import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Публичная оферта | AICreative',
  description: 'Публичная оферта сервиса AICreative.kz',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 font-sans px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> На главную
        </Link>

        <h1 className="text-4xl md:text-5xl font-extrabold mb-8">Публичная оферта</h1>

        <div className="prose prose-neutral max-w-none space-y-6 text-neutral-700 leading-relaxed">
          <p className="text-sm text-neutral-500">Последнее обновление: {new Date().toLocaleDateString('ru-RU')}</p>

          {/* TODO: Заменить на реальный текст оферты. Минимум:
              предмет, цена (в тенге, с НДС/без), порядок оплаты (Kaspi, карта), возвраты,
              момент оказания услуги, ответственность, форс-мажор, юрисдикция (РК), реквизиты.
          */}

          <section>
            <h2 className="text-2xl font-bold mb-3 text-neutral-900">1. Предмет оферты</h2>
            <p>ТОО «[НАИМЕНОВАНИЕ]» (БИН [ХХХХХХХХХХХХ]) предлагает услуги по генерации рекламных креативов с помощью искусственного интеллекта на платформе AICreative.kz.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3 text-neutral-900">2. Стоимость и оплата</h2>
            <p>Стоимость указана в тенге на странице <Link href="/#pricing" className="text-hermes-600 hover:underline">тарифов</Link>. Оплата через Kaspi Pay / банковскую карту. Моментом оказания услуги считается зачисление Импульсов на баланс пользователя.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3 text-neutral-900">3. Возврат средств</h2>
            <p>Возврат возможен в течение 14 дней с момента покупки при условии, что использовано не более 10% купленных Импульсов. Запрос направляется на <a href="mailto:support@aicreative.kz" className="text-hermes-600 hover:underline">support@aicreative.kz</a>.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3 text-neutral-900">4. Ответственность</h2>
            <p>Сгенерированный контент принадлежит пользователю. Пользователь обязуется не загружать материалы, нарушающие авторские права третьих лиц или законодательство РК.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3 text-neutral-900">5. Реквизиты</h2>
            <p>ТОО «[НАИМЕНОВАНИЕ]»<br />БИН: [ХХХХХХХХХХХХ]<br />Адрес: [ЮРИДИЧЕСКИЙ АДРЕС]<br />Email: support@aicreative.kz</p>
          </section>

          <div className="mt-12 p-6 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm text-amber-900"><strong>⚠️ Шаблон.</strong> Этот текст — заглушка. Согласуй с юристом и подставь реальные реквизиты.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
