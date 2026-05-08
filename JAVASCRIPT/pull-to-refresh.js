// pull-to-refresh.js - Professional Pull to Refresh for PWA (COMPLETE FIXED)

class PullToRefresh {
  constructor(options = {}) {
    this.options = {
      threshold: 80, // pixels to trigger refresh
      maxPull: 150, // maximum pull distance
      refreshTimeout: 10000, // max wait time for refresh
      onRefresh: null, // callback function
      enabled: true,
      ...options,
    };

    this.isRefreshing = false;
    this.startY = 0;
    this.currentY = 0;
    this.pullDistance = 0;
    this.isDragging = false;
    this.hasStartedRefreshing = false;
    this.refreshElement = null;
    this.loadingOverlay = null;
    this.toast = null;
    this.scrollableElement = null;
    this.startScrollTop = 0;
    this.touchElement = null;
    this.toastTimeout = null;

    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    this.createElements();
    this.attachEvents();
    this.detectScrollableElement();
  }

  createElements() {
    // Create pull-to-refresh indicator with professional design
    this.refreshElement = document.createElement("div");
    this.refreshElement.className = "pull-to-refresh";
    this.refreshElement.innerHTML = `
      <div class="refresh-indicator">
        <div class="refresh-spinner">
          <svg class="refresh-spinner-svg" viewBox="0 0 50 50">
            <circle class="refresh-spinner-circle" cx="25" cy="25" r="20" fill="none" stroke-width="3"></circle>
          </svg>
          <i class="fas fa-arrow-down refresh-arrow"></i>
        </div>
        <span class="refresh-text">Pull to refresh</span>
      </div>
    `;
    document.body.appendChild(this.refreshElement);

    // Create loading overlay
    this.loadingOverlay = document.createElement("div");
    this.loadingOverlay.className = "refresh-loading-overlay";
    this.loadingOverlay.innerHTML = `
      <div class="refresh-loading-spinner">
        <div class="refresh-loading-circle"></div>
        <div class="refresh-loading-circle-inner"></div>
        <svg class="refresh-loading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 22v-4M4 12H2M22 12h-2M19.07 4.93l-2.83 2.83M6.9 17.66l-2.82 2.82M17.66 17.66l2.82 2.82M4.93 4.93l2.83 2.83"/>
        </svg>
        <span>Updating...</span>
      </div>
    `;
    document.body.appendChild(this.loadingOverlay);

    // Create toast notification
    this.toast = document.createElement("div");
    this.toast.className = "refresh-toast";
    this.toast.innerHTML = `
      <svg class="refresh-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
      <span>Updated successfully</span>
    `;
    document.body.appendChild(this.toast);
  }

  detectScrollableElement() {
    // Find the main scrollable container
    this.scrollableElement =
      document.querySelector(".content-pages") ||
      document.querySelector(".admin-pages") ||
      document.querySelector(".main-content") ||
      document.querySelector(".dashboard .main-content") ||
      document.querySelector(".admin-main") ||
      document.querySelector(".page.active") ||
      window;
  }

  attachEvents() {
    // Determine the element to attach touch events to
    let touchElement = null;

    if (this.scrollableElement && this.scrollableElement !== window) {
      touchElement = this.scrollableElement;
    } else {
      touchElement = document.body || document.documentElement;
    }

    this.touchElement = touchElement;

    // Touch events for mobile
    if (touchElement) {
      touchElement.addEventListener(
        "touchstart",
        this.handleTouchStart.bind(this),
        { passive: false },
      );
      touchElement.addEventListener(
        "touchmove",
        this.handleTouchMove.bind(this),
        { passive: false },
      );
      touchElement.addEventListener("touchend", this.handleTouchEnd.bind(this));
    }

    // Mouse events for desktop development
    document.addEventListener("mousedown", this.handleMouseDown.bind(this));
    document.addEventListener("mousemove", this.handleMouseMove.bind(this));
    document.addEventListener("mouseup", this.handleMouseUp.bind(this));

    // Also listen on window for scroll events
    window.addEventListener("scroll", this.handleWindowScroll.bind(this));
  }

