"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Code2, Image as ImageIcon, Loader2, Expand, MonitorPlay, Maximize, Smartphone, Upload, Frame, X, Download, Video, PackageSearch, Trash2, Scissors, Zap } from "lucide-react";
import clsx from "clsx";
import { removeBackground } from "@imgly/background-removal";
import { toPng } from "html-to-image";

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
  const [format, setFormat] = useState<Format>("9:16");
  const [isAnimated, setIsAnimated] = useState<boolean>(true);
  
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

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const MAX_IMAGES = 4;

  const isUIBlocked = isLoading || isRemovingBg || isRecording;

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
    setError("");
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

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          format,
          isAnimated,
          referenceImagesBase64: refBase64,
          productImagesBase64: prodBase64,
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        // Intercept nasty 503 google errors
        const errMsg = data.error?.toLowerCase() || "";
        if (response.status === 503 || errMsg.includes("503") || errMsg.includes("high demand")) {
          throw new Error("Сервера Google (Gemini) сейчас перегружены из-за высокого спроса! Пожалуйста, подождите 15-30 секунд и нажмите кнопку заново.");
        }
        throw new Error(data.error || "Произошла ошибка при генерации");
      }

      setCode(data.code);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError("Превышено время ожидания (генерация заняла больше 90 секунд). Пожалуйста, попробуйте еще раз.");
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
    }
  };

  const handleDownloadClick = async () => {
    if (!iframeRef.current) return;

    if (!isAnimated) {
      if (!iframeRef.current.contentDocument) {
        setError("Не удалось получить доступ к содержимому креатива. Попробуйте обновить страницу.");
        return;
      }
      try {
        const bodyContent = iframeRef.current.contentDocument.body;
        const rect = iframeRef.current.getBoundingClientRect();
        
        const dataUrl = await toPng(bodyContent, { 
          cacheBust: true, 
          pixelRatio: 2, 
          backgroundColor: '#ffffff',
          skipFonts: true,
          width: rect.width,
          height: rect.height,
          style: {
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            overflow: 'hidden'
          }
        });
        const link = document.createElement("a");
        link.download = `creative-static-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error("Error downloading image", err);
        setError("Не удалось скачать картинку (возможно ограничение безопасности браузера).");
      }
    } else {
      setShowVideoInstruction(true);
    }
  };

  const handleReplay = () => {
    setIframeKey(prev => prev + 1);
  };

  const startVideoRecording = async () => {
    setShowVideoInstruction(false);

    // Simple detection for mobile phones where screen recording is impossible
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      setError("Функция захвата Видео недоступна на мобильных устройствах. Для экспорта MP4 нужен компьютер или интеграция платного API-сервиса.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "browser" }, audio: false });
      
      const mimeType = MediaRecorder.isTypeSupported("video/mp4") 
              ? "video/mp4" 
              : MediaRecorder.isTypeSupported("video/webm; codecs=vp9") 
              ? "video/webm; codecs=vp9" 
              : "video/webm";
              
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `creative-video-${Date.now()}.${ext}`;
        link.click();
        setIsRecording(false);
      };

      const currentIframe = iframeRef.current as any;
      const originalCode = currentIframe.srcdoc || currentIframe.getAttribute('srcdoc') || code;
      currentIframe.srcdoc = '';
      
      setTimeout(() => {
        if(currentIframe) currentIframe.srcdoc = originalCode;
        setIsRecording(true);
        mediaRecorder.start();
        
        setTimeout(() => {
          if(mediaRecorder.state !== "inactive") mediaRecorder.stop();
          stream.getTracks().forEach(t => t.stop());
        }, 6500);
      }, 300);

    } catch (err) {
      console.error("Recording failed", err);
      setError("Запись видео была отменена или не поддерживается на вашем устройстве.");
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
              <button onClick={startVideoRecording} className="flex-1 py-3 px-4 bg-hermes-600 hover:bg-hermes-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-hermes-600/30">
                Понятно, Начать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Controls */}
      <aside className="w-[420px] h-full shrink-0 glass-panel bg-white/80 flex flex-col z-10 relative shadow-xl border-r border-neutral-200">
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
          
          <div className="flex flex-col items-end cursor-pointer group" title="Пополнить баланс">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">Баланс</span>
            <div className="flex items-center gap-1.5 bg-hermes-50 text-hermes-700 px-3 py-1.5 rounded-lg border border-hermes-200 group-hover:bg-hermes-100 group-hover:border-hermes-300 transition-colors">
              <span className="font-extrabold text-sm">17</span>
              <Zap className="w-4 h-4 fill-current" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
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
                  {f === "1:1" && <div className="border-2 border-inherit rounded-sm w-4 h-4" />}
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

          {/* Reference Image Upload */}
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

          {/* Product Image Upload */}
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
                  <img src={pendingProductFile.dataUrl} className={clsx("w-full h-full object-contain", isRemovingBg && "opacity-50")} />
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
              maxLength={500}
              className={clsx("w-full h-40 bg-white border border-neutral-200 rounded-xl p-4 text-sm focus:outline-none focus:border-hermes-500 focus:ring-1 focus:ring-hermes-500 transition-all resize-none shadow-sm placeholder:text-neutral-400", isLoading && "opacity-50 cursor-not-allowed")}
              placeholder="Опишите, что вы хотите... Например: 'Минималистичный рекламный постер с зелеными акцентами для курса по Upwork. Сделай крупный заголовок и кнопку Принять участие 👇'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border-2 border-red-100 font-medium leading-relaxed">
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-neutral-200/50 bg-white/50 backdrop-blur-sm z-20">
          <button
            onClick={handleGenerate}
            disabled={isLoading || isRemovingBg || !prompt.trim()}
            className={clsx(
              "w-full py-4 rounded-xl font-bold text-white transition-all duration-300 flex flex-col items-center justify-center gap-1 relative overflow-hidden",
              isLoading || isRemovingBg || !prompt.trim()
                ? "bg-neutral-300 cursor-not-allowed text-neutral-600 shadow-none"
                : "bg-neutral-900 hover:bg-hermes-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-hermes-500/30"
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
                  <Sparkles className="w-5 h-5" />
                  Создать Креатив
                </span>
                <span className="text-[10px] uppercase font-bold opacity-80 flex items-center justify-center gap-1">
                  (Спишется 1 ⚡)
                </span>
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <section className="flex-1 relative flex flex-col items-center justify-center p-8 bg-[#E5E5E5] custom-grid-pattern">
        
        {code && (
           <div className="absolute top-8 right-8 z-20 flex items-center gap-3">
             {isAnimated && (
               <button 
                 onClick={handleReplay}
                 disabled={isLoading || isRemovingBg || isRecording}
                 className="w-12 h-12 bg-white border border-neutral-200 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full text-neutral-800 transition-all flex items-center justify-center hover:bg-neutral-50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.16)] hover:-translate-y-0.5"
                 title="Повторить анимацию"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
               </button>
             )}
             <button 
               onClick={handleDownloadClick}
               disabled={isLoading || isRemovingBg || isRecording}
               className={clsx("px-6 py-3 bg-white border border-neutral-200 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full font-bold text-neutral-800 transition-all flex items-center gap-2", 
                isRecording ? "opacity-90 cursor-wait bg-hermes-50 border-hermes-200" : "hover:bg-neutral-50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.16)] hover:-translate-y-0.5"
               )}
             >
               {isRecording ? <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1"/> : <Download className="w-4 h-4" />}
               {isRecording ? "Идет запись (еще пару сек)..." : `Скачать ${isAnimated ? "MP4 / Видео" : "PNG"}`}
             </button>
           </div>
        )}

        {code ? (
          <div 
            className="relative z-10 bg-white overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] transition-all duration-500 ease-out flex items-center justify-center pointer-events-auto"
            style={getCanvasStyle()}
          >
            <iframe
              key={iframeKey}
              ref={iframeRef}
              srcDoc={code}
              className="w-full h-full bg-[#fcfcfc] overflow-hidden"
              sandbox="allow-scripts allow-same-origin"
              title="Generated Creative"
              style={{ padding: 0, margin: 0, border: 'none' }}
            />
          </div>
        ) : (
          <div className="z-10 flex flex-col items-center justify-center text-neutral-400 space-y-6">
            <div className="w-24 h-24 rounded-full border border-neutral-200 bg-white flex items-center justify-center shadow-lg shadow-black/5">
              <Frame className="w-10 h-10 text-neutral-300" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-neutral-800 tracking-tight">Холст пуст</h3>
              <p className="text-sm mt-2 max-w-sm font-medium text-neutral-500">Заполните ТЗ в панели слева и нажмите сгенерировать. Мы создадим для вас идеальную картинку.</p>
            </div>
          </div>
        )}
      </section>
      
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
