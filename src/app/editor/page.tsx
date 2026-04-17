"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Code2, Image as ImageIcon, Loader2, Expand, MonitorPlay, Maximize, Smartphone, Upload, Frame, X, Download, Video, PackageSearch, Trash2, Scissors, Zap, Check } from "lucide-react";
import clsx from "clsx";
import { removeBackground } from "@imgly/background-removal";
import { toPng } from "html-to-image";
import { useUser } from "@clerk/nextjs";
import { getUserBalance } from "@/actions/getUserBalance";
import { redeemPromoCode } from "@/actions/redeemPromoCode";
import { getUserCreatives } from "@/actions/getUserCreatives";
import { deleteUserCreative } from "@/actions/deleteUserCreative";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type Format = "1:1" | "9:16";

const buildLoadingTexts = (isAnimated: boolean, hasRefs: boolean, hasProducts: boolean) => {
  return [
    hasRefs || hasProducts ? "Анализируем ваше ТЗ и загруженные медиа..." : "Изучаем запрос и генерируем идею...",
    "Проектируем премиальную сетку дизайна...",
    hasProducts ? "Интегрируем объект в промо-композицию..." : "Подбираем сочные цвета и типографику...",
    "Нейросеть собирает финальный макет...",
    isAnimated ? "Добавляем крутые анимации (почти готово!)..." : "Полируем статичный кадр (почти готово!)..."
  ];
};