  handleWindowScroll() {
    // Reset pull if user scrolls normally
    if (!this.isDragging && this.pullDistance > 0) {
      this.resetPullUI();
      this.pullDistance = 0;
    }
  }

  isAtTop() {
    if (!this.scrollableElement) return true;

    if (this.scrollableElement === window) {
      return (window.scrollY || document.documentElement.scrollTop) <= 5;
    }

    if (
      this.scrollableElement &&
      typeof this.scrollableElement.scrollTop !== "undefined"
    ) {
      return this.scrollableElement.scrollTop <= 5;
    }

    return true;
  }

  handleTouchStart(e) {
    if (!this.options.enabled || this.isRefreshing) return;

    // Get current scroll position
    if (this.scrollableElement === window) {
      this.startScrollTop =
        window.scrollY || document.documentElement.scrollTop;
    } else {
      this.startScrollTop = this.scrollableElement?.scrollTop || 0;
    }

    // Only allow pull-to-refresh if at the very top
    if (!this.isAtTop()) return;

    this.startY = e.touches[0].clientY;
    this.isDragging = true;
    this.pullDistance = 0;
    this.hasStartedRefreshing = false;
  }

  handleTouchMove(e) {
    if (!this.isDragging || !this.options.enabled || this.isRefreshing) return;

    // Check if we're still at top during drag
    if (!this.isAtTop()) {
      // User scrolled down, cancel the pull
      this.resetPullUI();
      this.isDragging = false;
      return;
    }

    this.currentY = e.touches[0].clientY;
    let deltaY = this.currentY - this.startY;

    // Only positive delta (pulling down) and at top
    if (deltaY > 0 && this.isAtTop()) {
      // Prevent default to stop page scroll while pulling
      e.preventDefault();

      // Calculate pull distance with resistance (increasing resistance as you pull more)
      let resistance = 1;
      if (deltaY > 40) {
        resistance = Math.max(0.2, 1 - (deltaY - 40) / 200);
      }
      this.pullDistance = Math.min(deltaY * resistance, this.options.maxPull);

      // Update UI based on pull distance
      this.updatePullUI(this.pullDistance);
    }
  }

  handleTouchEnd() {
    if (!this.isDragging) return;

    this.isDragging = false;

    if (this.pullDistance >= this.options.threshold && !this.isRefreshing) {
      this.triggerRefresh();
    } else {
      this.resetPullUI();
    }

    this.pullDistance = 0;
  }

  handleMouseDown(e) {
    if (!this.options.enabled || this.isRefreshing) return;

    if (this.scrollableElement === window) {
      this.startScrollTop =
        window.scrollY || document.documentElement.scrollTop;
    } else {
      this.startScrollTop = this.scrollableElement?.scrollTop || 0;
    }

    if (!this.isAtTop()) return;

    this.startY = e.clientY;
    this.isDragging = true;
    this.pullDistance = 0;
    this.hasStartedRefreshing = false;
  }

  handleMouseMove(e) {
    if (!this.isDragging || !this.options.enabled || this.isRefreshing) return;

    if (!this.isAtTop()) {
      this.resetPullUI();
      this.isDragging = false;
      return;
    }

    let deltaY = e.clientY - this.startY;

    if (deltaY > 0 && this.isAtTop()) {
      let resistance = 1;
      if (deltaY > 40) {
        resistance = Math.max(0.2, 1 - (deltaY - 40) / 200);
      }
      this.pullDistance = Math.min(deltaY * resistance, this.options.maxPull);
      this.updatePullUI(this.pullDistance);
    }
  }

  handleMouseUp() {
    if (!this.isDragging) return;

    this.isDragging = false;

    if (this.pullDistance >= this.options.threshold && !this.isRefreshing) {
      this.triggerRefresh();
    } else {
      this.resetPullUI();
    }

    this.pullDistance = 0;
  }

