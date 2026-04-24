"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Sparkles, Phone, ArrowRight } from "lucide-react";
import { savePhone } from "@/actions/savePhone";

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Redirect signed-out users to /register. Must run inside an effect —
  // calling router.replace() during render causes a client-side render loop.
  useEffect(() => {
    if (isLoaded && !user) router.replace("/register");
  }, [isLoaded, user, router]);

  if (!isLoaded || !user) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await savePhone(phone);
      if (result.success) {
        router.push("/editor");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-900 relative overflow-hidden overscroll-none">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] bg-hermes-600/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-amber-500/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Header */}
      <div className="px-6 py-6 pt-12 md:pt-6 flex items-center justify-center z-10 w-full max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-hermes-500 flex items-center justify-center shadow-lg shadow-hermes-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl text-white tracking-tight">Creative AI</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-end md:justify-center z-10 w-full mb-0 md:mb-6 max-w-sm mx-auto">
        <div className="w-full text-center px-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
          <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight mb-2">
            Почти готово!
          </h1>
          <p className="text-neutral-400 text-sm font-medium">
            Укажите номер телефона для завершения регистрации
          </p>
        </div>

        <div className="animate-in slide-in-from-bottom-10 fade-in duration-500">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-none rounded-t-[2.5rem] md:rounded-3xl border-t border-white/10 md:border-transparent p-8 md:p-10 pb-14 md:pb-10"
          >
            <label
              htmlFor="phone"
              className="block text-sm font-bold text-neutral-700 mb-2"
            >
              Номер телефона
            </label>
            <div className="relative mb-4">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+7 (777) 123-45-67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-2xl border border-neutral-200 focus:border-hermes-500 focus:ring-2 focus:ring-hermes-500/20 py-3.5 pl-12 pr-4 bg-neutral-50 text-neutral-900 outline-none transition-all"
                required
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm font-medium mb-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={isPending || !phone.trim()}
              className="w-full bg-black hover:bg-hermes-500 disabled:opacity-50 disabled:hover:bg-black text-white rounded-2xl py-4 font-bold transition-all shadow-md flex items-center justify-center gap-2"
            >
              {isPending ? (
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Продолжить
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <p className="text-neutral-400 text-xs text-center mt-4">
              Номер нужен для связи по вопросам оплаты и поддержки
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
