import React, { useEffect, useState } from 'react';
import { Download, Check, WifiOff, Share, X, Smartphone } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAAndOffline() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    try {
      registerSW({
        immediate: true,
        onOfflineReady() {
          setOfflineReady(true);
        },
        onRegisteredSW() {
          setOfflineReady(true);
        },
      });
    } catch {
      // Service worker registration fallback
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isOnline,
    offlineReady,
    install,
  };
}

export const PWAInstallControl: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isOnline, offlineReady, install } =
    usePWAAndOffline();
  const [showGuideModal, setShowGuideModal] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        {!isOnline && (
          <span
            className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-600 dark:text-amber-400 whitespace-nowrap"
            title="Running offline from cached service worker"
          >
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline Active</span>
          </span>
        )}

        {!isInstalled && (
          <button
            type="button"
            onClick={() => {
              if (isInstallable) {
                install();
              } else {
                setShowGuideModal(true);
              }
            }}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
            aria-label="Install Offline App"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isInstallable ? 'Install App' : isIOS ? 'Install on iOS' : 'Offline App'}</span>
          </button>
        )}
      </div>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#14161B] border border-slate-200 dark:border-[#262934] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#FF5500]/15 text-[#FF5500] flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="pwa-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Offline Studio & Home Screen Setup
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {offlineReady
                      ? 'All patterns & synthesizer modules are cached for 100% offline use'
                      : 'Service worker caching active for offline operation'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                aria-label="Close offline setup dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-b border-slate-200 dark:border-[#232630] py-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                <Check className="w-4 h-4 shrink-0" />
                <span>Works offline automatically after this initial load.</span>
              </div>
              {isIOS ? (
                <p>
                  To install on iPhone or iPad: tap the <Share className="w-3.5 h-3.5 inline mx-0.5" />{' '}
                  <strong>Share</strong> button in Safari, then choose <strong>Add to Home Screen</strong>.
                </p>
              ) : (
                <p>
                  To install as a standalone app on Android or Desktop: open your browser menu and select{' '}
                  <strong>Install Haptics Pro</strong> or <strong>Add to Home Screen</strong>.
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#FF5500] text-white text-xs font-semibold hover:bg-[#e04b00] transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
