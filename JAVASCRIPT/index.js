// index.js - Handles the landing/dashboard page with login requirements

// Check if user is logged in (check if token exists without redeclaring)
const storedToken = localStorage.getItem("token");
let currentUserData = null;

// DOM Elements
const sidebarUserEl = document.getElementById("sidebarUser");
const sidebarGuestEl = document.getElementById("sidebarGuest");
const authButtonsEl = document.getElementById("authButtons");
const userMenuEl = document.getElementById("userMenu");
const notificationsEl = document.getElementById("notifications");
const logoutBtnEl = document.getElementById("logoutBtn");
const loginNavBtnEl = document.getElementById("loginNavBtn");
const registerNavBtnEl = document.getElementById("registerNavBtn");
const welcomeNameEl = document.getElementById("welcomeName");

// Update UI based on login status
async function updateUIBasedOnLoginStatus() {
  if (storedToken) {
    try {
      const response = await fetch(
        "https://bank-backend-blush.vercel.app/api/user/profile",
        {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        },
      );

      if (response.ok) {
        currentUserData = await response.json();

        // Show logged-in UI
        if (sidebarUserEl) sidebarUserEl.style.display = "flex";
        if (sidebarGuestEl) sidebarGuestEl.style.display = "none";
        if (authButtonsEl) authButtonsEl.style.display = "none";
        if (userMenuEl) userMenuEl.style.display = "flex";
        if (notificationsEl) notificationsEl.style.display = "block";
        if (logoutBtnEl) logoutBtnEl.style.display = "flex";
        if (loginNavBtnEl) loginNavBtnEl.style.display = "none";
        if (registerNavBtnEl) registerNavBtnEl.style.display = "none";

        // Update user info
        if (welcomeNameEl)
          welcomeNameEl.textContent = `, ${currentUserData.first_name || ""}`;
        const userNameEl = document.getElementById("userName");
        const userEmailEl = document.getElementById("userEmail");
        const userInitialsEl = document.getElementById("userInitials");

        if (userNameEl)
          userNameEl.textContent = `${currentUserData.first_name || ""} ${currentUserData.last_name || ""}`;
        if (userEmailEl) userEmailEl.textContent = currentUserData.email || "";

        const initials =
          (currentUserData.first_name?.[0] || "") +
          (currentUserData.last_name?.[0] || "");
        if (userInitialsEl) userInitialsEl.textContent = initials || "U";

        return true;
      } else {
        // Token invalid
        localStorage.removeItem("token");
        showLoggedOutUIState();
        return false;
      }
    } catch (error) {
      console.error("Error checking login status:", error);
      showLoggedOutUIState();
      return false;
    }
  } else {
    showLoggedOutUIState();
    return false;
  }
}

function showLoggedOutUIState() {
  if (sidebarUserEl) sidebarUserEl.style.display = "none";
  if (sidebarGuestEl) sidebarGuestEl.style.display = "flex";
  if (authButtonsEl) authButtonsEl.style.display = "flex";
  if (userMenuEl) userMenuEl.style.display = "none";
  if (notificationsEl) notificationsEl.style.display = "none";
  if (logoutBtnEl) logoutBtnEl.style.display = "none";
  if (loginNavBtnEl) loginNavBtnEl.style.display = "flex";
  if (registerNavBtnEl) registerNavBtnEl.style.display = "flex";
  if (welcomeNameEl) welcomeNameEl.textContent = "";
}

// Show login required modal
function showLoginRequiredModalFunc() {
  const modal = document.getElementById("loginRequiredOverlay");
  if (modal) modal.style.display = "flex";
}

function closeLoginRequiredModalFunc() {
  const modal = document.getElementById("loginRequiredOverlay");
  if (modal) modal.style.display = "none";
}

// Require login before performing actions
function requireLoginFunc() {
  const tokenCheck = localStorage.getItem("token");
  if (!tokenCheck) {
    showLoginRequiredModalFunc();
    return false;
  }
  return true;
}

// Require login and redirect to specific page
function requireLoginAndRedirectFunc(page) {
  const tokenCheck = localStorage.getItem("token");
  if (!tokenCheck) {
    localStorage.setItem("redirectAfterLogin", page);
    showLoginRequiredModalFunc();
    return false;
  }
  window.location.href = "dashboard.html";
  return true;
}

// Require login and redirect to dashboard for receive
function requireLoginAndRedirectRecieveFunc() {
  const tokenCheck = localStorage.getItem("token");
  if (!tokenCheck) {
    showLoginRequiredModalFunc();
    return false;
  }
  window.location.href = "dashboard.html";
  return true;
}

// Require login and show savings modal
function requireLoginAndShowSavingsFunc(type) {
  const tokenCheck = localStorage.getItem("token");
  if (!tokenCheck) {
    showLoginRequiredModalFunc();
    return false;
  }
  window.location.href = "dashboard.html";
  return true;
}

// Require login and show payment modal
function requireLoginAndShowPaymentFunc(service) {
  const tokenCheck = localStorage.getItem("token");
  if (!tokenCheck) {
    showLoginRequiredModalFunc();
    return false;
  }
  window.location.href = "dashboard.html";
  return true;
}

