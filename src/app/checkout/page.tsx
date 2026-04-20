"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles, CheckCircle2, ArrowLeft, Send, Receipt, CreditCard, ChevronRight } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Suspense } from "react";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "Старт";
  const price = searchParams.get("price") || "1 990";
  const impulses = searchParams.get("impulses") || "45";
  const { isSignedIn } = useAuth();
  
  // Replace these with real links once the user provides them
  const KASPI_PAY_LINK = "https://pay.kaspi.kz/pay/7esn3yim"; 
  const WHATSAPP_LINK = "https://wa.me/77770000000?text=Здравствуйте!%20Я%20оплатил%20пакет%20" + plan + " в AICreative.kz.%20Моя%20квитанция:";

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
                  <div>
                    <p className="font-bold text-neutral-800">Переведите сумму через Kaspi</p>
                    <p className="text-sm text-neutral-500 mt-1 mb-3">Нажмите на кнопку ниже, чтобы перейти в приложение Kaspi и сделать перевод по нашему номеру телефона.</p>
                    <a href={KASPI_PAY_LINK} target="_blank" rel="noreferrer" className="inline-flex items-center justify-between px-6 py-3 bg-[#f14635] text-white font-bold rounded-xl active:scale-95 transition-transform shadow-lg shadow-red-500/20 w-full sm:w-auto">
                       <span className="flex items-center gap-2"><CreditCard className="w-5 h-5"/> Оплатить на Kaspi</span>
                       <ChevronRight className="w-5 h-5 opacity-50" />
                    </a>
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
                  <div>
                    <p className="font-bold text-neutral-800">Отправьте скриншот менеджеру</p>
                    <p className="text-sm text-neutral-500 mt-1 mb-3">Менеджер проверит платеж и моментально пришлет вам промокод на {impulses} Импульсов.</p>
                    <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" className="inline-flex items-center justify-between px-6 py-3 bg-[#25D366] text-white font-bold rounded-xl active:scale-95 transition-transform shadow-lg shadow-green-500/20 w-full sm:w-auto">
                       <span className="flex items-center gap-2"><Send className="w-5 h-5"/> Отправить в WhatsApp</span>
                       <ChevronRight className="w-5 h-5 opacity-50" />
                    </a>
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
