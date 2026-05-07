"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

/**
 * Shared footer for all 4 landings. By default DOES NOT list the
 * other products — each per-product landing stays focused on its own
 * product, so we render Account + Contacts columns only.
 *
 * The main `/` landing (creatives) can opt back into showing the
 * cross-product nav by passing `showProductsNav={true}`.
 */
export function LandingFooter({
  showProductsNav = false,
}: {
  showProductsNav?: boolean;
}) {
  const cols = showProductsNav ? "md:grid-cols-4" : "md:grid-cols-3";
  return (
    <footer className="border-t border-neutral-200 bg-white py-14">
      <div className={`max-w-7xl mx-auto px-4 grid sm:grid-cols-2 ${cols} gap-10`}>
        <div>
          <Link href="/" className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-hermes-500 via-rose-500 to-violet-500 flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">AICreative</span>
          </Link>
          <p className="text-sm text-neutral-500 leading-relaxed max-w-[260px]">
            ИИ-студия для маркетинга в Казахстане.
          </p>
        </div>

        {showProductsNav && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-4">
              Продукты
            </h4>
            <ul className="space-y-2 text-sm text-neutral-600">
              <li><Link href="/" className="hover:text-neutral-900 transition-colors">Креативы</Link></li>
              <li><Link href="/products" className="hover:text-neutral-900 transition-colors">Карточки товара</Link></li>
              <li><Link href="/sites" className="hover:text-neutral-900 transition-colors">Сайты</Link></li>
              <li><Link href="/presentations" className="hover:text-neutral-900 transition-colors">Презентации</Link></li>
            </ul>
          </div>
        )}

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-4">
            Аккаунт
          </h4>
          <ul className="space-y-2 text-sm text-neutral-600">
            <li><Link href="/account" className="hover:text-neutral-900 transition-colors">Личный кабинет</Link></li>
            <li><Link href="/editor" className="hover:text-neutral-900 transition-colors">Редактор</Link></li>
            <li><a href="#pricing" className="hover:text-neutral-900 transition-colors">Тарифы</a></li>
            <li><a href="#faq" className="hover:text-neutral-900 transition-colors">FAQ</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-4">
            Контакты
          </h4>
          <ul className="space-y-2 text-sm text-neutral-600">
            <li><a href="mailto:hello@aicreative.kz" className="hover:text-neutral-900 transition-colors">hello@aicreative.kz</a></li>
            <li><a href="https://t.me/voise_kz" target="_blank" rel="noopener" className="hover:text-neutral-900 transition-colors">Telegram</a></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-10 pt-6 border-t border-neutral-100 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
        <span>© {new Date().getFullYear()} AICreative. Алматы, Казахстан.</span>
        <div className="flex gap-5">
          <Link href="/legal/privacy" className="hover:text-neutral-600 transition-colors">Политика конфиденциальности</Link>
          <Link href="/legal/terms" className="hover:text-neutral-600 transition-colors">Условия использования</Link>
        </div>
      </div>
    </footer>
  );
}
