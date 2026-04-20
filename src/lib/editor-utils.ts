/**
 * Чистые утилиты редактора.
 *
 * Вынесены из editor/page.tsx чтобы:
 *   1) сократить главный файл
 *   2) тестировать независимо от React-дерева
 *   3) повторно использовать в других местах (например, скрипте загрузки)
 *
 * Функции здесь НЕ дергают React / стейт / Clerk — только чистые вычисления.
 */

/**
 * Набор "проходящих" текстов во время генерации. Выбираются по тому, что
 * пользователь прислал (рефы / продукт) и какой режим (анимация / статика).
 */
export const buildLoadingTexts = (
  isAnimated: boolean,
  hasRefs: boolean,
  hasProducts: boolean,
): string[] => {
  return [
    hasRefs || hasProducts
      ? 'Анализируем ваше ТЗ и загруженные медиа...'
      : 'Изучаем запрос и генерируем идею...',
    'Проектируем премиальную сетку дизайна...',
    hasProducts
      ? 'Интегрируем объект в промо-композицию...'
      : 'Подбираем сочные цвета и типографику...',
    'Нейросеть собирает финальный макет...',
    isAnimated
      ? 'Добавляем крутые анимации (почти готово!)...'
      : 'Полируем статичный кадр (почти готово!)...',
  ];
};

/**
 * Сжать изображение (Blob) в WebP data-URL с ограничением по ширине.
 * Сохраняет пропорции. WebP поддерживает прозрачность и весит в разы меньше PNG.
 *
 * ВАЖНО: использует DOM (canvas, Image). Работает только в браузере.
 */
export const optimizeImageToWebP = (
  blob: Blob,
  maxWidth = 800,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new globalThis.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Canvas context error');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/webp', 0.85));
      URL.revokeObjectURL(url);
    };
    img.onerror = reject;
    img.src = url;
  });
};
