'use client';

import { MonitorPlay, X } from 'lucide-react';

/**
 * Модалка с инструкцией перед записью видео через screen-share.
 *
 * Вынесена из editor/page.tsx — чисто презентационная: 3 пропса, никакого
 * собственного состояния. Логика запуска записи и закрытия живёт в родителе.
 */
type Props = {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
};

export function VideoRecordingModal({ open, onClose, onStart }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-800"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="w-12 h-12 bg-hermes-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <MonitorPlay className="w-6 h-6 text-hermes-600" />
        </div>
        <h3 className="text-xl font-bold text-neutral-900 mb-2">Плавная запись видео (MP4)</h3>
        <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
          Чтобы видео было <b>идеально качественным</b> и ваш компьютер не зависал, мы запишем его напрямую с вашей видеокарты. <br />
          <br />
          <b>Что сейчас будет:</b>
          <br />
          1. Нажмите "Начать" ниже.
          <br />
          2. В системном окне перейдите в раздел <b>"Вкладка Chrome/Browser"</b>.
          <br />
          3. Выберите эту самую вкладку Creative AI и нажмите кнопку <b>"Поделиться"</b>.
          <br />
          <br />
          <i>Внимание: на телефонах эта функция недоступна из-за ограничений iOS/Android. Для скачивания на мобильных потребуется интеграция платного API в будущем.</i>
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={onStart}
            className="flex-1 py-3 px-4 bg-hermes-600 hover:bg-hermes-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-hermes-600/30"
          >
            Понятно, Начать
          </button>
        </div>
      </div>
    </div>
  );
}
