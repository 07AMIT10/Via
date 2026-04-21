import { useEffect, useMemo } from "react";

interface TelegramWebAppLike {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebAppLike;
    };
  }
}

export function useTelegramWebApp() {
  const webApp = useMemo(() => window.Telegram?.WebApp, []);

  useEffect(() => {
    if (!webApp) {
      return;
    }
    webApp.ready?.();
    webApp.expand?.();
  }, [webApp]);

  return {
    initData: webApp?.initData ?? "",
    isTelegram: Boolean(webApp),
  };
}
