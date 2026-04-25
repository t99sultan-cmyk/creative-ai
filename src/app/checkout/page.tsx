"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles, CheckCircle2, ArrowLeft, Send, Receipt, CreditCard, ChevronRight, MessageCircle, QrCode, Link2 } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Suspense, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { notifyPaymentIntent } from "@/actions/notifyPaymentIntent";
import { SUPPORT_CONTACTS } from "@/lib/constants";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "Старт";
  const price = searchParams.get("price") || "1 990";
  const impulses = searchParams.get("impulses") || "45";
  const { isSignedIn } = useAuth();

  // Two payment entry points: tap-through deep-link for visitors on phone
  // (opens Kaspi native), and a QR rendered inline for visitors on desktop
  // who scan it with their phone. "link" is the default because ~70% of
  // traffic is mobile.
  const [payMethod, setPayMethod] = useState<"link" | "qr">("link");
  const [intentPinged, setIntentPinged] = useState(false);

  /** Best-effort signal to admin Telegram when the user starts the
   *  payment flow. Once per session (state guard). */
  function pingPaymentIntent(method: "link" | "qr") {
    if (intentPinged) return;
    setIntentPinged(true);
    const priceKzt = parseInt(price.replace(/\s/g, ""), 10) || 0;
    notifyPaymentIntent({ tier: plan, priceKzt, method }).catch(() => {});
  }

  // Contact channels for the "send receipt" step. User chooses WhatsApp or
  // Telegram on step 3 depending on preference.
  const KASPI_PAY_LINK = "https://pay.kaspi.kz/pay/0p9drfes";
  const { WA_NUMBER_E164, TG_USERNAME } = SUPPORT_CONTACTS;
  const MESSAGE_TEXT = `Здравствуйте! Я оплатил пакет "${plan}" в AICreative.kz. Моя квитанция:`;
  const ENCODED_MSG = encodeURIComponent(MESSAGE_TEXT);
  const WHATSAPP_LINK = `https://wa.me/${WA_NUMBER_E164}?text=${ENCODED_MSG}`;
  const TELEGRAM_LINK = `https://t.me/${TG_USERNAME}?text=${ENCODED_MSG}`;

  return (
    <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 selection:bg-hermes-200">
      <div className="max-w-xl w-full">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-neutral-800 transition-colors text-sm font-bold">
            <ArrowLeft className="w-4 h-4" /> Назад на главную
          </Link>
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl shadow-black/5 border border-neutral-100 overflow-hidden">
          
          <div className="bg-neutral-900 text-white p-8 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-10">
               <Sparkles className="w-32 h-32" />
             </div>
             <h1 className="text-2xl md:text-3xl font-black mb-2 relative z-10">Оформление подписки</h1>
             <p className="text-neutral-400 relative z-10">Временная механика оплаты (до 26 апреля)</p>
          </div>

          <div className="p-8">
             <div className="flex items-center justify-between border-b border-neutral-100 pb-6 mb-6">
                <div>
                  <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-1">Выбранный пакет</p>
                  <h2 className="text-2xl font-extrabold text-hermes-600">{plan}</h2>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-1">Сумма к оплате</p>
                  <h3 className="text-2xl font-black">{price} ₸</h3>
                </div>
             </div>

             <div className="bg-hermes-50 border border-hermes-100 rounded-2xl p-5 mb-8 flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0 text-2xl">⚡</div>
                <div>
                   <p className="font-bold text-neutral-800">После оплаты вы получите</p>
                   <p className="text-hermes-600 font-extrabold text-lg">{impulses} Импульсов на баланс</p>
                </div>
             </div>

             <h4 className="font-bold text-lg mb-4 flex items-center gap-2">Инструкция по оплате</h4>
             
             <div className="space-y-4 mb-8">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center font-black text-sm shrink-0">1</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-neutral-800">Переведите сумму через Kaspi</p>
                    <p className="text-sm text-neutral-500 mt-1 mb-3">Откройте Kaspi-ссылку с телефона или отсканируйте QR-код через камеру — откроется приложение Kaspi с уже заполненным переводом.</p>

                    {/* Mode toggle: link (for mobile visitors tapping from
                        their phone) vs QR (for desktop visitors who scan
                        with phone). Rendered as a segmented control so it
                        stays compact and doesn't look like a CTA itself. */}
                    <div role="tablist" aria-label="Способ оплаты" className="inline-flex bg-neutral-100 p-1 rounded-xl mb-4">
                       <button
                         role="tab"
                         aria-selected={payMethod === "link"}
                         onClick={() => setPayMethod("link")}
                         className={`px-4 py-2 text-sm font-bold rounded-lg inline-flex items-center gap-2 transition-colors ${
                           payMethod === "link"
                             ? "bg-white shadow-sm text-neutral-900"
                             : "text-neutral-500 hover:text-neutral-800"
                         }`}
                       >
                         <Link2 className="w-4 h-4" /> По ссылке
                       </button>
                       <button
                         role="tab"
                         aria-selected={payMethod === "qr"}
                         onClick={() => { setPayMethod("qr"); pingPaymentIntent("qr"); }}
                         className={`px-4 py-2 text-sm font-bold rounded-lg inline-flex items-center gap-2 transition-colors ${
                           payMethod === "qr"
                             ? "bg-white shadow-sm text-neutral-900"
                             : "text-neutral-500 hover:text-neutral-800"
                         }`}
                       >
                         <QrCode className="w-4 h-4" /> По QR-коду
                       </button>
                    </div>

                    {payMethod === "link" ? (
                      <a
                        href={KASPI_PAY_LINK}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => pingPaymentIntent("link")}
                        className="inline-flex items-center justify-between px-6 py-3 bg-[#f14635] text-white font-bold rounded-xl active:scale-95 transition-transform shadow-lg shadow-red-500/20 w-full sm:w-auto"
                      >
                        <span className="flex items-center gap-2"><CreditCard className="w-5 h-5"/> Оплатить на Kaspi</span>
                        <ChevronRight className="w-5 h-5 opacity-50" />
                      </a>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 w-full sm:w-auto">
                        {/* SVG render so the code stays crisp at every
                            zoom level and doesn't eat extra paint cycles
                            like a rasterized canvas would on re-render. */}
                        <div className="bg-white p-2 rounded-lg border border-neutral-100 shrink-0 self-center">
                          <QRCodeSVG
                            value={KASPI_PAY_LINK}
                            size={180}
                            level="M"
                            marginSize={0}
                            bgColor="#ffffff"
                            fgColor="#0f172a"
                          />
                        </div>
                        <div className="text-sm text-neutral-600 leading-snug">
                          <p className="font-bold text-neutral-900 mb-1">Отсканируйте с телефона</p>
                          <p>Откройте камеру на смартфоне и наведите на код — откроется приложение Kaspi с уже заполненным переводом.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center font-black text-sm shrink-0">2</div>
                  <div>
                    <p className="font-bold text-neutral-800">Сохраните квитанцию</p>
                    <p className="text-sm text-neutral-500 mt-1">Обязательно сохраните чек (скриншот) об успешном переводе.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center font-black text-sm shrink-0">3</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-neutral-800">Отправьте скриншот менеджеру</p>
                    <p className="text-sm text-neutral-500 mt-1 mb-3">
                      Менеджер проверит платёж и <b>моментально пришлёт вам промокод на {impulses} Импульсов</b>.
                      Выберите удобный мессенджер:
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <a
                        href={WHATSAPP_LINK}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-between px-5 py-3 bg-[#25D366] hover:bg-[#1dbf58] text-white font-bold rounded-xl active:scale-[0.97] transition-all shadow-lg shadow-green-500/20"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Send className="w-5 h-5 shrink-0" />
                          <span className="truncate">WhatsApp</span>
                        </span>
                        <ChevronRight className="w-5 h-5 opacity-60 shrink-0" />
                      </a>
                      <a
                        href={TELEGRAM_LINK}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-between px-5 py-3 bg-[#2AABEE] hover:bg-[#1e95d5] text-white font-bold rounded-xl active:scale-[0.97] transition-all shadow-lg shadow-sky-500/20"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <MessageCircle className="w-5 h-5 shrink-0" />
                          <span className="truncate">Telegram</span>
                        </span>
                        <ChevronRight className="w-5 h-5 opacity-60 shrink-0" />
                      </a>
                    </div>
                    <div className="mt-2 text-xs text-neutral-400">
                      WhatsApp: <span className="font-mono">+7 776 528 27 88</span> · Telegram: <span className="font-mono">@{TG_USERNAME}</span>
                    </div>
                  </div>
                </div>
             </div>

             <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100 flex gap-3 text-sm">
               <Receipt className="w-5 h-5 text-neutral-400 shrink-0" />
               <p className="text-neutral-500 leading-snug">
                 Как только вы получите промокод от менеджера, перейдите в
                 {" "}
                 <Link href="/account" className="font-bold text-hermes-600 underline">
                   Личный кабинет
                 </Link>{" "}
                 и введите код в поле <b>«Активировать промокод»</b> — импульсы мгновенно
                 добавятся на баланс. Эта механика работает до внедрения 100% авто-платежей на сайте.
               </p>
             </div>

          </div>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-hermes-500"></div></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
