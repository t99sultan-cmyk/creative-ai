"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Code2, Image as ImageIcon, Loader2, Expand, Maximize, Smartphone, Upload, Frame, X, Download, Video, PackageSearch, Trash2, Scissors, Zap, Check, Wand2, Lightbulb, ChevronDown, Eye, EyeOff, LayoutGrid, Trophy } from "lucide-react";
import { toggleCreativePublic } from "@/actions/galleryActions";
import { TemplatesModal } from "@/components/TemplatesModal";
import { STATIC_DUAL_COST, VIDEO_GEN_COST } from "@/lib/pricing";
import { generateTzBrief } from "@/actions/generateTzBrief";
import { polishProductPhoto } from "@/actions/polishProductPhoto";
import clsx from "clsx";
import { removeBackground } from "@imgly/background-removal";
import { useUser } from "@clerk/nextjs";
import { getUserBalance } from "@/actions/getUserBalance";
import { redeemPromoCode } from "@/actions/redeemPromoCode";
import { trackPurchase } from "@/lib/fb-pixel";
import { getUserCreatives, getCreativeHtml } from "@/actions/getUserCreatives";
import { deleteUserCreative } from "@/actions/deleteUserCreative";
import { cancelGeneration } from "@/actions/generationActions";
import { buildLoadingTexts, optimizeImageToWebP } from "@/lib/editor-utils";
import { VideoRecordingModal } from "@/components/editor/VideoRecordingModal";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type Format = "1:1" | "9:16";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [remixSourceCode, setRemixSourceCode] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("9:16");
  // Animation removed in this iteration — only static. The constant
  // is kept so we don't have to gut every conditional in the file
  // (TypeScript will tree-shake the dead branches).
  const isAnimated = false as const;
  // Static path: 1 image from each model (Gemini 3 Pro + GPT Image 2).
  const variantCount: 1 = 1;
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Per-click cost. Static = 2 models × 1 variant × 2 imp = 4 imp.
  const currentCost = variantCount * 2 * 2;
  
  const [referenceImages, setReferenceImages] = useState<{ file: File; dataUrl: string }[]>([]);
  const [productImages, setProductImages] = useState<{ file: File; dataUrl: string; original?: string }[]>([]);
  const [pendingProductFile, setPendingProductFile] = useState<{ file: File; dataUrl: string } | null>(null);
  // Per-product-photo polish state. Indices line up with productImages.
  // `idle` (just uploaded), `polishing`, `polished`, `failed`.
  type PolishState = "idle" | "polishing" | "polished" | "failed";
  const [polishStateByIndex, setPolishStateByIndex] = useState<Record<number, PolishState>>({});
  // strictClone is no longer a user choice — when there's a reference
  // image, we ALWAYS pass strict-clone=true to /api/generate. Without
  // it the model treats the reference as soft inspiration and makes
  // wildly off-style outputs. This was the single biggest source of
  // "не похоже на то, что я загрузил" complaints.

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0); 
  const [loadingText, setLoadingText] = useState("Инициируем сервера...");
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showVideoInstruction, setShowVideoInstruction] = useState(false);
  
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState("");

  // ---- Multi-model triplet state ----
  // Animated mode → `pair.claude` + `pair.gemini` (HTML).
  // Static mode  → `pair.variants` (Nano Banana × N + GPT-Image-1 × N).
  // The two are mutually exclusive — only one is populated per
  // generation. UI branches on whichever is present.
  type DualGen = { creativeId: string; code: string };
  type ImageGen = { creativeId: string; imageUrl: string };
  type ImageVariant = {
    creativeId: string | null;
    model: "gemini-3-pro-image" | "gpt-image-2";
    ok: boolean;
    imageUrl: string | null;
    error: string | null;
  };
  const [pair, setPair] = useState<{
    pairId: string;
    claude: DualGen | null;
    gemini: DualGen | null;
    imagen: ImageGen | null;
    variants: ImageVariant[] | null;
    claudeError?: string;
    geminiError?: string;
    imagenError?: string;
  } | null>(null);

  // Veo 3 video state — kicked from "Сделать видео" button under winner.
  // `videoJob` holds the in-flight job; client polls /api/check-video
  // every ~5 sec until state=ready or state=failed.
  type VideoState = "kicking" | "polling" | "ready" | "failed";
  const [videoJob, setVideoJob] = useState<{
    creativeId: string;
    sourceCreativeId: string;
    state: VideoState;
    videoUrl?: string;
    error?: string;
  } | null>(null);

  const [mobileTab, setMobileTab] = useState<'controls' | 'canvas'>('controls');
  const [feedback, setFeedback] = useState<'like'|'dislike'|null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const MAX_IMAGES = 4;

  const [impulses, setImpulses] = useState<number | null>(null);
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [promoSuccess, setPromoSuccess] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeCreativeId, setActiveCreativeId] = useState<string | null>(null);

  // ---- TZ helper / 4-question wizard ----
  // The user can fill in 4 short fields and we synthesize a clean
  // Russian brief for the image-gen models. Keeps prompts consistent
  // ("реклама ___, главное ___, аудитория ___, стиль ___") without
  // making the user remember the structure each time.
  const [tzHelperOpen, setTzHelperOpen] = useState(false);
  const [tzSubject, setTzSubject] = useState("");
  const [tzBenefit, setTzBenefit] = useState("");
  const [tzAudience, setTzAudience] = useState("");
  const [tzStyle, setTzStyle] = useState("");
  const [tzBuilding, setTzBuilding] = useState(false);
  const [tzError, setTzError] = useState<string | null>(null);
  async function buildTzFromHelper() {
    setTzError(null);
    if (!tzSubject.trim() && !tzBenefit.trim() && !tzAudience.trim() && !tzStyle.trim()) {
      return;
    }
    setTzBuilding(true);
    try {
      const result = await generateTzBrief({
        subject: tzSubject,
        benefit: tzBenefit,
        audience: tzAudience,
        style: tzStyle,
      });
      if (result.success) {
        setPrompt(result.brief);
        setTzHelperOpen(false);
      } else {
        setTzError(result.error);
      }
    } finally {
      setTzBuilding(false);
    }
  }

  // Which image variant the user marked as "best" — controls the gold
  // star highlight on the cards. One per pair; selecting a different
  // card auto-deselects the previous one.
  const [bestCreativeId, setBestCreativeId] = useState<string | null>(null);
  const [savingBestId, setSavingBestId] = useState<string | null>(null);

  async function markAsBest(creativeId: string) {
    if (!creativeId || savingBestId) return;
    setSavingBestId(creativeId);
    try {
      const res = await fetch("/api/select-best", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creativeId }),
      });
      if (res.ok) {
        setBestCreativeId(creativeId);
      } else {
        const err = await res.json().catch(() => ({}));
        console.warn("[select-best] failed:", err);
      }
    } finally {
      setSavingBestId(null);
    }
  }
  
  // Moved below historyItems
  const [backgroundJobId, setBackgroundJobId] = useState<string | null>(null);
  const [isBackgroundRendering, setIsBackgroundRendering] = useState(false);
  const [renderPhase, setRenderPhase] = useState<string>('Инициализация...');
  const [renderProgress, setRenderProgress] = useState<number>(0);
  // History
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showHistoryWarning, setShowHistoryWarning] = useState(true);
  const [downloadedItems, setDownloadedItems] = useState<string[]>([]);
  // "View Mode" properties based on either the canvas OR the active history item
  const [backgroundStatuses, setBackgroundStatuses] = useState<Record<string, string>>({});
  const [renderJobs, setRenderJobs] = useState<Record<string, { startTime: number, totalFrames: number, format: string }>>({});
  const activeCreativeCode = activeCreativeId ? historyItems.find(i => i.id === activeCreativeId)?.htmlCode || code : code;

  // Lazy-load htmlCode for history items ONLY when the modal opens.
  // getUserCreatives returns metadata only (no htmlCode) so the editor's
  // initial page load is fast; here we fetch the heavy HTML in one batch
  // on demand, and merge it into historyItems state.
  useEffect(() => {
    if (!showHistory) return;
    const needsHtml = historyItems
      .filter((i: any) => !i.htmlCode)
      .map((i: any) => i.id);
    if (needsHtml.length === 0) return;

    let cancelled = false;
    (async () => {
      const res = await getCreativeHtml(needsHtml);
      if (cancelled || !res.success || !res.htmlMap) return;
      const map = res.htmlMap;
      setHistoryItems((prev: any[]) =>
        prev.map((item) => (map[item.id] ? { ...item, htmlCode: map[item.id] } : item)),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [showHistory, historyItems.length]);

  useEffect(() => {
    if (!showHistory || historyItems.length === 0) return;

    // Cross-device Sync: Map DB 'rendering:' strings into local background jobs
    try {
      const currentLocaltorage = JSON.parse(localStorage.getItem('backgroundRenderJobs') || '{}');
      let changed = false;
      historyItems.forEach((item: any) => {
         if (item.videoUrl && item.videoUrl.startsWith('rendering:')) {
             const startTime = parseInt(item.videoUrl.split(':')[1]);
             // Add timeout check: if it's been more than 10 minutes, ignore DB render state
             if (Date.now() - startTime < 10 * 60 * 1000) {
                 if (!currentLocaltorage[item.id]) {
                     currentLocaltorage[item.id] = { startTime, totalFrames: item.format === '9:16' ? 450 : 300, format: item.format || '9:16' };
                     changed = true;
                 }
             } else {
                 if (currentLocaltorage[item.id]) {
                     delete currentLocaltorage[item.id];
                     changed = true;
                 }
             }
         }
      });
      if (changed) {
          localStorage.setItem('backgroundRenderJobs', JSON.stringify(currentLocaltorage));
          setRenderJobs(currentLocaltorage);
      }
    } catch(e) {}

    let isPolling = true;
    const fetchStatuses = async () => {
      // Animated detection: prefer htmlCode 'gsap' substring when loaded
      // (reliable even for legacy creatives saved with cost=3), fall back
      // to cost > 3 for items that don't have htmlCode yet. After the
      // lazy-loader populates htmlCode, this effect re-runs (historyItems
      // is in the deps array) and any missed animated items get picked up.
      const itemsToCheck = historyItems.filter(
        (item: any) =>
          (item.htmlCode?.includes('gsap') || (item.cost ?? 3) > 3) &&
          !downloadedItems.includes(item.id),
      );
      for (const item of itemsToCheck) {
        if (!isPolling) break;
        // Do not query the server if the item is actively rendering locally
        const currentJobs = JSON.parse(localStorage.getItem('backgroundRenderJobs') || '{}');
        if (currentJobs[item.id]) continue;

        try {
          const res = await fetch(`/api/check-render?id=${item.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.ready) {
              setBackgroundStatuses(prev => ({...prev, [item.id]: 'done'}));
            }
          }
        } catch(e) {}
      }
    };
    fetchStatuses();
    return () => { isPolling = false; };
  }, [showHistory, historyItems, downloadedItems]);

  useEffect(() => {
    if (showHistory) {
      setShowHistoryWarning(true);
      const timer = setTimeout(() => setShowHistoryWarning(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [showHistory]);


  useEffect(() => {
    const saved = localStorage.getItem('downloadedCreativeIds');
    if (saved) setDownloadedItems(JSON.parse(saved));
  }, []);

  const markItemAsDownloaded = (id: string | null) => {
    if (!id) return;
    setDownloadedItems(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem('downloadedCreativeIds', JSON.stringify(next));
      return next;
    });
  };

  const isUIBlocked = isLoading || isRemovingBg || isRecording || isRedeeming;

  // Global Background Render Poller (Persists across page refresh!)
  useEffect(() => {
    const saved = localStorage.getItem('backgroundRenderJobs');
    if (saved) {
      try { setRenderJobs(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const activeKeys = Object.keys(renderJobs);
    if (!activeKeys.length) return;

    let isPolling = true;
    // Skip-counter: we don't fetch every tick. Strategy:
    //   - first 30s:  check every 2s  (skip 1 tick between fetches)
    //   - 30s–120s:  check every 3s  (skip 2)
    //   - 120s+:     check every 5s  (skip 4)
    // Saves 70–80% of /api/check-render calls while still feeling instant
    // to the user thanks to the server-side early-exit (< 45s → ~10ms).
    let tickCounter = 0;

    const interval = setInterval(async () => {
      if (!isPolling) return;
      tickCounter++;

      // Page Visibility: keep the timer so we can still detect 10-min
      // timeouts, but skip BOTH the progress-bar animation AND the network
      // polling when the user isn't looking. No point animating unseen UI
      // and no point spamming /api/check-render.
      const isTabVisible = typeof document !== 'undefined' && !document.hidden;

      const currentJobs = JSON.parse(localStorage.getItem('backgroundRenderJobs') || '{}');
      const jobsToUpdate = { ...currentJobs };
      let updated = false;

      // --- Progress bar animation for the active canvas creative ---
      if (activeCreativeId && currentJobs[activeCreativeId] && isTabVisible) {
         const job = currentJobs[activeCreativeId];
         const elapsedSec = Math.floor((Date.now() - job.startTime) / 1000);
         // Cloud Run takes about 3 to 4 minutes to render 450 frames
         const estimatedTotalSecs = job.totalFrames === 450 ? 240 : 180;
         const framesDone = Math.floor((elapsedSec / (estimatedTotalSecs - 30)) * job.totalFrames);

         if (elapsedSec < 5) {
            setRenderPhase('☁️ Инициализация сервера Cloud Run...');
         } else if (framesDone < job.totalFrames) {
            setRenderPhase(`🎞️ Покадровая сборка: ${Math.min(framesDone, job.totalFrames)} / ${job.totalFrames} кадров`);
         } else if (elapsedSec < estimatedTotalSecs - 5) {
            setRenderPhase(`⚙️ Кодирование H.264 и выгрузка в облако...`);
         } else if (elapsedSec < 5 * 60) {
            // First 5 min past the estimated window: it's "finishing up"
            setRenderPhase(`🔄 Финализация файла... ожидание сервера`);
         } else {
            // Past 5 min — be honest, don't pretend we're "almost done"
            setRenderPhase(`⏳ Сервер дольше обычного. Не уходите — видео на подходе...`);
         }

         // Visual progress bar that fills up over full estimated time
         setRenderProgress(10 + Math.min(85, (elapsedSec / estimatedTotalSecs) * 85));
         setIsRecording(true);
      }

      // --- Decide whether to actually fetch this tick (backoff) ---
      // Use the OLDEST active job's elapsed time as the "phase" signal.
      let minElapsed = Infinity;
      for (const id of activeKeys) {
        if (currentJobs[id]) {
          minElapsed = Math.min(minElapsed, Date.now() - currentJobs[id].startTime);
        }
      }
      const skipEvery = minElapsed < 30_000 ? 2 : minElapsed < 120_000 ? 3 : 5;
      const shouldFetchThisTick = tickCounter % skipEvery === 0;

      // --- Timeout check (runs every tick, independent of fetch backoff) ---
      for (const id of activeKeys) {
        if (!currentJobs[id]) continue;
        const jobElapsed = Date.now() - currentJobs[id].startTime;
        if (jobElapsed > 10 * 60 * 1000) {
          delete jobsToUpdate[id];
          updated = true;
          setBackgroundStatuses(prev => ({ ...prev, [id]: 'error' }));
          if (id === activeCreativeId && isRecording) {
            setIsRecording(false);
            setError("Слишком долгое ожидание. Процесс прерван по тайм-ауту (сервер отдыхает).");
          }
        }
      }

      // --- Parallel poll of all active creatives ---
      if (isTabVisible && shouldFetchThisTick) {
        const stillActive = activeKeys.filter(id => jobsToUpdate[id]);
        const results = await Promise.all(
          stillActive.map(async (id) => {
            try {
              const res = await fetch(`/api/check-render?id=${id}`);
              if (!res.ok) return { id, data: null };
              return { id, data: await res.json() };
            } catch {
              return { id, data: null };
            }
          }),
        );

        for (const { id, data } of results) {
          // Server says this creative was never actually rendering (empty
          // videoUrl in DB or creative not found). Drop the zombie job from
          // localStorage so we stop polling it forever.
          if (data?.notStarted) {
            delete jobsToUpdate[id];
            updated = true;
            setBackgroundStatuses(prev => ({ ...prev, [id]: 'error' }));
            if (id === activeCreativeId && isRecording) {
              setIsRecording(false);
              setError(data.error || 'Рендер не был запущен для этого креатива.');
            }
            continue;
          }
          // Explicit failure from server (failed:... prefix in DB).
          if (data?.failed) {
            delete jobsToUpdate[id];
            updated = true;
            setBackgroundStatuses(prev => ({ ...prev, [id]: 'error' }));
            if (id === activeCreativeId && isRecording) {
              setIsRecording(false);
              setError(data.error || 'Ошибка рендера.');
            }
            continue;
          }
          if (!data?.ready || !data.url) continue;
          const fileUrl = data.url;
          delete jobsToUpdate[id];
          updated = true;
          setBackgroundStatuses(prev => ({ ...prev, [id]: 'done' }));

          // Auto-download only the one the user is actively watching.
          if (id === activeCreativeId && isRecording) {
            setRenderProgress(100);
            setRenderPhase(`✅ Видео готово! Скачиваем на устройство...`);
            const jobFormat = currentJobs[id]?.format ?? '9:16';
            setTimeout(async () => {
              try {
                const videoRes = await fetch(fileUrl);
                if (videoRes.ok) {
                  const videoBlob = await videoRes.blob();
                  const blobUrl = URL.createObjectURL(videoBlob);
                  const link = document.createElement("a");
                  link.href = blobUrl;
                  link.download = `creative_${jobFormat}.mp4`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(blobUrl);
                } else {
                  window.location.href = `/api/download?url=${encodeURIComponent(fileUrl)}`;
                }
              } catch {
                window.location.href = `/api/download?url=${encodeURIComponent(fileUrl)}`;
              }
              markItemAsDownloaded(id);
              setIsRecording(false);
            }, 1000);
          }
        }
      }

      // Only commit state + localStorage on real changes. The previous
      // version called setRenderJobs() every tick, which re-triggered this
      // whole useEffect and silently recreated the interval every second.
      if (updated) {
        setRenderJobs(jobsToUpdate);
        localStorage.setItem('backgroundRenderJobs', JSON.stringify(jobsToUpdate));
      }
    }, 1000);
    return () => { isPolling = false; clearInterval(interval); };
  }, [renderJobs, activeCreativeId, isRecording]);

  // (Page Visibility is now read inline from `document.hidden` inside the
  // polling interval above — no stale closure, no stub.)

  useEffect(() => {
    async function fetchData() {
      const data = await getUserBalance();
      if (data.success) {
        setImpulses(data.impulses);
      }
      const hist = await getUserCreatives();
      if (hist.success && hist.creatives) {
        setHistoryItems(hist.creatives);
      }
    }
    fetchData();
  }, []);

  const handleRedeem = async () => {
    setIsRedeeming(true);
    setError("");
    setPromoSuccess("");
    try {
      const result = await redeemPromoCode(promoCode);
      if (result.success) {
        setPromoSuccess(`Успешно! Начислено +${result.impulsesAdded} ⚡️`);
        if (impulses !== null && result.impulsesAdded) {
          setImpulses(impulses + result.impulsesAdded);
        }
        // Meta Pixel conversion — fire Purchase with KZT value derived
        // from impulses so FB Ads Manager ROAS lines up with real revenue.
        if (result.impulsesAdded) {
          trackPurchase({ impulses: result.impulsesAdded, code: promoCode });
        }
        setPromoCode("");
        setTimeout(() => {
          setShowPromoInput(false);
          setPromoSuccess("");
        }, 3000);
      } else {
        setError(result.error || "Ошибка активации кода.");
      }
    } catch (err: any) {
      setError(err.message || "Ошибка системы");
    } finally {
      setIsRedeeming(false);
    }
  };

  // LOCAL STORAGE PERSISTENCE
  useEffect(() => {
    const savedPrompt = localStorage.getItem("creative_prompt");
    if (savedPrompt) setPrompt(savedPrompt);

    const savedFormat = localStorage.getItem("creative_format") as Format;
    if (savedFormat) setFormat(savedFormat);

  }, []);

  useEffect(() => {
    localStorage.setItem("creative_prompt", prompt);
  }, [prompt]);

  useEffect(() => {
    localStorage.setItem("creative_format", format);
  }, [format]);

  // Handle Progress Timer (Percentage 0 to 95) with Dynamic Texts
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
      const texts = buildLoadingTexts(isAnimated, referenceImages.length > 0, productImages.length > 0);
      
      setLoadingProgress(0);
      setLoadingText(texts[0]);
      
      timer = setInterval(() => {
        setLoadingProgress(prev => {
          const next = prev + Math.floor(Math.random() * 5) + 1;
          
          if (next >= 15 && next < 35) setLoadingText(texts[1]);
          else if (next >= 35 && next < 55) setLoadingText(texts[2]);
          else if (next >= 55 && next < 75) setLoadingText(texts[3]);
          else if (next >= 75) setLoadingText(texts[4]);

          return next < 95 ? next : 95;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isLoading]);

  const handleClearAll = () => {
    setPrompt("");
    setReferenceImages([]);
    setProductImages([]);
    setPendingProductFile(null);
    setCode(null);
    setActiveCreativeId(null);
    setRemixSourceCode(null);
    setError("");
    setPair(null);
    setBestCreativeId(null);
    setVideoJob(null);
    localStorage.removeItem("creative_prompt");
  };

  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remainingSlots = MAX_IMAGES - referenceImages.length;
    const filesToProcess = files.slice(0, remainingSlots);

    if (files.length > remainingSlots) setError(`Можно загрузить максимум ${MAX_IMAGES} референсов.`);

    for (const file of filesToProcess) {
       try {
         const webpDataUrl = await optimizeImageToWebP(file);
         setReferenceImages(prev => [...prev, { file, dataUrl: webpDataUrl }]);
       } catch (err) {
         console.error("Error optimizing reference", err);
       }
    }
    
    e.target.value = '';
  };

  const handleProductSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (productImages.length >= MAX_IMAGES) {
      setError(`Можно загрузить максимум ${MAX_IMAGES} медиа/фото объектов.`);
      return;
    }

    try {
      const webpDataUrl = await optimizeImageToWebP(file);
      setPendingProductFile({ file, dataUrl: webpDataUrl });
    } catch(err) {
      console.error(err);
    }
    e.target.value = '';
  };

  // Background polish — runs Nano Banana studio enhance on the freshly
  // confirmed product photo. We push the original into `productImages`
  // first, then swap in the polished version once Gemini returns. If
  // it fails, the original stays. The user can revert with the "↩
  // Оригинал" button on the thumbnail.
  async function runPolishForLatest() {
    setPolishStateByIndex((prev) => {
      // Find the newly-added product photo's index (last item).
      // We can't read productImages here cleanly because of stale-state,
      // so we rely on functional update inside fetch result instead.
      return prev;
    });
    setProductImages((prev) => {
      const idx = prev.length - 1;
      if (idx < 0) return prev;
      // Mark as polishing.
      setPolishStateByIndex((s) => ({ ...s, [idx]: "polishing" }));
      // Kick the polish call (don't await — we're inside a state setter).
      const target = prev[idx];
      void (async () => {
        try {
          const result = await polishProductPhoto(target.dataUrl);
          if (result.success) {
            const polishedDataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;
            setProductImages((cur) => {
              if (cur[idx]?.dataUrl !== target.dataUrl) return cur; // gone or replaced
              const next = [...cur];
              next[idx] = { ...cur[idx], original: target.dataUrl, dataUrl: polishedDataUrl };
              return next;
            });
            setPolishStateByIndex((s) => ({ ...s, [idx]: "polished" }));
          } else {
            console.warn("[polish] failed:", result.error);
            setPolishStateByIndex((s) => ({ ...s, [idx]: "failed" }));
          }
        } catch (e) {
          console.warn("[polish] crashed:", e);
          setPolishStateByIndex((s) => ({ ...s, [idx]: "failed" }));
        }
      })();
      return prev;
    });
  }

  function revertPolish(index: number) {
    setProductImages((prev) => {
      const item = prev[index];
      if (!item?.original) return prev;
      const next = [...prev];
      next[index] = { ...item, dataUrl: item.original, original: undefined };
      return next;
    });
    setPolishStateByIndex((s) => ({ ...s, [index]: "idle" }));
  }

  const confirmProductAsIs = () => {
    if (!pendingProductFile) return;
    setProductImages(prev => [...prev, pendingProductFile]);
    setPendingProductFile(null);
    runPolishForLatest();
  };

  const confirmProductCut = async () => {
    if (!pendingProductFile) return;
    setIsRemovingBg(true);
    setError("");

    try {
      const sourceUrl = URL.createObjectURL(pendingProductFile.file);
      const blob = await removeBackground(sourceUrl);

      const webpDataUrl = await optimizeImageToWebP(blob);
      setProductImages(prev => [...prev, { file: blob as File, dataUrl: webpDataUrl }]);
    } catch (err) {
      console.error("BG removal failed", err);
      setError("Не удалось удалить фон. Загружен оригинал.");
      setProductImages(prev => [...prev, pendingProductFile]);
    } finally {
      setIsRemovingBg(false);
      setPendingProductFile(null);
      runPolishForLatest();
    }
  };

  const cancelPendingProduct = () => {
    setPendingProductFile(null);
  };

  const removeReference = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
    if (error) setError(""); 
  };

  const removeProduct = (index: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== index));
    setPolishStateByIndex((prev) => {
      const next: Record<number, PolishState> = {};
      for (const [k, v] of Object.entries(prev)) {
        const i = Number(k);
        if (i < index) next[i] = v;
        else if (i > index) next[i - 1] = v;
      }
      return next;
    });
    if (error) setError("");
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Пожалуйста, введите ТЗ для генерации.");
      return;
    }
    setError("");
    setIsLoading(true);

    const refBase64 = referenceImages.map(img => img.dataUrl);
    const prodBase64 = productImages.map(img => img.dataUrl);

    // Use explicit remix base if selected
    const htmlCodeToRemix = remixSourceCode || undefined;
    
    let remixScreenshotBase64: string | undefined = undefined;
    if (htmlCodeToRemix) {
       setLoadingText("Снимаем холст для визуального ИИ...");
       try {
         const response = await fetch("https://creative-cloud-renderer-694906438875.europe-west4.run.app/screenshot", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ html: htmlCodeToRemix, format: format })
         });
         
         if (response.ok) {
           const blob = await response.blob();
           remixScreenshotBase64 = await new Promise<string>((resolve) => {
             const reader = new FileReader();
             reader.onloadend = () => resolve(reader.result as string);
             reader.readAsDataURL(blob);
           });
         } else {
           console.warn("Server screenshot returned non-ok status:", response.status);
         }
       } catch (err) {
         console.warn("Server screenshot capture failed:", err);
       }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 360_000);

      let data: any;
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            format,
            isAnimated,
            variantCount,
            referenceImagesBase64: refBase64,
            productImagesBase64: prodBase64,
            remixHtmlCode: htmlCodeToRemix,
            remixScreenshotBase64,
            strictClone: referenceImages.length > 0,
          }),
          signal: controller.signal,
        });
        data = await res.json();
        clearTimeout(timeoutId);
        if (data.error) {
          const errMsg = String(data.error).toLowerCase();
          if (errMsg.includes("503") || errMsg.includes("high demand")) {
            throw new Error("Сервера перегружены. Подожди и попробуй снова.");
          }
          throw new Error(data.error);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") throw new Error("Таймаут (превышено время ожидания).");
        throw err;
      }

      // ---- Response shape ----
      // Static mode:  { pairId, variants: [...], partialRefunded }
      // Animated mode: { pairId, claude, gemini, partialRefunded }
      if (Array.isArray(data.variants)) {
        const okCount = data.variants.filter((v: any) => v.ok).length;
        if (okCount === 0) {
          throw new Error("Все модели вернули ошибку. Импульсы возвращены.");
        }
        setPair({
          pairId: data.pairId,
          claude: null,
          gemini: null,
          imagen: null,
          variants: data.variants as ImageVariant[],
        });
      } else {
        const claudeOk = data.claude && data.claude.code && !data.claude.error;
        const geminiOk = data.gemini && data.gemini.code && !data.gemini.error;

        if (!claudeOk && !geminiOk) {
          throw new Error("Все модели вернули ошибку. Импульсы возвращены.");
        }

        setPair({
          pairId: data.pairId,
          claude: claudeOk
            ? { creativeId: data.claude.creativeId, code: data.claude.code }
            : null,
          gemini: geminiOk
            ? { creativeId: data.gemini.creativeId, code: data.gemini.code }
            : null,
          imagen: null,
          variants: null,
          claudeError: claudeOk ? undefined : data.claude?.error,
          geminiError: geminiOk ? undefined : data.gemini?.error,
        });
      }

      // Reset legacy single-creative state — it's repopulated when the
      // user picks a winner.
      setCode(null);
      setActiveCreativeId(null);
      setRemixSourceCode(null);

      // Refresh history and balance.
      const hist = await getUserCreatives();
      if (hist.success && hist.creatives) {
        setHistoryItems(hist.creatives);
      }
      const bal = await getUserBalance();
      if (bal.success) setImpulses(bal.impulses);

      setMobileTab("canvas");
      setFeedback(null);
      setFeedbackComment("");
      setFeedbackSubmitted(false);
    } catch (err: any) {
      if (err.name === "AbortError") {
        setError("Превышено время ожидания. Код мог успеть сохраниться в вашем Банке Креативов.");
        const hist = await getUserCreatives();
        if (hist.success && hist.creatives) setHistoryItems(hist.creatives);
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
    }
  };

  /**
   * Юзер кликнул "Это лучше" под одной из 2 карточек dual-pair.
   * - помечаем победителя на сервере (selectedAsBest=true) и проигравшего (false);
   * - `pair` сбрасываем, `code`/`activeCreativeId` подставляем победителя →
   *   canvas переходит в обычный single-iframe вид с фидбэком, скачиванием и т.д.
   */
  const selectPairWinner = async (winnerModel: "claude" | "gemini" | "imagen") => {
    if (!pair) return;
    const winner =
      winnerModel === "claude" ? pair.claude :
      winnerModel === "gemini" ? pair.gemini :
      pair.imagen;
    if (!winner) return;
    const winnerCreativeId = winner.creativeId;
    try {
      await fetch("/api/select-best", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creativeId: winnerCreativeId }),
      });
    } catch (e) {
      console.warn("[select-best] failed (ignoring, UI continues):", e);
    }
    if (winnerModel === "imagen") {
      // Image winner — no HTML code, just an image URL.
      setCode(null);
      setActiveCreativeId(winnerCreativeId);
      // We cheat by stuffing the image into a minimal HTML wrapper
      // so the existing single-canvas iframe renders it. Avoids a
      // new render branch.
      const imgUrl = (winner as ImageGen).imageUrl;
      const wrapperHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:100vw;height:100vh;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden}img{width:100%;height:100%;object-fit:contain}</style></head><body><img src="${imgUrl}" alt=""></body></html>`;
      setCode(wrapperHtml);
    } else {
      setCode((winner as DualGen).code);
      setActiveCreativeId(winnerCreativeId);
    }
    setPair(null);
    setVideoJob(null);
    setIframeKey((k) => k + 1);
  };

  /**
   * Запустить Veo 3 на победителе → poll status каждые 6 сек.
   * Видео генерится 30-90 сек. После готовности скачиваем MP4.
   */
  const startVideoGeneration = async () => {
    if (!activeCreativeId) return;
    if (videoJob) return; // already running for current pick
    setError("");
    setVideoJob({
      creativeId: "", // filled after kick
      sourceCreativeId: activeCreativeId,
      state: "kicking",
    });
    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCreativeId: activeCreativeId,
          prompt,
          aspectRatio: format,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.creativeId) throw new Error("Сервер не вернул creativeId");

      const newCreativeId = data.creativeId as string;
      setVideoJob({
        creativeId: newCreativeId,
        sourceCreativeId: activeCreativeId,
        state: "polling",
      });

      // Refresh balance — 50 имп. списано.
      const bal = await getUserBalance();
      if (bal.success) setImpulses(bal.impulses);

      // Poll loop. Stops on ready/failed or after 5 minutes.
      const startedAt = Date.now();
      const POLL_INTERVAL = 6000;
      const MAX_DURATION_MS = 5 * 60 * 1000;
      const tick = async () => {
        if (Date.now() - startedAt > MAX_DURATION_MS) {
          setVideoJob((prev) =>
            prev && prev.creativeId === newCreativeId
              ? { ...prev, state: "failed", error: "Таймаут (>5 мин)" }
              : prev,
          );
          return;
        }
        try {
          const r = await fetch(`/api/check-video?creativeId=${newCreativeId}`);
          const d = await r.json();
          if (d.state === "ready" && d.videoUrl) {
            setVideoJob((prev) =>
              prev && prev.creativeId === newCreativeId
                ? { ...prev, state: "ready", videoUrl: d.videoUrl }
                : prev,
            );
            return;
          }
          if (d.state === "failed") {
            setVideoJob((prev) =>
              prev && prev.creativeId === newCreativeId
                ? { ...prev, state: "failed", error: d.error || "Veo не справился" }
                : prev,
            );
            // Refund happened server-side — refresh balance.
            const bal2 = await getUserBalance();
            if (bal2.success) setImpulses(bal2.impulses);
            return;
          }
        } catch (e) {
          console.warn("[video poll]", e);
        }
        setTimeout(tick, POLL_INTERVAL);
      };
      setTimeout(tick, POLL_INTERVAL);
    } catch (e: any) {
      setError(e?.message || "Не удалось запустить генерацию видео.");
      setVideoJob(null);
      const bal = await getUserBalance();
      if (bal.success) setImpulses(bal.impulses);
    }
  };

  const downloadVideoFile = async () => {
    if (!videoJob || videoJob.state !== "ready" || !videoJob.videoUrl) return;
    try {
      const res = await fetch(videoJob.videoUrl);
      if (!res.ok) throw new Error(`download failed: ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `creative-veo-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch (e: any) {
      setError(`Скачивание не удалось: ${e?.message || e}`);
    }
  };

  // Auto-polish, vision-loop refine and Canvas-mode helpers removed
  // per user request — strip-back to bare dual-API only.

  const submitFeedback = async (reasonOverride?: string) => {
    if (!activeCreativeId) return;
    // reasonOverride lets the chip handlers send their value directly,
    // bypassing the async setState delay that would otherwise leave
    // feedbackComment empty on the first chip-click.
    const comment = reasonOverride ?? feedbackComment;
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creativeId: activeCreativeId,
          score: feedback === 'like' ? 1 : -1,
          comment,
        })
      });
      setFeedbackSubmitted(true);
    } catch (e) {
      console.error(e);
      setFeedbackSubmitted(true);
    }
  };

  const handleDeleteCreative = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await deleteUserCreative(id);
      if (res.success) {
        setHistoryItems(prev => prev.filter(item => item.id !== id));
      } else {
        console.error("Failed to delete", res.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  /** Optimistic toggle for the eye/eye-off icon on each creative tile.
   *  Flip in state immediately so the icon swap feels instant; revert
   *  if the server action fails. */
  const handleTogglePublic = async (
    id: string,
    nextValue: boolean,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setHistoryItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, isPublic: nextValue } : it)),
    );
    try {
      const res = await toggleCreativePublic(id, nextValue);
      if (!res.success) {
        // Roll back if the server rejected.
        setHistoryItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, isPublic: !nextValue } : it,
          ),
        );
        console.error("toggleCreativePublic failed:", res.error);
      }
    } catch (err) {
      setHistoryItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, isPublic: !nextValue } : it,
        ),
      );
      console.error(err);
    }
  };

  const handleDownloadClick = async () => {
    if (!iframeRef.current) return;

    if (!isAnimated) {
      setIsRecording(true);
      try {
        const response = await fetch("https://creative-cloud-renderer-694906438875.europe-west4.run.app/screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            html: code,
            format: format
          })
        });

        if (!response.ok) {
          throw new Error("Screenshot Failed");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.href = url;
        link.download = `creative-static-${Date.now()}.png`;
        link.click();
        
        markItemAsDownloaded(activeCreativeId);
        
        setTimeout(() => window.URL.revokeObjectURL(url), 5000);
      } catch (err) {
        console.error("Screenshot capture failed", err);
        setError("Ошибка скачивания. Сервер перегружен или недоступен.");
      } finally {
        setIsRecording(false);
      }
    } else {
      startVideoRecording(backgroundJobId || undefined);
    }
  };

  const handleReplay = () => {
    setIframeKey(prev => prev + 1);
  };
  const removeDownloadedState = (id: string) => {
     setDownloadedItems(prev => prev.filter(x => x !== id));
     const currentStr = localStorage.getItem('downloadedCreatives');
     if (currentStr) {
        const arr = JSON.parse(currentStr);
        localStorage.setItem('downloadedCreatives', JSON.stringify(arr.filter((x: string) => x !== id)));
     }
  };

  const cancelRender = (id: string) => {
    // 1. Серверная отметка — помечает videoUrl как `failed:<ts>:cancelled-by-user`
    //    в БД, чтобы /api/check-render вернул failed и другие устройства
    //    (например, телефон) увидели, что ждать нечего. Fire-and-forget:
    //    даже если сервер недоступен — локальная чистка ниже пройдёт.
    void cancelGeneration(id).catch((e) =>
      console.error('[cancelRender] server-side cancel failed:', e)
    );

    // 2. Локальная чистка (как раньше): прибить job из localStorage + state.
    const currentJobs = JSON.parse(localStorage.getItem('backgroundRenderJobs') || '{}');
    if (currentJobs[id]) {
      delete currentJobs[id];
      localStorage.setItem('backgroundRenderJobs', JSON.stringify(currentJobs));
      setRenderJobs(currentJobs);
    }
    setBackgroundStatuses(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (isRecording && activeCreativeId === id) {
       setIsRecording(false);
    }

    // 3. Локально помечаем как failed, чтобы после F5 запись не всплыла
    //    обратно как "rendering:..." до завершения серверной отмены.
    setHistoryItems(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, videoUrl: `failed:${Date.now()}:cancelled-by-user` }
          : item
      )
    );
  };

  const startVideoRecording = async (preExistingJobId?: string) => {
    setShowVideoInstruction(false);
    setIsRecording(true);

    const targetId = preExistingJobId || activeCreativeId;
    if (!targetId || !code) {
      setError("Не найден ID креатива для рендера");
      setIsRecording(false); return;
    }

    try {
      const CLOUD_URL = "/api/render";
      setRenderPhase('Подключение к оркестратору Google Cloud...');
      setRenderProgress(5);

      // Save to background jobs map explicitly for 450 frames
      const totalFrames = format === '9:16' ? 450 : 300;
      const currentJobs = JSON.parse(localStorage.getItem('backgroundRenderJobs') || '{}');
      currentJobs[targetId] = { startTime: Date.now(), totalFrames, format };
      setRenderJobs(currentJobs);
      localStorage.setItem('backgroundRenderJobs', JSON.stringify(currentJobs));
      setBackgroundStatuses(prev => ({...prev, [targetId]: 'rendering'}));

      fetch(CLOUD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: code, format, creativeId: targetId })
      }).catch(err => console.error(err));

      // Do nothing else! The global useEffect poller handles the progress bars & downloading!

    } catch (err) {
      console.error("Recording start failed", err);
      setError("Ошибка рендера. Сервер перегружен или недоступен.");
      setIsRecording(false);
    }
  };

  const getCanvasStyle = () => {
    switch (format) {
      case "1:1":
        return { aspectRatio: "1 / 1", width: "100%", maxWidth: "500px", maxHeight: "500px" };
      case "9:16":
        return { aspectRatio: "9 / 16", width: "100%", maxWidth: "360px", maxHeight: "640px" };
    }
  };

  return (
    <main className="flex h-screen w-full overflow-hidden text-neutral-900 font-sans relative z-0">
      {/* Shows a warning banner when an admin is impersonating a user via
          the /admin "Войти как" flow. Offers a one-click sign-out back to
          /admin. */}
      <ImpersonationBanner />
      
      {/* HISTORY BANK OVERLAY */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm p-0 sm:p-4 md:p-10 flex flex-col items-center">
             <div className="w-full h-[100dvh] sm:h-full max-w-6xl bg-white sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-neutral-100 flex-shrink-0">
                   <div className="flex items-center justify-between mb-0 sm:mb-3">
                     <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2"><PackageSearch className="w-5 h-5 sm:w-6 sm:h-6 text-hermes-500" /> Мои креативы ({historyItems.length})</h2>
                     <button onClick={() => setShowHistory(false)} className="w-11 h-11 rounded-full flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 transition-colors" aria-label="Закрыть">
                       <X className="w-5 h-5 text-neutral-600" />
                     </button>
                   </div>
                   
                   <div className="flex flex-col gap-2">
                     <div className="px-3 py-2.5 bg-neutral-50 border border-neutral-200 text-neutral-600 text-xs font-medium rounded-lg flex items-start gap-2">
                        <span className="text-xl leading-none mt-0.5">💡</span>
                        <p>
                           <b>Как это работает:</b> Выберите любой креатив, чтобы открыть его в редакторе. 
                           Статусы показывают, был ли файл <b>«Скачан»</b> на ваш ПК ранее, или это свежесозданный <b>«Новый»</b> креатив, 
                           который еще не скачивался.
                        </p>
                     </div>
                     <AnimatePresence>
                       {showHistoryWarning && (
                         <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                           <div className="px-3 py-2 mt-2 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-lg inline-flex items-center gap-1.5 w-full">
                              ⚠️ Внимание: из-за большого веса файлов, история хранится на наших серверах 30 дней. Скачивайте видео к себе на компьютер для вечного хранения!
                           </div>
                         </motion.div>
                       )}
                     </AnimatePresence>
                   </div>
                </div>
                {/* Mobile: 2-column grid so the history list isn't an endless
                    vertical scroll of full-screen cards. Desktop: keep the
                    wrapping row layout with fixed-width cards. */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-neutral-100/50 grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:flex-wrap sm:gap-4 md:gap-6 items-start sm:justify-start content-start">
                   {historyItems.length === 0 ? (
                      <div className="w-full text-center text-neutral-400 font-bold py-20 bg-white rounded-3xl border border-neutral-100">Вы пока не создали ни одного креатива.</div>
                   ) : (
                      historyItems.map((item: any) => {
                        const isVertical = item.format === '9:16' || !item.format;
                        const isDownloaded = downloadedItems.includes(item.id);
                        
                        return (
                          <div key={item.id} className="bg-white rounded-2xl sm:rounded-[24px] shadow-sm border border-neutral-200 overflow-hidden relative group flex flex-col w-full sm:w-[232px] sm:max-w-[320px] shrink-0 hover:shadow-xl hover:border-neutral-300 transition-all duration-300 hover:-translate-y-1">
                            
                            {/* Top Bar: Format, Date & Delete */}
                            <div className="flex justify-between items-center p-3 border-b border-neutral-100 bg-white/50 backdrop-blur-md">
                               <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="bg-neutral-100/80 text-neutral-600 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border border-neutral-200/50">
                                     {item.format || '9:16'}
                                  </span>
                                  {isDownloaded ? (
                                    <div className="flex items-center gap-1 min-w-max">
                                      <span 
                                        className="bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border border-green-200 flex items-center gap-0.5 cursor-pointer hover:bg-green-200 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); window.location.href = `/api/download?creativeId=${item.id}`; }}
                                      >
                                        <Download className="w-3 h-3" /> Скачано
                                      </span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); removeDownloadedState(item.id); }}
                                        className="w-7 h-7 sm:w-5 sm:h-5 flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-500 border border-neutral-200 rounded drop-shadow-sm transition-colors shrink-0"
                                        title="Сбросить статус скачанного"
                                        aria-label="Сбросить статус"
                                      >
                                        <X className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                                      </button>
                                    </div>
                                  ) : backgroundStatuses[item.id] === 'done' ? (
                                    <span 
                                      onClick={(e) => { 
                                         e.stopPropagation(); 
                                         window.location.href = `/api/download?creativeId=${item.id}`;
                                         setDownloadedItems(prev => [...prev, item.id]);
                                         const currentStr = localStorage.getItem('downloadedCreatives');
                                         const arr = currentStr ? JSON.parse(currentStr) : [];
                                         if (!arr.includes(item.id)) {
                                            arr.push(item.id);
                                            localStorage.setItem('downloadedCreatives', JSON.stringify(arr));
                                         }
                                      }}
                                      className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase border border-blue-200 flex items-center gap-0.5 cursor-pointer hover:bg-blue-200 transition-colors shadow-sm"
                                    >
                                      <span>✅ Скачать видео</span>
                                    </span>
                                  ) : renderJobs[item.id] ? (
                                    <div className="flex items-center gap-1 min-w-max">
                                      <span className="bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border border-amber-200 flex items-center gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin shrink-0"/> 
                                        Сборка: {Math.min(renderJobs[item.id].totalFrames, Math.floor(((Date.now() - renderJobs[item.id].startTime) / 1000 / (renderJobs[item.id].totalFrames === 450 ? 100 : 60)) * renderJobs[item.id].totalFrames))} / {renderJobs[item.id].totalFrames}
                                      </span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); cancelRender(item.id); }}
                                        className="w-7 h-7 sm:w-5 sm:h-5 flex items-center justify-center bg-red-100 hover:bg-red-200 active:bg-red-300 text-red-600 border border-red-200 rounded drop-shadow-sm transition-colors shrink-0"
                                        title="Отменить очередь"
                                        aria-label="Отменить рендер"
                                      >
                                        <X className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                                      </button>
                                    </div>
                                  ) : (backgroundStatuses[item.id] && (backgroundStatuses[item.id] === 'queued' || backgroundStatuses[item.id] === 'rendering' || backgroundStatuses[item.id].startsWith('processing'))) ? (
                                    <div className="flex items-center gap-1 min-w-max">
                                      <span className="bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border border-amber-200 flex items-center gap-1 min-w-max">
                                        <Loader2 className="w-3 h-3 animate-spin shrink-0"/> 
                                        В очереди
                                      </span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); cancelRender(item.id); }}
                                        className="w-7 h-7 sm:w-5 sm:h-5 flex items-center justify-center bg-red-100 hover:bg-red-200 active:bg-red-300 text-red-600 border border-red-200 rounded drop-shadow-sm transition-colors shrink-0"
                                        title="Отменить очередь"
                                        aria-label="Отменить рендер"
                                      >
                                        <X className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                                      </button>
                                    </div>
                                  ) : backgroundStatuses[item.id] === 'error' ? (
                                    <span className="bg-red-50 text-red-600 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border border-red-200 flex items-center gap-0.5">
                                      Тайм-аут
                                    </span>
                                  ) : (
                                    <span className="bg-orange-50 text-orange-600 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border border-orange-200 flex items-center gap-0.5">
                                      Новый
                                    </span>
                                  )}
                               </div>
                               <div className="flex items-center gap-0.5 shrink-0">
                                 <button
                                    onClick={(e) => handleTogglePublic(item.id, !item.isPublic, e)}
                                    className={clsx(
                                      "w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center transition-colors rounded-md",
                                      item.isPublic
                                        ? "text-green-600 hover:bg-green-50"
                                        : "text-neutral-400 hover:bg-neutral-100"
                                    )}
                                    title={item.isPublic ? "Виден в общей галерее — нажми чтобы скрыть" : "Скрыт из галереи — нажми чтобы опубликовать"}
                                    aria-label={item.isPublic ? "Скрыть из галереи" : "Опубликовать в галерею"}
                                 >
                                    {item.isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                 </button>
                                 <button
                                    onClick={(e) => handleDeleteCreative(item.id, e)}
                                    className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center text-neutral-400 hover:text-red-500 active:bg-red-100 transition-colors rounded-md hover:bg-red-50"
                                    title="Удалить"
                                    aria-label="Удалить креатив"
                                 >
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                               </div>
                            </div>

                            {/* Creative Preview */}
                            <div
                               className="w-full bg-neutral-50/50 flex items-center justify-center p-2 sm:p-4 cursor-pointer relative"
                            >
                               {/* On mobile (2-col grid) preview uses container width
                                   so it fits inside a ~150px column cell. On sm+ we
                                   keep the classic 200px fixed box. */}
                               <div className={clsx(
                                 "shadow-lg bg-white rounded-xl overflow-hidden relative",
                                 isVertical
                                   ? "aspect-[9/16] w-[min(200px,100%)] sm:w-[200px]"
                                   : "aspect-square w-[min(200px,100%)] sm:w-[200px]",
                               )}>
                                  <iframe
                                     srcDoc={item.htmlCode}
                                     loading="lazy"
                                     title={`Creative ${item.id}`}
                                     referrerPolicy="no-referrer"
                                     className="absolute inset-0 border-0 pointer-events-none origin-top-left"
                                     style={{
                                        width: isVertical ? '400px' : '500px',
                                        height: isVertical ? '711px' : '500px',
                                        transform: isVertical ? 'scale(0.5)' : 'scale(0.4)',
                                     }}
                                     sandbox="allow-scripts"
                                  />
                                  <div className="absolute inset-0 bg-transparent z-10" />
                               </div>

                               {/* RENDER PROGRESS OVERLAY (Gallery) */}
                               {renderJobs[item.id] && (
                                  <div className="absolute inset-x-4 bottom-4 z-30 bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-2xl border border-neutral-200/60 flex flex-col gap-1.5">
                                      <div className="flex justify-between items-center text-[10px] font-black text-neutral-800 uppercase">
                                          <span>Сборка кадров</span>
                                          <span className="text-hermes-500 font-mono">
                                            {Math.min(renderJobs[item.id].totalFrames, Math.floor(((Date.now() - renderJobs[item.id].startTime) / 1000 / (renderJobs[item.id].totalFrames === 450 ? 100 : 60)) * renderJobs[item.id].totalFrames))} / {renderJobs[item.id].totalFrames}
                                          </span>
                                      </div>
                                      <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                                          <div className="h-full bg-gradient-to-r from-hermes-400 to-hermes-500 transition-all duration-1000 ease-linear rounded-full" style={{ width: `${Math.min(95, 10 + ((Date.now() - renderJobs[item.id].startTime) / 1000 / (renderJobs[item.id].totalFrames === 450 ? 120 : 80)) * 85)}%` }}></div>
                                      </div>
                                  </div>
                               )}

                               {/* Hover overlay */}
                               <div
                                 onClick={async () => {
                                   // Ensure htmlCode is loaded before switching canvas.
                                   // It's usually fetched by the lazy-loader when the
                                   // modal opened, but if the user clicked too fast
                                   // we fall back to an on-demand fetch here.
                                   let html: string | undefined = item.htmlCode;
                                   if (!html) {
                                     const res = await getCreativeHtml([item.id]);
                                     html = res.success ? res.htmlMap?.[item.id] : undefined;
                                     if (html) {
                                       setHistoryItems((prev: any[]) =>
                                         prev.map((h) => (h.id === item.id ? { ...h, htmlCode: html } : h)),
                                       );
                                     }
                                   }
                                   if (!html) return; // Silently skip if fetch failed
                                   setCode(html);
                                   setActiveCreativeId(item.id);
                                   setPrompt(item.prompt || "");
                                   setFormat(item.format || '9:16');
                                   setShowHistory(false);
                                   setMobileTab('canvas');
                                 }}
                                 /* On desktop (sm+): hidden overlay that fades in on hover,
                                    scaled hero button, covers the whole card. On mobile:
                                    touch has no hover, so the overlay is a permanently
                                    visible bottom pill — users immediately see the card
                                    is tappable. Note: opacity-0 does NOT block pointer
                                    events so the click handler still fires on desktop
                                    everywhere; no pointer-events overrides needed. */
                                 className="absolute inset-x-0 bottom-0 sm:inset-0 bg-gradient-to-t from-black/70 to-transparent sm:bg-black/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex flex-col items-center justify-end sm:justify-center pb-2 sm:pb-0 transition-all duration-300 z-20"
                               >
                                  <div className="bg-white text-neutral-900 font-black px-3 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl flex items-center gap-1.5 sm:gap-2 shadow-xl sm:shadow-2xl text-xs sm:text-base transform sm:scale-90 sm:group-hover:scale-100 transition-all duration-300">
                                     <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Открыть
                                  </div>
                               </div>
                            </div>
                          </div>
                      )})
                   )}
                </div>
             </div>
          </div>
        )}
      </AnimatePresence>

      {/* Video Recording Modal */}
      <VideoRecordingModal
        open={showVideoInstruction}
        onClose={() => setShowVideoInstruction(false)}
        onStart={() => startVideoRecording()}
      />


      {/* Sidebar Controls */}
      <aside className={clsx(
        "fixed md:static inset-0 pb-16 md:pb-0 w-full md:w-[420px] h-full shrink-0 glass-panel bg-white/80 flex-col z-40 md:z-10 relative shadow-xl border-r border-neutral-200 overflow-hidden",
        mobileTab === 'controls' ? "flex" : "hidden md:flex"
      )}>
        <div className="p-6 border-b border-neutral-200/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-hermes-500 flex items-center justify-center shadow-lg shadow-hermes-500/20">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">Creative AI</h1>
              <p className="text-[11px] text-neutral-500 font-medium">Умный генератор рекламы</p>
            </div>
          </div>
          
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">Баланс</span>
              <div className="flex items-center gap-2">
                {/* Balance badge — clicks open the promo input inline (quick path).
                    For full flow (history, account info) use the Личный кабинет link below. */}
                <button
                  onClick={() => setShowPromoInput(!showPromoInput)}
                  className="flex items-center gap-1.5 bg-hermes-50 text-hermes-700 px-3 py-1.5 rounded-lg border border-hermes-200 hover:bg-hermes-100 hover:border-hermes-300 transition-colors"
                  title="Нажмите чтобы ввести промокод"
                >
                  <span className="font-extrabold text-sm">{impulses === null ? "..." : impulses}</span>
                  <span className="text-sm">⚡</span>
                </button>
                <Link href="/#pricing" className="px-3 py-1.5 bg-[#f14635] text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors flex items-center shadow-sm whitespace-nowrap">
                  {impulses !== null && impulses >= 10 ? 'Докупить (Kaspi)' : 'Купить (Kaspi)'}
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
                  onClick={() => setShowHistory(true)}
                  className="text-[10px] uppercase font-bold text-neutral-500 hover:text-hermes-600 underline"
                >
                  Мои креативы ({historyItems.length})
                </button>
              </div>
            </div>
        </div>

        {showPromoInput && (
          <div className="px-6 py-4 bg-hermes-50/50 border-b border-hermes-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-hermes-800 uppercase tracking-wider">Активация промокода</h3>
              <Link
                href="/account"
                className="text-[10px] font-bold text-hermes-600 hover:text-hermes-700 underline"
              >
                Открыть кабинет →
              </Link>
            </div>
            {/* flex-col on mobile: stacks input above button so neither is
                squeezed on narrow viewports (iPhone SE ≈ 320px). flex-row
                on sm+ brings back the inline look. text-base on input to
                keep iOS from auto-zooming on focus. */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="PROMO-XXX-YYYY-ZZZZ"
                className="flex-1 bg-white border border-hermes-200 rounded-lg px-3 py-3 sm:py-2 text-base sm:text-sm uppercase outline-none focus:border-hermes-500 font-mono"
                disabled={isRedeeming}
                autoComplete="off"
                autoCapitalize="characters"
              />
              <button
                onClick={handleRedeem}
                disabled={isRedeeming || !promoCode.trim()}
                className="bg-hermes-600 hover:bg-hermes-700 active:bg-hermes-800 disabled:opacity-50 text-white px-4 py-3 sm:py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 sm:min-w-[100px]"
              >
                {isRedeeming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Активация…
                  </>
                ) : (
                  "Активировать"
                )}
              </button>
            </div>
            {promoSuccess && <p className="text-xs text-green-600 font-bold mt-2">{promoSuccess}</p>}
          </div>
        )}

        <div className={clsx("flex-1 overflow-y-auto p-6 space-y-8 relative z-20", activeCreativeId && "pointer-events-none opacity-60 grayscale-[0.2]")}>
          
          {remixSourceCode && !activeCreativeId && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
               <div className="bg-amber-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                 <Sparkles className="w-4 h-4 text-amber-600" />
               </div>
               <div className="flex-1">
                 <h4 className="text-xs font-bold text-amber-900 mb-0.5">Режим Ремикса Активирован</h4>
                 <p className="text-[10px] text-amber-800 leading-tight">Прошлый креатив загружен в память ИИ. Измените настройки ниже, перепишите ТЗ и нажмите "Создать".</p>
               </div>
               <button onClick={() => setRemixSourceCode(null)} className="shrink-0 p-1 hover:bg-amber-200/50 rounded-md transition-colors" title="Отменить ремикс">
                 <X className="w-4 h-4 text-amber-600" />
               </button>
            </div>
          )}
          
          {/* Format Selection */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Maximize className="w-4 h-4 text-hermes-500" />
              Формат креатива
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {(["9:16", "1:1"] as Format[]).map((f) => (
                <button
                  key={f}
                  disabled={isLoading}
                  onClick={() => setFormat(f)}
                  className={clsx(
                    "py-3 rounded-xl border text-sm font-medium transition-all duration-200 flex flex-col items-center gap-1",
                    format === f
                      ? "bg-neutral-900 border-neutral-900 text-white shadow-md shadow-neutral-900/10"
                      : "bg-white border-neutral-200 text-neutral-600",
                    !isLoading && format !== f && "hover:border-neutral-300 hover:shadow-sm",
                    isLoading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {f === "9:16" && <Smartphone className="w-4 h-4" />}
                  {f === "1:1" && <div className="border-2 border-current rounded-sm w-4 h-4" />}
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Тип креатива. Анимированный режим временно скрыт за
              disabled-кнопкой с бейджем «На обновлении» — пока обкатываем
              новые видео-модели (Veo 3 / Kling). Статичный — единственный
              рабочий путь. */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Video className="w-4 h-4 text-hermes-500" />
              Тип креатива
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled
                aria-disabled="true"
                title="Анимированные креативы временно недоступны — обкатываем новые видео-модели"
                className="py-3 px-2 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-400 text-sm font-medium flex flex-col items-center gap-0.5 cursor-not-allowed relative"
              >
                <span className="flex items-center gap-1 font-bold">
                  Анимированный
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-amber-100 text-amber-700">
                    Скоро
                  </span>
                </span>
                <span className="text-[10px] font-medium leading-tight text-neutral-400">
                  На обновлении
                </span>
              </button>
              <button
                disabled
                aria-pressed="true"
                className="py-3 px-2 rounded-xl border border-neutral-900 bg-neutral-900 text-white text-sm font-medium flex flex-col items-center gap-0.5 cursor-default"
              >
                <span className="font-bold">Статичный</span>
                <span className="text-[10px] font-medium leading-tight text-white/70">
                  PNG-постер 4K
                </span>
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 leading-tight">
              Анимация вернётся после обновления видео-движка. Сейчас доступна статика — 2 варианта от Gemini 3 Pro Image и GPT Image 2.
            </p>
          </div>

          {/* Reference and Product Image Uploads */}
          {!remixSourceCode ? (
            <>
              {/* Reference Image Upload */}
              <div className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-neutral-400" />
                  Референс (стиль / дизайн)
                </span>
                <span className="text-xs text-neutral-400 font-medium">{referenceImages.length}/{MAX_IMAGES}</span>
              </h2>

              {/* Reference-presets grid removed per user request. Users
                  who want a style anchor upload it manually below. */}
              {referenceImages.length === 0 && !isLoading && (
                <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-2.5 flex items-start gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-neutral-500 leading-snug">
                    Можно загрузить референс — скриншот рекламы или дизайна, на который хочешь быть похожим. Без референса тоже работает.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {referenceImages.map((img, i) => (
                  <div key={i} className={clsx("relative group w-16 h-16 rounded-lg border border-neutral-200 overflow-hidden shadow-sm flex items-center justify-center", isLoading && "opacity-50")}>
                    <img src={img.dataUrl} alt={`Ref ${i}`} className="w-full h-full object-cover" />
                    {!isLoading && (
                      <button
                        onClick={() => removeReference(i)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                
                {referenceImages.length < MAX_IMAGES && (
                  <label className={clsx("w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center transition-all", isLoading ? "border-neutral-200 opacity-50 cursor-not-allowed text-neutral-300 bg-neutral-50" : "cursor-pointer border-neutral-300 hover:border-neutral-500 hover:bg-neutral-50 text-neutral-400 hover:text-neutral-500")}>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleReferenceUpload} disabled={isLoading} />
                    <Upload className="w-5 h-5" />
                  </label>
                )}
              </div>
              {referenceImages.length > 0 && (
                <div className="flex items-start gap-2 pt-2">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-neutral-600 leading-snug">
                    ИИ <strong>точно повторит</strong> стиль референса —
                    структуру, цвета, шрифты, расположение блоков. Поменяет
                    только текст и продукт под твой запрос.
                  </p>
                </div>
              )}
            </div>
          {/* Product Image Upload — re-enabled for the Nano Banana / GPT-Image
              testing phase. Both image-gen models accept a single product
              photo as input and edit/restyle it into a sales creative;
              this is the whole point of the static path now. The previous
              HTML-creative integration issues (text overlap, off-frame
              product) don't apply because we're no longer rendering HTML. */}
          <div className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <PackageSearch className="w-4 h-4 text-hermes-500" />
                Исходник, продукт или объект
              </span>
              <span className="text-xs text-neutral-400 font-medium">{productImages.length}/{MAX_IMAGES}</span>
            </h2>
            
            {pendingProductFile ? (
              <div className="bg-white border-2 border-hermes-200 rounded-xl p-3 flex gap-3 shadow-sm items-center relative overflow-hidden">
                {!isRemovingBg && (
                  <button onClick={cancelPendingProduct} className="absolute inset-0 bg-black/10 opacity-0 hover:opacity-100 flex items-start justify-end p-2 transition-opacity z-10">
                    <X className="w-4 h-4 text-neutral-500 bg-white rounded-full shadow-sm" />
                  </button>
                )}
                <div className="w-14 h-14 bg-neutral-50 rounded-lg border border-neutral-100 overflow-hidden shrink-0">
                  <img src={pendingProductFile?.dataUrl} className={clsx("w-full h-full object-contain", isRemovingBg && "opacity-50")} />
                </div>
                <div className="flex-1 relative z-20">
                  <p className="text-xs font-bold text-neutral-800 mb-2">Что делаем с фото?</p>
                  <div className="flex flex-col gap-1.5">
                     <button onClick={confirmProductCut} disabled={isRemovingBg} className="w-full bg-hermes-500 hover:bg-hermes-600 text-white text-[10px] font-bold py-1.5 rounded-md flex justify-center items-center gap-1 transition-colors disabled:opacity-75 disabled:cursor-wait">
                        {isRemovingBg ? <Loader2 className="w-3 h-3 animate-spin"/> : <Scissors className="w-3 h-3"/>}
                        {isRemovingBg ? "ВЫРЕЗАЮ ФОН..." : "БЕЗ ФОНА"}
                     </button>
                     <button onClick={confirmProductAsIs} disabled={isRemovingBg} className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-[10px] font-bold py-1.5 rounded-md transition-colors disabled:opacity-50">
                        ОРИГИНАЛ
                     </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {productImages.map((img, i) => {
                  const polish = polishStateByIndex[i] ?? "idle";
                  return (
                    <div key={i} className={clsx("relative group w-16 h-16 rounded-lg border border-neutral-200 overflow-hidden shadow-sm bg-neutral-100/50 flex items-center justify-center", isLoading && "opacity-50")}>
                      <img src={img.dataUrl} alt={`Product ${i}`} className="w-full h-full object-contain mix-blend-multiply" />
                      {polish === "polishing" && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white pointer-events-none">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      )}
                      {polish === "polished" && (
                        <span
                          title="Студийное улучшение применено"
                          className="absolute top-0.5 left-0.5 bg-amber-400 text-amber-950 rounded-full p-0.5 shadow-sm pointer-events-none"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                        </span>
                      )}
                      {!isLoading && polish !== "polishing" && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          {polish === "polished" && img.original && (
                            <button
                              onClick={() => revertPolish(i)}
                              title="Вернуть оригинал"
                              className="text-white text-[9px] font-bold bg-white/15 hover:bg-white/30 rounded px-1.5 py-0.5"
                            >
                              ↩ Ориг
                            </button>
                          )}
                          <button
                            onClick={() => removeProduct(i)}
                            title="Удалить"
                            className="text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {productImages.length < MAX_IMAGES && (
                   <label className={clsx("w-16 h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all", isLoading || isRemovingBg ? "border-neutral-200 opacity-50 cursor-not-allowed text-neutral-300 bg-neutral-50" : "cursor-pointer border-neutral-300 hover:border-hermes-500 hover:bg-hermes-50 text-neutral-400 hover:text-hermes-500")}>
                     <Upload className="w-5 h-5 mb-1 text-inherit" />
                     <span className="text-[9px] font-semibold uppercase">Загрузить</span>
                     <input type="file" accept="image/*" className="hidden" onChange={handleProductSelect} disabled={isLoading || isRemovingBg}/>
                   </label>
                )}
              </div>
            )}
          </div>
          </>
          ) : (
            <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-xl relative overflow-hidden shadow-inner flex flex-col gap-3">
              <div className="absolute -top-4 -right-4 p-2"><Wand2 className="text-amber-200 w-24 h-24 opacity-30"/></div>
              
              <h2 className="text-sm font-bold flex items-center gap-2 text-amber-800 relative z-10 tracking-tight">
                <Sparkles className="w-4 h-4" />
                Режим доработки (Ремикс)
              </h2>
              
              <p className="text-xs text-amber-700/90 leading-relaxed font-medium relative z-10">
                Креатив загружен в память ИИ. Все загруженные ранее исходники, фото и стили сохранены внутри самого дизайна.
                <br/><br/>
                Просто напишите в ТЗ ниже, что именно нужно изменить (текст, цвета, отступы), и ИИ пересоберёт код.
              </p>
              
              <div className="flex gap-2 items-center relative z-10 py-1.5 px-3 bg-amber-100/70 w-fit rounded-lg border border-amber-200/50 mt-1">
                <div className="flex -space-x-1.5">
                  <div className="w-5 h-5 border border-amber-50 rounded bg-amber-200 flex items-center justify-center shadow-sm"><ImageIcon className="w-3 h-3 text-amber-700"/></div>
                  <div className="w-5 h-5 border border-amber-50 rounded bg-amber-300 flex items-center justify-center shadow-sm"><PackageSearch className="w-3 h-3 text-amber-800"/></div>
                </div>
                <span className="text-[9px] text-amber-800 font-bold tracking-wide uppercase">Файлы уже внутри</span>
              </div>
            </div>
          )}

          {/* Prompt + Clear Button */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-hermes-500" />
                ТЗ для генерации
              </span>
              <button
                onClick={handleClearAll}
                disabled={isLoading || isRemovingBg}
                className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-neutral-400 bg-neutral-100 rounded-md hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                title="Очистить текстовое ТЗ и картинки"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Очистить
              </button>
            </h2>

            {/* TZ helper — 4 short questions to build a structured brief.
                Collapsed by default; expanded on click. After "Сформировать"
                the assembled text overwrites the textarea content. */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden">
              <button
                type="button"
                onClick={() => setTzHelperOpen((v) => !v)}
                className="w-full px-3 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-100 flex items-center gap-2 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-hermes-500" />
                <span className="flex-1 text-left">Помощь с ТЗ — ответь на 4 вопроса</span>
                <ChevronDown className={clsx("w-3.5 h-3.5 transition-transform", tzHelperOpen && "rotate-180")} />
              </button>
              {tzHelperOpen && (
                <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-neutral-200 bg-white">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">
                      1. Что рекламируем?
                    </label>
                    <input
                      type="text"
                      value={tzSubject}
                      onChange={(e) => setTzSubject(e.target.value)}
                      placeholder="Кроссовки Nike Air Max"
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-hermes-500 focus:ring-1 focus:ring-hermes-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">
                      2. Главная выгода / посыл
                    </label>
                    <input
                      type="text"
                      value={tzBenefit}
                      onChange={(e) => setTzBenefit(e.target.value)}
                      placeholder="Скидка 30%, новинка, premium-качество"
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-hermes-500 focus:ring-1 focus:ring-hermes-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">
                      3. Целевая аудитория
                    </label>
                    <input
                      type="text"
                      value={tzAudience}
                      onChange={(e) => setTzAudience(e.target.value)}
                      placeholder="Молодёжь 18-24, активный городской образ жизни"
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-hermes-500 focus:ring-1 focus:ring-hermes-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">
                      4. Стиль и тон
                    </label>
                    <input
                      type="text"
                      value={tzStyle}
                      onChange={(e) => setTzStyle(e.target.value)}
                      placeholder="Минимализм / премиум / дерзкий / яркие цвета"
                      className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-hermes-500 focus:ring-1 focus:ring-hermes-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={buildTzFromHelper}
                    disabled={tzBuilding || (!tzSubject.trim() && !tzBenefit.trim() && !tzAudience.trim() && !tzStyle.trim())}
                    className="w-full bg-hermes-500 hover:bg-hermes-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    {tzBuilding ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ИИ пишет ТЗ...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Сформировать ТЗ ↓
                      </>
                    )}
                  </button>
                  {tzError && (
                    <p className="text-[10px] text-red-600 font-medium mt-1 leading-tight">
                      {tzError}
                    </p>
                  )}
                </div>
              )}
            </div>

            <textarea
              disabled={isLoading}
              readOnly={!!activeCreativeId}
              maxLength={500}
              /* text-base (16px) on mobile prevents iOS Safari from auto-zooming.
                 h-28 (112px) on mobile so the on-screen keyboard doesn't hide
                 the rest of the form; h-40 (160px) back on sm+ for desktop comfort. */
              className={clsx(
                "w-full bg-white border border-neutral-200 rounded-xl p-4 text-base sm:text-sm focus:outline-none focus:border-hermes-500 focus:ring-1 focus:ring-hermes-500 transition-all resize-none shadow-sm placeholder:text-neutral-400",
                isLoading ? "opacity-50 cursor-not-allowed" : activeCreativeId ? "opacity-70 bg-neutral-50 h-24" : "h-28 sm:h-40",
              )}
              placeholder="Опишите, что вы хотите... Например: 'Минималистичный рекламный постер с зелеными акцентами для курса по Upwork.'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          {/* Old remix instruction field is removed as per user request to just use the main prompt in new Edit Mode! */}

          {error && (
            <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border-2 border-red-100 font-medium leading-relaxed">
              {error}
              {error.includes("Пожалуйста, пополните счет") && (
                 <a href="/#pricing" className="block mt-3 text-center bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-sm">
                    🚀 Перейти к Пакетам
                 </a>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-neutral-200/50 bg-white/50 backdrop-blur-sm z-20 hidden md:block">
          {activeCreativeId ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-neutral-500 font-bold text-center">Вы просматриваете креатив из ваших сохранений</p>
              
              <button
                onClick={() => { setRemixSourceCode(activeCreativeCode); setCode(activeCreativeCode); setActiveCreativeId(null); }}
                className="w-full py-4 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 shadow-xl shadow-amber-500/30 text-white cursor-pointer active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5"
              >
                 <span className="flex items-center gap-2 text-base">
                   <Sparkles className="w-5 h-5 text-white" />
                   Использовать для Ремикса
                 </span>
                 <span className="text-[10px] uppercase font-bold opacity-90">(Разблокировать настройки)</span>
              </button>

              <button
                onClick={() => {
                  setRemixSourceCode(null); setCode(""); setActiveCreativeId(null); setPrompt(""); setReferenceImages([]); setProductImages([]);
                }}
                disabled={isLoading}
                className="w-full py-3 rounded-xl font-bold bg-neutral-900 hover:bg-neutral-800 text-white cursor-pointer active:scale-95 transition-all text-sm flex justify-center items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Закрыть (Сброс)
              </button>
            </div>
          ) : (
            <>
            {/* Pre-flight quality warning. The biggest predictor of a
                disappointing result is a thin prompt with no reference
                images, so we surface a soft yellow nudge BEFORE the user
                spends impulses. Doesn't block — they can still proceed. */}
            {!isLoading && !remixSourceCode && (() => {
              const wc = prompt.trim().split(/\s+/).filter(Boolean).length;
              const cc = prompt.trim().length;
              const noImg = referenceImages.length === 0 && productImages.length === 0;
              if (cc >= 30 && wc >= 5) return null;
              if (!noImg && cc >= 15) return null;
              if (cc === 0) return null;
              return (
                <div className="flex gap-2 p-2.5 mb-2 rounded-lg bg-yellow-50 border border-yellow-200 text-[11px] leading-snug text-yellow-900">
                  <Lightbulb className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>ТЗ слишком общее.</strong> Добавь нишу, аудиторию,
                    оффер и стиль — иначе ИИ будет угадывать. Загрузи референс,
                    если можешь.
                  </span>
                </div>
              );
            })()}
            <button
              onClick={() => handleGenerate()}
              disabled={isLoading || isRemovingBg || !prompt.trim()}
              className={clsx(
                "w-full py-4 rounded-xl font-bold text-white transition-all duration-300 flex flex-col items-center justify-center gap-1 relative overflow-hidden",
                isLoading || isRemovingBg || !prompt.trim()
                  ? "bg-neutral-300 cursor-not-allowed text-neutral-600 shadow-none"
                  : remixSourceCode
                  ? "bg-amber-500 hover:bg-amber-600 shadow-lg hover:shadow-amber-500/30 active:scale-95"
                  : "bg-neutral-900 hover:bg-hermes-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-hermes-500/30 active:scale-95"
              )}
            >
              {isLoading ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Loader2 className="w-4 h-4 animate-spin opacity-70" />
                    <span className="text-xs opacity-70 uppercase tracking-widest font-bold">
                      СБОРКА... {loadingProgress}%
                    </span>
                  </div>
                  <span className="text-[13px]">{loadingText}</span>
                </>
              ) : (
                <span className="flex flex-col items-center gap-0.5 text-base relative">
                  <span className="flex items-center gap-2">
                    {remixSourceCode ? <Sparkles className="w-5 h-5"/> : <Sparkles className="w-5 h-5" />}
                    {remixSourceCode ? "Создать Ремикс" : "Создать Креатив"}
                  </span>
                  <span className="text-[10px] uppercase font-bold opacity-80 flex items-center justify-center gap-1">
                    (Спишется {currentCost} ⚡ — за 2 варианта)
                  </span>
                </span>
              )}
            </button>
            </>
          )}
        </div>
      </aside>

      {/* Main Canvas Area */}
      <section className={clsx(
        "flex-1 relative flex-col items-center justify-start p-4 md:p-8 bg-[#E5E5E5] custom-grid-pattern overflow-y-auto pb-[300px] md:pb-12 pt-8 md:pt-8 w-full min-h-screen",
        mobileTab === 'canvas' ? "flex" : "hidden md:flex"
      )}>

        {/* Templates entry — TEMP HIDDEN: фид/шаблоны выглядят слабо, потому что
            креативы там — продукт того же сломанного пайплайна. Возвращаем когда
            улучшим качество генерации. См. обсуждение 2026-04-27. */}
        {false && (
        <button
          onClick={() => setTemplatesOpen(true)}
          className="absolute top-4 left-4 md:top-6 md:left-6 z-30 flex items-center gap-2 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 rounded-xl px-3 py-2 shadow-sm hover:shadow-md transition-all font-bold text-xs md:text-sm"
          title="Открыть шаблоны (мои и от клиентов)"
        >
          <LayoutGrid className="w-4 h-4 text-hermes-500" />
          Шаблоны
        </button>
        )}


        {code && (
           <div className="absolute top-4 left-4 right-4 md:top-8 md:auto md:left-auto md:right-8 z-20 flex flex-wrap items-center justify-end gap-2 md:gap-3">
             <button
               onClick={() => { setMobileTab('controls'); setShowHistory(true); }}
               className="md:hidden flex-1 max-w-[140px] px-4 py-3 bg-white border border-neutral-200 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full text-xs font-bold text-neutral-800 transition-all flex items-center justify-center gap-1.5 hover:bg-neutral-50 active:scale-95"
             >
               <PackageSearch className="w-4 h-4" /> Мои креативы
             </button>
             
             {isAnimated && (
               <button 
                 onClick={handleReplay}
                 disabled={isLoading || isRemovingBg || isRecording}
                 className="w-12 h-12 shrink-0 bg-white border border-neutral-200 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full text-neutral-800 transition-all flex items-center justify-center hover:bg-neutral-50 hover:-translate-y-0.5"
                 title="Повторить анимацию"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
               </button>
             )}
             
             <button 
               onClick={handleDownloadClick}
               disabled={isLoading || isRemovingBg || isRecording}
               className={clsx("flex-grow md:flex-grow-0 px-6 py-3 shrink-0 bg-white border border-neutral-200 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full text-sm font-bold text-neutral-800 transition-all flex items-center justify-center gap-1", 
                isRecording ? "flex-col opacity-100 cursor-wait bg-hermes-50 border-hermes-200 min-w-[200px]" : "hover:bg-neutral-50 hover:-translate-y-0.5 flex-row"
               )}
             >
               <div className="flex items-center gap-2">
                 {isRecording ? <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1"/> : <Download className="w-4 h-4" />}
                 {isRecording ? (!isAnimated ? "Кроппинг изображения..." : renderPhase) : `Скачать ${isAnimated ? "MP4 / Видео" : "PNG"}`}
               </div>
               {isRecording && isAnimated && (
                 <div className="w-full bg-neutral-200 rounded-full h-1.5 mt-1 overflow-hidden">
                   <div className="bg-hermes-500 h-1.5 transition-all duration-1000 ease-linear" style={{ width: `${renderProgress}%` }}></div>
                 </div>
               )}
               {isRecording && (
                 <p className="text-[10px] sm:text-xs font-medium text-neutral-500 mt-3 text-center normal-case leading-snug px-2 drop-shadow-sm max-w-sm mx-auto opacity-80">
                   Рендеринг запущен в облаке. Можете закрыть вкладку или свернуть приложение — готовое видео появится в "Мои Креативы", и вы скачаете его позже.
                 </p>
               )}
             </button>
           </div>
        )}

        {pair && pair.variants ? (
          // ---- IMAGE VARIANTS GRID (2 models × N variants) ----
          // Two rows: Gemini 3 Pro Image, GPT Image 2. Each card is
          // a final PNG — user can download any. No "winner" step
          // (only the legacy HTML path needed that to load HTML into
          // the single canvas).
          <div className="relative z-10 mt-16 md:mt-0 w-full max-w-[1300px] grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {(["gemini-3-pro-image", "gpt-image-2"] as const).map((m) => {
              const row = pair.variants!.filter((v) => v.model === m);
              if (row.length === 0) return null;
              const label =
                m === "gemini-3-pro-image" ? "Gemini 3 Pro Image (Google)" :
                "GPT Image 2 (OpenAI)";
              const accent =
                m === "gemini-3-pro-image" ? "bg-amber-500" :
                "bg-blue-500";
              return (
                <div key={m} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className={clsx("text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded text-white", accent)}>
                      {label}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-medium">
                      {row.filter((v) => v.ok).length} / {row.length} ok
                    </span>
                  </div>
                  <div
                    className="grid gap-3 md:gap-4"
                    style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
                  >
                    {row.map((v, i) => (
                      <div
                        key={`${m}-${i}`}
                        className="bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col"
                      >
                        <div
                          className="relative bg-[#fcfcfc] flex items-center justify-center"
                          style={format === "9:16"
                            ? { aspectRatio: "9 / 16", width: "100%", maxHeight: "560px" }
                            : { aspectRatio: "1 / 1", width: "100%" }}
                        >
                          {v.ok && v.imageUrl ? (
                            <img
                              src={v.imageUrl}
                              alt={`${label} variant ${i + 1}`}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="p-4 flex flex-col items-center justify-center text-center">
                              <p className="text-sm font-bold text-red-600 mb-1">Ошибка</p>
                              <p className="text-[10px] text-neutral-500 leading-snug">
                                {v.error?.slice(0, 200) || "Без подробностей."}
                              </p>
                            </div>
                          )}
                        </div>
                        {v.ok && v.imageUrl && (
                          <div className="p-2.5 flex flex-col gap-2">
                            {(() => {
                              const isBest = bestCreativeId === v.creativeId;
                              const isSaving = savingBestId === v.creativeId;
                              return (
                                <button
                                  onClick={() => v.creativeId && markAsBest(v.creativeId)}
                                  disabled={isSaving || !v.creativeId}
                                  className={clsx(
                                    "w-full py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors",
                                    isBest
                                      ? "bg-amber-400 text-amber-950 hover:bg-amber-500"
                                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                                    isSaving && "opacity-60 cursor-wait",
                                  )}
                                >
                                  <Trophy className="w-3.5 h-3.5" />
                                  {isBest ? "Лучший выбран" : "Этот лучший"}
                                </button>
                              );
                            })()}
                            <a
                              href={v.imageUrl}
                              download={`creative-${m}-${i + 1}.png`}
                              className="w-full bg-hermes-500 hover:bg-hermes-600 text-white py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" /> Скачать PNG
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => setPair(null)}
              className="md:col-span-2 justify-self-center text-xs font-semibold text-neutral-500 hover:text-neutral-700 underline underline-offset-4"
            >
              Сгенерировать заново
            </button>
          </div>
        ) : pair ? (
          // ---- TRIPLET PREVIEW (animated HTML mode): Claude / Gemini ----
          // Image card (Imagen) is no longer here — static path uses the
          // new variants grid above. Animated stays HTML×2.
          <div className={clsx(
            "relative z-10 mt-16 md:mt-0 grid grid-cols-1 gap-4 md:gap-5 w-full",
            pair.imagen
              ? "md:grid-cols-3 max-w-[1300px]"
              : "md:grid-cols-2 max-w-[1100px]"
          )}>
            {(["claude", "gemini", "imagen"] as const).map((m) => {
              if (m === "imagen" && !pair.imagen && !pair.imagenError) {
                // Animated mode — image card not present at all.
                return null;
              }
              const sib =
                m === "claude" ? pair.claude :
                m === "gemini" ? pair.gemini :
                pair.imagen;
              const sibErr =
                m === "claude" ? pair.claudeError :
                m === "gemini" ? pair.geminiError :
                pair.imagenError;
              const label =
                m === "claude" ? "Claude Opus 4.7" :
                m === "gemini" ? "Gemini 3.1 Pro" :
                "Imagen 4 (картинка)";
              const accent =
                m === "claude" ? "bg-orange-500" :
                m === "gemini" ? "bg-blue-500" :
                "bg-emerald-500";
              if (!sib) {
                return (
                  <div key={m} className="bg-white rounded-3xl border-2 border-dashed border-red-200 p-6 flex flex-col items-center justify-center gap-2 min-h-[400px]">
                    <span className={clsx("text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded text-white", accent)}>{label}</span>
                    <p className="text-sm font-bold text-red-600 mt-2">Эта модель упала</p>
                    <p className="text-[11px] text-neutral-500 text-center leading-snug max-w-[260px]">
                      {sibErr || "Без подробностей."} Импульсы за неудавшийся вариант возвращены.
                    </p>
                  </div>
                );
              }
              const isImageCard = m === "imagen";
              return (
                <div
                  key={m}
                  className="bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col"
                >
                  <div className="px-4 py-2.5 flex items-center justify-between border-b border-neutral-100">
                    <span className={clsx("text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded text-white", accent)}>
                      {label}
                    </span>
                  </div>
                  <div
                    className="relative bg-[#fcfcfc] overflow-hidden flex items-center justify-center"
                    style={format === "9:16"
                      ? { aspectRatio: "9 / 16", width: "100%", maxHeight: "560px" }
                      : { aspectRatio: "1 / 1", width: "100%" }}
                  >
                    {isImageCard ? (
                      <img
                        src={(sib as ImageGen).imageUrl}
                        alt="Imagen creative"
                        className="w-full h-full object-contain bg-[#fcfcfc]"
                      />
                    ) : (() => {
                      // The HTML creative is designed for a 400×711 (9:16)
                      // or 500×500 (1:1) viewport — see the system prompt
                      // and CSS rules. We render it at native size inside
                      // a fixed-size wrapper, scaled down via CSS to fit.
                      // Wrapper has scaled WIDTH/HEIGHT so the layout box
                      // matches what's visible (no overflow surprises on
                      // mobile, no negative-margin hacks). transform-
                      // origin: top-left + position: absolute: inset 0
                      // gives clean, predictable layout.
                      const nativeW = format === "9:16" ? 400 : 500;
                      const nativeH = format === "9:16" ? 711 : 500;
                      const scale = isMobile ? 0.46 : 0.6;
                      const w = Math.round(nativeW * scale);
                      const h = Math.round(nativeH * scale);
                      return (
                        <div
                          style={{ width: w, height: h, position: "relative", overflow: "hidden" }}
                          className="bg-[#fcfcfc]"
                        >
                          <iframe
                            key={`${iframeKey}-${m}`}
                            data-pair-model={m}
                            srcDoc={(sib as DualGen).code}
                            referrerPolicy="no-referrer"
                            sandbox="allow-scripts"
                            title={`${label} Preview`}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: nativeW,
                              height: nativeH,
                              transform: `scale(${scale})`,
                              transformOrigin: "top left",
                              border: "none",
                              background: "#fcfcfc",
                            }}
                          />
                        </div>
                      );
                    })()}
                  </div>
                  <div className="p-3">
                    <button
                      onClick={() => selectPairWinner(m)}
                      className="w-full bg-hermes-500 hover:bg-hermes-600 text-white py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <Trophy className="w-4 h-4" /> Этот лучше →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : code ? (
          <div
            className="relative z-10 bg-white overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] transition-all duration-500 ease-out flex items-center justify-center pointer-events-auto rounded-[32px] shrink-0 mt-20 md:mt-0"
            style={format === '9:16' ? { width: '360px', height: '640px' } : { width: isMobile ? '350px' : '500px', height: isMobile ? '350px' : '500px' }}
          >
            <iframe
              key={iframeKey}
              ref={iframeRef}
              srcDoc={code}
              referrerPolicy="no-referrer"
              className="absolute bg-[#fcfcfc] overflow-hidden"
              sandbox="allow-scripts"
              title="Generated Creative"
              style={{
                width: format === '9:16' ? '400px' : '500px',
                height: format === '9:16' ? '711px' : '500px',
                transform: format === '9:16' ? 'scale(0.9)' : (isMobile ? 'scale(0.7)' : 'scale(1)'),
                transformOrigin: 'center center',
                border: 'none',
              }}
            />
          </div>
        ) : (
          <div
             className="z-10 flex flex-col items-center justify-center text-neutral-400 p-8 border-2 border-dashed border-neutral-300 rounded-[32px] bg-white/50 backdrop-blur-md transition-all duration-300 ease-out shadow-sm"
             style={getCanvasStyle()}
          >
            <div className="w-24 h-24 rounded-full border border-neutral-200 bg-white flex items-center justify-center shadow-lg shadow-black/5 mb-6">
              <Frame className="w-10 h-10 text-neutral-300" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-neutral-800 tracking-tight">Холст пуст</h3>
              <p className="text-sm mt-2 max-w-sm font-medium text-neutral-500 text-center px-4">Заполни ТЗ в настройках слева и нажми «Создать» — система сразу соберёт два варианта (Claude и Gemini), а ты выберешь лучший.</p>
            </div>
          </div>
        )}

        {/* Veo 3 — «Сделать видео» button + progress + download.
            Visible only when user has picked a winner (code+activeId)
            and there's NO already-running render flow (isRecording from
            legacy Cloud Run video path is for animated HTML videos). */}
        {code && !pair && !isRecording && activeCreativeId && (
          <div className="relative mt-6 z-20 shrink-0 w-[90%] max-w-[340px]">
            {!videoJob ? (
              <button
                onClick={startVideoGeneration}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg"
              >
                <Video className="w-4 h-4" />
                Сделать MP4-видео из этого ({VIDEO_GEN_COST} ⚡)
              </button>
            ) : videoJob.state === "kicking" ? (
              <div className="w-full bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                <span className="text-xs font-bold text-purple-800">Запускаем Veo 3...</span>
              </div>
            ) : videoJob.state === "polling" ? (
              <div className="w-full bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  <span className="text-xs font-bold text-purple-800">
                    Veo 3 рендерит видео (30-90 сек)...
                  </span>
                </div>
                <p className="text-[10px] text-purple-600/80 leading-tight">
                  Можешь не ждать — продолжай работать. Видео появится в «Моих креативах» когда будет готово.
                </p>
              </div>
            ) : videoJob.state === "ready" ? (
              <div className="w-full flex flex-col gap-2">
                <video
                  src={videoJob.videoUrl}
                  controls
                  loop
                  autoPlay
                  muted
                  className="w-full rounded-xl shadow-md bg-black aspect-[9/16]"
                  style={format === "1:1" ? { aspectRatio: "1/1" } : undefined}
                />
                <button
                  onClick={downloadVideoFile}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Скачать MP4
                </button>
              </div>
            ) : (
              <div className="w-full bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-2">
                <p className="text-xs font-bold text-red-700">Veo 3 не справился</p>
                <p className="text-[11px] text-red-600 leading-snug">
                  {videoJob.error || "Без подробностей."} Импульсы возвращены.
                </p>
                <button
                  onClick={() => setVideoJob(null)}
                  className="text-[11px] font-bold text-red-700 underline"
                >
                  Попробовать ещё раз
                </button>
              </div>
            )}
          </div>
        )}

        {/* AI Learning Loop Feedback UI */}
        {code && !isRecording && (
          <div className="relative mt-4 z-20 shrink-0 flex flex-col items-center gap-3 w-[90%] max-w-[340px] bg-white p-4 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-neutral-200">
             {!feedbackSubmitted ? (
                <div className="w-full flex justify-between items-center">
                   <p className="text-xs font-bold text-neutral-800">Оцените результат:</p>
                   <div className="flex gap-2">
                     <button onClick={() => setFeedback('like')} className={clsx("p-2 rounded-full border transition-all", feedback === 'like' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-neutral-200 text-neutral-400 hover:bg-neutral-50')}>👍</button>
                     <button onClick={() => setFeedback('dislike')} className={clsx("p-2 rounded-full border transition-all", feedback === 'dislike' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-neutral-200 text-neutral-400 hover:bg-neutral-50')}>👎</button>
                   </div>
                </div>
             ) : (
                <p className="text-xs font-bold text-green-600 text-center w-full my-1">Обновляем нейросеть... Спасибо! ❤️</p>
             )}
             {feedback === 'dislike' && !feedbackSubmitted && (
               <div className="w-full flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                 <p className="text-[11px] font-semibold text-neutral-600">Что испортило результат?</p>
                 <div className="flex flex-wrap gap-1.5">
                   {[
                     "Текст налазит",
                     "Не тот стиль",
                     "Не моя ниша",
                     "Слишком плоско",
                     "Эмодзи мешают",
                     "Не читается",
                     "Слабый CTA",
                   ].map(reason => (
                     <button
                       key={reason}
                       onClick={() => {
                         setFeedbackComment(reason);
                         // Submit immediately with this reason — one click
                         // is the whole point. Pass reason directly because
                         // setState is async.
                         setTimeout(() => submitFeedback(reason), 0);
                       }}
                       className="text-[11px] bg-neutral-100 hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-neutral-200 text-neutral-700 px-2.5 py-1 rounded-full font-semibold transition-colors"
                     >
                       {reason}
                     </button>
                   ))}
                 </div>
                 <div className="flex gap-2 mt-1">
                   <input type="text" value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} placeholder="Или опиши своими словами…" className="flex-1 text-xs border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:border-hermes-500" />
                   <button onClick={() => submitFeedback()} className="bg-neutral-900 hover:bg-hermes-500 transition-colors text-white px-3 py-2 text-xs rounded-lg font-bold">Ок</button>
                 </div>
               </div>
             )}
             {feedback === 'like' && !feedbackSubmitted && (
                <button onClick={() => submitFeedback()} className="w-full mt-2 bg-neutral-900 hover:bg-hermes-500 transition-colors text-white px-3 py-2 text-xs rounded-lg font-bold">Отправить и обучить ИИ на этом</button>
             )}
          </div>
        )}
      </section>

      {/* Mobile App Bottom Navigation (Glassmorphic) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[85px] bg-white/90 backdrop-blur-xl border-t border-neutral-200/50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-[60] flex items-center justify-between px-6 safe-area-bottom pb-5 pt-2">
        <button onClick={() => setMobileTab('controls')} className={clsx("flex flex-col items-center gap-1 w-16 transition-all", mobileTab === 'controls' ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-600")}>
          <div className={clsx("p-2 rounded-xl transition-all", mobileTab === 'controls' ? "bg-neutral-100" : "")}>
             <Sparkles className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold">Настройки</span>
        </button>

        {/* Central FAB Generate Button */}
        <div className="relative -top-6">
          <button
            onClick={() => {
              if (mobileTab === 'controls') {
                 if (activeCreativeId) {
                    setRemixSourceCode(activeCreativeCode);
                    setActiveCreativeId(null);
                 } else if (prompt.trim()) {
                    handleGenerate();
                    setMobileTab('canvas');
                 }
              } else {
                 setMobileTab('controls');
              }
            }}
            disabled={isLoading || isRemovingBg || (!prompt.trim() && mobileTab === 'controls' && !activeCreativeId)}
            className={clsx(
              "w-[72px] h-[72px] rounded-full flex flex-col items-center justify-center text-white shadow-xl border-[5px] border-white transition-all duration-300",
              isLoading || isRemovingBg || (!prompt.trim() && mobileTab === 'controls' && !activeCreativeId)
                ? "bg-neutral-300 shadow-none hover:scale-100 cursor-not-allowed border-neutral-100"
                : activeCreativeId && mobileTab === 'controls'
                ? "bg-amber-500 shadow-amber-500/30 hover:bg-amber-600 hover:scale-105 active:scale-95 hover:border-amber-50"
                : remixSourceCode && mobileTab === 'controls'
                ? "bg-amber-500 shadow-amber-500/30 hover:bg-amber-600 hover:scale-105 active:scale-95 hover:border-amber-50"
                : "bg-black shadow-hermes-500/30 hover:bg-hermes-500 hover:scale-105 active:scale-95 hover:border-hermes-50"
            )}
          >
            {isLoading ? (
               <Loader2 className="w-8 h-8 text-white animate-spin" />
            ) : mobileTab === 'controls' ? (
               activeCreativeId || remixSourceCode ? (
                 <div className="flex flex-col items-center">
                   <Sparkles className="w-6 h-6 text-white mb-0.5" />
                   <span className="text-[8px] font-black uppercase text-center leading-none">
                     {activeCreativeId ? "В ремикс" : "Ремикс"}
                   </span>
                 </div>
               ) : (
                 <Zap className="w-8 h-8 text-white fill-white/20" />
               )
            ) : (
               <Sparkles className="w-7 h-7 text-white" />
            )}
          </button>
          {!isLoading && prompt.trim() && mobileTab === 'controls' && !activeCreativeId && (
             <span className="absolute -top-1 -right-1 bg-hermes-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-bounce ring-2 ring-white">{currentCost}</span>
          )}
        </div>

        <button onClick={() => setMobileTab('canvas')} className={clsx("flex flex-col items-center gap-1 w-16 transition-all", mobileTab === 'canvas' ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-600")}>
          <div className={clsx("p-2 rounded-xl transition-all relative", mobileTab === 'canvas' ? "bg-neutral-100" : "")}>
             <Frame className="w-6 h-6" />
             {code && mobileTab !== 'canvas' && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-hermes-500 rounded-full border-2 border-white" />}
          </div>
          <span className="text-[10px] font-bold">Холст</span>
        </button>
      </div>
      
      {/* Templates modal. Renders into document.body via a portal so
          z-index works against the entire page. */}
      <TemplatesModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onPickTemplate={(item) => {
          if (item.htmlCode) setRemixSourceCode(item.htmlCode);
          setFormat(item.format === "1:1" ? "1:1" : "9:16");
          setMobileTab("controls");
        }}
      />

      {/* Background Dots Pattern Definition */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-grid-pattern {
          background-image: radial-gradient(#d4d4d4 1px, transparent 1px);
          background-size: 24px 24px;
        }
      `}} />
    </main>
  );
}
// Trigger turbopack rebuild
