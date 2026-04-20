import Link from 'next/link';
import { Sparkles, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 font-sans flex items-center justify-center px-4 overflow-hidden">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-400/20 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[20%] w-[60%] h-[50%] bg-yellow-400/20 blur-[150px] rounded-full" />
      </div>

      <div className="max-w-xl w-full text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-hermes-500/10 border border-hermes-500/20 text-hermes-600 text-sm font-semibold mb-8">
          <Sparkles className="w-4 h-4" /> 404 — страница не найдена
        </div>

        <h1 className="text-7xl md:text-8xl font-extrabold tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-br from-neutral-900 to-neutral-600 mb-6">
          Упс!
        </h1>

        <p className="text-lg md:text-xl text-neutral-600 mb-10">
          Похоже, этот креатив ещё не сгенерирован. Вернитесь на главную — там есть всё остальное.
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 bg-hermes-500 hover:bg-hermes-600 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all shadow-xl shadow-hermes-500/30 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5" />
          На главную
        </Link>
      </div>
    </main>
  );
}