const optimizeImageToWebP = (blob: Blob, maxWidth = 800): Promise<string> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new globalThis.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("Canvas context error");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/webp", 0.85)); // webp supports transparency and tiny size!
      URL.revokeObjectURL(url);
    };
    img.onerror = reject;
    img.src = url;
  });
};

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [remixSourceCode, setRemixSourceCode] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("9:16");
  const [isAnimated, setIsAnimated] = useState<boolean>(true);
  const [generationsCount, setGenerationsCount] = useState<number>(1);
  
  // All plans cost 3 for static and 4 for animated
  const currentCost = (isAnimated ? 4 : 3) * generationsCount;
  
  const [referenceImages, setReferenceImages] = useState<{ file: File; dataUrl: string }[]>([]);
  const [productImages, setProductImages] = useState<{ file: File; dataUrl: string }[]>([]);
  
  const [pendingProductFile, setPendingProductFile] = useState<{ file: File; dataUrl: string } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0); 
  const [loadingText, setLoadingText] = useState("Инициируем сервера...");
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showVideoInstruction, setShowVideoInstruction] = useState(false);
  
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState("");

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
  const [backgroundStatuses, setBackgroundStatuses] = useState<Record<string, string>>({});

  // "View Mode" properties based on either the canvas OR the active history item
  const activeCreativeCode = activeCreativeId ? historyItems.find(i => i.id === activeCreativeId)?.htmlCode || code : code;

  useEffect(() => {
    if (!showHistory || historyItems.length === 0) return;
    let isPolling = true;
    const fetchStatuses = async () => {
      const itemsToCheck = historyItems.filter(item => item.htmlCode?.includes('gsap') && !downloadedItems.includes(item.id));
      for (const item of itemsToCheck) {
        if (!isPolling) break;
        try {
          // Check if Google Cloud Storage has the file yet
          const bucket = process.env.NEXT_PUBLIC_GCP_BUCKET || 'creative-coder-outputs-dev';
          const fileUrl = `https://storage.googleapis.com/${bucket}/renders/${item.id}.mp4`;
          const res = await fetch(fileUrl, { method: 'HEAD' });
          if (res.ok) {
            setBackgroundStatuses(prev => ({...prev, [item.id]: 'done'}));
          } else {
             setBackgroundStatuses(prev => ({...prev, [item.id]: 'queued'}));
          }
        } catch(e) {}
      }
      if (isPolling) {
        setTimeout(fetchStatuses, itemsToCheck.length > 0 ? 2000 : 10000);
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

    const savedAnim = localStorage.getItem("creative_animated");
    if (savedAnim !== null) setIsAnimated(savedAnim === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("creative_prompt", prompt);
  }, [prompt]);

  useEffect(() => {
    localStorage.setItem("creative_format", format);
  }, [format]);

  useEffect(() => {
    localStorage.setItem("creative_animated", isAnimated.toString());
  }, [isAnimated]);

  // Background Pre-Rendering
  useEffect(() => {
    if (!code || !isAnimated || !activeCreativeId) return;
    
    setBackgroundJobId(null);
    
    let isMounted = true;
    const runPreRender = async () => {
      setIsBackgroundRendering(true);
      try {
        const response = await fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: code, format, creativeId: activeCreativeId })
        });
        if (response.ok && isMounted) {
          const data = await response.json();
          setBackgroundJobId(data.jobId);
        }
      } catch (err) {
        console.error("Background render failed", err);
      } finally {
        if (isMounted) setIsBackgroundRendering(false);
      }
    };
    
    runPreRender();
    
    return () => {
      isMounted = false;
    };
  }, [code, isAnimated, format, activeCreativeId]);

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
    setGenerationsCount(1);
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

  const confirmProductAsIs = () => {
    if (!pendingProductFile) return;
    setProductImages(prev => [...prev, pendingProductFile]);
    setPendingProductFile(null);
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

    try {
      const results = [];
      
      for (let i = 0; i < generationsCount; i++) {
        // Show iteration in loading state if multiple
        if (generationsCount > 1) {
           // We safely override the loading text
           setLoadingText(`Генерация ${i + 1} из ${generationsCount}...`);
        }

        const iterationPrompt = prompt + (i > 0 && generationsCount > 1 ? ` [Сделай альтернативную версию ${i + 1}, немного поменяй композицию]` : '');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 360000); // 360s local timeout

        try {
          const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: iterationPrompt,
              format,
              isAnimated,
              referenceImagesBase64: refBase64,
              productImagesBase64: prodBase64,
              remixHtmlCode: htmlCodeToRemix
            }),
            signal: controller.signal
          });
          
          const data = await res.json();
          clearTimeout(timeoutId);
          
          if (data.error) {
             const errMsg = data.error.toLowerCase();
             if (errMsg.includes("503") || errMsg.includes("high demand")) {
               throw new Error(`Сервера перегружены из-за высокого спроса! Ошибка на варианте ${i+1}. Подождите.`);
             }
             throw new Error(data.error);
          }
          
          results.push(data);
          
          // Optionally, immediately load the first one while others render in bg
          if (i === 0) {
            setCode(data.code);
            if (data.creativeId) setActiveCreativeId(data.creativeId);
          }
          
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError') throw new Error(`Таймаут (превышено время ожидания) на ${i+1} варианте.`);
          throw err; // Re-throw to be caught by outer catch
        }
      }

      if (results.length > 0) {
        // Automatically load the FIRST generated variation into the main canvas
        setCode(results[0].code);
        if (results[0].creativeId) {
          setActiveCreativeId(results[0].creativeId);
        }
        setRemixSourceCode(null); // Clear remix source after successful generation
      }

      // Update History Bank
      const hist = await getUserCreatives();
      if (hist.success && hist.creatives) {
        setHistoryItems(hist.creatives);
      }

      setMobileTab('canvas');
      setFeedback(null);
      setFeedbackComment("");
      setFeedbackSubmitted(false);
    } catch (err: any) {
      if (err.name === 'AbortError') {
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

  const submitFeedback = async () => {
    if (!activeCreativeId) return;
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creativeId: activeCreativeId,
          score: feedback === 'like' ? 1 : -1,
          comment: feedbackComment
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

  const startVideoRecording = async (preExistingJobId?: string) => {
    setShowVideoInstruction(false);
    setIsRecording(true);

    const targetId = preExistingJobId || activeCreativeId;
    if (!targetId || !code) {
      setError("Не найден ID креатива для рендера");
      setIsRecording(false);
      return;
    }

    try {
      const CLOUD_URL = "/api/render";
      
      setRenderPhase('Подключение к оркестратору Google Cloud...');
      setRenderProgress(10);

      const response = await fetch(CLOUD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: code, format, creativeId: targetId })
      });

      if (!response.ok) throw new Error("Cloud Render Queue Failed: " + response.statusText);

      let isDone = false;
      let checkError = "";
      setRenderPhase('В очереди Cloud Run (около 1 минуты)...');
      setRenderProgress(40);

      const bucket = process.env.NEXT_PUBLIC_GCP_BUCKET || 'creative-coder-outputs-dev';
      const fileUrl = `https://storage.googleapis.com/${bucket}/renders/${targetId}.mp4`;

      // Wait up to 5 minutes for Google Cloud Run to process
      let attempts = 0;
      while (!isDone && attempts < 150) {
        await new Promise(r => setTimeout(r, 2000));
        attempts++;
        
        try {
          const pollRes = await fetch(fileUrl, { method: 'HEAD' });
          if (pollRes.ok) {
              setRenderProgress(100);
              setRenderPhase(`Видео готово! Подготовка загрузки...`);
              isDone = true;
          } else {
             // Just indicate we are waiting
             if (attempts > 5) setRenderProgress(60);
             if (attempts > 15) setRenderProgress(80);
          }
        } catch (e) {
          console.warn("Polling error, retrying...", e);
        }
      }

      if (!isDone) throw new Error("Превышено время ожидания рендера в Google Cloud.");

      setRenderPhase('Скачивание видеофайла на устройство...');
      
      // We directly download the finished file from Google Storage!
      const videoRes = await fetch(fileUrl);
      if (!videoRes.ok) throw new Error("Video download failed. Not found.");

      const videoBlob = await videoRes.blob();
      const blobUrl = URL.createObjectURL(videoBlob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `creative_${format}_4k.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      markItemAsDownloaded(activeCreativeId);

    } catch (err) {
      console.error("Recording failed", err);
      setError("Ошибка рендера. Сервер перегружен или недоступен.");
    } finally {
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
      
      {/* HISTORY BANK OVERLAY */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm p-0 sm:p-4 md:p-10 flex flex-col items-center">
             <div className="w-full h-[100dvh] sm:h-full max-w-6xl bg-white sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-neutral-100 flex-shrink-0">
                   <div className="flex items-center justify-between mb-0 sm:mb-3">
                     <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2"><PackageSearch className="w-5 h-5 sm:w-6 sm:h-6 text-hermes-500" /> Мои креативы ({historyItems.length})</h2>
                     <button onClick={() => setShowHistory(false)} className="w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 transition-colors">
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
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-neutral-100/50 flex flex-col sm:flex-row sm:flex-wrap gap-4 md:gap-6 items-center sm:items-start sm:justify-start content-start">
                   {historyItems.length === 0 ? (
                      <div className="w-full text-center text-neutral-400 font-bold py-20 bg-white rounded-3xl border border-neutral-100">Вы пока не создали ни одного креатива.</div>
                   ) : (
                      historyItems.map((item: any) => {
                        const isVertical = item.format === '9:16' || !item.format;
                        const isDownloaded = downloadedItems.includes(item.id);
                        
                        return (
                          <div key={item.id} className="bg-white rounded-[24px] shadow-sm border border-neutral-200 overflow-hidden relative group flex flex-col w-full max-w-[320px] sm:w-[232px] shrink-0 hover:shadow-xl hover:border-neutral-300 transition-all duration-300 hover:-translate-y-1">
                            
                            {/* Top Bar: Format, Date & Delete */}
                            <div className="flex justify-between items-center p-3 border-b border-neutral-100 bg-white/50 backdrop-blur-md">
                               <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="bg-neutral-100/80 text-neutral-600 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border border-neutral-200/50">
                                     {item.format || '9:16'}
                                  </span>
                                  {isDownloaded ? (
                                    <span className="bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border border-green-200 flex items-center gap-0.5">
                                      <Check className="w-3 h-3" /> Скачано
                                    </span>
                                  ) : backgroundStatuses[item.id] === 'done' ? (
                                    <span 
                                      onClick={(e) => { e.stopPropagation(); startVideoRecording(item.id); }}
                                      className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase border border-blue-200 flex items-center gap-0.5 cursor-pointer hover:bg-blue-200 transition-colors shadow-sm"
                                    >
                                      <span>✅ Скачать видео</span>
                                    </span>
                                  ) : (backgroundStatuses[item.id] && (backgroundStatuses[item.id] === 'queued' || backgroundStatuses[item.id].startsWith('processing'))) ? (
                                    <span className="bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border border-purple-200 flex items-center gap-1 min-w-max">
                                      <Loader2 className="w-3 h-3 animate-spin shrink-0"/> 
                                      {(backgroundStatuses[item.id] === 'queued') 
                                         ? 'В очереди' 
                                         : `Сборка ${backgroundStatuses[item.id].split(':')[1] || 0}%`}
                                    </span>
                                  ) : (
                                    <span className="bg-orange-50 text-orange-600 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border border-orange-200 flex items-center gap-0.5">
                                      Новый
                                    </span>
                                  )}
                               </div>
                               <button 
                                  onClick={(e) => handleDeleteCreative(item.id, e)}
                                  className="text-neutral-300 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50 shrink-0"
                                  title="Удалить"
                               >
                                  <Trash2 className="w-4 h-4" />
                               </button>
                            </div>

                            {/* Creative Preview */}
                            <div 
                               className="w-full bg-neutral-50/50 flex items-center justify-center p-4 cursor-pointer relative"
                            >
                               <div className={`shadow-lg bg-white rounded-xl overflow-hidden relative ${isVertical ? 'aspect-[9/16] w-[200px]' : 'aspect-square w-[200px]'}`}>
                                  <iframe 
                                     srcDoc={item.htmlCode} 
                                     loading="lazy"
                                     className="absolute inset-0 border-0 pointer-events-none origin-top-left"
                                     style={{ 
                                        width: isVertical ? '400px' : '500px', 
                                        height: isVertical ? '711px' : '500px', 
                                        transform: isVertical ? 'scale(0.5)' : 'scale(0.4)',
                                     }}
                                     sandbox="allow-scripts allow-same-origin"
                                  />
                                  <div className="absolute inset-0 bg-transparent z-10" />
                               </div>

                               {/* Hover overlay */}
                               <div onClick={() => { setCode(item.htmlCode); setActiveCreativeId(item.id); setPrompt(item.prompt || ""); setFormat(item.format || '9:16'); setIsAnimated(item.htmlCode?.includes('gsap') || item.cost > 3); setShowHistory(false); setMobileTab('canvas'); }} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-300 z-20">
                                  <div className="bg-white text-neutral-900 font-black px-5 py-3 rounded-2xl flex items-center gap-2 shadow-2xl transform scale-90 group-hover:scale-100 transition-all duration-300">
                                     <Sparkles className="w-4 h-4" /> Посмотреть
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
      {showVideoInstruction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setShowVideoInstruction(false)} className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-800">
              <X className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 bg-hermes-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <MonitorPlay className="w-6 h-6 text-hermes-600" />
            </div>
            <h3 className="text-xl font-bold text-neutral-900 mb-2">Плавная запись видео (MP4)</h3>
            <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
              Чтобы видео было <b>идеально качественным</b> и ваш компьютер не зависал, мы запишем его напрямую с вашей видеокарты. <br/><br/>
              <b>Что сейчас будет:</b><br/>
              1. Нажмите "Начать" ниже.<br/>
              2. В системном окне перейдите в раздел <b>"Вкладка Chrome/Browser"</b>.<br/>
              3. Выберите эту самую вкладку Creative AI и нажмите кнопку <b>"Поделиться"</b>.<br/>
              <br/>
              <i>Внимание: на телефонах эта функция недоступна из-за ограничений iOS/Android. Для скачивания на мобильных потребуется интеграция платного API в будущем.</i>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowVideoInstruction(false)} className="flex-1 py-3 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl transition-colors">
                Отмена
              </button>
              <button onClick={() => startVideoRecording()} className="flex-1 py-3 px-4 bg-hermes-600 hover:bg-hermes-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-hermes-600/30">
                Понятно, Начать
              </button>
            </div>
          </div>
        </div>
      )}

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
                <button 
                  onClick={() => setShowPromoInput(!showPromoInput)}
                  className="flex items-center gap-1.5 bg-hermes-50 text-hermes-700 px-3 py-1.5 rounded-lg border border-hermes-200 hover:bg-hermes-100 hover:border-hermes-300 transition-colors"
                  title="Активировать промокод"
                >
                  <span className="font-extrabold text-sm">{impulses === null ? "..." : impulses}</span>
                  <span className="text-sm">⚡</span>
                </button>
                <Link href="/#pricing" className="px-3 py-1.5 bg-[#f14635] text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors flex items-center shadow-sm whitespace-nowrap">
                  {impulses !== null && impulses >= 10 ? 'Докупить (Kaspi)' : 'Купить (Kaspi)'}
                </Link>
              </div>
              <button 
                onClick={() => setShowHistory(true)}
                className="text-[10px] uppercase font-bold text-neutral-500 mt-2 hover:text-hermes-600 underline"
              >
                Мои креативы ({historyItems.length})
              </button>
            </div>
        </div>

        {showPromoInput && (
          <div className="px-6 py-4 bg-hermes-50/50 border-b border-hermes-100">
            <h3 className="text-xs font-bold text-hermes-800 uppercase tracking-wider mb-2">Активация промокода</h3>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="PROMO-XYZ"
                className="flex-1 bg-white border border-hermes-200 rounded-lg px-3 py-2 text-sm uppercase outline-none focus:border-hermes-500 font-mono"
                disabled={isRedeeming}
              />
              <button 
                onClick={handleRedeem}
                disabled={isRedeeming || !promoCode.trim()}
                className="bg-hermes-600 hover:bg-hermes-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center min-w-[100px]"
              >
                {isRedeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : "ОК"}
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

          {/* Animation Toggle */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Video className="w-4 h-4 text-hermes-500" />
              Тип креатива
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={isLoading}
                onClick={() => setIsAnimated(true)}
                className={clsx(
                  "py-3 rounded-xl border text-sm font-medium transition-all duration-200",
                  isAnimated ? "bg-neutral-900 border-neutral-900 text-white" : "bg-white border-neutral-200 text-neutral-600",
                  !isLoading && !isAnimated && "hover:border-neutral-300",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                Анимированный
              </button>
              <button
                disabled={isLoading}
                onClick={() => setIsAnimated(false)}
                className={clsx(
                  "py-3 rounded-xl border text-sm font-medium transition-all duration-200",
                  !isAnimated ? "bg-neutral-900 border-neutral-900 text-white" : "bg-white border-neutral-200 text-neutral-600",
                  !isLoading && isAnimated && "hover:border-neutral-300",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                Статичный
              </button>
            </div>
          </div>

          {/* Variations Count */}
          <div className="space-y-3">
             <h2 className="text-sm font-semibold flex items-center justify-between">
               <span className="flex items-center gap-2">
                 Сколько вариантов?
               </span>
               <span className="text-xs bg-hermes-50 text-hermes-600 px-2 py-0.5 rounded font-bold">x{currentCost} ⚡</span>
             </h2>
             <div className="flex gap-2">
                {[1, 2, 3, 4].map(v => (
                   <button 
                     key={v} 
                     disabled={isLoading}
                     onClick={() => setGenerationsCount(v)} 
                     className={clsx(
                       "flex-1 py-2 rounded-xl border text-sm font-bold transition-colors", 
                       generationsCount === v ? "bg-hermes-500 text-white border-hermes-500 shadow-md shadow-hermes-500/20" : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300",
                       isLoading && "opacity-50 cursor-not-allowed"
                     )}
                   >
                     {v}
                   </button>
                ))}
             </div>
             <p className="text-[10px] text-neutral-400 leading-tight">Система сгенерирует {generationsCount} {generationsCount === 1 ? 'вариант' : 'варианта'} одновременно. Первый откроется сразу, остальные сохранятся в Банк Креативов.</p>
          </div>

          {/* Reference Image Upload */}
          {!remixSourceCode && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-neutral-400" />
                  Референс (стиль / дизайн)
                </span>
                <span className="text-xs text-neutral-400 font-medium">{referenceImages.length}/{MAX_IMAGES}</span>
              </h2>
              
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
            </div>
          )}

          {/* Product Image Upload (Temporarily hidden per user request until fully refined) */}
          {false && (
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
                {productImages.map((img, i) => (
                  <div key={i} className={clsx("relative group w-16 h-16 rounded-lg border border-neutral-200 overflow-hidden shadow-sm bg-neutral-100/50 flex items-center justify-center", isLoading && "opacity-50")}>
                    <img src={img.dataUrl} alt={`Product ${i}`} className="w-full h-full object-contain mix-blend-multiply" />
                    {!isLoading && (
                      <button
                        onClick={() => removeProduct(i)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                
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
            <textarea
              disabled={isLoading}
              readOnly={!!activeCreativeId}
              maxLength={500}
              className={clsx("w-full bg-white border border-neutral-200 rounded-xl p-4 text-sm focus:outline-none focus:border-hermes-500 focus:ring-1 focus:ring-hermes-500 transition-all resize-none shadow-sm placeholder:text-neutral-400", isLoading ? "opacity-50 cursor-not-allowed" : activeCreativeId ? "opacity-70 bg-neutral-50 h-24" : "h-40")}
              placeholder="Опишите, что вы хотите... Например: 'Минималистичный рекламный постер с зелеными акцентами для курса по Upwork. Сделай крупный заголовок и кнопку Принять участие 👇'"
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
                onClick={() => { setRemixSourceCode(activeCreativeCode); setActiveCreativeId(null); }}
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
                    <span className="text-xs opacity-70 uppercase tracking-widest font-bold">СБОРКА... {loadingProgress}%</span>
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
                    (Спишется {currentCost * generationsCount} ⚡)
                  </span>
                </span>
              )}
            </button>
          )}
        </div>
      </aside>

      {/* Main Canvas Area */}
      <section className={clsx(
        "flex-1 relative flex-col items-center justify-start md:justify-center p-4 md:p-8 bg-[#E5E5E5] custom-grid-pattern overflow-y-auto pb-[300px] md:pb-12 pt-8 md:pt-8 w-full min-h-screen",
        mobileTab === 'canvas' ? "flex" : "hidden md:flex"
      )}>
        
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
                 <p className="text-[10px] font-medium text-neutral-500 mt-2 text-center normal-case leading-tight px-1 drop-shadow-sm">
                   Сборка идет на сервере. Приложение должно оставаться открытым, чтобы видео скачалось вам на телефон. Можете пока отойти выпить кофе ☕
                 </p>
               )}
             </button>
           </div>
        )}

        {code ? (
          <div 
            className="relative z-10 bg-white overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] transition-all duration-500 ease-out flex items-center justify-center pointer-events-auto rounded-[32px] shrink-0 mt-20 md:mt-0"
            style={format === '9:16' ? { width: '360px', height: '640px' } : { width: isMobile ? '350px' : '500px', height: isMobile ? '350px' : '500px' }}
          >
            <iframe
              key={iframeKey}
              ref={iframeRef}
              srcDoc={code}
              className="absolute bg-[#fcfcfc] overflow-hidden"
              sandbox="allow-scripts allow-same-origin"
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
              <p className="text-sm mt-2 max-w-sm font-medium text-neutral-500 text-center px-4">Заполните ТЗ в настройках слева и нажмите сгенерировать. Создадим для вас идеальную картинку.</p>
            </div>
          </div>
        )}

        {/* AI Learning Loop Feedback UI */}
        {code && !isRecording && (
          <div className="relative mt-8 z-20 shrink-0 flex flex-col items-center gap-3 w-[90%] max-w-[340px] bg-white p-4 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-neutral-200">
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
               <div className="w-full flex gap-2 animate-in fade-in slide-in-from-top-2">
                 <input type="text" value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} placeholder="Что ИИ исправить в будущем?" className="flex-1 text-xs border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:border-hermes-500" />
                 <button onClick={submitFeedback} className="bg-neutral-900 hover:bg-hermes-500 transition-colors text-white px-3 py-2 text-xs rounded-lg font-bold">Ок</button>
               </div>
             )}
             {feedback === 'like' && !feedbackSubmitted && (
                <button onClick={submitFeedback} className="w-full mt-2 bg-neutral-900 hover:bg-hermes-500 transition-colors text-white px-3 py-2 text-xs rounded-lg font-bold">Отправить и обучить ИИ на этом</button>
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
             <span className="absolute -top-1 -right-1 bg-hermes-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-bounce ring-2 ring-white">{currentCost * generationsCount}</span>
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
