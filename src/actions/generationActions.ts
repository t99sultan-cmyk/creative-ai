'use server';

import { db } from '@/db';
import { creatives } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';

/**
 * Серверная отмена "зависшего" рендера.
 *
 * Cloud Run мы остановить не можем — но помечаем запись в БД как
 * `failed:<ts>:cancelled-by-user`. Дальше:
 *   - /api/check-render увидит префикс `failed:` и сразу отдаст failed
 *   - UI (на любом устройстве) перестанет поллить рендер
 *   - В истории отобразится статус "отменён"
 *
 * Без этого локальный `cancelRender` в редакторе чистил только state
 * и localStorage — мобильный телефон продолжал видеть рендер как активный.
 *
 * Работает только для записей в статусе 'rendering:<ts>'. Для уже готовых /
 * провалившихся возвращает ok:false (чтобы случайно не "отменить" успех).
 */
export async function cancelGeneration(
  creativeId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Требуется вход' };

  if (!creativeId || typeof creativeId !== 'string') {
    return { ok: false, error: 'Неверный id' };
  }

  const row = await db.query.creatives.findFirst({
    where: eq(creatives.id, creativeId),
  });
  if (!row) return { ok: false, error: 'Креатив не найден' };
  if (row.userId && row.userId !== userId) {
    return { ok: false, error: 'Доступ запрещён' };
  }

  // Only cancel in-flight renders. Already-done/failed stays as is.
  const v = row.videoUrl || '';
  if (!v.startsWith('rendering:')) {
    return { ok: false, error: 'Рендер уже завершён' };
  }

  const ts = Date.now();
  await db
    .update(creatives)
    .set({ videoUrl: `failed:${ts}:cancelled-by-user` })
    .where(and(eq(creatives.id, creativeId), eq(creatives.userId, userId)));

  return { ok: true };
}
