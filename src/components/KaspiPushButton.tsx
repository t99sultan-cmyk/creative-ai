"use client";

/**
 * Inline Kaspi push payment form for /checkout.
 *
 * Stages: phone → waiting → topup → failed.
 *   phone   — input для номера + кнопка "Выставить счёт"
 *   waiting — push отправлен, polling /api/kaspi/status каждые 3 сек
 *   topup   — успех, +N⚡, через 2.5 сек router.refresh()
 *   failed  — push не прошёл / истёк, кнопка "Попробовать ещё раз"
 *
 * Polling таймаут 10 минут — push в Kaspi живёт ~5-10 мин.
 *
 * После успеха firing trackKaspiPurchase с event_id="kaspi_<opId>" —
 * server-side CAPI fire в /api/kaspi/webhook использует тот же event_id,
 * Meta дедупит пару.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Receipt,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { trackKaspiPurchase } from "@/lib/fb-pixel";
import type { PricingTier } from "@/lib/pricing";

type Stage = "phone" | "waiting" | "topup" | "failed";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 минут — push в Kaspi живёт столько

export function KaspiPushButton({ tier }: { tier: PricingTier }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [balanceAfter, setBalanceAfter] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartedAt = useRef<number>(0);
  const purchaseTracked = useRef(false);

  function reset() {
    setStage("phone");
    setOperationId(null);
    setError(null);
    setReceiptUrl(null);
    purchaseTracked.current = false;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // Форматирование "700 000 00 00" → группы по 3-3-2-2 цифры,
  // префикс "+7" живёт отдельным элементом UI и не редактируется юзером.
  function formatPhoneInput(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    const parts = [
      digits.slice(0, 3),
      digits.slice(3, 6),
      digits.slice(6, 8),
      digits.slice(8, 10),
    ].filter(Boolean);
    return parts.join(" ");
  }

  async function submitInvoice(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setError("Введите 10 цифр номера (без +7)");
      return;
    }
    // Полный номер с кодом страны для бэка.
    const fullPhone = "7" + digits;
    setLoading(true);
    try {
      const res = await fetch("/api/kaspi/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierName: tier.name, phoneNumber: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Не удалось создать счёт. Попробуйте ещё раз.");
        return;
      }
      setOperationId(data.operationId);
      setStage("waiting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  // Polling статуса с момента входа в stage='waiting'.
  useEffect(() => {
    if (!operationId || stage !== "waiting") return;
    pollStartedAt.current = Date.now();

    pollRef.current = setInterval(async () => {
      // Тайм-аут: push в Kaspi живёт максимум 10 мин.
      if (Date.now() - pollStartedAt.current > POLL_TIMEOUT_MS) {
        setStage("failed");
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }

      try {
        const res = await fetch(`/api/kaspi/status?operationId=${operationId}`, {
          cache: "no-store",
        });
        if (!res.ok) return; // транзиентная ошибка, продолжаем
        const data = await res.json();

        if (data.status === "topup") {
          setReceiptUrl(data.receiptUrl ?? null);
          setBalanceAfter(typeof data.balanceAfter === "number" ? data.balanceAfter : null);
          setStage("topup");
          if (pollRef.current) clearInterval(pollRef.current);

          // Pixel-side Purchase для дедупа с CAPI (server-side fire
          // уже улетел из webhook'а с тем же event_id).
          if (!purchaseTracked.current) {
            purchaseTracked.current = true;
            trackKaspiPurchase({
              impulses: tier.impulses,
              operationId,
              amountKzt: tier.priceKzt,
              tierName: tier.name,
            });
          }

          // router.refresh пересчитает Server Components — баланс в шапке
          // обновится мгновенно, не нужно ждать переход. Юзер сам решает
          // куда дальше идти (в редактор или к истории платежей).
          router.refresh();
        } else if (data.status === "failed" || data.status === "expired") {
          setStage("failed");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // транзиентная сетевая ошибка — следующий тик повторит
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [operationId, stage, tier.impulses, tier.priceKzt, tier.name, router]);

  if (stage === "topup") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-3" />
        <h3 className="font-black text-2xl text-green-900 mb-1">Оплата прошла</h3>
        <p className="text-green-800 text-sm mb-4">
          +{tier.impulses} <Zap className="w-3.5 h-3.5 inline -mt-0.5 fill-green-700" /> зачислены на ваш баланс
        </p>
        {balanceAfter !== null && (
          <div className="inline-flex items-center gap-2 bg-white border border-green-200 rounded-xl px-4 py-2.5 mb-4">
            <Wallet className="w-4 h-4 text-green-700" />
            <span className="text-sm text-neutral-600 font-bold">Текущий баланс:</span>
            <span className="text-lg font-black text-green-900 tabular-nums">{balanceAfter}</span>
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-2">
          <Link
            href="/editor"
            className="inline-flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-lg shadow-neutral-900/20"
          >
            <Sparkles className="w-4 h-4" /> В редактор
          </Link>
          <Link
            href="/account"
            className="inline-flex items-center justify-center gap-2 bg-white border border-neutral-200 hover:border-neutral-300 active:scale-95 text-neutral-800 font-bold text-sm px-5 py-3 rounded-xl transition-all"
          >
            <Wallet className="w-4 h-4" /> Личный кабинет
          </Link>
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-green-700 mt-4 font-bold">
          <Receipt className="w-3.5 h-3.5" /> Чек придёт в приложение Kaspi
        </p>
      </div>
    );
  }

  if (stage === "waiting") {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#f14635]/10 rounded-2xl flex items-center justify-center shrink-0">
            <Smartphone className="w-7 h-7 text-[#f14635]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-lg text-neutral-900 mb-1">
              Push отправлен в Kaspi
            </h3>
            <p className="text-sm text-neutral-600">
              Откройте приложение Kaspi на телефоне <strong>+{phone.replace(/\D/g, "")}</strong>{" "}
              и подтвердите оплату {tier.priceKzt.toLocaleString("ru-RU")} ₸.
            </p>
          </div>
        </div>
        <div className="mt-5 inline-flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-bold">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Ждём подтверждения — баланс пополнится автоматически
        </div>
      </div>
    );
  }

  if (stage === "failed") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <AlertCircle className="w-14 h-14 text-red-600 mx-auto mb-3" />
        <h3 className="font-black text-lg text-red-900 mb-1">Push не прошёл или истёк</h3>
        <p className="text-sm text-red-700 mb-4">
          Push в Kaspi живёт 5–10 минут. Попробуйте ещё раз или переключитесь на оплату по
          ссылке/QR-коду.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 bg-[#f14635] hover:bg-red-600 active:scale-95 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all"
        >
          Попробовать ещё раз
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submitInvoice} className="bg-white border border-neutral-200 rounded-2xl p-5">
      <label htmlFor="kaspi-phone" className="block text-sm font-bold text-neutral-800 mb-2">
        Номер телефона в Kaspi
      </label>
      <div className="flex items-stretch rounded-xl border border-neutral-200 bg-neutral-50 focus-within:border-hermes-500 focus-within:bg-white transition-colors overflow-hidden">
        <span className="flex items-center px-4 text-base font-mono font-bold text-neutral-500 border-r border-neutral-200 bg-neutral-100 select-none">
          +7
        </span>
        <input
          id="kaspi-phone"
          type="tel"
          value={formatPhoneInput(phone)}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="700 000 00 00"
          inputMode="tel"
          autoComplete="tel"
          autoFocus
          disabled={loading}
          className="flex-1 bg-transparent px-4 py-3.5 text-base font-mono outline-none disabled:opacity-60"
        />
      </div>
      <p className="text-xs text-neutral-500 mt-2">
        Номер, привязанный к вашему приложению Kaspi. На него придёт push для подтверждения
        оплаты {tier.priceKzt.toLocaleString("ru-RU")} ₸.
      </p>
      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm font-bold">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full inline-flex items-center justify-between px-6 py-3.5 bg-[#f14635] hover:bg-red-600 active:scale-95 disabled:opacity-60 disabled:cursor-wait text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all"
      >
        <span className="inline-flex items-center gap-2">
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Создаём счёт…
            </>
          ) : (
            <>
              <Smartphone className="w-5 h-5" />
              Выставить счёт на Kaspi push
            </>
          )}
        </span>
        {!loading && <ChevronRight className="w-5 h-5 opacity-60" />}
      </button>
    </form>
  );
}
