// ========== PWA INSTALL BANNER (Improved) ==========
(function() {
    let deferredPrompt = null;
    let bannerShown = false;

    // Check if app is already installed (standalone mode)
    function isPWAInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true;
    }

    // Check if inside Capacitor native wrapper (future)
    function isNativeApp() {
        return typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
    }

    // Should we show the banner?
    function shouldShowBanner() {
        if (isPWAInstalled()) return false;
        if (isNativeApp()) return false;
        if (localStorage.getItem('pwaBannerDismissed') === 'true') return false;
        return true;
    }

    // Show the banner with animation
    function showPwaBanner() {
        const banner = document.getElementById('pwaInstallBanner');
        if (!banner || bannerShown) return;
        if (shouldShowBanner()) {
            banner.style.display = 'block';
            bannerShown = true;
        }
    }

    // Hide and optionally remember dismissal
    function dismissPwaBanner(permanent = true) {
        const banner = document.getElementById('pwaInstallBanner');
        if (banner) banner.style.display = 'none';
        if (permanent) localStorage.setItem('pwaBannerDismissed', 'true');
        bannerShown = false;
    }

        // Show iOS instructions modal
    function showIosInstructions() {
        const modal = document.getElementById('pwaInstructionsModal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    // Handle install button click
    async function installPwa() {
        if (!isIos && deferredPrompt) {
            // Android/Chrome: native install prompt
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`PWA install: ${outcome}`);
            deferredPrompt = null;
            dismissPwaBanner(true);
        } else {
            // iOS or no beforeinstallprompt: show instructions
            showIosInstructions();
        }
    }

    // Handle install click
   /* async function installPwa() {
        if (deferredPrompt) {
            // Chrome/Edge: show native install prompt
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`PWA install: ${outcome}`);
            deferredPrompt = null;
            dismissPwaBanner(true);
        } else {
            // Fallback: show instructions (iOS or unsupported)
            alert('To install this app on your device:\n\n- On Android/Chrome: Tap the menu (⋮) → "Install app"\n- On iPhone/Safari: Tap Share → "Add to Home Screen"');
        }
    }*/

    // Wait for DOM before attaching events
    document.addEventListener('DOMContentLoaded', () => {
        const banner = document.getElementById('pwaInstallBanner');
        const installBtn = document.getElementById('pwaInstallBtn');
        const dismissBtn = document.getElementById('pwaDismissBtn');

        if (installBtn) installBtn.addEventListener('click', installPwa);
        if (dismissBtn) dismissBtn.addEventListener('click', () => dismissPwaBanner(true));

        // If beforeinstallprompt already fired, show banner
        if (deferredPrompt && shouldShowBanner()) {
            showPwaBanner();
        } else {
            // Even if no beforeinstallprompt, show banner after 2 seconds (for iOS/fallback)
            setTimeout(() => {
                if (shouldShowBanner() && !deferredPrompt) {
                    showPwaBanner();
                }
            }, 2000);
        }
    });

    // Listen for beforeinstallprompt event (Chrome/Edge)
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        // Show banner immediately if DOM is ready, else wait for DOMContentLoaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => showPwaBanner());
        } else {
            showPwaBanner();
        }
    });

    // If user installs from browser menu, hide banner on next visibility change
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && isPWAInstalled()) {
            dismissPwaBanner(false);
        }
    });
})();


