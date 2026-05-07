"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Languages,
  Loader2,
  PieChart,
  Plus,
  ShoppingBag,
  Share2,
  Sliders,
  Sparkles,
  Upload,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { computeProductGenCost } from "@/lib/pricing";
import { generateTzBrief } from "@/actions/generateTzBrief";

/**
 * Shared 4-step wizard for /sites/new, /presentations/new, /products/new.
 *
 * Why shared:
 *   - Three products have nearly identical UX flow (brief → details →
 *     generate → result). Diverging into 3 standalone files invites
 *     UX drift and duplication of state-management bugs.
 *
 * Tailwind JIT:
 *   - All theme classes are LITERAL strings inside the THEMES const.
 *     Tailwind sees them at build time, no dynamic interpolation.
 *
 * Tied to v2 backend:
 *   - 1 variant from Claude Opus 4.7
 *   - Variable element count (slider)
 *   - Language selector (ru / en / kz)
 *   - Single product photo passed to all image gens
 *   - Refs (URLs / images / extra context)
 */

type ContentLang = "ru" | "en" | "kz";

export type ProductKind = "site" | "presentation" | "product-cards";

export interface WizardConfig {
  product: ProductKind;
  generateUrl: string;
  publishUrl?: string;
  publishPathPrefix?: string;
  countParamName: string;
  countRange: { min: number; max: number; default: number };
  elementLabelGenitive: string;
  productTitle: string;
  productHeroLine: string;
  briefPlaceholder: string;
  downloadFileName: string;
  featureEnabled: boolean;
  iconKind: "site" | "presentation" | "product";
}

const THEMES: Record<
  ProductKind,
  {
    accentText: string;
    accentBg: string;
    focusBorder: string;
    focusRing: string;
    hoverBg: string;
    hoverBorder: string;
    btnGradient: string;
    btnGradientHover: string;
    btnShadow: string;
    pillBg: string;
    progressDoneBg: string;
    progressLineBg: string;
    accentRangeClass: string;
  }
> = {
  site: {
    accentText: "text-hermes-500",
    accentBg: "bg-hermes-500",
    focusBorder: "focus:border-hermes-500",
    focusRing: "focus:ring-hermes-500/20",
    hoverBg: "hover:bg-hermes-50",
    hoverBorder: "hover:border-hermes-500",
    btnGradient: "from-hermes-500 to-orange-500",
    btnGradientHover: "hover:from-hermes-600 hover:to-orange-600",
    btnShadow: "shadow-hermes-500/30",
    pillBg: "bg-hermes-50",
    progressDoneBg: "bg-hermes-500",
    progressLineBg: "bg-hermes-500",
    accentRangeClass: "accent-hermes-500",
  },
  presentation: {
    accentText: "text-violet-500",
    accentBg: "bg-violet-500",
    focusBorder: "focus:border-violet-500",
    focusRing: "focus:ring-violet-500/20",
    hoverBg: "hover:bg-violet-50",
    hoverBorder: "hover:border-violet-500",
    btnGradient: "from-violet-500 to-fuchsia-500",
    btnGradientHover: "hover:from-violet-600 hover:to-fuchsia-600",
    btnShadow: "shadow-violet-500/30",
    pillBg: "bg-violet-50",
    progressDoneBg: "bg-violet-500",
    progressLineBg: "bg-violet-500",
    accentRangeClass: "accent-violet-500",
  },
  "product-cards": {
    accentText: "text-emerald-500",
    accentBg: "bg-emerald-500",
    focusBorder: "focus:border-emerald-500",
    focusRing: "focus:ring-emerald-500/20",
    hoverBg: "hover:bg-emerald-50",
    hoverBorder: "hover:border-emerald-500",
    btnGradient: "from-emerald-500 to-teal-500",
    btnGradientHover: "hover:from-emerald-600 hover:to-teal-600",
    btnShadow: "shadow-emerald-500/30",
    pillBg: "bg-emerald-50",
    progressDoneBg: "bg-emerald-500",
    progressLineBg: "bg-emerald-500",
    accentRangeClass: "accent-emerald-500",
  },
};

