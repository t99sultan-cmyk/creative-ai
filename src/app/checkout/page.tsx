"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { Suspense } from "react";
import { PRICING_TIERS } from "@/lib/pricing";
import { KaspiPushButton } from "@/components/KaspiPushButton";
import { useAuth } from "@/lib/auth/AuthContext";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "Старт";
  const { isSignedIn } = useAuth();

  // Тариф — единственный источник правды для цены и импульсов.
  // searchParams.price/impulses из URL игнорируются (юзер мог их подделать).
  const tier = PRICING_TIERS.find((t) => t.name === plan && t.action === "buy");

  return (
    <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 selection:bg-hermes-200">
      <div className="max-w-xl w-full">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-neutral-500 hover:text-neutral-800 transition-colors text-sm font-bold"
          >
            <ArrowLeft className="w-4 h-4" /> Назад на главную
          </Link>
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl shadow-black/5 border border-neutral-100 overflow-hidden">
          <div className="bg-neutral-900 text-white p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Sparkles className="w-32 h-32" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black mb-2 relative z-10">
              Оформление подписки
            </h1>
            <p className="text-neutral-400 relative z-10">
              Автоматическое зачисление импульсов после оплаты через Kaspi
            </p>
          </div>

          <div className="p-8">
            {!tier ? (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-5 text-sm">
                Тариф «{plan}» не найден. Вернитесь на{" "}
                <Link href="/" className="font-bold underline">
                  главную
                </Link>{" "}
                и выберите тариф.
              </div>
            ) : !isSignedIn ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-6">
                  <div>
                    <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      Выбранный пакет
                    </p>
                    <h2 className="text-2xl font-extrabold text-hermes-600">{tier.name}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      Сумма к оплате
                    </p>
                    <h3 className="text-2xl font-black">
                      {tier.priceKzt.toLocaleString("ru-RU")} ₸
                    </h3>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm">
                  <p className="font-bold text-amber-900 mb-1">Нужно войти в аккаунт</p>
                  <p className="text-amber-800 leading-snug">
                    Чтобы оплата зачислилась на ваш баланс,{" "}
                    <Link
                      href={`/login?redirect=${encodeURIComponent(`/checkout?plan=${plan}`)}`}
                      className="font-bold underline"
                    >
                      войдите
                    </Link>{" "}
                    или{" "}
                    <Link
                      href={`/register?redirect=${encodeURIComponent(`/checkout?plan=${plan}`)}`}
                      className="font-bold underline"
                    >
                      зарегистрируйтесь
                    </Link>
                    .
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-neutral-100 pb-6 mb-6">
                  <div>
                    <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      Выбранный пакет
                    </p>
                    <h2 className="text-2xl font-extrabold text-hermes-600">{tier.name}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      Сумма к оплате
                    </p>
                    <h3 className="text-2xl font-black">
                      {tier.priceKzt.toLocaleString("ru-RU")} ₸
                    </h3>
                  </div>
                </div>

                <div className="bg-hermes-50 border border-hermes-100 rounded-2xl p-5 mb-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0 text-2xl">
                    ⚡
                  </div>
                  <div>
                    <p className="font-bold text-neutral-800">После оплаты вы получите</p>
                    <p className="text-hermes-600 font-extrabold text-lg">
                      {tier.impulses} Импульсов на баланс
                    </p>
                  </div>
                </div>

                <KaspiPushButton tier={tier} />

                <div className="bg-green-50 rounded-xl p-4 border border-green-100 flex gap-3 text-sm mt-5">
                  <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
                  <p className="text-green-800 leading-snug">
                    Введите номер Kaspi, мы пришлём push в приложение. После
                    подтверждения оплаты импульсы зачислятся на баланс автоматически
                    за 5–30 секунд — никаких чеков и менеджеров.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-hermes-500"></div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
