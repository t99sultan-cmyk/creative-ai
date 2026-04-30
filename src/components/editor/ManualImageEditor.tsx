"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Plus, Trash2, Bold, Italic, AlignLeft, AlignCenter, AlignRight,
  Loader2, Square, Eraser,
} from "lucide-react";
import clsx from "clsx";

/**
 * Manual creative editor — direct manipulation of text overlays on
 * top of an AI-generated image.
 *
 * Architecture: image-gen models output a clean *visual* creative
 * (no text — see gemini-3-pro-image.ts / gpt-image.ts). All text is
 * an editor overlay that's freely draggable, resizable via font size,
 * and editable inline (contentEditable). On save we rasterise the
 * whole wrapper via html2canvas and hand the resulting PNG back to
 * the parent.
 *
 * Initial overlays:
 *   • If `initialBlocks` is passed, use it (auto-populated from the
 *     brief: headline = subject, sub = benefit).
 *   • Otherwise start empty — user clicks "+ Добавить текст".
 */

const FONT_FAMILIES = [
  { id: "inter", label: "Inter", css: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { id: "playfair", label: "Playfair", css: "'Playfair Display', Georgia, serif" },
  { id: "bebas", label: "Bebas", css: "'Bebas Neue', Impact, sans-serif" },
  { id: "monos", label: "JetBrains", css: "'JetBrains Mono', ui-monospace, monospace" },
];

interface TextOverlay {
  id: string;
  /** Position as % of canvas — survives resize. */
  xPct: number;
  yPct: number;
  text: string;
  /** Size as % of canvas width — proportional. */
  fontSizePct: number;
  color: string;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  letterSpacingEm: number;   // -0.04 to 0.2
  lineHeight: number;        // 0.9 to 2.0
  /** Optional background pill behind text. */
  bgEnabled: boolean;
  bgColor: string;
  bgOpacity: number; // 0..1
  bgPaddingPct: number; // 0..3 (% of canvas width)
}

export interface InitialOverlayBlock {
  text: string;
  /** Hint about role (controls default sizing/position). */
  role?: "headline" | "sub" | "cta";
}

interface Props {
  imageUrl: string;
  format: string; // "9:16" | "3:4" | "1:1" | "4:3" | "16:9"
  /** Optional pre-populated overlays. */
  initialBlocks?: InitialOverlayBlock[];
  onClose: () => void;
  onSave: (newImageDataUrl: string) => void;
}

function defaultsForRole(role?: InitialOverlayBlock["role"]): Partial<TextOverlay> {
  switch (role) {
    case "headline":
      return { fontSizePct: 9, yPct: 18, bold: true, fontFamily: FONT_FAMILIES[0].css };
    case "sub":
      return { fontSizePct: 4, yPct: 32, bold: false, fontFamily: FONT_FAMILIES[0].css };
    case "cta":
      return {
        fontSizePct: 4,
        yPct: 88,
        bold: true,
        bgEnabled: true,
        bgColor: "#ffffff",
        bgOpacity: 0.95,
        bgPaddingPct: 1.5,
        color: "#0a0a0a",
      };
    default:
      return {};
  }
}

export function ManualImageEditor({ imageUrl, format, initialBlocks, onClose, onSave }: Props) {
  const initialOverlays = useMemo<TextOverlay[]>(() => {
    if (!initialBlocks || initialBlocks.length === 0) return [];
    return initialBlocks
      .filter((b) => b.text.trim().length > 0)
      .map((b) => ({
        id: crypto.randomUUID(),
        xPct: 50,
        yPct: 50,
        text: b.text,
        fontSizePct: 6,
        color: "#ffffff",
        fontFamily: FONT_FAMILIES[0].css,
        bold: true,
        italic: false,
        align: "center" as const,
        letterSpacingEm: -0.01,
        lineHeight: 1.1,
        bgEnabled: false,
        bgColor: "#000000",
        bgOpacity: 0.5,
        bgPaddingPct: 1,
        ...defaultsForRole(b.role),
      }));
  }, [initialBlocks]);

  const [overlays, setOverlays] = useState<TextOverlay[]>(initialOverlays);
  const [selectedId, setSelectedId] = useState<string | null>(initialOverlays[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = overlays.find((o) => o.id === selectedId) ?? null;

  function addText() {
    const id = crypto.randomUUID();
    const newOverlay: TextOverlay = {
      id,
      xPct: 50,
      yPct: 50,
      text: "Ваш текст",
      fontSizePct: 6,
      color: "#ffffff",
      fontFamily: FONT_FAMILIES[0].css,
      bold: true,
      italic: false,
      align: "center",
      letterSpacingEm: -0.01,
      lineHeight: 1.1,
      bgEnabled: false,
      bgColor: "#000000",
      bgOpacity: 0.5,
      bgPaddingPct: 1,
    };
    setOverlays((prev) => [...prev, newOverlay]);
    setSelectedId(id);
  }

  function update(id: string, patch: Partial<TextOverlay>) {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function remove(id: string) {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function clearAll() {
    if (overlays.length === 0) return;
    if (!confirm("Удалить все блоки текста?")) return;
    setOverlays([]);
    setSelectedId(null);
  }

  // Drag with pointer events. Math is in %, so the layout survives
  // window resize and the rasterised export keeps positioning.
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  function onPointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    setSelectedId(id);
    if (!wrapperRef.current) return;
    const o = overlays.find((x) => x.id === id);
    if (!o) return;
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: o.xPct,
      origY: o.yPct,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
    const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;
    update(drag.id, {
      xPct: Math.max(0, Math.min(100, drag.origX + dxPct)),
      yPct: Math.max(0, Math.min(100, drag.origY + dyPct)),
    });
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  async function handleSave() {
    if (!wrapperRef.current) return;
    setSaving(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(wrapperRef.current, {
        backgroundColor: null,
        useCORS: true,
        scale: 2,
        ignoreElements: (el) => el.classList?.contains("manual-editor-ignore"),
      });
      onSave(canvas.toDataURL("image/png"));
    } catch (e: any) {
      console.error("[ManualImageEditor] save failed:", e);
      alert("Не удалось сохранить: " + (e?.message ?? "unknown"));
    } finally {
      setSaving(false);
    }
  }

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const target = e.target as HTMLElement | null;
        if (target?.getAttribute("contenteditable") === "true") return;
        remove(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, onClose]);

  // Canvas wrapper sizing — keep natural format aspect.
  const canvasStyle: React.CSSProperties = (() => {
    const ar = format.replace(":", " / ");
    if (format === "9:16" || format === "3:4") {
      return { aspectRatio: ar, height: "min(82vh, 900px)" };
    }
    if (format === "1:1") {
      return { aspectRatio: ar, height: "min(82vh, 720px)", width: "min(82vh, 720px)" };
    }
    // 4:3, 16:9
    return { aspectRatio: ar, width: "min(85vw, 1100px)" };
  })();

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/95 backdrop-blur-md flex flex-col">
      {/* Top bar — minimal, clean */}
      <header className="flex items-center justify-between px-5 py-3.5 bg-neutral-950 border-b border-white/10 text-white">
        <div className="flex items-center gap-2">
          <button
            onClick={addText}
            className="bg-hermes-500 hover:bg-hermes-600 text-white px-3.5 py-2 rounded-lg font-bold text-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить текст
          </button>
          {overlays.length > 0 && (
            <button
              onClick={clearAll}
              className="text-white/60 hover:text-white hover:bg-white/10 px-2.5 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors"
              title="Удалить все блоки"
            >
              <Eraser className="w-3.5 h-3.5" />
              Очистить
            </button>
          )}
        </div>
        <div className="hidden md:block text-xs text-white/50 font-medium">
          Тащи мышкой · двойной клик — редактировать · Delete — удалить
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3 py-2 rounded-lg font-bold text-sm text-white/80 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Сохраняю...
              </>
            ) : (
              "Готово"
            )}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div
          className="flex-1 flex items-center justify-center p-6 overflow-auto bg-neutral-900"
          onClick={() => setSelectedId(null)}
        >
          <div
            ref={wrapperRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative bg-black shadow-[0_30px_80px_-15px_rgba(0,0,0,0.8)] select-none"
            style={{ ...canvasStyle, containerType: "inline-size" }}
          >
            <img
              src={imageUrl}
              alt="creative"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              crossOrigin="anonymous"
              draggable={false}
            />
            {overlays.map((o) => {
              const isSelected = o.id === selectedId;
              return (
                <div
                  key={o.id}
                  onPointerDown={(e) => onPointerDown(e, o.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(o.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    const target = e.currentTarget.querySelector("[data-text]") as HTMLElement | null;
                    target?.focus();
                  }}
                  className="absolute touch-none"
                  style={{
                    left: `${o.xPct}%`,
                    top: `${o.yPct}%`,
                    transform: "translate(-50%, -50%)",
                    cursor: "move",
                  }}
                >
                  <div
                    data-text
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => update(o.id, { text: e.currentTarget.textContent ?? "" })}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      fontFamily: o.fontFamily,
                      fontSize: `${o.fontSizePct}cqw`,
                      color: o.color,
                      fontWeight: o.bold ? 900 : 500,
                      fontStyle: o.italic ? "italic" : "normal",
                      textAlign: o.align,
                      whiteSpace: "pre-wrap",
                      lineHeight: o.lineHeight,
                      letterSpacing: `${o.letterSpacingEm}em`,
                      textShadow: o.bgEnabled ? "none" : "0 2px 14px rgba(0,0,0,0.45)",
                      padding: o.bgEnabled
                        ? `${o.bgPaddingPct}cqw ${o.bgPaddingPct * 1.6}cqw`
                        : "0.1em 0.3em",
                      outline: "none",
                      minWidth: "1ch",
                      cursor: "text",
                      backgroundColor: o.bgEnabled
                        ? hexToRgba(o.bgColor, o.bgOpacity)
                        : "transparent",
                      borderRadius: o.bgEnabled ? "0.5em" : 0,
                    }}
                  >
                    {o.text}
                  </div>
                  {isSelected && (
                    <>
                      <div className="manual-editor-ignore absolute inset-0 border-2 border-hermes-500 rounded-sm pointer-events-none" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(o.id);
                        }}
                        className="manual-editor-ignore absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg z-10"
                        title="Удалить"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right sidebar — formatting controls */}
        <aside className="w-80 bg-neutral-950 border-l border-white/10 p-5 overflow-y-auto text-white">
          {!selected ? (
            <div className="space-y-3 text-sm text-white/60 leading-relaxed">
              <p>
                Нажми <strong className="text-white">«+ Добавить текст»</strong> наверху, или кликни на существующий блок текста, чтобы открыть его настройки.
              </p>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs">
                <p className="font-bold text-white mb-1">Подсказки:</p>
                <ul className="list-disc list-inside space-y-1 text-white/70">
                  <li>Тащи мышкой — двигать текст</li>
                  <li>Двойной клик — редактировать содержимое</li>
                  <li>Esc — закрыть редактор</li>
                  <li>Delete — удалить выделенный блок</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <Section title="Шрифт">
                <select
                  value={selected.fontFamily}
                  onChange={(e) => update(selected.id, { fontFamily: e.target.value })}
                  className="w-full bg-white/10 border border-white/15 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-hermes-500"
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f.id} value={f.css}>{f.label}</option>
                  ))}
                </select>
              </Section>

              <Section title={`Размер: ${selected.fontSizePct.toFixed(1)}%`}>
                <input
                  type="range"
                  min="2"
                  max="20"
                  step="0.5"
                  value={selected.fontSizePct}
                  onChange={(e) => update(selected.id, { fontSizePct: parseFloat(e.target.value) })}
                  className="w-full accent-hermes-500"
                />
              </Section>

              <Section title="Цвет текста">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selected.color}
                    onChange={(e) => update(selected.id, { color: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-white/15 cursor-pointer bg-transparent"
                  />
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {["#ffffff", "#000000", "#f37021", "#fbbf24", "#10b981", "#3b82f6", "#ec4899"].map((c) => (
                      <button
                        key={c}
                        onClick={() => update(selected.id, { color: c })}
                        className={clsx(
                          "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                          selected.color.toLowerCase() === c ? "border-white scale-110" : "border-white/20",
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </Section>

              <Section title="Стиль">
                <div className="grid grid-cols-2 gap-1.5">
                  <ToggleBtn active={selected.bold} onClick={() => update(selected.id, { bold: !selected.bold })}>
                    <Bold className="w-4 h-4" /> Bold
                  </ToggleBtn>
                  <ToggleBtn active={selected.italic} onClick={() => update(selected.id, { italic: !selected.italic })}>
                    <Italic className="w-4 h-4" /> Italic
                  </ToggleBtn>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  {(["left", "center", "right"] as const).map((a) => {
                    const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
                    return (
                      <ToggleBtn key={a} active={selected.align === a} onClick={() => update(selected.id, { align: a })}>
                        <Icon className="w-4 h-4" />
                      </ToggleBtn>
                    );
                  })}
                </div>
              </Section>

              <Section title={`Высота строки: ${selected.lineHeight.toFixed(2)}`}>
                <input
                  type="range"
                  min="0.9"
                  max="2"
                  step="0.05"
                  value={selected.lineHeight}
                  onChange={(e) => update(selected.id, { lineHeight: parseFloat(e.target.value) })}
                  className="w-full accent-hermes-500"
                />
              </Section>

              <Section title={`Межбуквенный: ${selected.letterSpacingEm.toFixed(2)}em`}>
                <input
                  type="range"
                  min="-0.04"
                  max="0.2"
                  step="0.01"
                  value={selected.letterSpacingEm}
                  onChange={(e) => update(selected.id, { letterSpacingEm: parseFloat(e.target.value) })}
                  className="w-full accent-hermes-500"
                />
              </Section>

              <Section title="Подложка (фон под текстом)">
                <ToggleBtn
                  active={selected.bgEnabled}
                  onClick={() => update(selected.id, { bgEnabled: !selected.bgEnabled })}
                  fullWidth
                >
                  <Square className="w-4 h-4" />
                  {selected.bgEnabled ? "Включена" : "Выключена"}
                </ToggleBtn>
                {selected.bgEnabled && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={selected.bgColor}
                        onChange={(e) => update(selected.id, { bgColor: e.target.value })}
                        className="w-9 h-9 rounded-lg border border-white/15 cursor-pointer bg-transparent"
                      />
                      <div className="flex-1 text-[11px] text-white/60">Цвет подложки</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1">
                        Прозрачность: {Math.round(selected.bgOpacity * 100)}%
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={selected.bgOpacity}
                        onChange={(e) => update(selected.id, { bgOpacity: parseFloat(e.target.value) })}
                        className="w-full accent-hermes-500"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1">
                        Отступы: {selected.bgPaddingPct.toFixed(1)}%
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        value={selected.bgPaddingPct}
                        onChange={(e) => update(selected.id, { bgPaddingPct: parseFloat(e.target.value) })}
                        className="w-full accent-hermes-500"
                      />
                    </div>
                  </div>
                )}
              </Section>

              <button
                onClick={() => remove(selected.id)}
                className="w-full bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Удалить блок
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">{title}</div>
      {children}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
  fullWidth,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1.5 transition-colors",
        fullWidth && "w-full",
        active ? "bg-hermes-500 text-white" : "bg-white/10 hover:bg-white/15 text-white/70",
      )}
    >
      {children}
    </button>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}
