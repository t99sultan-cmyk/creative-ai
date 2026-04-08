"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles, ArrowRight, Gift, Key, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [promo, setPromo] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [promoMessage, setPromoMessage] = useState<{type: "error" | "success" | "", text: string}>({type: "", text: ""});

  const handleCheckPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promo.trim()) return;
    
    setIsChecking(true);
    setPromoMessage({type: "", text: ""});
    
    // Simulate promo code checking
    setTimeout(() => {
      setIsChecking(false);
      if (promo.toLowerCase() === "target100" || promo.toLowerCase() === "kazakhstan") {
        setPromoMessage({
          type: "success", 
          text: "Промокод активирован! Вы получите безлимитный доступ к креативам."
        });
      } else {
        setPromoMessage({
          type: "error", 
          text: "Неверный или недействительный промокод."
        });
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-hermes-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center justify-center gap-2 mb-6 cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-hermes-500 flex items-center justify-center shadow-lg shadow-hermes-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-2xl tracking-tight text-neutral-900 pointer-events-auto">Creative AI Ads</span>
        </Link>
        <h2 className="text-3xl font-extrabold text-neutral-900">
          Доступ в систему
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          Студия для арбитражников и бизнеса
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-10 px-6 sm:px-10 shadow-xl shadow-neutral-200/50 rounded-3xl border border-neutral-100 flex flex-col md:flex-row gap-8">
          
          {/* Main Action Demo */}
          <div className="flex-1 flex flex-col justify-center text-center">
             <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-hermes-50 flex items-center justify-center border border-hermes-100">
                   <Key className="w-6 h-6 text-hermes-500" />
                </div>
             </div>
             <p className="text-neutral-500 mb-6 text-sm leading-relaxed">
               Для старта генерации пароль пока не требуется. Нажмите на кнопку, чтобы войти и бесплатно сгенерировать первые 10 креативов.
             </p>
             <Link 
               href="/editor" 
               className="w-full flex items-center gap-2 justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-hermes-500/20 text-base font-bold text-white bg-hermes-500 hover:bg-hermes-600 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hermes-500 transition-all mb-4"
             >
               Войти в Редактор
               <ArrowRight className="w-5 h-5" />
             </Link>
          </div>

          <div className="w-px bg-neutral-100 hidden md:block"></div>
          
          {/* Promo Section */}
          <div className="flex-1 flex flex-col justify-center bg-neutral-50 p-6 rounded-2xl border border-neutral-100">
             <div className="flex items-center gap-2 mb-3">
               <Gift className="w-4 h-4 text-hermes-400" />
               <h3 className="font-bold text-[15px] text-neutral-800">Есть промокод?</h3>
             </div>
             <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
               Введите секретный промокод (напр. от партнера), чтобы разблокировать безлимитный пул креативов.
             </p>
             
             <form onSubmit={handleCheckPromo} className="space-y-3">
                <input
                  type="text"
                  placeholder="CODE2026"
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm font-bold uppercase tracking-widest focus:ring-2 focus:ring-hermes-500 focus:border-hermes-500 outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={!promo.trim() || isChecking}
                  className="w-full flex items-center justify-center py-2.5 bg-neutral-900 border border-transparent rounded-xl text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Активировать"}
                </button>
             </form>

             {promoMessage.text && (
                <div className={`mt-3 text-xs font-bold p-3 rounded-xl border ${promoMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                   {promoMessage.text}
                </div>
             )}
          </div>
          
        </div>
        <div className="mt-6 flex justify-center">
            <Link href="/" className="text-sm font-medium text-neutral-400 hover:text-neutral-600">
              Вернуться на главную
            </Link>
        </div>
      </div>
    </div>
  );
}
