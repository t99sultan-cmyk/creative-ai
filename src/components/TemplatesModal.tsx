"use client";

import { useEffect, useRef, useState } from "react";
import {
  getAllTemplates,
  type GalleryItem,
  type TemplateScope,
} from "@/actions/galleryActions";
import { Wand2, X, Loader2, User, Users } from "lucide-react";

/**
 * Templates browser shown when the user taps the "Шаблоны" button on
 * the editor canvas. Combines:
 *   • the user's own creatives (history)
 *   • public creatives from other users
 * in one grid, with a tab-filter ("Все / Мои / От клиентов") so the
 * user controls what they see.
 *
 * Click a tile → close modal + load that creative's html as the
 * remix source. The editor's existing remix flow handles the rest.
 *
 * Preview rendering — fixed in this iteration:
 *  - iframe sized to the FINAL render dimensions (1080×1080 / 1080×1920)
 *  - wrapper has aspect-ratio + overflow:hidden
 *  - JS-measured scale via ResizeObserver so the iframe fits the wrapper
 *    pixel-perfectly without cropping content
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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setItems(null);
    (async () => {
      const res = await getAllTemplates(scope, 24);
      if (cancelled) return;
      setItems(res.success ? res.items : []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, scope]);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tabs: { id: TemplateScope; label: string; icon: React.ReactNode }[] = [
    { id: "all", label: "Все", icon: null },
    { id: "mine", label: "Мои", icon: <User className="w-3.5 h-3.5" /> },
    { id: "public", label: "От клиентов", icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with tabs + close */}
        <div className="px-5 md:px-6 py-4 border-b border-neutral-100 flex items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-lg md:text-xl font-black text-neutral-900 whitespace-nowrap">
              🎨 Шаблоны
            </h2>
          </div>
          <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-xl flex-1 max-w-md">
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 bg-neutral-50">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {items.map((item) => (
                <TemplateTile
                  key={`${item.isMine ? "m" : "p"}-${item.id}`}
                  item={item}
                  onClick={() => {
                    onPickTemplate(item);
                    onClose();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Single tile — preview + label. Iframe is sized at the creative's
 * actual render viewport (1080×1080 or 1080×1920) and scaled to fit
 * the tile width via JS-measured ResizeObserver. This gives a
 * pixel-perfect mini-preview without the content-clipping bug the
 * old fixed-scale approach had.
 */
function TemplateTile({
  item,
  onClick,
}: {
  item: GalleryItem;
  onClick: () => void;
}) {
  const isVertical = item.format === "9:16" || !item.format;
  const isAnimated = (item.cost ?? 0) > 3;
  // Real viewport dimensions used by Cloud Run renderer.
  const VW = isVertical ? 1080 : 1080;
  const VH = isVertical ? 1920 : 1080;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / VW);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [VW]);

  return (
    <button
      onClick={onClick}
      className="group relative bg-white rounded-2xl border border-neutral-200 overflow-hidden hover:border-hermes-400 hover:shadow-xl transition-all text-left flex flex-col"
      title={item.prompt ?? "Шаблон"}
    >
      <div
        ref={wrapperRef}
        className="relative bg-neutral-100 overflow-hidden w-full"
        style={{ aspectRatio: `${VW} / ${VH}` }}
      >
        {isAnimated && item.videoUrl && !/^(rendering|failed):/.test(item.videoUrl) ? (
          <video
            src={item.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        ) : item.htmlCode ? (
          <iframe
            srcDoc={item.htmlCode}
            sandbox=""
            scrolling="no"
            className="absolute top-0 left-0 pointer-events-none border-0"
            style={{
              width: `${VW}px`,
              height: `${VH}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        ) : null}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          {item.isMine && (
            <span className="bg-hermes-500 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
              МОЁ
            </span>
          )}
          {item.feedbackScore === 1 && !item.isMine && (
            <span className="bg-green-500 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
              👍
            </span>
          )}
        </div>
        {isAnimated && (
          <span className="absolute top-2 right-2 bg-amber-400 text-neutral-900 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
            ANIM
          </span>
        )}

        {/* Hover CTA */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="bg-white text-neutral-900 text-xs font-black px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
            <Wand2 className="w-3.5 h-3.5 text-hermes-500" />
            Использовать
          </span>
        </div>
      </div>
    </button>
  );
}
