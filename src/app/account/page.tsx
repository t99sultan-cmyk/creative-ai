"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Zap,
  ArrowLeft,
  CreditCard,
  Gift,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Receipt,
  Film,
  Image as ImageIcon,
} from "lucide-react";
import { getAccountData } from "@/actions/getAccountData";
import { redeemPromoCode } from "@/actions/redeemPromoCode";
import { trackPurchase } from "@/lib/fb-pixel";

type AccountData = Awaited<ReturnType<typeof getAccountData>>;

export default function AccountPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);

  // Promo code form
  const [promoCode, setPromoCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Redirect unauthed users to Clerk sign-in flow (editor does the same).
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/");
    }
  }, [isLoaded, isSignedIn, router]);

  const loadData = async () => {
    setLoading(true);
    const res = await getAccountData();
    setData(res);
    setLoading(false);
  };

  useEffect(() => {
    if (isSignedIn) loadData();
  }, [isSignedIn]);

  const handleRedeem = async () => {
    const code = promoCode.trim();
    if (!code) return;
    setRedeeming(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const res = await redeemPromoCode(code);
    if (res.success) {
      setSuccessMsg(`✅ Промокод активирован! +${res.impulsesAdded} импульсов.`);
      setPromoCode("");
      // Meta Pixel: this is the actual conversion — user has paid (Kaspi),
      // received a code, and we just credited their balance. The value is
      // back-computed from impulses using the same pricing table the
      // landing uses, so campaign ROAS reports line up with admin revenue.
      if (res.impulsesAdded) {
        trackPurchase({ impulses: res.impulsesAdded, code });
      }
      // Refresh balance + history
      await loadData();
    } else {
      setErrorMsg(res.error || "Не удалось активировать промокод.");
    }
    setRedeeming(false);
  };

  if (!isLoaded || loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="w-8 h-8 animate-spin text-hermes-500" />
      </div>
    );
  }

  if (!data.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl max-w-md">
          {data.error ?? "Не удалось загрузить кабинет"}
        </div>
      </div>
    );
  }

  const { balance, profile, promoHistory, generationStats } = data;

  return (
    <main className="min-h-screen bg-neutral-50 selection:bg-hermes-200">
      {/* Top bar */}
      <header className="bg-white border-b border-neutral-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="/editor"
            className="inline-flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors font-bold text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> В редактор
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-bold text-neutral-500 hover:text-neutral-800 uppercase tracking-wider hidden sm:inline"
            >
              Главная
            </Link>
            {/* Note: `afterSignOutUrl` was removed from UserButton props in
                recent @clerk/nextjs versions. Sign-out redirect is now
                configured at the Clerk app level or via CLERK_SIGN_OUT_URL. */}
            <UserButton />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Banner with balance */}
        <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 rounded-3xl p-8 sm:p-10 text-white relative overflow-hidden shadow-xl">
          <div className="absolute -top-20 -right-20 opacity-10">
            <Sparkles className="w-64 h-64" />
          </div>

          <div className="relative z-10">
            <p className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-2">
              Привет, {profile.name || profile.email?.split("@")[0] || "Creator"} 👋
            </p>
            <h1 className="text-2xl sm:text-3xl font-black mb-6">Личный кабинет</h1>

            <div className="bg-white/5 border border-white/10 backdrop-blur rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-1">
                  Ваш баланс
                </p>
                <div className="flex items-center gap-2">
                  <Zap className="w-8 h-8 text-amber-400 fill-amber-400" />
                  <span className="text-4xl sm:text-5xl font-black tabular-nums">{balance}</span>
                  <span className="text-lg font-semibold text-neutral-400 ml-1">импульсов</span>
                </div>
              </div>

              <Link
                href="/#pricing"
                className="inline-flex items-center justify-center gap-2 bg-[#f14635] hover:bg-red-600 active:scale-95 px-6 py-3 rounded-xl font-bold text-white shadow-lg shadow-red-500/20 transition-all"
              >
                <CreditCard className="w-5 h-5" /> Купить импульсы
              </Link>
            </div>
          </div>
        </section>

        {/* Promo redemption — the main thing this page is for */}
        <section className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-neutral-100 bg-gradient-to-r from-hermes-50 to-amber-50/40">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0">
                <Gift className="w-6 h-6 text-hermes-600" />
              </div>
              <div>
                <h2 className="text-xl font-black mb-1">Активировать промокод</h2>
                <p className="text-sm text-neutral-600 max-w-xl">
                  Получили промокод от менеджера после оплаты Kaspi? Введите его ниже —
                  импульсы мгновенно добавятся на ваш баланс.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">
              Код промокода
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value.toUpperCase());
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !redeeming && promoCode.trim()) handleRedeem();
                }}
                placeholder="PROMO-XXX-YYYY-ZZZZ"
                className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-base font-mono uppercase tracking-wider outline-none focus:border-hermes-500 focus:bg-white transition-colors"
                disabled={redeeming}
                autoFocus
              />
              <button
                onClick={handleRedeem}
                disabled={redeeming || !promoCode.trim()}
                className="bg-hermes-600 hover:bg-hermes-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 min-w-[140px]"
              >
                {redeeming ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Активация…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" /> Активировать
                  </>
                )}
              </button>
            </div>

            {successMsg && (
              <div className="mt-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {errorMsg}
              </div>
            )}

            <p className="mt-4 text-xs text-neutral-500">
              Нет промокода?{" "}
              <Link href="/#pricing" className="font-bold text-hermes-600 hover:underline">
                Выберите пакет и оплатите Kaspi
              </Link>{" "}
              — промокод придёт в WhatsApp от менеджера.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-neutral-100 p-5">
            <div className="flex items-center gap-2 text-neutral-500 text-xs font-bold uppercase tracking-wider mb-2">
              <ImageIcon className="w-4 h-4" /> Всего креативов
            </div>
            <p className="text-3xl font-black">{generationStats.total}</p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 p-5">
            <div className="flex items-center gap-2 text-neutral-500 text-xs font-bold uppercase tracking-wider mb-2">
              <Film className="w-4 h-4" /> Анимированных
            </div>
            <p className="text-3xl font-black">{generationStats.animated}</p>
          </div>
        </section>

        {/* Promo history */}
        <section className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-neutral-100 flex items-center gap-3">
            <Receipt className="w-5 h-5 text-neutral-400" />
            <h2 className="text-lg font-black">История пополнений</h2>
            <span className="text-sm text-neutral-400 font-mono">({promoHistory.length})</span>
          </div>

          {promoHistory.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">
              <p className="text-sm">Пока пусто. Промокоды, которые вы активируете, появятся здесь.</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {promoHistory.map((p) => (
                <li key={p.code} className="px-6 sm:px-8 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold text-neutral-800 truncate">{p.code}</p>
                    <p className="text-xs text-neutral-500">
                      {p.usedAt
                        ? new Date(p.usedAt).toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-hermes-50 text-hermes-700 px-3 py-1.5 rounded-lg font-extrabold shrink-0">
                    +{p.impulses} <Zap className="w-4 h-4" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Back to editor CTA */}
        <div className="pt-4 pb-12 flex justify-center">
          <Link
            href="/editor"
            className="inline-flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white font-bold px-6 py-3 rounded-xl transition-all"
          >
            <Sparkles className="w-5 h-5" /> Вернуться в редактор
          </Link>
        </div>
      </div>
    </main>
  );
}
