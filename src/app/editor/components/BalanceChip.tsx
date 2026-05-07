"use client";

import Link from "next/link";

/**
 * Editor header balance chip — impulse counter pill + Kaspi top-up
 * link + secondary links (account, history, my publications).
 *
 * First sub-component extracted as part of the editor decomposition
 * plan (#8 from the critique). The visual is byte-identical with the
 * inline version it replaced; only the JSX moved.
 *
 * Props are minimal — most state lives in the parent. `onPromoClick`
 * toggles the inline promo-input form (kept in parent because it owns
 * the input value and submit logic).
 */

export interface BalanceChipProps {
  impulses: number | null;
  historyCount: number;
  onPromoClick: () => void;
  onHistoryClick: () => void;
}

export function BalanceChip({
  impulses,
  historyCount,
  onPromoClick,
  onHistoryClick,
}: BalanceChipProps) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">
        Баланс
      </span>
      <div className="flex items-center gap-2">
        {/* Balance badge — clicks open the promo input inline (quick path).
            For full flow (history, account info) use the Кабинет link below. */}
        <button
          onClick={onPromoClick}
          className="flex items-center gap-1.5 bg-hermes-50 text-hermes-700 px-3 py-1.5 rounded-lg border border-hermes-200 hover:bg-hermes-100 hover:border-hermes-300 transition-colors"
          title="Нажмите чтобы ввести промокод"
        >
          <span className="font-extrabold text-sm">
            {impulses === null ? "..." : impulses}
          </span>
          <span className="text-sm">⚡</span>
        </button>
        <Link
          href="/#pricing"
          className="px-3 py-1.5 bg-[#f14635] text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors flex items-center shadow-sm whitespace-nowrap"
        >
          {impulses !== null && impulses >= 10 ? "Докупить (Kaspi)" : "Купить (Kaspi)"}
        </Link>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <Link
          href="/account"
          className="text-[10px] uppercase font-bold text-hermes-600 hover:text-hermes-700 underline flex items-center gap-1"
          title="Промокоды, история пополнений, ваш баланс"
        >
          🎁 Промокод / Кабинет
        </Link>
        <button
          onClick={onHistoryClick}
          className="text-[10px] uppercase font-bold text-neutral-500 hover:text-hermes-600 underline"
        >
          Мои креативы ({historyCount})
        </button>
        <Link
          href="/published"
          className="text-[10px] uppercase font-bold text-neutral-500 hover:text-emerald-600 underline"
          title="Сайты и презентации, опубликованные на нашем домене"
        >
          Публикации
        </Link>
      </div>
    </div>
  );
}
