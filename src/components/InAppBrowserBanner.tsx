"use client";

import { useEffect, useState } from "react";

/**
 * Detects when the page is loaded inside an in-app browser (Instagram,
 * Facebook, TikTok, Threads, Snapchat, Telegram, Line, Twitter X, etc.)
 * and shows a sticky top banner asking the user to open the site in
 * a real browser.
 *
 * Why: Google's OAuth (used by Clerk for "Sign in with Google") refuses
 * to load inside embedded WebViews — the user gets a 403 with
 * "disallowed_useragent" and can't sign up. By the time they see that
 * Google error they've already lost trust. We catch them earlier by
 * showing a friendly banner the moment they land.
 *
 * Detection: user-agent string match against the known in-app browser
 * markers documented by each platform. Not perfect (some hide the UA),
 * but covers the 95% common cases.
 *
 * Dismissibility: a "Понятно" button stores `iab-dismissed=1` in
 * sessionStorage. Banner stays hidden for the rest of the session even
 * if the user navigates around. New session = banner re-checks.
 */

const IN_APP_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "Instagram", re: /Instagram/i },
  { name: "Facebook", re: /FBA[NV]\/|FB_IAB|FBAN|FBAV/i },
  { name: "TikTok", re: /BytedanceWebview|musical_ly|TikTok|Aweme/i },
  { name: "Threads", re: /Threads/i },
  { name: "Snapchat", re: /Snapchat/i },
  { name: "Telegram", re: /TelegramBot|Telegram\/|TgWebView/i },
  { name: "X / Twitter", re: /Twitter|TwitterAndroid/i },
  { name: "Line", re: /Line\//i },
  { name: "WeChat", re: /MicroMessenger/i },
];

function detectInAppBrowser(): string | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  for (const { name, re } of IN_APP_PATTERNS) {
    if (re.test(ua)) return name;
  }
  return null;
}

export function InAppBrowserBanner() {
  const [appName, setAppName] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("iab-dismissed") === "1") {
      setDismissed(true);
      return;
    }
    setAppName(detectInAppBrowser());
  }, []);

  if (!appName || dismissed) return null;

  function dismiss() {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("iab-dismissed", "1");
    }
    setDismissed(true);
  }

  async function copyUrl() {
    const url = typeof window !== "undefined" ? window.location.href : "https://aicreative.kz";
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for old browsers / insecure contexts: show a prompt the
      // user can long-press-copy from. Better than nothing.
      window.prompt("Скопируйте ссылку:", url);
    }
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] bg-red-600 text-white shadow-lg shadow-red-900/30"
      role="alert"
      aria-live="polite"
    >
      <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white text-red-600 flex items-center justify-center text-lg font-black shadow-sm">
          !
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base font-black leading-tight">
            Регистрация через Google не работает в {appName}
          </p>
          <p className="text-xs sm:text-sm text-white/90 mt-1 leading-snug">
            <strong>Решение 1:</strong> регистрируйся через <strong>email</strong> — он работает прямо здесь, ничего открывать не надо.
            <br />
            <strong>Решение 2:</strong> открой сайт в Safari/Chrome — там Google-вход тоже работает.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              onClick={copyUrl}
              className="text-xs sm:text-sm font-bold bg-white text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors active:scale-[0.97]"
            >
              {copied ? "✓ Ссылка скопирована" : "Скопировать ссылку"}
            </button>
            <button
              onClick={dismiss}
              className="text-xs sm:text-sm font-bold text-white/80 hover:text-white px-3 py-2 rounded-lg transition-colors"
            >
              Понятно, скрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
