// pull-to-refresh.js - Professional Pull to Refresh for PWA (COMPLETELY FIXED)

class PullToRefresh {
  constructor(options = {}) {
    this.options = {
      threshold: 80,
      maxPull: 150,
      refreshTimeout: 10000,
      onRefresh: null,
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
    this.isAtTopStart = false;

    // Bind methods to ensure correct 'this' context
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    this.createElements();
    this._attachEvents();
    this.detectScrollableElement();
  }

  createElements() {
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
    // Find the ACTUAL scrollable content container
    const activePage = document.querySelector(".page.active");

    if (activePage) {
      // Check if the active page itself is scrollable
      if (activePage.scrollHeight > activePage.clientHeight + 10) {
        this.scrollableElement = activePage;
        return;
      }

      // Look for common scrollable containers within the active page
      const scrollableSelectors = [
        ".content-pages",
        ".admin-pages",
        ".transactions-list",
        ".savings-list",
        ".accounts-grid",
        ".recent-transactions",
        ".main-content",
        ".dashboard .main-content",
        ".admin-main",
        ".page.active .transactions-list",
        ".page.active .savings-list",
        ".page.active .accounts-grid",
      ];

      for (const selector of scrollableSelectors) {
        const element = document.querySelector(selector);
        if (element && element.scrollHeight > element.clientHeight + 10) {
          this.scrollableElement = element;
          return;
        }
      }

      // Fallback: find any scrollable div within active page
      const allDivs = activePage.querySelectorAll("div");
      for (const div of allDivs) {
        if (div.scrollHeight > div.clientHeight + 20) {
          this.scrollableElement = div;
          return;
        }
      }
    }

    // If no scrollable content found, use the main content wrapper
    this.scrollableElement =
      document.querySelector(".main-content") || document.documentElement;
  }

  isAtTop() {
    if (!this.scrollableElement) return true;

    let scrollTop = 0;

    if (this.scrollableElement === document.documentElement) {
      scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    } else {
      scrollTop = this.scrollableElement.scrollTop;
    }

    // Allow a small tolerance (5px) for natural scroll bounce
    return scrollTop <= 5;
  }

  _attachEvents() {
    let touchElement = this.scrollableElement || document.body;
    this.touchElement = touchElement;

    touchElement.addEventListener("touchstart", this.handleTouchStart, {
      passive: false,
    });
    touchElement.addEventListener("touchmove", this.handleTouchMove, {
      passive: false,
    });
    touchElement.addEventListener("touchend", this.handleTouchEnd);

    document.addEventListener("mousedown", this.handleMouseDown);
    document.addEventListener("mousemove", this.handleMouseMove);
    document.addEventListener("mouseup", this.handleMouseUp);
  }

  handleTouchStart(e) {
    if (!this.options.enabled || this.isRefreshing) return;

    // Store current scroll position
    if (this.scrollableElement === document.documentElement) {
      this.startScrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
    } else {
      this.startScrollTop = this.scrollableElement
        ? this.scrollableElement.scrollTop
        : 0;
    }

    // Check if we're at the top of scrollable content
    this.isAtTopStart = this.isAtTop();

    // ONLY allow pull-to-refresh if scrollable content is at its top
    if (!this.isAtTopStart || this.startScrollTop > 5) {
      this.isDragging = false;
      return;
    }

    this.startY = e.touches[0].clientY;
    this.isDragging = true;
    this.pullDistance = 0;
  }

  handleTouchMove(e) {
    if (!this.isDragging || !this.options.enabled || this.isRefreshing) return;

    // Get current scroll position
    let currentScrollTop = 0;
    if (this.scrollableElement === document.documentElement) {
      currentScrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
    } else {
      currentScrollTop = this.scrollableElement
        ? this.scrollableElement.scrollTop
        : 0;
    }

    // If user has scrolled down even a little, cancel pull-to-refresh
    if (currentScrollTop > 5) {
      this._resetPullUI();
      this.isDragging = false;
      this.pullDistance = 0;
      return;
    }

    this.currentY = e.touches[0].clientY;
    let deltaY = this.currentY - this.startY;

    // Only allow pull-down when at top and starting to pull down
    if (deltaY > 0 && this.isAtTopStart && currentScrollTop <= 5) {
      // Prevent default scrolling while pulling
      e.preventDefault();

      // Calculate pull distance with resistance (increases as you pull more)
      let resistance = 1;
      if (deltaY > 40) {
        resistance = Math.max(0.2, 1 - (deltaY - 40) / 200);
      }
      this.pullDistance = Math.min(deltaY * resistance, this.options.maxPull);

      // Update UI based on pull distance
      this._updatePullUI(this.pullDistance);
    }
  }

  handleTouchEnd() {
    if (!this.isDragging) {
      this.isDragging = false;
      this.pullDistance = 0;
      return;
    }

    this.isDragging = false;

    if (
      this.pullDistance >= this.options.threshold &&
      !this.isRefreshing &&
      this.isAtTopStart
    ) {
      this.triggerRefresh();
    } else {
      this._resetPullUI();
    }

    this.pullDistance = 0;
    this.isAtTopStart = false;
  }

  handleMouseDown(e) {
    if (!this.options.enabled || this.isRefreshing) return;

    if (this.scrollableElement === document.documentElement) {
      this.startScrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
    } else {
      this.startScrollTop = this.scrollableElement
        ? this.scrollableElement.scrollTop
        : 0;
    }

    this.isAtTopStart = this.isAtTop();

    if (!this.isAtTopStart || this.startScrollTop > 5) {
      this.isDragging = false;
      return;
    }

    this.startY = e.clientY;
    this.isDragging = true;
    this.pullDistance = 0;
  }

  handleMouseMove(e) {
    if (!this.isDragging || !this.options.enabled || this.isRefreshing) return;

    let currentScrollTop = 0;
    if (this.scrollableElement === document.documentElement) {
      currentScrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
    } else {
      currentScrollTop = this.scrollableElement
        ? this.scrollableElement.scrollTop
        : 0;
    }

    if (currentScrollTop > 5) {
      this._resetPullUI();
      this.isDragging = false;
      this.pullDistance = 0;
      return;
    }

    let deltaY = e.clientY - this.startY;

    if (deltaY > 0 && this.isAtTopStart && currentScrollTop <= 5) {
      let resistance = 1;
      if (deltaY > 40) {
        resistance = Math.max(0.2, 1 - (deltaY - 40) / 200);
      }
      this.pullDistance = Math.min(deltaY * resistance, this.options.maxPull);
      this._updatePullUI(this.pullDistance);
    }
  }

  handleMouseUp() {
    if (!this.isDragging) {
      this.isDragging = false;
      this.pullDistance = 0;
      return;
    }

    this.isDragging = false;

    if (
      this.pullDistance >= this.options.threshold &&
      !this.isRefreshing &&
      this.isAtTopStart
    ) {
      this.triggerRefresh();
    } else {
      this._resetPullUI();
    }

    this.pullDistance = 0;
    this.isAtTopStart = false;
  }

  _updatePullUI(pullDistance) {
    if (!this.refreshElement) return;

    const percentage = Math.min(pullDistance / this.options.threshold, 1);
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

  _resetPullUI() {
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

    if (this.loadingOverlay) {
      this.loadingOverlay.classList.add("show");
    }

    let timeoutId = null;
    let isCompleted = false;

    const refreshPromise = (async () => {
      try {
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

    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        if (!isCompleted) {
          resolve({ success: false, error: new Error("timeout") });
        }
      }, this.options.refreshTimeout);
    });

    const result = await Promise.race([refreshPromise, timeoutPromise]);

    if (timeoutId) clearTimeout(timeoutId);

    if (result.success !== undefined) {
      if (result.success) {
        this._hideRefreshUI(true);
        this._showToast("Updated successfully", "success");
      } else {
        if (result.error && result.error.message === "timeout") {
          console.log("Refresh taking longer than expected, waiting...");
          const finalResult = await refreshPromise;
          if (finalResult.success) {
            this._hideRefreshUI(true);
            this._showToast("Updated successfully", "success");
          } else {
            this._hideRefreshUI(false);
            this._showToast("Refresh failed. Try again.", "error");
          }
        } else {
          this._hideRefreshUI(false);
          this._showToast("Refresh failed. Try again.", "error");
        }
      }
    }
  }

  _hideRefreshUI(success) {
    this.isRefreshing = false;
    this.hasStartedRefreshing = false;

    if (this.loadingOverlay) {
      this.loadingOverlay.classList.remove("show");
    }

    if (this.refreshElement) {
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

      setTimeout(() => {
        if (this.refreshElement) {
          this._resetPullUI();
        }
      }, 100);
    }
  }

  _showToast(message, type = "success") {
    if (!this.toast) return;

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

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

    this.toastTimeout = setTimeout(() => {
      if (this.toast) {
        this.toast.classList.remove("show");
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
    this._resetPullUI();
  }

  async manualRefresh() {
    if (this.isRefreshing) return;
    await this.triggerRefresh();
  }

  destroy() {
    this.disable();

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

if (typeof module !== "undefined" && module.exports) {
  module.exports = PullToRefresh;
}

window.PullToRefresh = PullToRefresh;
