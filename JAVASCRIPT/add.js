// At the very top of main.js (after API_BASE_URL, before anything else)
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // We'll show banner after DOM is ready
});

// Then later, inside DOMContentLoaded:
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code (initPasswordStrength, etc.)

    // ---------- PWA Banner Initialization ----------
    const pwaBanner = document.getElementById('pwaInstallBanner');
    const installBtn = document.getElementById('pwaInstallBtn');
    const dismissBtn = document.getElementById('pwaDismissBtn');

    function isPWAInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true;
    }

    function isNativeApp() {
        return typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
    }

    function shouldShowBanner() {
        if (isPWAInstalled()) return false;
        if (isNativeApp()) return false;
        if (!deferredPrompt) return false;
        if (localStorage.getItem('pwaBannerDismissed') === 'true') return false;
        return true;
    }

    function showPwaBanner() {
        if (pwaBanner && shouldShowBanner()) {
            pwaBanner.style.display = 'block';
        }
    }

    function dismissPwaBanner(permanent = true) {
        if (pwaBanner) pwaBanner.style.display = 'none';
        if (permanent) localStorage.setItem('pwaBannerDismissed', 'true');
    }

    async function installPwa() {
        if (!deferredPrompt) {
            alert('You can install this app manually from browser menu: "Add to Home Screen".');
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User ${outcome} installation`);
        deferredPrompt = null;
        if (pwaBanner) pwaBanner.style.display = 'none';
    }

    if (installBtn) installBtn.addEventListener('click', installPwa);
    if (dismissBtn) dismissBtn.addEventListener('click', () => dismissPwaBanner(true));

    // If beforeinstallprompt already fired before DOM ready, show banner now
    if (deferredPrompt) showPwaBanner();

    // Optional: re-check when visibility changes (user might install from browser menu)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && isPWAInstalled() && pwaBanner) {
            pwaBanner.style.display = 'none';
        }
    });
    // ---------- End PWA Banner ----------
});