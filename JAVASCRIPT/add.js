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






// PWA Installation Logic
let deferredPrompt = null;
const pwaBanner = document.getElementById('pwaInstallBanner');
const installBtn = document.getElementById('pwaInstallBtn');
const dismissBtn = document.getElementById('pwaDismissBtn');

// 1. Check if already installed (standalone mode)
function isPWAInstalled() {
  // Check for display-mode: standalone, fullscreen, minimal-ui
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        window.navigator.standalone === true; // iOS Safari
  return isStandalone;
}

// 2. Check if inside Capacitor native app (future proof)
function isNativeApp() {
  return typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
}

// 3. Show banner only if:
//    - PWA not installed
//    - Not in native wrapper
//    - beforeinstallprompt event was fired (deferredPrompt exists)
//    - User hasn't dismissed it permanently (localStorage)
function shouldShowBanner() {
  if (isPWAInstalled()) return false;
  if (isNativeApp()) return false;
  if (!deferredPrompt) return false;
  const dismissed = localStorage.getItem('pwaBannerDismissed');
  if (dismissed === 'true') return false;
  return true;
}

// 4. Show banner with animation
function showPwaBanner() {
  if (pwaBanner && shouldShowBanner()) {
    pwaBanner.style.display = 'block';
  }
}

// 5. Hide banner permanently (dismiss)
function dismissPwaBanner(permanent = true) {
  if (pwaBanner) pwaBanner.style.display = 'none';
  if (permanent) {
    localStorage.setItem('pwaBannerDismissed', 'true');
  }
}

// 6. Trigger native install prompt
async function installPwa() {
  if (!deferredPrompt) {
    // Fallback: Show instructions if event not ready
    alert('You can install this app manually from browser menu: "Add to Home Screen".');
    return;
  }
  // Show the install prompt
  deferredPrompt.prompt();
  // Wait for user choice
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`User ${outcome} the installation`);
  // Clear deferredPrompt – can't be used again
  deferredPrompt = null;
  // Hide banner after install attempt (even if cancelled)
  if (pwaBanner) pwaBanner.style.display = 'none';
  // If user installed, we won't show again because isPWAInstalled() becomes true
  // but we can keep localStorage untouched – next page load will detect standalone.
}

// 7. Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // After event is captured, we can safely show the banner
  showPwaBanner();
});

// 8. Attach button events
if (installBtn) {
  installBtn.addEventListener('click', installPwa);
}
if (dismissBtn) {
  dismissBtn.addEventListener('click', () => dismissPwaBanner(true));
}

// 9. Re-check on visibility change (user might install from browser menu)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && isPWAInstalled()) {
    // Installed while tab was hidden – hide banner
    if (pwaBanner) pwaBanner.style.display = 'none';
  }
});

// 10. Initial check – in case beforeinstallprompt already fired before DOM ready
if (deferredPrompt) {
  showPwaBanner();
}