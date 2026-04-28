"use client";

import { useEffect, useRef, useState } from "react";
import {
  getAllTemplates,
  adminHideFromGallery,
  adminDeleteFromGallery,
  type GalleryItem,
  type TemplateScope,
} from "@/actions/galleryActions";
import { Wand2, X, Loader2, User, Users, EyeOff, Trash2 } from "lucide-react";
import clsx from "clsx";

/**
 * Templates browser. Combines user's own creatives + public from
 * other users in a single grid with three tabs.
 *
 * Built on the native HTML <dialog> element with showModal() — the
 * browser places it in the **top layer**, which is above ALL other
 * stacking contexts on the page. This is the only way to guarantee
 * the modal sits above the editor's left aside and the canvas
 * section, both of which establish their own stacking contexts via
 * z-index/relative/overflow on the editor's <main>.
 *
 * Tile preview reuses the EXACT pattern from "Мои креативы" in
 * editor/page.tsx: iframe 400×711 (9:16) or 500×500 (1:1) with
 * scale 0.5 / 0.4, and sandbox="allow-scripts" so animations play.
 */
export function TemplatesModal({
  open,
  onClose,
  onPickTemplate,
}: {
  open: boolean;
  onClose: () => void;
  onPickTemplate: (item: GalleryItem) => void;
}) {
  const [scope, setScope] = useState<TemplateScope>("all");
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync `open` prop with the imperative dialog API. showModal() is
  // what triggers top-layer rendering; <dialog open> alone keeps the
  // dialog inline (in normal flow) and breaks the whole point.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      try {
        d.showModal();
      } catch {
        // showModal throws if already open — safe to swallow.
      }
    }
    if (!open && d.open) {
      d.close();
    }
  }, [open]);

  // Native <dialog> emits a `close` event when Esc is pressed or
  // dialog.close() is called. Mirror that into our parent's state so
  // controlled `open` stays in sync.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const handler = () => onClose();
    d.addEventListener("close", handler);
    return () => d.removeEventListener("close", handler);
  }, [onClose]);

  // Load list whenever the modal opens or scope changes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setItems(null);
    (async () => {
      const res = await getAllTemplates(scope, 24);
      if (cancelled) return;
      setItems(res.success ? res.items : []);
      setIsAdminUser(res.isAdmin === true);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, scope, reloadTick]);

  async function handleAdminHide(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Скрыть из публичной галереи? У автора креатив останется.")) return;
    await adminHideFromGallery(id);
    setReloadTick((t) => t + 1);
  }
  async function handleAdminDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Удалить креатив навсегда? Это нельзя отменить.")) return;
    await adminDeleteFromGallery(id);
    setReloadTick((t) => t + 1);
  }

  // Click handler on the <dialog> itself — close when click lands
  // OUTSIDE the modal card (i.e. on the ::backdrop area).
  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    const d = dialogRef.current;
    if (!d) return;
    const r = d.getBoundingClientRect();
    const inside =
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom;
    if (!inside) onClose();
  }

  const tabs: { id: TemplateScope; label: string; icon: React.ReactNode }[] = [
    { id: "all", label: "Все", icon: null },
    { id: "mine", label: "Мои", icon: <User className="w-3.5 h-3.5" /> },
    { id: "public", label: "От клиентов", icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      // Reset all the default <dialog> styling — we provide our own
      // sizing/border/padding/bg via Tailwind. `m-auto` re-centers in
      // the viewport (default <dialog> has `margin: auto` only when
      // open, so we re-apply explicitly).
      className="m-auto bg-white w-[min(95vw,72rem)] max-w-5xl h-[82dvh] max-h-[82dvh] rounded-3xl shadow-2xl overflow-hidden p-0 border-0 backdrop:bg-black/70 backdrop:backdrop-blur-sm open:animate-in open:fade-in open:zoom-in-95 open:duration-300"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-neutral-100 flex items-center gap-2 md:gap-3 bg-white shrink-0">
          <h2 className="text-base md:text-xl font-black text-neutral-900 whitespace-nowrap">
            🎨 Шаблоны
          </h2>
          <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-xl flex-1 max-w-md mx-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setScope(t.id)}
                className={`flex-1 px-2 md:px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1 ${
                  scope === t.id
                    ? "bg-white shadow-sm text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors flex-shrink-0"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body. min-h-0 mandatory in flex-col child for scroll. */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-5 bg-neutral-50"
          style={{ overscrollBehavior: "contain" }}
        >
          {loading || items === null ? (
            <div className="h-full flex items-center justify-center text-neutral-400 gap-2 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" />
              Загружаем шаблоны…
            </div>
          ) : items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 px-6">
              <p className="text-base font-bold text-neutral-700">Пусто</p>
              <p className="text-sm mt-1">
                {scope === "mine"
                  ? "Ты пока не создал ни одного креатива."
                  : scope === "public"
                    ? "Публичных шаблонов пока нет."
                    : "Шаблонов пока нет."}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 md:gap-4 justify-center sm:justify-start">
              {items.map((item) => (
                <TemplateTile
                  key={`${item.isMine ? "m" : "p"}-${item.id}`}
                  item={item}
                  isAdminUser={isAdminUser}
                  onPick={() => {
                    onPickTemplate(item);
                    onClose();
                  }}
                  onAdminHide={(e) => handleAdminHide(item.id, e)}
                  onAdminDelete={(e) => handleAdminDelete(item.id, e)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}

function TemplateTile({
  item,
  isAdminUser,
  onPick,
  onAdminHide,
  onAdminDelete,
}: {
  item: GalleryItem;
  isAdminUser: boolean;
  onPick: () => void;
  onAdminHide: (e: React.MouseEvent) => void;
  onAdminDelete: (e: React.MouseEvent) => void;
}) {
  const isVertical = item.format === "9:16" || !item.format;
  const isAnimated = (item.cost ?? 0) > 3;
  const hasVideo =
    isAnimated && !!item.videoUrl && !/^(rendering|failed):/.test(item.videoUrl);

  return (
    // <div role="button"> — outer wrapper isn't a real <button> because
    // we have nested <button>s for admin actions inside; button-in-
    // button is invalid HTML and triggers React hydration errors.
    <div
      role="button"
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
        }
      }}
      className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col w-full sm:w-[232px] sm:max-w-[232px] shrink-0 hover:shadow-xl hover:border-hermes-300 transition-all duration-300 hover:-translate-y-0.5 text-left group cursor-pointer focus:outline-none focus:ring-2 focus:ring-hermes-400 focus:ring-offset-2"
      title={item.prompt ?? "Шаблон"}
    >
      {/* Top row — badges + admin actions (admin only) */}
      <div className="flex justify-between items-center p-2.5 border-b border-neutral-100 bg-white/50 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-1">
          <span className="bg-neutral-100/80 text-neutral-600 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border border-neutral-200/50">
            {item.format || "9:16"}
          </span>
          {item.isMine && (
            <span className="bg-hermes-50 text-hermes-700 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border border-hermes-200/50">
              МОЁ
            </span>
          )}
          {isAnimated && (
            <span className="bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border border-amber-200/50">
              ANIM
            </span>
          )}
          {item.feedbackScore === 1 && !item.isMine && (
            <span className="bg-green-50 text-green-700 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border border-green-200/50">
              👍
            </span>
          )}
        </div>
        {isAdminUser && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={onAdminHide}
              className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
              title="Скрыть из публичной галереи (админ)"
              aria-label="Скрыть"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onAdminDelete}
              className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
              title="Удалить (админ)"
              aria-label="Удалить"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Preview — same iframe sizing as editor's "Мои креативы" */}
      <div className="w-full bg-neutral-50/50 flex items-center justify-center p-3 sm:p-4 relative">
        <div
          className={clsx(
            "shadow-lg bg-white rounded-xl overflow-hidden relative",
            isVertical
              ? "aspect-[9/16] w-[min(200px,100%)] sm:w-[200px]"
              : "aspect-square w-[min(200px,100%)] sm:w-[200px]",
          )}
        >
          {hasVideo ? (
            <video
              src={item.videoUrl!}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
          ) : item.htmlCode ? (
            <iframe
              srcDoc={item.htmlCode}
              loading="lazy"
              title={`Template ${item.id}`}
              referrerPolicy="no-referrer"
              className="absolute inset-0 border-0 pointer-events-none origin-top-left"
              style={{
                width: isVertical ? "400px" : "500px",
                height: isVertical ? "711px" : "500px",
                transform: isVertical ? "scale(0.5)" : "scale(0.4)",
              }}
              sandbox="allow-scripts"
            />
          ) : null}
          <div className="absolute inset-0 bg-transparent z-10 pointer-events-none" />
        </div>

        {/* Hover CTA. transition-all (not transition-colors) so the
            opacity flips synchronously with the bg fade — old version
            used transition-colors which left opacity flipping
            instantly and could appear "stuck" on touch devices. */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
          <span className="bg-white text-neutral-900 text-xs font-black px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
            <Wand2 className="w-3.5 h-3.5 text-hermes-500" />
            Использовать
          </span>
        </div>
      </div>
    </div>
  );
}