  updatePullUI(pullDistance) {
    if (!this.refreshElement) return;

    const percentage = Math.min(pullDistance / this.options.threshold, 1);
    // Calculate position - start hidden above screen
    const translateY = -60 + pullDistance;

    this.refreshElement.style.transform = `translateY(${translateY}px)`;
    this.refreshElement.style.opacity = Math.min(percentage + 0.3, 1);

    const arrow = this.refreshElement.querySelector(".refresh-arrow");
    const text = this.refreshElement.querySelector(".refresh-text");
    const spinnerCircle = this.refreshElement.querySelector(
      ".refresh-spinner-circle",
    );

    if (arrow && text) {
      if (pullDistance >= this.options.threshold) {
        arrow.classList.remove("fa-arrow-down");
        arrow.classList.add("fa-sync-alt");
        text.textContent = "Release to refresh";
        arrow.style.transform = "rotate(180deg)";
        if (spinnerCircle) {
          spinnerCircle.style.strokeDashoffset = "0";
        }
      } else {
        arrow.classList.remove("fa-sync-alt");
        arrow.classList.add("fa-arrow-down");
        text.textContent = "Pull to refresh";
        const rotation = (pullDistance / this.options.threshold) * 180;
        arrow.style.transform = `rotate(${rotation}deg)`;
        if (spinnerCircle) {
          const dashOffset = 126 - percentage * 126;
          spinnerCircle.style.strokeDashoffset = dashOffset;
        }
      }
    }
  }

  resetPullUI() {
    if (!this.refreshElement) return;

    this.refreshElement.style.transform = "";
    this.refreshElement.style.opacity = "";

    const arrow = this.refreshElement.querySelector(".refresh-arrow");
    const text = this.refreshElement.querySelector(".refresh-text");
    const spinnerCircle = this.refreshElement.querySelector(
      ".refresh-spinner-circle",
    );

    if (arrow && text) {
      arrow.classList.remove("fa-sync-alt");
      arrow.classList.add("fa-arrow-down");
      arrow.style.transform = "";
      if (spinnerCircle) {
        spinnerCircle.style.strokeDashoffset = "126";
      }
      text.textContent = "Pull to refresh";
    }
  }

  async triggerRefresh() {
    if (this.isRefreshing) return;

    this.isRefreshing = true;

    // Show refreshing state - move element into visible area
    if (this.refreshElement) {
      this.refreshElement.style.transform = "translateY(0)";
      const arrow = this.refreshElement.querySelector(".refresh-arrow");
      const text = this.refreshElement.querySelector(".refresh-text");
      const spinnerCircle = this.refreshElement.querySelector(
        ".refresh-spinner-circle",
      );

      if (arrow && text) {
        arrow.style.display = "none";
        text.textContent = "Refreshing...";
        if (spinnerCircle) {
          spinnerCircle.style.animation = "refresh-spin 0.8s linear infinite";
          spinnerCircle.style.strokeDashoffset = "0";
        }
      }
    }

    // Show loading overlay
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.add("show");
    }

    // Store timeout reference
    let timeoutId = null;
    let isCompleted = false;

    // Create a promise that resolves when refresh completes or times out
    const refreshPromise = (async () => {
      try {
        // Call the refresh callback
        if (
          this.options.onRefresh &&
          typeof this.options.onRefresh === "function"
        ) {
          await this.options.onRefresh();
        }
        isCompleted = true;
        return { success: true };
      } catch (error) {
        console.error("Refresh error:", error);
        isCompleted = true;
        return { success: false, error };
      }
    })();

