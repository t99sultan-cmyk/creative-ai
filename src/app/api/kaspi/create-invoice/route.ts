/**
 * POST /api/kaspi/create-invoice
 *
 * Выставляет счёт через микросервис kaspi-pos-automation и записывает
 * pending-транзакцию в БД. Микросервис общий с VoiceSpace — на стороне
 * Kaspi-кассы выручка идёт одним юр.лицом, разделение по проектам — по
 * полю `comment` (см. ниже).
 *
 * Тариф валидируется на сервере по PRICING_TIERS — клиентские price/impulses
 * игнорируются (юзер мог поправить ?plan=Бизнес в URL).
 */
import { auth, currentUser } from "@/lib/auth/clerk-compat";
import { db } from "@/db";
import { billingTransactions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PRICING_TIERS, SIGNUP_BONUS_IMPULSES } from "@/lib/pricing";
import { notifyAdmin, fmt } from "@/lib/admin-notify";

export const runtime = "nodejs";

const KASPI_URL = process.env.KASPI_PAY_URL ?? "";
const KASPI_TOKEN_SN = process.env.KASPI_TOKEN_SN ?? "";
const KASPI_PROFILE_ID = process.env.KASPI_PROFILE_ID ?? "";
const KASPI_VTOKEN_SECRET = process.env.KASPI_VTOKEN_SECRET ?? "";

export async function POST(request: Request) {
  if (!KASPI_URL || !KASPI_TOKEN_SN || !KASPI_VTOKEN_SECRET) {
    return Response.json(
      { error: "Kaspi не настроен на сервере. Обратитесь в поддержку." },
      { status: 500 },
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { tierName?: string; phoneNumber?: string };
  const tier = PRICING_TIERS.find((t) => t.name === body.tierName && t.action === "buy");
  if (!tier) {
    return Response.json({ error: "tier_not_found" }, { status: 400 });
  }

  const rawPhone = (body.phoneNumber ?? "").replace(/\D/g, "");
  const phoneNumber = rawPhone.startsWith("8") ? "7" + rawPhone.slice(1) : rawPhone;
  if (phoneNumber.length !== 11 || !phoneNumber.startsWith("7")) {
    return Response.json(
      { error: "Укажите корректный номер Kaspi (+7XXXXXXXXXX)" },
      { status: 400 },
    );
  }

  // Ленивое создание user-row — тот же паттерн что в redeemPromoCode.
  // Юзер может не иметь записи в БД, если ещё не делал ни одного действия,
  // которое её создаёт (генерация, активация промокода).
  const existingUser = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!existingUser) {
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses[0]?.emailAddress || "unknown";
    await db.insert(users).values({
      id: userId,
      email,
      name: clerkUser?.firstName || "User",
      image: clerkUser?.imageUrl || "",
      impulses: SIGNUP_BONUS_IMPULSES,
    });
  }

  // Префикс "AICreative.kz" в комментарии нужен, чтобы в Kaspi-выписке
  // юр.лица можно было отделить выручку iCreative от VoiceSpace.
  const kaspiRes = await fetch(`${KASPI_URL}/api/invoice/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Token-SN": KASPI_TOKEN_SN,
      "X-Profile-Id": KASPI_PROFILE_ID,
      "X-Vtoken-Secret": KASPI_VTOKEN_SECRET,
    },
    body: JSON.stringify({
      phoneNumber,
      amount: tier.priceKzt,
      comment: `AICreative.kz · ${tier.name} · ${tier.impulses} импульсов`,
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch((e: unknown) => {
    console.error("[kaspi.create-invoice] fetch failed:", e);
    return null;
  });

  if (!kaspiRes) {
    return Response.json({ error: "Сервис Kaspi недоступен. Попробуйте позже." }, { status: 502 });
  }

  if (!kaspiRes.ok) {
    const txt = await kaspiRes.text().catch(() => "");
    console.error(`[kaspi.create-invoice] Kaspi HTTP ${kaspiRes.status}:`, txt.slice(0, 500));
    return Response.json(
      { error: `Kaspi ошибка: ${kaspiRes.status}`, details: txt.slice(0, 200) },
      { status: 502 },
    );
  }

  const kaspiData = (await kaspiRes.json().catch(() => ({}))) as {
    Data?: {
      Id?: string | number;
      QrOperationId?: string | number;
      Status?: string;
    };
    StatusCode?: string;
    error?: string;
  };

  // Kaspi возвращает либо Id (старый формат), либо QrOperationId (новый).
  const operationIdRaw = kaspiData.Data?.Id ?? kaspiData.Data?.QrOperationId;
  const operationId = operationIdRaw != null ? String(operationIdRaw) : null;
  if (!operationId) {
    console.error("[kaspi.create-invoice] no operationId in Kaspi response:", kaspiData);
    return Response.json(
      { error: "Не удалось создать счёт в Kaspi", raw: kaspiData },
      { status: 502 },
    );
  }

  // Записываем pending. onConflictDoNothing без target — на случай
  // двойного клика. PostgreSQL не позволяет ссылаться на partial unique
  // index в ON CONFLICT (target), поэтому используем bare-form: любой
  // конфликт молча игнорируется.
  try {
    await db
      .insert(billingTransactions)
      .values({
        userId,
        type: "pending",
        impulses: tier.impulses,
        amountKzt: tier.priceKzt,
        tierName: tier.name,
        externalId: operationId,
        phoneNumber: `+${phoneNumber}`,
        description: `Kaspi pending: ${tier.name}, счёт ${operationId}, телефон +${phoneNumber}`,
      })
      .onConflictDoNothing();
  } catch (e) {
    console.error("[kaspi.create-invoice] insert pending tx failed:", e);
    // Не валим запрос — счёт в Kaspi уже выставлен, webhook должен
    // прийти и найти operationId (если другой инстанс успел его записать).
  }

  // Best-effort Telegram-пинг — менеджеру полезно видеть воронку
  // "сколько push-ей отправили vs оплатили".
  notifyAdmin(
    `🧾 *Kaspi push отправлен*\n\n` +
      `*Тариф:* ${fmt.esc(tier.name)} (${tier.priceKzt.toLocaleString("ru-RU")} ₸)\n` +
      `*Импульсы:* +${tier.impulses} ⚡\n` +
      `*Телефон:* +${fmt.esc(phoneNumber)}\n` +
      `*Юзер:* ${fmt.esc(existingUser?.email ?? userId)}\n` +
      `*Operation ID:* \`${fmt.esc(operationId)}\``,
  ).catch(() => {});

  return Response.json({
    ok: true,
    operationId,
    phoneNumber: `+${phoneNumber}`,
    amountKzt: tier.priceKzt,
    impulses: tier.impulses,
    tierName: tier.name,
  });
}