// Switch page function
function switchToPageFunc(page) {
  document
    .querySelectorAll(".nav-item")
    .forEach((nav) => nav.classList.remove("active"));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add("active");

  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add("active");

  // Update bottom nav
  document.querySelectorAll(".bottom-nav-item").forEach((item) => {
    if (item.dataset.page === page) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Close mobile sidebar
  const sidebar = document.getElementById("sidebar");
  if (sidebar && window.innerWidth <= 1024) {
    sidebar.classList.remove("show");
  }
}

// Initialize event listeners
function initializeIndexEventListenersFunc() {
  // Sidebar navigation
  document.querySelectorAll(".sidebar-nav .nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      if (page) switchToPageFunc(page);
    });
  });

  // Bottom navigation
  document.querySelectorAll(".bottom-nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      const page = item.dataset.page;
      if (page) switchToPageFunc(page);
    });
  });

  // Sidebar toggle
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
  }

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("show");
    });
  }

  // More services button
  const moreServicesBtn = document.getElementById("moreServicesBtn");
  if (moreServicesBtn) {
    moreServicesBtn.addEventListener("click", () => {
      const modal = document.getElementById("moreServicesModal");
      if (modal) modal.classList.add("show");
      loadServicesContentFunc("ecommerce");
    });
  }

  // Services tabs
  document.querySelectorAll(".services-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".services-tab-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadServicesContentFunc(btn.dataset.category);
    });
  });

  // Close modals
  document.querySelectorAll(".close-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal");
      if (modal) modal.classList.remove("show");
    });
  });

  // Logout
  const logoutHandler = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("impersonating");
    localStorage.removeItem("remember");
    window.location.href = "index.html";
  };

  if (logoutBtnEl) logoutBtnEl.addEventListener("click", logoutHandler);
  if (document.getElementById("logoutDropdown")) {
    document
      .getElementById("logoutDropdown")
      .addEventListener("click", logoutHandler);
  }
}

// Load services content
async function loadServicesContentFunc(category) {
  const container = document.getElementById("servicesContent");
  if (!container) return;

  const services = {
    ecommerce: [
      { name: "Oraimo", icon: "fab fa-shopify" },
      { name: "AliExpress", icon: "fab fa-alipay" },
      { name: "Jumia", icon: "fas fa-store" },
      { name: "Konga", icon: "fas fa-shopping-bag" },
      { name: "Netflix", icon: "fab fa-netflix" },
      { name: "Spotify", icon: "fab fa-spotify" },
    ],
    bills: [
      { name: "Airtime", icon: "fas fa-signal" },
      { name: "Data", icon: "fas fa-wifi" },
      { name: "Electricity", icon: "fas fa-bolt" },
      { name: "TV Subscription", icon: "fas fa-tv" },
      { name: "Internet", icon: "fas fa-globe" },
      { name: "Water Bill", icon: "fas fa-tint" },
    ],
    finance: [
      { name: "Harvest Plan", icon: "fas fa-seedling" },
      { name: "Fixed Savings", icon: "fas fa-lock" },
      { name: "SaveBox", icon: "fas fa-box" },
      { name: "Target Savings", icon: "fas fa-bullseye" },
    ],
    others: [
      { name: "SMS Alert", icon: "fas fa-sms" },
      { name: "Email Alert", icon: "fas fa-envelope" },
      { name: "Account Statement", icon: "fas fa-file-alt" },
      { name: "Card Request", icon: "fas fa-credit-card" },
    ],
  };

  const serviceList = services[category] || [];

  container.innerHTML = `
        <div class="services-grid">
            ${serviceList
              .map(
                (service) => `
                <div class="service-item require-login" onclick="window.requireLoginAndRedirectFunc('dashboard')">
                    <div class="service-icon"><i class="${service.icon}"></i></div>
                    <span class="service-name">${service.name}</span>
                </div>
            `,
              )
              .join("")}
        </div>
    `;
}

// Update date and time
function updateDateTimeFunc() {
  const dateElement = document.getElementById("currentDate");
  if (dateElement) {
    const now = new Date();
    dateElement.textContent = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
  await updateUIBasedOnLoginStatus();
  initializeIndexEventListenersFunc();
  updateDateTimeFunc();

  // Check for redirect after login
  const redirectAfterLogin = localStorage.getItem("redirectAfterLogin");
  if (redirectAfterLogin) {
    localStorage.removeItem("redirectAfterLogin");
    if (storedToken) {
      window.location.href = "dashboard.html";
    }
  }
});

// Make functions globally available - use window object to avoid conflicts
window.requireLoginFunc = requireLoginFunc;
window.showLoginRequiredModalFunc = showLoginRequiredModalFunc;
window.closeLoginRequiredModalFunc = closeLoginRequiredModalFunc;
window.requireLoginAndRedirectFunc = requireLoginAndRedirectFunc;
window.requireLoginAndRedirectRecieveFunc = requireLoginAndRedirectRecieveFunc;
window.requireLoginAndShowSavingsFunc = requireLoginAndShowSavingsFunc;
window.requireLoginAndShowPaymentFunc = requireLoginAndShowPaymentFunc;
window.switchToPageFunc = switchToPageFunc;