    // Set timeout - but don't auto-hide, just handle the timeout case
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        if (!isCompleted) {
          resolve({ success: false, error: new Error("timeout") });
        }
      }, this.options.refreshTimeout);
    });

    // Race between refresh completion and timeout
    const result = await Promise.race([refreshPromise, timeoutPromise]);

    // Clear timeout
    if (timeoutId) clearTimeout(timeoutId);

    if (result.success !== undefined) {
      // Refresh completed or timed out
      if (result.success) {
        this.hideRefreshUI(true);
        this.showToast("Updated successfully", "success");
      } else {
        if (result.error && result.error.message === "timeout") {
          // Timeout occurred but refresh might still be ongoing
          // Don't hide yet, wait for actual completion
          console.log("Refresh taking longer than expected, waiting...");

          // Wait for the actual refresh to complete
          const finalResult = await refreshPromise;
          if (finalResult.success) {
            this.hideRefreshUI(true);
            this.showToast("Updated successfully", "success");
          } else {
            this.hideRefreshUI(false);
            this.showToast("Refresh failed. Try again.", "error");
          }
        } else {
          this.hideRefreshUI(false);
          this.showToast("Refresh failed. Try again.", "error");
        }
      }
    }
  }

  hideRefreshUI(success) {
    this.isRefreshing = false;
    this.hasStartedRefreshing = false;

    // Hide loading overlay
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.remove("show");
    }

    // Reset the refresh element
    if (this.refreshElement) {
      // Remove the spinning animation
      const spinnerCircle = this.refreshElement.querySelector(
        ".refresh-spinner-circle",
      );
      if (spinnerCircle) {
        spinnerCircle.style.animation = "";
      }

      const arrow = this.refreshElement.querySelector(".refresh-arrow");
      if (arrow) {
        arrow.style.display = "";
      }

      // Reset to original state
      setTimeout(() => {
        if (this.refreshElement) {
          this.resetPullUI();
        }
      }, 100);
    }
  }

  showToast(message, type = "success") {
    if (!this.toast) return;

    // Clear any existing timeout
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    // Update toast icon based on type
    const iconSvg = this.toast.querySelector(".refresh-toast-icon");
    if (iconSvg) {
      if (type === "success") {
        iconSvg.innerHTML = '<path d="M20 6L9 17l-5-5"/>';
        iconSvg.style.stroke = "#10b981";
      } else if (type === "error") {
        iconSvg.innerHTML =
          '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';
        iconSvg.style.stroke = "#ef4444";
      }
    }

    const textSpan = this.toast.querySelector("span");
    if (textSpan) textSpan.textContent = message;

    this.toast.className = `refresh-toast ${type}`;
    this.toast.classList.add("show");

    // Set timeout to hide after 2 seconds
    this.toastTimeout = setTimeout(() => {
      if (this.toast) {
        this.toast.classList.remove("show");
        // Reset icon back to success style after error
        if (iconSvg && type === "error") {
          iconSvg.innerHTML = '<path d="M20 6L9 17l-5-5"/>';
          iconSvg.style.stroke = "#10b981";
        }
      }
      this.toastTimeout = null;
    }, 2000);
  }

  enable() {
    this.options.enabled = true;
  }

  disable() {
    this.options.enabled = false;
    this.resetPullUI();
  }

  async manualRefresh() {
    if (this.isRefreshing) return;
    await this.triggerRefresh();
  }

  destroy() {
    this.disable();

    // Remove event listeners
    if (this.touchElement) {
      this.touchElement.removeEventListener(
        "touchstart",
        this.handleTouchStart,
      );
      this.touchElement.removeEventListener("touchmove", this.handleTouchMove);
      this.touchElement.removeEventListener("touchend", this.handleTouchEnd);
    }

    document.removeEventListener("mousedown", this.handleMouseDown);
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("mouseup", this.handleMouseUp);
    window.removeEventListener("scroll", this.handleWindowScroll);

    // Remove elements from DOM
    if (this.refreshElement && this.refreshElement.remove) {
      this.refreshElement.remove();
    }
    if (this.loadingOverlay && this.loadingOverlay.remove) {
      this.loadingOverlay.remove();
    }
    if (this.toast && this.toast.remove) {
      this.toast.remove();
    }

    this.refreshElement = null;
    this.loadingOverlay = null;
    this.toast = null;
    this.scrollableElement = null;
    this.touchElement = null;
  }
}

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = PullToRefresh;
}

// Make available globally
window.PullToRefresh = PullToRefresh;
