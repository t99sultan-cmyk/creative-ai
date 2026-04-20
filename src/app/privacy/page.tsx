import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Политика конфиденциальности | AICreative',
  description: 'Политика конфиденциальности сервиса AICreative.kz',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 font-sans px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> На главную
        </Link>

        <h1 className="text-4xl md:text-5xl font-extrabold mb-8">Политика конфиденциальности</h1>

        <div className="prose prose-neutral max-w-none space-y-6 text-neutral-700 leading-relaxed">
          <p className="text-sm text-neutral-500">Последнее обновление: {new Date().toLocaleDateString('ru-RU')}</p>

          {/* TODO: Заменить на реальный текст политики конфиденциальности, согласованный с юристом.
              Минимум для РК: что собираем (email, загруженные фото, платёжные данные через Kaspi/Stripe),
              зачем, где храним (юрисдикция), срок хранения, права субъекта данных (закон РК №94-V «О персональных данных»).
          */}

          <section>
            <h2 className="text-2xl font-bold mb-3 text-neutral-900">1. Общие положения</h2>
            <p>ТОО «[НАИМЕНОВАНИЕ]» (далее — «Компания», БИН [ХХХХХХХХХХХХ]) уважает ваше право на конфиденциальность и обязуется защищать персональные данные пользователей сервиса AICreative.kz.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3 text-neutral-900">2. Какие данные мы собираем</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Email и имя при регистрации через Clerk</li>
              <li>Загруженные изображения и промпты для генерации креативов</li>
              <li>История генераций и платежей</li>
              <li>Технические данные: IP-адрес, User-Agent, cookies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3 text-neutral-900">3. Цели обработки</h2>
            <p>Данные используются для: работы сервиса, подтверждения платежей, улучшения качества ИИ-моделей (в обезличенном виде), связи со службой поддержки.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3 text-neutral-900">4. Ваши права</h2>
            <p>В соответствии с Законом РК «О персональных данных» вы имеете право на доступ, изменение, удаление своих данных. Запросы направляйте на <a href="mailto:support@aicreative.kz" className="text-hermes-600 hover:underline">support@aicreative.kz</a>.</p>
          </section>

          <div className="mt-12 p-6 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm text-amber-900"><strong>⚠️ Шаблон.</strong> Этот текст — заглушка. Перед публикацией согласуй с юристом, подставь реальные БИН/адрес/email.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
