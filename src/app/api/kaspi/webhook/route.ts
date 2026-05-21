/**
 * POST /api/kaspi/webhook
 *
 * Принимает callback от микросервиса kaspi-pos-automation. Самый
 * ответственный endpoint в Kaspi-флоу: здесь происходит зачисление
 * импульсов на баланс юзера.
 *
 * Защита: HMAC-SHA256 от raw body с секретом KASPI_WEBHOOK_SECRET,
 * заголовок X-Webhook-Signature формата "sha256=<hex>". Без валидной
 * подписи отвечаем 401.
 *
 * Идемпотентность: микросервис ретраит callback до получения 200.
 * Двухшаговый claim защищает от двойного начисления при гонке.
 *
 * Возвращаем 200 всегда (кроме 401 на bad signature) — иначе микросервис
 * будет ретраить и спамить.
 */
import crypto from "node:crypto";
import { db } from "@/db";
import { billingTransactions, users, adminAuditLog } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { sendCapiEvent } from "@/lib/fb-capi";
import { notifyAdmin, fmt } from "@/lib/admin-notify";

export const runtime = "nodejs";

type KaspiWebhookPayload = {
  event: "payment.success" | "payment.failed" | "payment.expired" | "session.expired";
  // Микросервис может слать operationId в любом из этих имён — поддерживаем все.
  paymentId?: string;
  operationId?: string;
  qrOperationId?: string;
  id?: string;
  type?: "qr" | "invoice";
  status?: string;
  statusDesc?: string;
  amount?: number;
  receiptUrl?: string;
  orderNumber?: string;
};

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (signature.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const secret = process.env.KASPI_WEBHOOK_SECRET;
  const rawBody = await request.text();

  if (secret) {
    const sig =
      request.headers.get("x-webhook-signature") ??
      request.headers.get("x-signature") ??
      null;
    if (!verifySignature(rawBody, sig, secret)) {
      console.warn("[kaspi.webhook] invalid signature");
      return Response.json({ error: "invalid_signature" }, { status: 401 });
    }
  } else {
    console.warn("[kaspi.webhook] KASPI_WEBHOOK_SECRET not set — skipping signature check");
  }

  let payload: KaspiWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  // Логируем сырой payload первое время, чтобы поймать формат поля
  // operationId от микросервиса (paymentId / id / qrOperationId).
  console.log("[kaspi.webhook] payload:", JSON.stringify(payload).slice(0, 500));

  const operationId =
    payload.paymentId ?? payload.operationId ?? payload.qrOperationId ?? payload.id ?? null;
  if (!payload.event || !operationId) {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }

  const pendingRows = await db
    .select({
      id: billingTransactions.id,
      userId: billingTransactions.userId,
      impulses: billingTransactions.impulses,
      amountKzt: billingTransactions.amountKzt,
      tierName: billingTransactions.tierName,
      type: billingTransactions.type,
    })
    .from(billingTransactions)
    .where(eq(billingTransactions.externalId, operationId))
    .orderBy(desc(billingTransactions.createdAt))
    .limit(1);

  const pending = pendingRows[0];

  if (!pending) {
    // Чужой платёж (например, для VoiceSpace, если микросервис шлёт нам
    // всё подряд). Безопасно игнорим.
    return Response.json({ ok: true, ignored: "no_pending_tx" });
  }

  if (pending.type !== "pending") {
    return Response.json({ ok: true, ignored: "already_processed", was: pending.type });
  }

  if (payload.event === "payment.success") {
    // Шаг 1: claim. UPDATE проходит ТОЛЬКО если type='pending'.
    // Двух параллельных ретраев — один выиграет, второй увидит 0 строк.
    const claimed = await db
      .update(billingTransactions)
      .set({ type: "topup_in_progress", updatedAt: new Date() })
      .where(
        and(eq(billingTransactions.id, pending.id), eq(billingTransactions.type, "pending")),
      )
      .returning({ id: billingTransactions.id });

    if (claimed.length === 0) {
      return Response.json({ ok: true, ignored: "race_lost" });
    }

    // Шаг 2: атомарное начисление на баланс. SQL-выражение, не read+write,
    // поэтому не теряется при interleave с другими mutation'ами баланса.
    const updatedUser = await db
      .update(users)
      .set({ impulses: sql`COALESCE(${users.impulses}, 0) + ${pending.impulses}` })
      .where(eq(users.id, pending.userId))
      .returning({ impulses: users.impulses, email: users.email, name: users.name });

    const newBalance = updatedUser[0]?.impulses ?? null;
    const userEmail = updatedUser[0]?.email ?? null;

    // Шаг 3: финализируем строку транзакции.
    await db
      .update(billingTransactions)
      .set({
        type: "topup",
        balanceAfter: newBalance,
        receiptUrl: payload.receiptUrl ?? null,
        description:
          `Оплачено через Kaspi (${payload.amount ?? pending.amountKzt} ₸)` +
          (payload.receiptUrl ? `, чек: ${payload.receiptUrl}` : ""),
        updatedAt: new Date(),
      })
      .where(eq(billingTransactions.id, pending.id));

    // Side effects — все fire-and-forget. CAPI / Telegram / audit не должны
    // ломать ответ микросервису, иначе он зациклится в ретраях.

    // Meta CAPI Purchase. event_id = "kaspi_<opId>" — точно такой же
    // отправит фронтенд через trackKaspiPurchase для дедупа.
    sendCapiEvent({
      eventName: "Purchase",
      eventId: `kaspi_${operationId}`,
      user: {
        email: userEmail ?? undefined,
        externalId: pending.userId,
      },
      customData: {
        value: pending.amountKzt,
        currency: "KZT",
        content_name: `Тариф ${pending.tierName}`,
        content_ids: [pending.tierName],
        content_category: "kaspi_push_payment",
        num_items: 1,
      },
    }).catch((e) => console.error("[kaspi.webhook] CAPI failed:", e));

    // Запись в admin_audit_log напрямую — у вебхука нет сессии админа,
    // поэтому helper recordAdminAction не подходит.
    db.insert(adminAuditLog)
      .values({
        adminId: "system:kaspi-webhook",
        adminEmail: "kaspi-webhook@aicreative.kz",
        action: "kaspi_payment",
        targetType: "user",
        targetId: pending.userId,
        meta: {
          operationId,
          tierName: pending.tierName,
          amountKzt: pending.amountKzt,
          impulses: pending.impulses,
          balanceAfter: newBalance,
          receiptUrl: payload.receiptUrl ?? null,
          event: payload.event,
        } as Record<string, unknown>,
      })
      .catch((e) => console.error("[kaspi.webhook] audit_log failed:", e));

    // Считаем сколько успешных Kaspi-платежей у юзера — для пометки
    // "первый в жизни" в Telegram.
    (async () => {
      try {
        const countRows = await db
          .select({ c: sql<number>`count(*)::int` })
          .from(billingTransactions)
          .where(
            and(
              eq(billingTransactions.userId, pending.userId),
              eq(billingTransactions.type, "topup"),
            ),
          );
        const totalSuccessful = countRows[0]?.c ?? 0;
        const isFirst = totalSuccessful === 1;
        await notifyAdmin(
          `${isFirst ? "🆕💰 *ПЕРВЫЙ KASPI-ПЛАТЁЖ ЮЗЕРА*" : "💰 *KASPI оплачен*"}\n\n` +
            `*Тариф:* ${fmt.esc(pending.tierName)} (${pending.amountKzt.toLocaleString("ru-RU")} ₸)\n` +
            `*Email:* ${fmt.esc(userEmail ?? pending.userId)}\n` +
            (updatedUser[0]?.name ? `*Имя:* ${fmt.esc(updatedUser[0].name)}\n` : "") +
            `*Начислено:* +${pending.impulses} ⚡\n` +
            `*Новый баланс:* ${newBalance ?? "?"} ⚡\n` +
            (payload.receiptUrl ? `*Чек:* ${payload.receiptUrl}\n` : "") +
            `*Operation ID:* \`${fmt.esc(operationId)}\`\n` +
            `*Всего платежей у юзера:* ${totalSuccessful}` +
            (isFirst ? `\n\n🎉 _Первый платёж — закрепи отношения._` : ""),
        );
      } catch (e) {
        console.error("[kaspi.webhook] notifyAdmin failed:", e);
      }
    })();

    return Response.json({ ok: true, processed: "success", newBalance });
  }

  if (payload.event === "payment.failed" || payload.event === "payment.expired") {
    await db
      .update(billingTransactions)
      .set({
        type: payload.event === "payment.failed" ? "failed" : "expired",
        description: `Оплата не прошла: ${payload.statusDesc ?? payload.event}`,
        updatedAt: new Date(),
      })
      .where(eq(billingTransactions.id, pending.id));

    notifyAdmin(
      `❌ *Kaspi платёж не прошёл* — ${payload.event === "payment.expired" ? "истёк" : "ошибка"}\n\n` +
        `*Тариф:* ${fmt.esc(pending.tierName)} (${pending.amountKzt.toLocaleString("ru-RU")} ₸)\n` +
        `*Operation ID:* \`${fmt.esc(operationId)}\`\n` +
        `*Причина:* ${fmt.esc(payload.statusDesc ?? payload.event)}`,
    ).catch(() => {});

    return Response.json({ ok: true, processed: payload.event });
  }

  return Response.json({ ok: true, ignored: payload.event });
}
