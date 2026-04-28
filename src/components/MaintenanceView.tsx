import Link from "next/link";
import { Sparkles, ArrowLeft, Wrench } from "lucide-react";

/**
 * Shown to anonymous visitors when NEXT_PUBLIC_REGISTRATION_OPEN="false".
 * Mirrors the dark, branded aesthetic of /register and /login so the
 * visual transition from landing → maintenance feels intentional rather
 * than broken.
 */
export function MaintenanceView() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-900 relative overflow-hidden overscroll-none">
      <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] bg-hermes-600/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-amber-500/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="px-6 py-6 pt-12 md:pt-6 flex items-center justify-between z-10 w-full max-w-md mx-auto">
        <Link
          href="/"
          className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/5 rounded-full flex items-center justify-center text-white/80 hover:bg-white/20 hover:text-white transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-hermes-500 flex items-center justify-center shadow-lg shadow-hermes-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl text-white tracking-tight">
            Creative AI
          </span>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex flex-col justify-center z-10 w-full max-w-md mx-auto px-6">
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 md:p-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-hermes-500/20 border border-hermes-500/30 flex items-center justify-center">
            <Wrench className="w-7 h-7 text-hermes-400" />
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight mb-3">
            Идёт обновление платформы
          </h1>

          <p className="text-neutral-400 text-base leading-relaxed mb-8">
            Мы запускаем новые модели генерации (Veo 3, Kling, Nano Banana).
            Регистрация новых пользователей временно приостановлена.
            Напишите нам в Telegram, если хотите попасть в early access.
          </p>

          <div className="flex flex-col gap-3">
            <a
              href="https://t.me/aicreative_support"
              target="_blank"
              rel="noreferrer"
              className="w-full bg-hermes-500 hover:bg-hermes-600 text-white rounded-2xl py-4 font-bold transition-all shadow-md flex items-center justify-center gap-2"
            >
              Написать в Telegram
            </a>
            <Link
              href="/login"
              className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 rounded-2xl py-4 font-semibold transition-all flex items-center justify-center gap-2"
            >
              У меня уже есть аккаунт
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