const STEPS = [
  { num: 1, label: "Бриф" },
  { num: 2, label: "Параметры" },
  { num: 3, label: "Создание" },
  { num: 4, label: "Готово" },
];

function ProductIcon({ kind, className }: { kind: WizardConfig["iconKind"]; className?: string }) {
  if (kind === "site") return <Globe className={className} />;
  if (kind === "presentation") return <PieChart className={className} />;
  return <ShoppingBag className={className} />;
}

export function ProductWizard({ config }: { config: WizardConfig }) {
  const theme = THEMES[config.product];

  const [step, setStep] = useState(1);

  // Step 1
  const [brief, setBrief] = useState("");
  const [cityCountry, setCityCountry] = useState("");
  const [tzHelperOpen, setTzHelperOpen] = useState(false);
  const [tzSubject, setTzSubject] = useState("");
  const [tzBenefit, setTzBenefit] = useState("");
  const [tzAudience, setTzAudience] = useState("");
  const [tzStyle, setTzStyle] = useState("");
  const [tzBuilding, setTzBuilding] = useState(false);
  const [tzError, setTzError] = useState<string | null>(null);

  // Step 2
  const [count, setCount] = useState(config.countRange.default);
  const [language, setLanguage] = useState<ContentLang>("ru");
  const [productPhoto, setProductPhoto] = useState<string | null>(null);
  const [extOpen, setExtOpen] = useState(false);
  const [refUrlsRaw, setRefUrlsRaw] = useState("");
  const [refImages, setRefImages] = useState<string[]>([]);
  const [extraContext, setExtraContext] = useState("");

  // Step 3-4
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [resultHtml, setResultHtml] = useState<string | null>(null);

  type PublishState =
    | { kind: "idle" }
    | { kind: "publishing" }
    | { kind: "ready"; url: string }
    | { kind: "failed"; error: string };
  const [publish, setPublish] = useState<PublishState>({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  // Refine state — free-text instruction applied to the current
  // resultHtml. `refineHistory` holds previous versions so the user can
  // undo a regrettable refine without re-paying. Stack is kept in
  // memory; lost on page refresh which is fine for v1.
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [refineHistory, setRefineHistory] = useState<string[]>([]);

  const cost = computeProductGenCost(config.product, count);
  const canGenerate = brief.trim().length >= 30 && config.featureEnabled;
  const costKzt = Math.round(cost * 52); // ~52 ₸ per impulse weighted average

  // ── Draft persistence ─────────────────────────────────────────
  // Save brief / city / count / language to sessionStorage so closing
  // the tab mid-flow doesn't wipe progress. Per-product key, scoped to
  // the current tab session (sessionStorage clears on browser close).
  // Generation result (resultHtml) is NOT persisted — too large and
  // user usually wants to regenerate after returning.
  const draftKey = `aicreative.wizard.draft.${config.product}`;
  // Restore on mount — only fields, not result.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (typeof draft.brief === "string") setBrief(draft.brief);
      if (typeof draft.cityCountry === "string") setCityCountry(draft.cityCountry);
      if (typeof draft.count === "number") setCount(draft.count);
      if (draft.language === "ru" || draft.language === "en" || draft.language === "kz") setLanguage(draft.language);
      if (typeof draft.refUrlsRaw === "string") setRefUrlsRaw(draft.refUrlsRaw);
      if (typeof draft.extraContext === "string") setExtraContext(draft.extraContext);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Persist on field change (debounced via direct write — sessionStorage
  // is synchronous and cheap, no debounce needed for our payload size).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ brief, cityCountry, count, language, refUrlsRaw, extraContext }),
      );
    } catch {}
  }, [draftKey, brief, cityCountry, count, language, refUrlsRaw, extraContext]);

  async function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleBuildBrief() {
    setTzError(null);
    if (!tzSubject.trim() && !tzBenefit.trim() && !tzAudience.trim() && !tzStyle.trim()) {
      setTzError("Заполни хотя бы одно поле");
      return;
    }
    setTzBuilding(true);
    try {
      const res = await generateTzBrief({
        subject: tzSubject,
        benefit: tzBenefit,
        audience: tzAudience,
        style: tzStyle,
        cityCountry,
      });
      if (res.success) {
        setBrief(res.brief);
        setTzHelperOpen(false);
      } else {
        setTzError(res.error);
      }
    } finally {
      setTzBuilding(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    setResultHtml(null);
    setPublish({ kind: "idle" });
    try {
      const refUrls = refUrlsRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const body: Record<string, unknown> = {
        brief,
        cityCountry,
        language,
        productPhoto: productPhoto || undefined,
        referenceImages: refImages,
        referenceUrls: refUrls,
        extraContext,
        [config.countParamName]: count,
      };
      const res = await fetch(config.generateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setResultHtml(data.html as string);
      setStep(4);
    } catch (e: any) {
      setGenError(e?.message || "Ошибка генерации");
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    if (!resultHtml || !config.publishUrl) return;
    setPublish({ kind: "publishing" });
    try {
      const res = await fetch(config.publishUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: resultHtml }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data?.error || `HTTP ${res.status}`);
      setPublish({ kind: "ready", url: data.url });
    } catch (e: any) {
      setPublish({ kind: "failed", error: e?.message || "publish failed" });
    }
  }

  function downloadHtml() {
    if (!resultHtml) return;
    const blob = new Blob([resultHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.downloadFileName}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function copyShareUrl(path: string) {
    const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    navigator.clipboard?.writeText(fullUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function startOver() {
    setStep(1);
    setResultHtml(null);
    setGenError(null);
    setPublish({ kind: "idle" });
    setRefineOpen(false);
    setRefineInstruction("");
    setRefineError(null);
    setRefineHistory([]);
  }

  function undoRefine() {
    if (refineHistory.length === 0) return;
    const previous = refineHistory[refineHistory.length - 1];
    setRefineHistory((p) => p.slice(0, -1));
    setResultHtml(previous);
    // Reset publish — the URL would point to the now-overwritten version.
    setPublish({ kind: "idle" });
  }

  async function handleRefine() {
    if (!resultHtml || refineInstruction.trim().length < 5) return;
    setRefining(true);
    setRefineError(null);
    try {
      const res = await fetch("/api/refine-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: resultHtml, instruction: refineInstruction.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      // Push current resultHtml onto the undo stack BEFORE replacing.
      setRefineHistory((p) => [...p, resultHtml]);
      setResultHtml(data.html as string);
      setRefineInstruction("");
      setRefineOpen(false);
      // Reset publish — the URL would point to old version.
      setPublish({ kind: "idle" });
    } catch (e: any) {
      setRefineError(e?.message || "Ошибка правки");
    } finally {
      setRefining(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white text-neutral-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/editor" className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">В редактор</span>
          </Link>
          <div className="flex items-center gap-2">
            <ProductIcon kind={config.iconKind} className={`w-5 h-5 ${theme.accentText}`} />
            <span className="font-black text-base sm:text-lg">{config.productTitle}</span>
            <span className="hidden sm:inline ml-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-700">
              Beta
            </span>
          </div>
          <Link href="/" className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors">
            На сайт
          </Link>
        </div>
      </header>

      {!config.featureEnabled && (
        <div className="bg-gradient-to-r from-amber-100 via-amber-50 to-amber-100 border-b border-amber-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 text-center text-xs sm:text-sm font-bold text-amber-900">
            🚧 Beta-тест — функция в активной разработке. Скоро запустим публично.
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const done = step > s.num;
            const active = step === s.num;
            return (
              <div key={s.num} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={clsx(
                      "w-9 h-9 rounded-full flex items-center justify-center font-black text-sm transition-all",
                      done && `${theme.progressDoneBg} text-white`,
                      active && "bg-neutral-900 text-white ring-4 ring-neutral-900/10",
                      !done && !active && "bg-neutral-200 text-neutral-500",
                    )}
                  >
                    {done ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  <span
                    className={clsx(
                      "text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                      active ? "text-neutral-900" : "text-neutral-400",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={clsx(
                      "h-0.5 flex-1 mx-2 sm:mx-4 mt-[-18px] transition-colors",
                      step > s.num ? theme.progressLineBg : "bg-neutral-200",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-24">
        <AnimatePresence mode="wait">
          {/* ─── Step 1: Brief ─────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                  {config.productHeroLine}
                </h1>
                <p className="text-neutral-500 text-sm sm:text-base">
                  Опиши что и кому продаёшь — чем точнее, тем лучше результат.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 space-y-4">
                <label className="block">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold">ТЗ / Бриф</span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {brief.length} / 30+ симв.
                    </span>
                  </div>
                  <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    rows={8}
                    placeholder={config.briefPlaceholder}
                    className={clsx(
                      "w-full text-sm px-3 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 resize-none transition-colors",
                      theme.focusBorder,
                      theme.focusRing,
                    )}
                  />
                </label>
                <input
                  type="text"
                  value={cityCountry}
                  onChange={(e) => setCityCountry(e.target.value)}
                  placeholder="Город / страна (необязательно)"
                  className={clsx(
                    "w-full text-sm px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 transition-colors",
                    theme.focusBorder,
                    theme.focusRing,
                  )}
                />
              </div>

              {/* TZ helper */}
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTzHelperOpen((v) => !v)}
                  className="w-full px-4 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-100 flex items-center gap-2 transition-colors"
                >
                  <Wand2 className={clsx("w-4 h-4", theme.accentText)} />
                  <span className="flex-1 text-left">Помоги написать ТЗ — 4 коротких поля</span>
                  <span className="text-xs text-neutral-400">{tzHelperOpen ? "−" : "+"}</span>
                </button>
                <AnimatePresence>
                  {tzHelperOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-neutral-200"
                    >
                      <div className="p-4 space-y-3 bg-white">
                        <input value={tzSubject} onChange={(e) => setTzSubject(e.target.value)} placeholder="Что рекламируем" className={clsx("w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 focus:outline-none", theme.focusBorder)} />
                        <input value={tzBenefit} onChange={(e) => setTzBenefit(e.target.value)} placeholder="Главная выгода" className={clsx("w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 focus:outline-none", theme.focusBorder)} />
                        <input value={tzAudience} onChange={(e) => setTzAudience(e.target.value)} placeholder="Целевая аудитория" className={clsx("w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 focus:outline-none", theme.focusBorder)} />
                        <input value={tzStyle} onChange={(e) => setTzStyle(e.target.value)} placeholder="Стиль и тон" className={clsx("w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 focus:outline-none", theme.focusBorder)} />
                        <button
                          onClick={handleBuildBrief}
                          disabled={tzBuilding}
                          className={clsx(
                            "w-full text-white font-bold text-sm px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50",
                            theme.accentBg,
                            "hover:opacity-90",
                          )}
                        >
                          {tzBuilding ? <><Loader2 className="w-4 h-4 animate-spin" /> Пишу ТЗ…</> : <><Sparkles className="w-4 h-4" /> Сформировать ТЗ</>}
                        </button>
                        {tzError && <p className="text-xs text-rose-600">{tzError}</p>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setStep(2)}
                  disabled={brief.trim().length < 30}
                  className="bg-neutral-900 hover:bg-black disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-bold text-sm px-6 py-3 rounded-xl flex items-center gap-2 transition-colors"
                >
                  Дальше — параметры
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── Step 2: Details ─────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Параметры</h1>
                <p className="text-neutral-500 text-sm sm:text-base">
                  Выбери количество, язык, опционально загрузи фото товара.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-neutral-500" />
                    <span className="text-sm font-bold">Сколько {config.elementLabelGenitive}</span>
                  </div>
                  <span className={clsx("text-2xl font-black tabular-nums", theme.accentText)}>{count}</span>
                </div>
                <input
                  type="range"
                  min={config.countRange.min}
                  max={config.countRange.max}
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value, 10))}
                  className={clsx("w-full h-2 cursor-pointer", theme.accentRangeClass)}
                />
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                  <span>{config.countRange.min} мин</span>
                  <span>default {config.countRange.default}</span>
                  <span>{config.countRange.max} макс</span>
                </div>
                <p className="text-xs text-neutral-500">
                  Стоимость: <span className={clsx("font-bold", theme.accentText)}>{cost} ⚡</span> ≈ {costKzt.toLocaleString("ru-RU")} ₸
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Languages className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm font-bold">Язык</span>
                </div>
                <div className="grid grid-cols-3 gap-1 p-0.5 bg-neutral-100 rounded-xl">
                  {([
                    { id: "ru", label: "Русский" },
                    { id: "en", label: "English" },
                    { id: "kz", label: "Қазақша" },
                  ] as { id: ContentLang; label: string }[]).map((l) => {
                    const active = language === l.id;
                    return (
                      <button
                        key={l.id}
                        onClick={() => setLanguage(l.id)}
                        className={clsx(
                          "py-2 px-2 rounded-lg text-xs font-bold transition-colors",
                          active ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700",
                        )}
                      >
                        {l.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm font-bold">Фото товара (опционально)</span>
                </div>
                <p className="text-xs text-neutral-500">
                  Если загрузишь — товар будет на ВСЕХ генерируемых картинках. ИИ
                  сохранит цвет, форму, этикетку.
                </p>
                <div className="flex items-center gap-3">
                  {productPhoto ? (
                    <div className="relative w-20 h-20 rounded-lg border border-neutral-200 overflow-hidden">
                      <img src={productPhoto} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setProductPhoto(null)}
                        className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className={clsx(
                      "w-20 h-20 rounded-lg border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center cursor-pointer text-neutral-400 transition-colors gap-1",
                      theme.hoverBorder,
                      theme.hoverBg,
                      "hover:text-neutral-700",
                    )}>
                      <Upload className="w-5 h-5" />
                      <span className="text-[9px] font-bold uppercase">Загрузить</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) readFileAsDataUrl(f).then(setProductPhoto);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExtOpen((v) => !v)}
                  className="w-full px-4 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-100 flex items-center gap-2 transition-colors"
                >
                  <Sparkles className={clsx("w-4 h-4", theme.accentText)} />
                  <span className="flex-1 text-left">Расширенный режим — референсы и доп. контекст</span>
                  <span className="text-xs text-neutral-400">{extOpen ? "−" : "+"}</span>
                </button>
                <AnimatePresence>
                  {extOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-neutral-200"
                    >
                      <div className="p-4 space-y-4 bg-white">
                        <label className="block">
                          <span className="text-xs font-bold text-neutral-700">Ссылки на сайты-примеры</span>
                          <textarea
                            value={refUrlsRaw}
                            onChange={(e) => setRefUrlsRaw(e.target.value)}
                            rows={3}
                            placeholder={"vercel.com\nlinear.app\nstripe.com"}
                            className={clsx(
                              "w-full mt-1.5 text-sm px-3 py-2 rounded-lg border border-neutral-200 focus:outline-none resize-none font-mono",
                              theme.focusBorder,
                            )}
                          />
                          <p className="text-[10px] text-neutral-400 mt-1">Одна ссылка на строку.</p>
                        </label>
                        <div>
                          <span className="text-xs font-bold text-neutral-700 block mb-1.5">Референс-картинки (до 3)</span>
                          <div className="flex flex-wrap gap-2">
                            {refImages.map((img, i) => (
                              <div key={i} className="relative group w-16 h-16 rounded-lg border border-neutral-200 overflow-hidden">
                                <img src={img} alt="" className="w-full h-full object-cover" />
                                <button
                                  onClick={() => setRefImages((p) => p.filter((_, j) => j !== i))}
                                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            {refImages.length < 3 && (
                              <label className={clsx(
                                "w-16 h-16 rounded-lg border-2 border-dashed border-neutral-300 flex items-center justify-center cursor-pointer text-neutral-400 transition-colors",
                                theme.hoverBorder,
                                theme.hoverBg,
                              )}>
                                <Plus className="w-5 h-5" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f && refImages.length < 3) {
                                      readFileAsDataUrl(f).then((dataUrl) =>
                                        setRefImages((p) => [...p, dataUrl].slice(0, 3)),
                                      );
                                    }
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                        <label className="block">
                          <span className="text-xs font-bold text-neutral-700">Доп. контекст</span>
                          <textarea
                            value={extraContext}
                            onChange={(e) => setExtraContext(e.target.value)}
                            rows={3}
                            placeholder="Любые детали: фокус на гарантии возврата, упомянуть сертификат..."
                            className={clsx(
                              "w-full mt-1.5 text-sm px-3 py-2 rounded-lg border border-neutral-200 focus:outline-none resize-none",
                              theme.focusBorder,
                            )}
                          />
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(1)} className="text-neutral-500 hover:text-neutral-900 font-bold text-sm px-4 py-3 rounded-xl flex items-center gap-2 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Назад
                </button>
                <button onClick={() => setStep(3)} className="bg-neutral-900 hover:bg-black text-white font-bold text-sm px-6 py-3 rounded-xl flex items-center gap-2 transition-colors">
                  Дальше — создать <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── Step 3: Generate ─────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Готово к запуску</h1>
                <p className="text-neutral-500 text-sm sm:text-base">
                  Соберём результат через Claude Opus 4.7 — лучшая модель для копи + HTML.
                  ~30-90 сек.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">Кол-во</span>
                    <span className="font-black text-lg">{count} {config.elementLabelGenitive}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">Язык</span>
                    <span className="font-black text-lg">{language === "ru" ? "Русский" : language === "en" ? "English" : "Қазақша"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">Фото</span>
                    <span className="font-black text-lg">{productPhoto ? "Загружено" : "ИИ нарисует"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">Стоимость</span>
                    <span className={clsx("font-black text-lg", theme.accentText)}>{cost} ⚡ <span className="text-xs font-normal text-neutral-500">≈ {costKzt.toLocaleString("ru-RU")} ₸</span></span>
                  </div>
                </div>
              </div>

              {genError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">⚠️ {genError}</div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={canGenerate ? handleGenerate : undefined}
                  disabled={!canGenerate || generating}
                  className={clsx(
                    "bg-gradient-to-r disabled:from-neutral-300 disabled:to-neutral-300 disabled:cursor-not-allowed text-white font-bold text-base px-6 py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg disabled:shadow-none transition-all",
                    theme.btnGradient,
                    theme.btnGradientHover,
                    theme.btnShadow,
                  )}
                >
                  {!config.featureEnabled ? (
                    <>🚧 Скоро · Beta-тест</>
                  ) : generating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Создаю... 30-90 сек
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" /> Создать
                      <span className="ml-2 inline-flex items-center gap-1 text-sm font-bold bg-white/20 px-2 py-0.5 rounded">
                        <Zap className="w-3.5 h-3.5" /> {cost}
                      </span>
                    </>
                  )}
                </button>
                <button onClick={() => setStep(2)} disabled={generating} className="text-neutral-500 hover:text-neutral-900 font-bold text-sm px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                  <ArrowLeft className="w-4 h-4" /> Назад
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── Step 4: Result ─────────────────────────── */}
          {step === 4 && resultHtml && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Готово</h1>
                <p className="text-neutral-500 text-sm sm:text-base">
                  Опубликуй на нашем домене или скачай HTML.
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                  <span className="text-sm font-black">Результат</span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {resultHtml.length.toLocaleString("ru-RU")} симв.
                  </span>
                </div>
                <iframe
                  title="result"
                  srcDoc={resultHtml}
                  sandbox="allow-scripts"
                  className="w-full h-[640px] bg-white"
                />
                <div className="p-4 space-y-2 border-t border-neutral-100">
                  {config.publishUrl && config.publishPathPrefix && (
                    <>
                      {publish.kind === "idle" && (
                        <button
                          onClick={handlePublish}
                          className={clsx(
                            "w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-gradient-to-r text-white shadow-md transition-all",
                            theme.btnGradient,
                            theme.btnGradientHover,
                          )}
                        >
                          <Share2 className="w-4 h-4" />
                          Опубликовать на aicreative.kz
                        </button>
                      )}
                      {publish.kind === "publishing" && (
                        <div className={clsx("w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-neutral-700 border border-neutral-200", theme.pillBg)}>
                          <Loader2 className="w-4 h-4 animate-spin" /> Публикую...
                        </div>
                      )}
                      {publish.kind === "ready" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-mono text-emerald-900 truncate">
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="truncate flex-1">aicreative.kz{publish.url}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => copyShareUrl(publish.url)} className="py-2.5 rounded-xl font-bold text-sm bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center gap-1.5 transition-colors">
                              <Copy className="w-4 h-4" /> {copied ? "Скопировано!" : "Скопировать"}
                            </button>
                            <a href={publish.url} target="_blank" rel="noopener noreferrer" className="py-2.5 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-1.5 transition-colors">
                              <ExternalLink className="w-4 h-4" /> Открыть
                            </a>
                          </div>
                        </div>
                      )}
                      {publish.kind === "failed" && (
                        <button onClick={handlePublish} className="w-full py-3 rounded-xl font-bold text-sm bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 flex items-center justify-center gap-2 transition-colors" title={publish.error}>
                          <Share2 className="w-4 h-4" /> Ошибка — повторить публикацию
                        </button>
                      )}
                    </>
                  )}

                  <button onClick={downloadHtml} className="w-full py-2.5 rounded-xl font-bold text-sm bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center gap-2 transition-colors">
                    <Download className="w-4 h-4" /> Скачать HTML
                  </button>

                  {/* Refine block — text-instruction edit. ~5⚡ per refine. */}
                  {!refineOpen ? (
                    <div className={refineHistory.length > 0 ? "grid grid-cols-3 gap-2" : ""}>
                      <button
                        onClick={() => setRefineOpen(true)}
                        className={clsx(
                          "py-2.5 rounded-xl font-bold text-sm bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center gap-2 transition-colors",
                          refineHistory.length > 0 ? "col-span-2" : "w-full",
                        )}
                      >
                        <Wand2 className="w-4 h-4" /> Доработать (5⚡)
                      </button>
                      {refineHistory.length > 0 && (
                        <button
                          onClick={undoRefine}
                          title={`Откатить последнюю правку (${refineHistory.length} в стеке)`}
                          className="py-2.5 rounded-xl font-bold text-sm bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          ↶ Откатить
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 space-y-2">
                      <textarea
                        value={refineInstruction}
                        onChange={(e) => setRefineInstruction(e.target.value)}
                        rows={3}
                        placeholder='Что изменить? Например: "поменяй заголовок на «Звук без проводов»" или "сделай фон тёмнее" или "удали 3-ю карточку"'
                        className="w-full text-sm px-3 py-2 rounded-lg border border-sky-200 focus:outline-none focus:border-sky-500 resize-none bg-white"
                      />
                      {refineError && (
                        <p className="text-xs text-rose-700">{refineError}</p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setRefineOpen(false);
                            setRefineInstruction("");
                            setRefineError(null);
                          }}
                          disabled={refining}
                          className="py-2 rounded-lg font-bold text-xs bg-white text-neutral-700 hover:bg-neutral-100 transition-colors disabled:opacity-50"
                        >
                          Отмена
                        </button>
                        <button
                          onClick={handleRefine}
                          disabled={refining || refineInstruction.trim().length < 5}
                          className="py-2 rounded-lg font-bold text-xs bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white flex items-center justify-center gap-1.5 transition-colors"
                        >
                          {refining ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Применяю...</>
                          ) : (
                            <><Wand2 className="w-3.5 h-3.5" /> Применить (5⚡)</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <button onClick={startOver} className="text-neutral-500 hover:text-neutral-900 font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
                  <Sparkles className="w-4 h-4" /> Создать ещё один
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
