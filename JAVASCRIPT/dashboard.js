// dashboard.js - Handles user dashboard functionality

// API Base URL
const API_BASE_URL = "https://bank-backend-blush.vercel.app/api";

// ==================== PROFESSIONAL LOADING MANAGER ====================
class LoadingManager {
  constructor() {
    this.overlay = document.getElementById("globalLoadingOverlay");
    this.lockScreen = document.getElementById("lockScreenOverlay");
    this.messageElement = document.getElementById("loadingMessage");
    this.activeRequests = 0;
    this.timeoutId = null;
    this.isHiding = false;
  }

  show(
    message = "Please wait while we complete your request",
    type = "default",
  ) {
    this.activeRequests++;
    this.isHiding = false;

    if (this.overlay) {
      this.overlay.classList.remove("success", "error");
      if (type === "success") this.overlay.classList.add("success");
      if (type === "error") this.overlay.classList.add("error");

      if (this.messageElement) {
        this.messageElement.textContent = message;
      }

      this.overlay.style.display = "flex";
    }

    if (this.lockScreen) {
      this.lockScreen.style.display = "block";
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.timeoutId = setTimeout(() => {
      if (this.activeRequests > 0 && !this.isHiding) {
        console.warn("Loading auto-closed due to timeout");
        this.forceHide();
      }
    }, 60000);
  }

  forceHide() {
    this.activeRequests = 0;
    this.isHiding = true;

    if (this.overlay) {
      this.overlay.style.display = "none";
      this.overlay.classList.remove("success", "error");
    }

    if (this.lockScreen) {
      this.lockScreen.style.display = "none";
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    setTimeout(() => {
      this.isHiding = false;
    }, 100);
  }

  showSuccess(message = "Completed successfully!") {
    if (this.overlay) {
      this.overlay.classList.remove("error");
      this.overlay.classList.add("success");
      if (this.messageElement) {
        this.messageElement.textContent = message;
      }
    }
  }

  showError(message = "Something went wrong") {
    if (this.overlay) {
      this.overlay.classList.remove("success");
      this.overlay.classList.add("error");
      if (this.messageElement) {
        this.messageElement.textContent = message;
      }
    }
  }

  hide() {
    if (this.isHiding) return;

    this.activeRequests = Math.max(0, this.activeRequests - 1);

    if (this.activeRequests === 0) {
      this.isHiding = true;

      if (this.overlay) {
        this.overlay.style.display = "none";
        setTimeout(() => {
          if (this.overlay) {
            this.overlay.classList.remove("success", "error");
          }
        }, 100);
      }

      if (this.lockScreen) {
        this.lockScreen.style.display = "none";
      }

      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      setTimeout(() => {
        this.isHiding = false;
      }, 100);
    }
  }

  reset() {
    this.activeRequests = 0;
    this.hide();
  }

  isActive() {
    return this.activeRequests > 0;
  }
}

// Create global instance
const loadingManager = new LoadingManager();

// Wrapper function for async operations with automatic loading
async function withLoading(operation, options = {}) {
  const {
    loadingMessage = "Processing your request...",
    successMessage = null,
    errorMessage = "Operation failed",
    showSuccessOnComplete = false,
    successDelay = 800,
    errorDelay = 1200,
  } = options;

  // Show loading
  loadingManager.show(loadingMessage);

  try {
    const result = await operation();

    if (showSuccessOnComplete && successMessage) {
      loadingManager.showSuccess(successMessage, successDelay);
    } else {
      loadingManager.hide();
    }

    return result;
  } catch (error) {
    console.error("Operation failed:", error);
    loadingManager.showError(errorMessage || error.message, errorDelay);
    throw error;
  }
}


// Wrap fetch requests with loading
async function fetchWithLoading(url, options = {}, loadingOptions = {}) {
  return withLoading(async () => {
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(
        error.error || `Request failed with status ${response.status}`,
      );
    }
    return response.json();
  }, loadingOptions);
}

// State management
let currentUser = null;
let accounts = [];
let transactions = [];
let cards = [];
let notifications = [];
let currentPage = "overview";
let charts = {};
let currentTransPage = 1;
let currentTransFilters = { search: "", type: "", status: "" };
let savedCards = [];

// Check authentication
const token = localStorage.getItem("token");
if (!token) {
  window.location.href = "login.html";
}

// Initialize dashboard
document.addEventListener("DOMContentLoaded", async () => {
  await loadUserData();
  debounce();
  await loadExistingSavingsPlans();
  lazyLoadSpendingChart();
  //loadSpendingByCategory();
  // checkAndShowAppBanner();
  //  setupAppBannerEvents();
  loadFullTransactions(1);
  initializeEventListeners();
  await loadLiveChat();
  initBillsGrid();
  initBottomNav();
  await loadMySavings();
  await loadExternalTransfers(1, "all");
  //startRealTimeUpdates();
  startOptimizedRealTimeUpdates();
  initLogoutSettings();
  updateDateTime();
  // Initialize push notifications
  await pushManager.init();

  // Start notification polling
  startNotificationPolling();

  // Setup mark all read button
  const markAllReadBtn = document.getElementById("markAllRead");
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener("click", markAllNotificationsRead);
  }
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  stopNotificationPolling();
});

// Make "View All" open full history
document.querySelectorAll(".view-all").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const transactionsNav = document.querySelector(
      '.nav-item[data-page="transactions"]',
    );
    if (transactionsNav) transactionsNav.click();
  });
});

// Debounce helper (prevents calling API on every keystroke)
function debounce(fn, delay = 600) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// Notification helper (copied/adapted from main.js)
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
        <i class="fas fa-${
          type === "success"
            ? "check-circle"
            : type === "error"
              ? "exclamation-circle"
              : "info-circle"
        }"></i>
        <span>${message}</span>
    `;

  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${
          type === "success"
            ? "#10b981"
            : type === "error"
              ? "#ef4444"
              : "#3b82f6"
        };
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
    `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add the missing keyframes if they're not already in your CSS
if (!document.getElementById("notification-animations")) {
  const style = document.createElement("style");
  style.id = "notification-animations";
  style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0);    opacity: 1; }
            to   { transform: translateX(100%); opacity: 0; }
        }
    `;
  document.head.appendChild(style);
}

// Load user data
async function loadUserData() {
  try {
    // Load user profile
    const profileResponse = await fetch(`${API_BASE_URL}/user/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!profileResponse.ok) {
      throw new Error("Failed to load profile");
    }

    currentUser = await profileResponse.json();
    //console.log('Loaded user data:', currentUser);
    console.log("Face image exists:", currentUser.face_image ? "Yes" : "No");

    // Also check localStorage for backup
    const storedFaceImage = localStorage.getItem("userFaceImage");
    if (storedFaceImage && !currentUser.face_image) {
      console.log("Using stored face image from localStorage");
      currentUser.face_image = storedFaceImage;
    }

    updateUserInterface();

    // Check if account is frozen
    if (currentUser.is_frozen) {
      showFreezeNotification(
        currentUser.freeze_reason,
        currentUser.unfreeze_method,
        currentUser.unfreeze_payment_details,
      );
    }

    // Load accounts
    await loadAccounts();

    // Load transactions
    await loadTransactions();

    await loadExternalTransfers(1, "all");

    // Load cards
    await loadCards();

    // Load notifications
    await loadNotifications();

    // Initialize charts
    await loadSpendingByCategory();
  } catch (error) {
    console.error("Error loading user data:", error);
    showNotification("Failed to load user data", "error");

    // Check if token expired
    if (error.message.includes("401")) {
      localStorage.removeItem("token");
      window.location.href = "login.html";
    }
  }
}

// Update user interface with profile data - Enhanced for face images
function updateUserInterface() {
  if (!currentUser) return;

  console.log(
    "Updating UI with user:",
    currentUser.first_name,
    currentUser.last_name,
  );
  console.log("Face image available:", currentUser.face_image ? "Yes" : "No");

  // Update user info text
  document.getElementById("userName").textContent =
    `${currentUser.first_name} ${currentUser.last_name}`;
  document.getElementById("userEmail").textContent = currentUser.email;
  document.getElementById("welcomeName").textContent = currentUser.first_name;

  // Update avatar - prioritize face image
  const userAvatar = document.getElementById("userAvatar");
  const userAvatarSpan = document.getElementById("userInitials");
  const userMenuAvatar = document.getElementById("userMenuAvatar");

  const initials = currentUser.first_name[0] + currentUser.last_name[0];

  // Check for face image in currentUser
  if (
    currentUser.face_image &&
    currentUser.face_image.startsWith("data:image")
  ) {
    console.log("Setting face image in avatar");

    // Update the user avatar div
    if (userAvatar) {
      userAvatar.style.backgroundImage = `url(${currentUser.face_image})`;
      userAvatar.style.backgroundSize = "cover";
      userAvatar.style.backgroundPosition = "center";
      userAvatar.style.backgroundColor = "transparent";
      if (userAvatarSpan) {
        userAvatarSpan.style.display = "none";
      }
    }

    // Update the user menu avatar image
    if (userMenuAvatar) {
      userMenuAvatar.src = currentUser.face_image;
      userMenuAvatar.style.objectFit = "cover";
      userMenuAvatar.style.display = "block";
    }
  } else {
    console.log("Using fallback initials avatar");

    // Use initials as fallback
    if (userAvatar) {
      userAvatar.style.backgroundImage = "none";
      userAvatar.style.backgroundColor = "var(--primary-color)";
      if (userAvatarSpan) {
        userAvatarSpan.textContent = initials;
        userAvatarSpan.style.display = "flex";
      }
    }

    if (userMenuAvatar) {
      userMenuAvatar.src = `https://ui-avatars.com/api/?name=${initials}&background=2563eb&color=fff`;
    }
  }
}

// Add this function to test face image display
function testFaceImageDisplay() {
  const testImage =
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=";
  const userAvatar = document.getElementById("userAvatar");
  if (userAvatar) {
    userAvatar.style.backgroundImage = `url(${testImage})`;
    userAvatar.style.backgroundSize = "cover";
    console.log("Test image applied");
  }
}

// Load accounts
async function loadAccounts() {
  try {
    const response = await fetch(`${API_BASE_URL}/user/accounts`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      accounts = await response.json();
      updateAccountsDisplay();
      updateTotalBalance();
    }
  } catch (error) {
    console.error("Error loading accounts:", error);
  }
}

// Update accounts display
function updateAccountsDisplay() {
  const accountsList = document.getElementById("accountsList");
  if (!accountsList) return;

  if (!accounts || accounts.length === 0) {
    accountsList.innerHTML =
      '<div class="empty-state" style="text-align: center; padding: 40px;">No accounts found</div>';
    return;
  }

  accountsList.innerHTML = accounts
    .map((account) => {
      const balance = account.balance || 0;
      const availableBalance = account.available_balance || 0;
      const accountType = account.account_type
        ? account.account_type.charAt(0).toUpperCase() +
          account.account_type.slice(1)
        : "Account";
      const accountNumber = account.account_number || "N/A";
      const progressPercent =
        balance > 0 ? (availableBalance / balance) * 100 : 0;

      return `
                <div class="balance-card">
                    <div class="balance-label">
                        <span>${accountType} Account</span>
                        <span>${accountNumber}</span>
                    </div>
                    <div class="balance-amount">${formatMoney(balance)}</div>
                    <div class="balance-change positive">
                        <i class="fas fa-arrow-up"></i>
                        <span>Available: ${formatMoney(availableBalance)}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress" style="width: ${progressPercent}%"></div>
                    </div>
                </div>
            `;
    })
    .join("");

  showPrimaryAccountNumber();

  // Update account select in transfer form
  const fromAccountSelect = document.getElementById("fromAccount");
  if (fromAccountSelect) {
    fromAccountSelect.innerHTML = `
            <option value="">Select account</option>
            ${accounts
              .map((account) => {
                const availableBalance = account.available_balance || 0;
                const accountType = account.account_type || "Account";
                const accountNumber = account.account_number || "N/A";
                return `
                        <option value="${account.id}">${accountType} (${accountNumber}) - ₦${availableBalance.toFixed(2)}</option>
                    `;
              })
              .join("")}
        `;
  }
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Update total balance display (no conversion needed)
function updateTotalBalance() {
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalBalanceElement = document.getElementById("totalBalance");
  if (totalBalanceElement) {
    totalBalanceElement.textContent = formatMoney(totalBalance);
  }
}

// Load transactions
async function loadTransactions(page = 1) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/user/transactions?page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      transactions = data.transactions;
      updateTransactionsDisplay();
    }
  } catch (error) {
    console.error("Error loading transactions:", error);
  }
}

// Show primary account number under Total Balance
function showPrimaryAccountNumber() {
  if (!accounts || accounts.length === 0) return;

  // Prefer checking account, fallback to first account
  const primaryAccount =
    accounts.find((acc) => acc.account_type === "checking") || accounts[0];

  const el = document.getElementById("primaryAccountNumber");
  if (el) {
    el.innerHTML = `
      Primary Account: 
      <strong style="color:#1e2937">${primaryAccount.account_number}</strong>
    `;
  }
}

// Update transactions display for recent transactions (overview page)
function updateTransactionsDisplay() {
  const recentTransactions = document.getElementById("recentTransactions");
  if (!recentTransactions) return;

  if (!transactions || transactions.length === 0) {
    recentTransactions.innerHTML =
      '<div class="empty-state" style="text-align: center; padding: 40px;">No recent transactions</div>';
    return;
  }

  recentTransactions.innerHTML = transactions
    .slice(0, 5)
    .map((t) => {
      const isCredit = t.to_user_id === currentUser?.id;
      const isTransfer = t.transaction_type === "transfer";
      const transactionId = t.id || t.transaction_id;

      // Determine icon and display text
      let icon = "exchange-alt";
      let displayName = "";
      let displayDetail = "";

      if (isTransfer) {
        if (isCredit) {
          // Received money
          const senderName = t.from_user?.first_name
            ? `${t.from_user.first_name} ${t.from_user.last_name || ""}`.trim()
            : "Transfer";
          icon = "arrow-down";
          displayName = `Received from ${senderName}`;
          displayDetail = t.from_account?.account_number || "";
        } else {
          // Sent money
          const receiverName = t.to_user?.first_name
            ? `${t.to_user.first_name} ${t.to_user.last_name || ""}`.trim()
            : "Transfer";
          icon = "arrow-up";
          displayName = `Sent to ${receiverName}`;
          displayDetail = t.to_account?.account_number || "";
        }
      } else if (t.transaction_type === "bill_payment") {
        icon = "file-invoice";
        displayName = t.description || "Bill Payment";
        displayDetail = "";
      } else if (t.transaction_type === "savings") {
        icon = "piggy-bank";
        displayName = "Savings Deposit";
        displayDetail = t.description || "";
      } else if (t.transaction_type === "savings_withdrawal") {
        icon = "money-bill-wave";
        displayName = "Savings Withdrawal";
        displayDetail = t.description || "";
      } else if (t.transaction_type === "deposit") {
        icon = "plus-circle";
        displayName = "Deposit";
        displayDetail = t.description || "";
      } else {
        icon = "exchange-alt";
        displayName = t.description || t.transaction_type || "Transaction";
        displayDetail = "";
      }

      return `
                <div class="transaction-item" data-transaction-id="${transactionId}" onclick="viewTransactionReceiptFromHistory('${transactionId}')" style="cursor: pointer;">
                    <div class="transaction-icon">
                        <i class="fas fa-${icon}"></i>
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-name">${escapeHtml(displayName)}</div>
                        ${displayDetail ? `<div class="transaction-date" style="font-size: 10px; font-family: monospace;">${escapeHtml(displayDetail)}</div>` : ""}
                        <div class="transaction-date">${new Date(t.created_at).toLocaleDateString()}</div>
                    </div>
                    <div class="transaction-amount ${isCredit ? "positive" : "negative"}">
                        ${isCredit ? "+" : "-"}${formatMoney(Math.abs(t.amount))}
                    </div>
                </div>
            `;
    })
    .join("");
}

// View transaction receipt from history (when user clicks any transaction)
async function viewTransactionReceiptFromHistory(transactionId) {
  if (!transactionId) {
    showNotification("Invalid transaction", "error");
    return;
  }

  // Show loading while fetching receipt
  loadingManager.show("Loading transaction details...");

  try {
    const response = await fetch(
      `${API_BASE_URL}/user/transactions/${transactionId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch transaction details");
    }

    const transaction = await response.json();

    if (
      transaction.status === "completed" ||
      transaction.status === "success"
    ) {
      // Prepare receipt data
      const receiptData = {
        transaction_id: transaction.transaction_id || transaction.id,
        amount: transaction.amount,
        fee_amount: transaction.fee_amount || 0,
        status: transaction.status || "completed",
        completed_at: transaction.completed_at || transaction.created_at,
        created_at: transaction.created_at,
        description: transaction.description || transaction.transaction_type,
        transaction_type: transaction.transaction_type,
      };

      // Get sender info
      if (transaction.from_user_id === currentUser?.id) {
        receiptData.from_name =
          `${currentUser?.first_name || ""} ${currentUser?.last_name || ""}`.trim() ||
          "You";
        receiptData.from_account =
          transaction.from_account?.account_number || "••••";
        receiptData.to_name = transaction.to_user?.first_name
          ? `${transaction.to_user.first_name} ${transaction.to_user.last_name || ""}`.trim()
          : "Recipient";
        receiptData.to_account =
          transaction.to_account?.account_number || "••••";
      } else {
        receiptData.from_name = transaction.from_user?.first_name
          ? `${transaction.from_user.first_name} ${transaction.from_user.last_name || ""}`.trim()
          : "Sender";
        receiptData.from_account =
          transaction.from_account?.account_number || "••••";
        receiptData.to_name =
          `${currentUser?.first_name || ""} ${currentUser?.last_name || ""}`.trim() ||
          "You";
        receiptData.to_account =
          transaction.to_account?.account_number || "••••";
      }

      // IMPORTANT: Hide loading overlay FIRST
      loadingManager.hide();

      // Then show receipt modal immediately
      showTransactionReceipt(receiptData);
    } else if (transaction.status === "pending") {
      // Hide loading and show pending notification
      loadingManager.hide();
      showNotification("This transaction is still pending", "warning");
    } else {
      // Hide loading and show failed modal
      loadingManager.hide();
      showTransactionFailedModal(
        "Transaction Failed",
        "This transaction was not completed successfully.",
      );
    }
  } catch (error) {
    console.error("Error viewing receipt:", error);
    // Hide loading on error
    loadingManager.hide();
    showNotification("Could not load transaction details", "error");
  }
}

// Make function globally available
window.viewTransactionReceiptFromHistory = viewTransactionReceiptFromHistory;

// ==================== FULL TRANSACTION HISTORY ====================
async function loadFullTransactions(page = 1) {
  currentTransPage = page;

  try {
    let url = `${API_BASE_URL}/user/transactions?page=${page}&limit=20`;
    if (currentTransFilters.search)
      url += `&search=${encodeURIComponent(currentTransFilters.search)}`;
    if (currentTransFilters.type) url += `&type=${currentTransFilters.type}`;
    if (currentTransFilters.status)
      url += `&status=${currentTransFilters.status}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error();

    const data = await res.json();

    renderFullTransactionsTable(data.transactions || data);
    updatePagination(
      "transactionsPagination",
      data.pagination || { page: 1, pages: 1 },
      loadFullTransactions,
    );
  } catch (err) {
    console.error(err);
    showNotification("Could not load transaction history", "error");
  }
}

// Render full transactions table with better transfer details
function renderFullTransactionsTable(transactions) {
  const tbody = document.getElementById("fullTransactionsBody");
  if (!tbody) return;

  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <i class="fas fa-exchange-alt" style="font-size: 48px; color: #94a3b8;"></i>
                    <p style="margin-top: 10px;">No transactions found</p>
                </td>
            </table>
        `;
    return;
  }

  tbody.innerHTML = transactions
    .map((t) => {
      const isIncoming = t.to_user_id === currentUser?.id;
      const amountClass = isIncoming ? "positive" : "negative";
      const sign = isIncoming ? "+" : "-";

      // Store transaction data safely
      const transactionId = t.id || t.transaction_id;

      // Format description with receiver/sender info for transfers
      let formattedDescription =
        t.description || t.transaction_type || "Transaction";
      let secondaryInfo = "";

      if (t.transaction_type === "transfer") {
        if (isIncoming) {
          // Money received - show sender name
          const senderName = t.from_user?.first_name
            ? `${t.from_user.first_name} ${t.from_user.last_name || ""}`.trim()
            : t.from_account?.account_number || "Unknown Sender";
          formattedDescription = `Received from ${senderName}`;
          secondaryInfo = t.from_account?.account_number
            ? `<small style="color: #64748b; font-size: 10px;">From: ${t.from_account.account_number}</small>`
            : "";
        } else {
          // Money sent - show receiver name
          const receiverName = t.to_user?.first_name
            ? `${t.to_user.first_name} ${t.to_user.last_name || ""}`.trim()
            : t.to_account?.account_number || "Unknown Recipient";
          formattedDescription = `Sent to ${receiverName}`;
          secondaryInfo = t.to_account?.account_number
            ? `<small style="color: #64748b; font-size: 10px;">To: ${t.to_account.account_number}</small>`
            : "";
        }
      } else if (t.transaction_type === "savings") {
        formattedDescription = `💰 ${t.description || "Savings Deposit"}`;
      } else if (t.transaction_type === "savings_withdrawal") {
        formattedDescription = `🏦 ${t.description || "Savings Withdrawal"}`;
      } else if (t.transaction_type === "bill_payment") {
        formattedDescription = `📄 ${t.description || "Bill Payment"}`;
      } else if (t.transaction_type === "deposit") {
        formattedDescription = `💵 ${t.description || "Deposit"}`;
      }

      return `
                <tr class="transaction-row" data-transaction-id="${transactionId}" onclick="viewTransactionReceiptFromHistory('${transactionId}')" style="cursor: pointer;">
                    <td style="white-space: nowrap;">${new Date(
                      t.created_at,
                    ).toLocaleDateString("en-NG", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}</td>
                    <td>
                        <div style="font-weight: 500;">${escapeHtml(formattedDescription)}</div>
                        ${secondaryInfo}
                        ${t.description && t.transaction_type !== "transfer" ? `<div style="font-size: 11px; color: #64748b;">${escapeHtml(t.description)}</div>` : ""}
                    </td>
                    <td><span class="transaction-badge ${t.transaction_type}">${(t.transaction_type || "OTHER").toUpperCase().replace("_", " ")}</span></td>
                    <td class="${amountClass}" style="font-weight: 600;">${sign}${formatMoney(Math.abs(t.amount))}</td>
                    <td style="font-family: monospace; font-size: 12px;">${t.account_number || "—"}</td>
                    <td><span class="status-badge ${t.status || "completed"}">${(t.status || "completed").toUpperCase()}</span></td>
                </tr>
            `;
    })
    .join("");
}

// ==================== PAGINATION HELPER ====================
function updatePagination(elementId, pagination, callback) {
  const container = document.getElementById(elementId);
  if (!container) return;

  // Default values if pagination object is missing or incomplete
  const currentPage = pagination?.page || 1;
  const totalPages = pagination?.pages || 1;

  let html = "";

  // Previous button
  html += `
        <button class="page-btn ${currentPage === 1 ? "disabled" : ""}" 
                onclick="${
                  currentPage > 1
                    ? `loadFullTransactions(${currentPage - 1})`
                    : ""
                }">
            ← Prev
        </button>
    `;

  // Page numbers (show max 5 pages around current)
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  for (let i = startPage; i <= endPage; i++) {
    html += `
            <button class="page-btn ${i === currentPage ? "active" : ""}" 
                    onclick="loadFullTransactions(${i})">${i}</button>
        `;
  }

  // Next button
  html += `
        <button class="page-btn ${
          currentPage === totalPages ? "disabled" : ""
        }" 
                onclick="${
                  currentPage < totalPages
                    ? `loadFullTransactions(${currentPage + 1})`
                    : ""
                }">
            Next →
        </button>
    `;

  container.innerHTML = html;
}

// Load cards
async function loadCards() {
  try {
    const response = await fetch(`${API_BASE_URL}/user/cards`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      cards = await response.json();
      updateCardsDisplay();
    }
  } catch (error) {
    console.error("Error loading cards:", error);
  }
}

// ==================== ADD MONEY FUNCTIONS ====================

// Switch to any page
function switchToPage(page) {
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

  document.getElementById("pageTitle").textContent =
    page === "add-money"
      ? "Add Money"
      : page.charAt(0).toUpperCase() + page.slice(1);
}

// Load saved cards
async function loadSavedCards() {
  try {
    const res = await fetch(`${API_BASE_URL}/user/saved-cards`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      savedCards = await res.json();
      renderSavedCards();
    }
  } catch (e) {
    console.error(e);
  }
}

function renderSavedCards() {
  const container = document.getElementById("savedCardsList");
  if (!container) return;

  container.innerHTML = savedCards
    .map(
      (card) => `
        <div class="saved-card-item">
            <div>
                <strong>•••• ${card.card_number.slice(-4)}</strong><br>
                <small>${card.cardholder_name} • ${card.expiry_date}</small>
            </div>
            <span class="badge">${card.card_type || "Card"}</span>
        </div>
    `,
    )
    .join("");
}

// show unfreeze payment modal
function showUnfreezePaymentModal(paymentDetails) {
  console.log("Payment details received:", paymentDetails); // 🔍 Debug

  const modal = document.getElementById("unfreezePaymentModal");
  const content = document.getElementById("unfreezePaymentContent");

  if (!modal || !content) {
    console.error("Modal elements not found");
    return;
  }

  let detailsHtml = `<p>Send exactly <strong>$${paymentDetails.amount}</strong> to the following details:</p>`;

  if (paymentDetails.method === "crypto") {
    // Support both address and crypto_address keys
    const address =
      paymentDetails.address || paymentDetails.crypto_address || "Not provided";
    const network = paymentDetails.network || "Not provided";
    detailsHtml += `
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>Crypto Address:</strong> ${address}</p>
        <p><strong>Network:</strong> ${network}</p>
        <button class="btn btn-sm btn-outline" onclick="copyToClipboard('${address}')">Copy Address</button>
      </div>
    `;
  } else if (paymentDetails.method === "bank") {
    const bankName = paymentDetails.bank_name || "Not provided";
    const accountNumber = paymentDetails.account_number || "Not provided";
    const accountName = paymentDetails.account_name || "Not provided";
    const swift = paymentDetails.swift || "Not provided";
    detailsHtml += `
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>Bank Name:</strong> ${bankName}</p>
        <p><strong>Account Number:</strong> ${accountNumber}</p>
        <p><strong>Account Name:</strong> ${accountName}</p>
        <p><strong>SWIFT/BIC:</strong> ${swift}</p>
      </div>
    `;
  } else {
    detailsHtml += `<p>No payment details available. Please contact support.</p>`;
  }

  detailsHtml += `<p class="note">After making the payment, click the button below. An administrator will review and provide an OTP to unlock your account.</p>`;

  content.innerHTML = detailsHtml;
  modal.classList.add("show");

  // Handle confirm button
  const confirmBtn = document.getElementById("confirmPaymentButton");
  const closeModal = () => modal.classList.remove("show");

  confirmBtn.onclick = async () => {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    try {
      const ticketRes = await fetch(`${API_BASE_URL}/user/tickets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: "Unfreeze Payment Completed",
          message: `I have sent $${paymentDetails.amount} via ${paymentDetails.method} for account unfreeze. Please generate OTP.`,
          priority: "high",
        }),
      });
      if (ticketRes.ok) {
        showNotification(
          "Payment confirmation sent. Admin will contact you soon.",
          "success",
        );
        closeModal();
      } else {
        showNotification(
          "Failed to notify admin. Please contact support.",
          "error",
        );
      }
    } catch (err) {
      console.error("Error sending payment confirmation:", err);
      showNotification("Error. Please try again or contact support.", "error");
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = "I Have Made the Payment";
    }
  };

  // Close modal on cancel/close
  modal.querySelector(".close-modal").onclick = closeModal;
  const cancelBtn = document.getElementById("cancelUnfreezePayment");
  if (cancelBtn) cancelBtn.onclick = closeModal;
}

// Add Money Form Handler - Updated
const addMoneyForm = document.getElementById("addMoneyForm");
if (addMoneyForm) {
  addMoneyForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const cardData = {
      card_number: document
        .getElementById("cardNumber")
        .value.replace(/\s/g, ""),
      expiry_date: document.getElementById("expiryDate").value,
      cvv: document.getElementById("cvv").value,
      cardholder_name: document.getElementById("cardholderName").value,
      amount: parseFloat(document.getElementById("addAmount").value),
      card_pin: document.getElementById("cardPin")?.value || null, // Add PIN field
    };

    const btn = document.getElementById("submitAddMoney");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
      const res = await fetch(`${API_BASE_URL}/user/add-money`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cardData),
      });

      const data = await res.json();

      if (res.ok) {
        showNotification(
          "Add money request updated for approval. This may take up to 1 hour.",
          "success",
        );
        addMoneyForm.reset();
        await loadSavedCards();
        switchToPage("overview");
      } else {
        showNotification(data.error || "Failed to submit request", "error");
      }
    } catch (err) {
      console.error("Add money error:", err);
      showNotification("Connection error", "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = "Submit Add Money Request";
    }
  });
}

// Connect Add Money Button
document.getElementById("addMoneyBtn")?.addEventListener("click", () => {
  switchToPage("add-money");
  loadSavedCards();
});

// Update cards display
function updateCardsDisplay() {
  const cardsList = document.getElementById("cardsList");
  if (!cardsList) return;

  cardsList.innerHTML = cards
    .map(
      (card) => `
        <div class="card-item">
            <div class="card-chip"></div>
            <div class="card-number">•••• •••• •••• ${card.card_number.slice(
              -4,
            )}</div>
            <div class="card-details">
                <div>${card.card_type.toUpperCase()}</div>
                <div>${new Date(card.expiry_date).toLocaleDateString("en-US", {
                  month: "2-digit",
                  year: "2-digit",
                })}</div>
            </div>
            <span class="card-status ${card.card_status}">${
              card.card_status
            }</span>
            <div class="card-actions">
                ${
                  card.card_status === "active"
                    ? `<button onclick="toggleCard('${card.id}', 'freeze')">Freeze</button>`
                    : card.card_status === "frozen"
                      ? `<button onclick="toggleCard('${card.id}', 'unfreeze')">Unfreeze</button>`
                      : ""
                }
                <button onclick="reportCard('${card.id}')">Report</button>
            </div>
        </div>
    `,
    )
    .join("");
}

// Toggle card status
async function toggleCard(cardId, action) {
  const confirmed = await confirmAction({
    title: `${action === "freeze" ? "Freeze" : "Unfreeze"} Card`,
    message: `Are you sure you want to ${action} this card? ${action === "freeze" ? "You can unfreeze it anytime." : "The card will become active again."}`,
    type: "warning",
    confirmText: `Yes, ${action} Card`,
  });

  if (!confirmed) return;

  // Rest of the function remains the same...
  try {
    const response = await fetch(`${API_BASE_URL}/user/toggle-card/${cardId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    });

    if (response.ok) {
      showToast(`Card ${action}d successfully`, "success");
      await loadCards();
    } else {
      const data = await response.json();
      showToast(data.error || `Failed to ${action} card`, "error");
    }
  } catch (error) {
    console.error("Error toggling card:", error);
    showToast("Failed to update card", "error");
  }
}

// Report card
async function reportCard(cardId) {
  const confirmed = await confirmAction({
    title: "Report Lost/Stolen Card",
    message:
      "⚠️ Once reported, this card will be permanently blocked and cannot be reversed. A new card will be issued. Continue?",
    type: "danger",
    confirmText: "Yes, Report Card",
  });

  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE_URL}/user/report-card/${cardId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      showToast(
        "Card reported successfully. Support ticket created.",
        "success",
      );
      await loadCards();
    } else {
      const data = await response.json();
      showToast(data.error || "Failed to report card", "error");
    }
  } catch (error) {
    console.error("Error reporting card:", error);
    showToast("Failed to report card", "error");
  }
}

// ==================== IMPROVED NOTIFICATION DISPLAY ====================

let currentNotificationPage = 1;
let notificationInterval = null;
let notificationPage = 1;
let hasMoreNotifications = true;
let isLoadingNotifications = false;
let notificationObserver = null;

// Update notification badge count (add this function)
function updateNotificationBadge(unreadCount) {
  const badge = document.getElementById("notificationBadge");
  if (badge) {
    badge.textContent = unreadCount || 0;
    badge.style.display = unreadCount > 0 ? "block" : "none";
  }
}

// Improved loadNotifications function with error handling
async function loadNotifications(page = 1, unreadOnly = false) {
  // This replaces the old function - same name, new optimized logic
  if (isLoadingNotifications) return;

  const shouldAppend = page > 1;
  notificationPage = page;

  isLoadingNotifications = true;

  try {
    let url = `${API_BASE_URL}/user/notifications?page=${page}&limit=15`;
    if (unreadOnly) url += "&unread_only=true";

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.error("Failed to load notifications:", response.status);
      return;
    }

    const data = await response.json();
    hasMoreNotifications = data.pagination.page < data.pagination.pages;

    if (!shouldAppend) {
      renderOptimizedNotifications(data.notifications);
    } else {
      appendOptimizedNotifications(data.notifications);
    }

    updateNotificationBadge(data.unread_count);
    setupInfiniteScroll();
  } catch (error) {
    console.error("Error loading notifications:", error);
  } finally {
    isLoadingNotifications = false;
  }
}

// New helper function - doesn't conflict with anything
function renderOptimizedNotifications(notifications) {
  const notificationsList = document.getElementById("notificationsList");
  if (!notificationsList) return;

  if (!notifications || notifications.length === 0) {
    notificationsList.innerHTML = `
      <div class="empty-notifications">
        <i class="fas fa-bell-slash"></i>
        <p>No notifications yet</p>
      </div>
    `;
    return;
  }

  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();

  notifications.forEach((notification) => {
    const item = document.createElement("div");
    item.className = `notification-item ${!notification.is_read ? "unread" : ""}`;
    item.dataset.id = notification.id;
    item.innerHTML = `
      <div class="notification-icon ${notification.type || "info"}">
        <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-header">
          <div class="notification-title">${escapeHtml(notification.title || "Notification")}</div>
          <button class="notification-delete" onclick="event.stopPropagation(); deleteNotification('${notification.id}')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="notification-message">${escapeHtml(notification.message || "")}</div>
        <div class="notification-footer">
          <span class="notification-time">${formatTimeAgo(notification.created_at)}</span>
          ${!notification.is_read ? `<button class="mark-read-btn" onclick="event.stopPropagation(); markNotificationRead('${notification.id}')">Mark as read</button>` : ""}
        </div>
      </div>
    `;
    fragment.appendChild(item);
  });

  notificationsList.innerHTML = "";
  notificationsList.appendChild(fragment);
}

// New helper function for infinite scroll
function appendOptimizedNotifications(newNotifications) {
  const notificationsList = document.getElementById("notificationsList");
  if (!notificationsList) return;

  const fragment = document.createDocumentFragment();

  newNotifications.forEach((notification) => {
    const item = document.createElement("div");
    item.className = `notification-item ${!notification.is_read ? "unread" : ""}`;
    item.dataset.id = notification.id;
    item.innerHTML = `
      <div class="notification-icon ${notification.type || "info"}">
        <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-header">
          <div class="notification-title">${escapeHtml(notification.title || "Notification")}</div>
          <button class="notification-delete" onclick="event.stopPropagation(); deleteNotification('${notification.id}')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="notification-message">${escapeHtml(notification.message || "")}</div>
        <div class="notification-footer">
          <span class="notification-time">${formatTimeAgo(notification.created_at)}</span>
          ${!notification.is_read ? `<button class="mark-read-btn" onclick="event.stopPropagation(); markNotificationRead('${notification.id}')">Mark as read</button>` : ""}
        </div>
      </div>
    `;
    fragment.appendChild(item);
  });

  notificationsList.appendChild(fragment);
}

// New helper for infinite scroll
function setupInfiniteScroll() {
  // Remove existing observer
  if (notificationObserver) {
    notificationObserver.disconnect();
  }

  const dropdown = document.querySelector(".notifications-dropdown");
  if (!dropdown || !hasMoreNotifications) return;

  // Create sentinel element
  let sentinel = document.getElementById("notifications-sentinel");
  if (!sentinel) {
    sentinel = document.createElement("div");
    sentinel.id = "notifications-sentinel";
    sentinel.style.height = "1px";
    sentinel.style.visibility = "hidden";
    dropdown.querySelector(".notifications-list")?.appendChild(sentinel);
  }

  notificationObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (
          entry.isIntersecting &&
          hasMoreNotifications &&
          !isLoadingNotifications
        ) {
          loadNotifications(notificationPage + 1);
        }
      });
    },
    { threshold: 0.1 },
  );

  notificationObserver.observe(sentinel);
}

// Update notification display with graceful fallback
/*function updateNotificationsDisplay(data) {
  const notificationsList = document.getElementById("notificationsList");
  if (!notificationsList) return;

  const notifications = data.notifications || [];

  if (notifications.length === 0) {
    notificationsList.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications yet</p>
            </div>
        `;
    return;
  }

  notificationsList.innerHTML = notifications
    .map(
      (notification) => `
            <div class="notification-item ${!notification.is_read ? "unread" : ""}" data-id="${notification.id}">
                <div class="notification-icon ${notification.type || "info"}">
                    <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-header">
                        <div class="notification-title">${escapeHtml(notification.title || "Notification")}</div>
                        <button class="notification-delete" onclick="deleteNotification('${notification.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="notification-message">${escapeHtml(notification.message || "")}</div>
                    <div class="notification-footer">
                        <span class="notification-time">${formatTimeAgo(notification.created_at)}</span>
                        ${
                          !notification.is_read
                            ? `<button class="mark-read-btn" onclick="markNotificationRead('${notification.id}')">
                                Mark as read
                            </button>`
                            : ""
                        }
                    </div>
                </div>
            </div>
        `,
    )
    .join("");
}*/

function updateNotificationsDisplay(data) {
  // This now just calls the optimized render function
  // Keeping the name so existing code doesn't break
  renderOptimizedNotifications(data.notifications);
  if (data.unread_count !== undefined) {
    updateNotificationBadge(data.unread_count);
  }
}

// Get notification icon based on type
function getNotificationIcon(type) {
  const icons = {
    success: "check-circle",
    error: "exclamation-circle",
    warning: "exclamation-triangle",
    info: "info-circle",
    transfer: "exchange-alt",
    savings: "piggy-bank",
    security: "shield-alt",
    bill: "receipt",
  };
  return icons[type] || "bell";
}

// Format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const past = new Date(date);
  const seconds = Math.floor((now - past) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return past.toLocaleDateString();
}

// Improved mark notification as read with better error handling
async function markNotificationRead(notificationId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/user/notifications/${notificationId}/read`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.ok) {
      // Update UI immediately
      const notificationItem = document.querySelector(
        `.notification-item[data-id="${notificationId}"]`,
      );
      if (notificationItem) {
        notificationItem.classList.remove("unread");
        const markBtn = notificationItem.querySelector(".mark-read-btn");
        if (markBtn) markBtn.remove();

        // Update badge count
        const badge = document.getElementById("notificationBadge");
        const currentCount = parseInt(badge.textContent) || 0;
        const newCount = Math.max(0, currentCount - 1);
        badge.textContent = newCount;
        badge.style.display = newCount > 0 ? "block" : "none";
      }
      console.log("Notification marked as read");
    } else {
      const errorData = await response.json();
      console.error("Failed to mark as read:", errorData);
    }
  } catch (error) {
    console.error("Error marking notification read:", error);
  }
}

// Improved mark all as read
async function markAllNotificationsRead() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/user/notifications/mark-all-read`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.ok) {
      // Update all notifications in UI
      document.querySelectorAll(".notification-item").forEach((item) => {
        item.classList.remove("unread");
        const markBtn = item.querySelector(".mark-read-btn");
        if (markBtn) markBtn.remove();
      });

      // Reset badge
      updateNotificationBadge(0);
      showNotification("All notifications marked as read", "success");
    } else {
      const errorData = await response.json();
      console.error("Failed to mark all as read:", errorData);
      showNotification("Failed to mark all as read", "error");
    }
  } catch (error) {
    console.error("Error marking all read:", error);
    showNotification("Failed to mark all as read", "error");
  }
}

// Delete notification
async function deleteNotification(notificationId) {
  const confirmed = await confirmAction({
    title: "Delete Notification",
    message: "Are you sure you want to delete this notification?",
    type: "warning",
    confirmText: "Yes, Delete",
  });

  if (!confirmed) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/user/notifications/${notificationId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok) {
      const notificationItem = document.querySelector(
        `.notification-item[data-id="${notificationId}"]`,
      );
      if (notificationItem) {
        const wasUnread = notificationItem.classList.contains("unread");
        notificationItem.remove();

        if (wasUnread) {
          const badge = document.getElementById("notificationBadge");
          const currentCount = parseInt(badge.textContent) || 0;
          const newCount = Math.max(0, currentCount - 1);
          badge.textContent = newCount;
          badge.style.display = newCount > 0 ? "block" : "none";
        }
      }
      showToast("Notification deleted", "success");
    }
  } catch (error) {
    console.error("Error deleting notification:", error);
  }
}

// Start real-time notification polling
function startNotificationPolling() {
  // Poll every 30 seconds
  notificationInterval = setInterval(async () => {
    if (document.visibilityState === "visible") {
      await loadNotifications(currentNotificationPage, false);
    }
  }, 30000);
}

// Stop notification polling
function stopNotificationPolling() {
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }
}

// Show freeze notification
function showFreezeNotification(reason, unfreezeMethod, paymentDetails) {
  const freezeNotification = document.getElementById("freezeNotification");
  const freezeReason = document.getElementById("freezeReason");
  const requestBtn = document.getElementById("requestUnfreezeBtn");

  if (freezeNotification && freezeReason) {
    freezeReason.textContent =
      reason || "Your account has been frozen. Please contact support.";
    freezeNotification.style.display = "flex";

    if (requestBtn) {
      if (unfreezeMethod === "support") {
        requestBtn.textContent = "Contact Support";
        requestBtn.onclick = () => {
          // Navigate to the live support page
          const supportNav = document.querySelector(
            '.nav-item[data-page="live-support"]',
          );
          if (supportNav) supportNav.click();
          // Optionally create a support ticket
          createUnfreezeSupportTicket();
        };
      } else {
        requestBtn.textContent = "Request Unfreeze OTP";
        requestBtn.onclick = async () => {
          try {
            const response = await fetch(
              `${API_BASE_URL}/user/request-unfreeze-otp`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              },
            );
            const data = await response.json();
            if (response.ok) {
              if (data.requires_payment) {
                showUnfreezePaymentModal(data.payment_details);
              } else if (data.requires_support) {
                showNotification("Redirecting to support...", "info");
                setTimeout(() => switchToPage("live-support"), 500);
              } else {
                showNotification(
                  data.message || "Unfreeze request sent",
                  "success",
                );
              }
            } else {
              showNotification(
                data.error || "Failed to request unfreeze",
                "error",
              );
            }
          } catch (error) {
            console.error("Unfreeze request error:", error);
            showNotification("Failed to request unfreeze", "error");
          }
        };
      }
    }
  }
}

async function createUnfreezeSupportTicket() {
  try {
    const response = await fetch(`${API_BASE_URL}/user/tickets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: "Account Unfreeze Request",
        message: "My account is frozen. Please assist in unfreezing it.",
        priority: "high",
      }),
    });
    if (response.ok) {
      showNotification(
        "Support ticket created. An admin will assist you shortly.",
        "success",
      );
    } else {
      console.error("Failed to create ticket");
    }
  } catch (err) {
    console.error("Error creating support ticket:", err);
  }
}

// Transfer form handler - COMPLETE VERSION WITH SELF-TRANSFER CHECK

// Updated Transfer Form Handler with PIN Verification
const transferForm = document.getElementById("transferForm");
if (transferForm) {
  transferForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fromAccountId = document.getElementById("fromAccount").value;
    const toAccountNumberRaw = document.getElementById("toAccount").value;
    const amount = parseFloat(document.getElementById("amount").value);
    const description = document.getElementById("description").value;

    const toAccountNumber = toAccountNumberRaw.replace(/\s/g, "");

    // Get source account details
    const selectedSourceAccount = accounts.find(
      (acc) => acc.id === fromAccountId,
    );

    // Check self-transfer
    if (
      selectedSourceAccount &&
      selectedSourceAccount.account_number === toAccountNumber
    ) {
      showNotification(
        "You cannot transfer money to your own account",
        "error",
      );
      return;
    }

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      showNotification("Please enter a valid amount", "error");
      return;
    }

    // Validate recipient
    const recipientFeedback = document.getElementById("recipientFeedback");
    if (!recipientFeedback || recipientFeedback.classList.contains("error")) {
      showNotification(
        "Please enter a valid recipient account number",
        "error",
      );
      return;
    }

    const transferData = {
      from_account_id: fromAccountId,
      to_account_number: toAccountNumber,
      amount: amount,
      description: description,
    };

    // Use the PIN verification flow
    requirePinForTransaction(transferData, async () => {
      await executeTransfer(transferData);
    });
  });
}

/*async function executeTransfer(transferData) {
  const transferBtn = document.getElementById("transferBtn");
  transferBtn.disabled = true;
  transferBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Processing...';

  try {
    // Show loading with custom message
    loadingManager.show("Processing your transfer...");

    const response = await fetch(`${API_BASE_URL}/user/transfer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transferData),
    });

    const data = await response.json();

    if (response.ok) {
      if (data.requires_otp) {
        showOTPModal(data.transaction_id, "transfer");
      } else {
        // Show success receipt
        /*showNotification(
          `Transfer of ${formatCurrency(transferData.amount)} completed successfully!`,
          "success",
        );*

        // Prepare receipt data
        const receiptData = {
          transaction_id:
            data.transaction?.transaction_id || data.transaction_id,
          amount: transferData.amount,
          fee_amount: data.transaction?.fee || 0,
          status: "completed",
          completed_at: new Date().toISOString(),
          description:
            transferData.description ||
            `Transfer to ${data.recipient?.name || "Recipient"}`,
          from_name: currentUser?.first_name + " " + currentUser?.last_name,
          from_account: accounts.find(
            (a) => a.id === transferData.from_account_id,
          )?.account_number,
          to_name: data.recipient?.name,
          to_account: transferData.to_account_number,
          transaction_type: "transfer",
        };

        // Show success state briefly before receipt
        loadingManager.showSuccess("Transfer completed successfully!", 600);

        setTimeout(() => {
          showTransactionReceipt(receiptData);
        }, 600);

        // Reset form
        transferForm.reset();
        const recipientFeedback = document.getElementById("recipientFeedback");
        if (recipientFeedback) {
          recipientFeedback.textContent = "";
          recipientFeedback.className = "input-feedback";
        }

        // Refresh data
        await loadAccounts();
        await loadTransactions();
        await loadMySavings();
        if (currentPage === "transactions") {
          await loadFullTransactions(1);
        }

        // Trigger spare change savings
        await triggerSpareChangeSavings(transferData);
      }
    } else {
      loadingManager.showError(data.error || "Transfer failed", 1000);

      // Handle different error types
      /* if (data.error === "Insufficient funds") {
        const fromAccount = accounts.find(
          (a) => a.id === transferData.from_account_id,
        );
        showInsufficientBalanceModal(
          transferData.amount,
          fromAccount?.available_balance || 0,
        );
      } else {
        showTransactionFailedModal(
          "Transfer Failed",
          data.error || "An error occurred. Please try again.",
        );
      }

      // Handle different error types
      if (data.error === "Insufficient funds") {
        const fromAccount = accounts.find(
          (a) => a.id === transferData.from_account_id,
        );
        setTimeout(() => {
          showInsufficientBalanceModal(
            transferData.amount,
            fromAccount?.available_balance || 0,
          );
        }, 1000);
      } else {
        setTimeout(() => {
          showTransactionFailedModal(
            "Transfer Failed",
            data.error || "An error occurred. Please try again.",
          );
        }, 1000);
      }
    }
  } catch (error) {
    console.error("Transfer error:", error);
    loadingManager.showError(
      "Network error. Please check your connection.",
      1000,
    );
    setTimeout(() => {
      showTransactionFailedModal(
        "Network Error",
        "Please check your connection and try again.",
      );
    }, 1000);
  } finally {
    /*transferBtn.disabled = false;
    transferBtn.innerHTML =
      '<span>Continue Transfer</span><i class="fas fa-arrow-right"></i>';
  }
}*/

async function executeTransfer(transferData) {
  const transferBtn = document.getElementById("transferBtn");

  try {
    // Show loading with custom message
    loadingManager.show("Processing your transfer...");

    const response = await fetch(`${API_BASE_URL}/user/transfer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transferData),
    });

    const data = await response.json();

    if (response.ok) {
      if (data.requires_otp) {
        // OTP required - just hide loading and show OTP modal
        loadingManager.hide();
        showOTPModal(data.transaction_id, "transfer");
      } else {
        // Transfer successful - prepare receipt data FIRST
        const receiptData = {
          transaction_id:
            data.transaction?.transaction_id ||
            data.transaction_id ||
            `TXN${Date.now()}`,
          amount: transferData.amount,
          fee_amount: data.transaction?.fee || 0,
          status: "completed",
          completed_at: new Date().toISOString(),
          description:
            transferData.description ||
            `Transfer to ${data.recipient?.name || "Recipient"}`,
          from_name: currentUser?.first_name + " " + currentUser?.last_name,
          from_account: accounts.find(
            (a) => a.id === transferData.from_account_id,
          )?.account_number,
          to_name: data.recipient?.name,
          to_account: transferData.to_account_number,
          transaction_type: "transfer",
        };

        // IMPORTANT: Hide loading overlay FIRST (before showing receipt)
        loadingManager.hide();

        // Then show receipt modal immediately
        showTransactionReceipt(receiptData);

        // Reset form
        transferForm.reset();
        const recipientFeedback = document.getElementById("recipientFeedback");
        if (recipientFeedback) {
          recipientFeedback.textContent = "";
          recipientFeedback.className = "input-feedback";
        }

        // Refresh data in background (don't block UI)
        setTimeout(() => {
          loadAccounts();
          loadTransactions();
          loadMySavings();
          if (currentPage === "transactions") {
            loadFullTransactions(1);
          }
          triggerSpareChangeSavings(transferData);
        }, 100);
      }
    } else {
      // Transfer failed - hide loading immediately
      loadingManager.hide();

      // Handle different error types
      if (data.error === "Insufficient funds") {
        const fromAccount = accounts.find(
          (a) => a.id === transferData.from_account_id,
        );
        setTimeout(() => {
          showInsufficientBalanceModal(
            transferData.amount,
            fromAccount?.available_balance || 0,
          );
        }, 50);
      } else {
        setTimeout(() => {
          showTransactionFailedModal(
            "Transfer Failed",
            data.error || "An error occurred. Please try again.",
          );
        }, 50);
      }
    }
  } catch (error) {
    console.error("Transfer error:", error);
    // Hide loading immediately on error
    loadingManager.hide();
    setTimeout(() => {
      showTransactionFailedModal(
        "Network Error",
        "Please check your connection and try again.",
      );
    }, 50);
  } finally {
    // Re-enable transfer button
    if (transferBtn) {
      transferBtn.disabled = false;
      transferBtn.innerHTML =
        '<span>Continue Transfer</span><i class="fas fa-arrow-right"></i>';
    }
  }
}

// ==================== TRANSACTION RECEIPT FUNCTIONS ====================

// Store transaction data for receipt
let lastTransactionReceipt = null;

// Show transaction receipt modal
function showTransactionReceipt(transactionData) {
  lastTransactionReceipt = transactionData;

  const modal = document.getElementById("transactionReceiptModal");
  if (!modal) {
    console.error("Receipt modal not found");
    return;
  }

  const isSuccess =
    transactionData.status === "completed" ||
    transactionData.status === "success";

  // Status icon and text
  const statusIcon = document.getElementById("receiptStatusIcon");
  const statusText = document.getElementById("receiptStatusText");

  if (isSuccess) {
    if (statusIcon)
      statusIcon.innerHTML =
        '<i class="fas fa-check-circle" style="font-size: 45px; color: #10b981;"></i>';
    if (statusText) statusText.textContent = "Transaction Successful";
  } else {
    if (statusIcon)
      statusIcon.innerHTML =
        '<i class="fas fa-times-circle" style="font-size: 45px; color: #ef4444;"></i>';
    if (statusText) statusText.textContent = "Transaction Failed";
  }

  // Transaction ID
  const txId =
    transactionData.transaction_id || transactionData.id || "TXN" + Date.now();
  const txIdEl = document.getElementById("receiptTransactionId");
  if (txIdEl) txIdEl.textContent = txId;

  // Amount
  const amount = transactionData.amount || 0;
  const amountEl = document.getElementById("receiptAmount");
  if (amountEl) amountEl.textContent = formatMoney(amount);

  // Fee and Total
  const fee = transactionData.fee_amount || transactionData.fee || 0;
  const total = amount + fee;
  const feeEl = document.getElementById("receiptFee");
  const totalEl = document.getElementById("receiptTotal");
  if (feeEl) {
    if (fee === 0) {
      feeEl.textContent = `Fee: Free`;
      feeEl.style.color = "#10b981";
    } else {
      feeEl.textContent = `Fee: ${formatMoney(fee)}`;
      feeEl.style.color = "#64748b";
    }
  }
  if (totalEl) totalEl.textContent = `Total: ${formatMoney(total)}`;

  // Status badge
  const statusBadge = document.getElementById("receiptStatus");
  if (statusBadge) {
    const status = transactionData.status || "completed";
    if (status === "completed" || status === "success") {
      statusBadge.textContent = "COMPLETED";
      statusBadge.style.background = "#d1fae5";
      statusBadge.style.color = "#065f46";
    } else if (status === "pending") {
      statusBadge.textContent = "PENDING";
      statusBadge.style.background = "#fef3c7";
      statusBadge.style.color = "#92400e";
    } else {
      statusBadge.textContent = "FAILED";
      statusBadge.style.background = "#fee2e2";
      statusBadge.style.color = "#991b1b";
    }
  }

  // Date & Time
  const dateEl = document.getElementById("receiptDateTime");
  if (dateEl) {
    const date =
      transactionData.completed_at ||
      transactionData.created_at ||
      new Date().toISOString();
    dateEl.textContent = new Date(date).toLocaleString("en-NG", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Generated date for footer
  const genDateEl = document.getElementById("receiptGeneratedDate");
  if (genDateEl) {
    genDateEl.textContent = new Date().toLocaleString("en-NG");
  }

  // Transaction Type
  const typeEl = document.getElementById("receiptType");
  if (typeEl) {
    const txType = transactionData.transaction_type || "transfer";
    typeEl.textContent =
      txType === "transfer"
        ? "Internal Transfer"
        : txType.toUpperCase().replace("_", " ");
  }

  // Description
  const descEl = document.getElementById("receiptDescription");
  if (descEl) descEl.textContent = transactionData.description || "-";

  // Sender Info
  const fromNameEl = document.getElementById("receiptFromName");
  const fromAccountEl = document.getElementById("receiptFromAccount");

  if (fromNameEl)
    fromNameEl.textContent =
      transactionData.from_name ||
      currentUser?.first_name + " " + currentUser?.last_name ||
      "You";
  if (fromAccountEl)
    fromAccountEl.textContent = transactionData.from_account || "••••";

  // Receiver Info
  const toNameEl = document.getElementById("receiptToName");
  const toAccountEl = document.getElementById("receiptToAccount");

  if (toNameEl)
    toNameEl.textContent =
      transactionData.to_name || transactionData.recipient_name || "Recipient";
  if (toAccountEl)
    toAccountEl.textContent =
      transactionData.to_account || transactionData.recipient_account || "••••";

  // Show modal
  modal.classList.add("show");
}

// Share receipt via Web Share API or fallback
async function shareReceipt() {
  if (!lastTransactionReceipt) {
    showNotification("No transaction data to share", "error");
    return;
  }

  const receiptText = generateReceiptText(lastTransactionReceipt);

  // Try Web Share API first
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Transaction Receipt - FEECENT",
        text: receiptText,
      });
      showNotification("Receipt shared successfully", "success");
      return;
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Share failed:", err);
      }
    }
  }

  // Fallback: Copy to clipboard
  try {
    await navigator.clipboard.writeText(receiptText);
    showNotification("Receipt copied to clipboard!", "success");
  } catch (err) {
    showNotification("Could not share receipt", "error");
  }
}

// Generate receipt text for sharing
function generateReceiptText(transaction) {
  const isSuccess =
    transaction.status === "completed" || transaction.status === "success";
  const statusSymbol = isSuccess ? "✅" : "❌";
  const statusText = isSuccess ? "SUCCESSFUL" : "FAILED";

  const date = new Date(
    transaction.completed_at || transaction.created_at || new Date(),
  );
  const amount = transaction.amount || 0;
  const fee = transaction.fee_amount || transaction.fee || 0;

  return `
╔══════════════════════════════════════════════════════════╗
║                 FEECENT TRANSACTION RECEIPT              ║
╠══════════════════════════════════════════════════════════╣
║ ${statusSymbol} STATUS: ${statusText}${" ".repeat(40 - statusText.length)}║
╠══════════════════════════════════════════════════════════╣
║ REF: ${(transaction.transaction_id || transaction.id || "N/A").substring(0, 36)}${" ".repeat(36 - (transaction.transaction_id || transaction.id || "N/A").substring(0, 36).length)}║
║ DATE: ${date.toLocaleString("en-NG").substring(0, 36)}${" ".repeat(36 - date.toLocaleString("en-NG").substring(0, 36).length)}║
╠══════════════════════════════════════════════════════════╣
║ AMOUNT: ₦${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}${" ".repeat(36 - `AMOUNT: ₦${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`.length)}║
║ FEE:    ₦${fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}${" ".repeat(36 - `FEE:    ₦${fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}`.length)}║
║ TOTAL:  ₦${(amount + fee).toLocaleString(undefined, { minimumFractionDigits: 2 })}${" ".repeat(36 - `TOTAL:  ₦${(amount + fee).toLocaleString(undefined, { minimumFractionDigits: 2 })}`.length)}║
╠══════════════════════════════════════════════════════════╣
║ SENT FROM:                                               ║
║   ${(transaction.from_name || "You").substring(0, 34)}${" ".repeat(34 - (transaction.from_name || "You").substring(0, 34).length)}║
║   ${(transaction.from_account || "").substring(0, 34)}${" ".repeat(34 - (transaction.from_account || "").substring(0, 34).length)}║
╠══════════════════════════════════════════════════════════╣
║ SENT TO:                                                 ║
║   ${(transaction.to_name || transaction.recipient_name || "Recipient").substring(0, 34)}${" ".repeat(34 - (transaction.to_name || transaction.recipient_name || "Recipient").substring(0, 34).length)}║
║   ${(transaction.to_account || transaction.recipient_account || "").substring(0, 34)}${" ".repeat(34 - (transaction.to_account || transaction.recipient_account || "").substring(0, 34).length)}║
╠══════════════════════════════════════════════════════════╣
║ DESC: ${(transaction.description || "-").substring(0, 34)}${" ".repeat(34 - (transaction.description || "-").substring(0, 34).length)}║
╠══════════════════════════════════════════════════════════╣
║ This is an electronically generated receipt.            ║
║ No signature required. Valid as proof of transaction.   ║
╚══════════════════════════════════════════════════════════╝
    `;
}

// Download receipt as image - FIXED to capture the entire receipt area
async function downloadReceiptAsImage() {
  if (!lastTransactionReceipt) {
    showNotification("No transaction data to save", "error");
    return;
  }

  // Show loading indicator
  const downloadBtn = document.getElementById("receiptDownloadBtn");
  const originalText = downloadBtn.innerHTML;
  downloadBtn.disabled = true;
  downloadBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Generating...';

  // Get the receipt capture area
  const captureArea = document.getElementById("receiptCaptureArea");
  if (!captureArea) {
    showNotification("Could not capture receipt", "error");
    downloadBtn.disabled = false;
    downloadBtn.innerHTML = originalText;
    return;
  }

  // Store original styles
  const originalOverflow = captureArea.style.overflow;
  const originalMaxHeight = captureArea.style.maxHeight;
  const modalContent = captureArea.closest(".modal-content");
  const originalModalMaxHeight = modalContent?.style.maxHeight;
  const originalModalOverflow = modalContent?.style.overflowY;

  // Temporarily modify for full capture
  if (modalContent) {
    modalContent.style.maxHeight = "none";
    modalContent.style.overflowY = "visible";
  }
  captureArea.style.overflow = "visible";
  captureArea.style.maxHeight = "none";

  // Scroll to top of capture area
  captureArea.scrollIntoView({ behavior: "instant", block: "start" });

  // Small delay for DOM to settle
  await new Promise((resolve) => setTimeout(resolve, 100));

  try {
    // Check if html2canvas is available
    if (typeof html2canvas === "undefined") {
      // Fallback: Use a polyfill or show error
      showNotification(
        "Please add html2canvas library to enable image download",
        "error",
      );
      return;
    }

    // Capture the entire receipt area
    const canvas = await html2canvas(captureArea, {
      scale: 2.5, // Higher scale for better quality
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
      allowTaint: false,
      windowWidth: captureArea.scrollWidth,
      windowHeight: captureArea.scrollHeight,
      onclone: (clonedDoc, element) => {
        // Ensure all styles are applied in the cloned document
        const clonedArea = clonedDoc.getElementById("receiptCaptureArea");
        if (clonedArea) {
          clonedArea.style.overflow = "visible";
          clonedArea.style.maxHeight = "none";
        }
      },
    });

    // Create download link
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const txId = (
      lastTransactionReceipt.transaction_id ||
      lastTransactionReceipt.id ||
      timestamp
    ).substring(0, 20);
    link.download = `feecent_receipt_${txId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();

    showNotification("Receipt saved as image!", "success");
  } catch (err) {
    console.error("Download error:", err);
    showNotification("Could not save receipt. Please try again.", "error");
  } finally {
    // Restore original styles
    if (modalContent) {
      modalContent.style.maxHeight = originalModalMaxHeight || "90vh";
      modalContent.style.overflowY = originalModalOverflow || "auto";
    }
    captureArea.style.overflow = originalOverflow || "";
    captureArea.style.maxHeight = originalMaxHeight || "";

    downloadBtn.disabled = false;
    downloadBtn.innerHTML = originalText;
  }
}

// Also add a print function for receipts (optional)
function printReceipt() {
  if (!lastTransactionReceipt) {
    showNotification("No transaction data to print", "error");
    return;
  }

  const captureArea = document.getElementById("receiptCaptureArea");
  if (!captureArea) return;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>FEECENT Transaction Receipt</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; margin: 0; }
                .receipt { max-width: 550px; margin: 0 auto; }
                @media print {
                    body { margin: 0; padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="receipt">
                ${captureArea.outerHTML}
            </div>
            <div class="no-print" style="text-align: center; margin-top: 20px;">
                <button onclick="window.print()">Print</button>
                <button onclick="window.close()">Close</button>
            </div>
        </body>
        </html>
    `);
  printWindow.document.close();
}

// Show insufficient balance modal
function showInsufficientBalanceModal(required, available) {
  const modal = document.getElementById("insufficientBalanceModal");
  if (!modal) return;

  const msgEl = document.getElementById("insufficientMsg");
  const detailsEl = document.getElementById("insufficientDetails");

  if (msgEl)
    msgEl.textContent =
      "Your account balance is insufficient for this transfer.";
  if (detailsEl)
    detailsEl.textContent = `Available balance: ${formatMoney(available)} | Required: ${formatMoney(required)}`;

  modal.classList.add("show");
}

// Show transaction failed modal
function showTransactionFailedModal(message, reason = "") {
  const modal = document.getElementById("transactionFailedModal");
  if (!modal) return;

  const msgEl = document.getElementById("failedMessage");
  const reasonEl = document.getElementById("failedReason");

  if (msgEl)
    msgEl.textContent = message || "Your transaction could not be completed.";
  if (reasonEl)
    reasonEl.textContent = reason || "Please check your balance and try again.";

  modal.classList.add("show");
}

// Attach receipt event listeners
document.addEventListener("DOMContentLoaded", () => {
  const shareBtn = document.getElementById("receiptShareBtn");
  const downloadBtn = document.getElementById("receiptDownloadBtn");

  if (shareBtn) shareBtn.addEventListener("click", shareReceipt);
  if (downloadBtn)
    downloadBtn.addEventListener("click", downloadReceiptAsImage);
});

// Function to trigger spare change savings after transfer
async function triggerSpareChangeSavings(transferData) {
  try {
    // Check if user has spare change savings active
    const response = await fetch(`${API_BASE_URL}/user/savings`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return;

    const savings = await response.json();
    const spareChange = savings.find(
      (s) => s.type === "spare_change" && s.status === "active",
    );

    // If spare change is not active or auto-save is off, don't process
    if (!spareChange || !spareChange.auto_save) return;

    // Call the spare change API
    const spareResponse = await fetch(
      `${API_BASE_URL}/user/savings/spare-change/process`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_account_id: transferData.from_account_id,
          amount: transferData.amount,
        }),
      },
    );

    if (spareResponse.ok) {
      const result = await spareResponse.json();
      if (result.saved_amount > 0) {
        showNotification(
          `💰 Spare Change: ₦${result.saved_amount.toFixed(2)} saved automatically!`,
          "success",
        );
      }
    }
  } catch (error) {
    console.error("Spare change trigger error:", error);
    // Don't show error to user - spare change is optional
  }
}

// ── Recipient name lookup ───────────────────────────────────────────────
const toAccountInput = document.getElementById("toAccount");
const feedbackEl = document.getElementById("recipientFeedback");

if (toAccountInput && feedbackEl) {
  const lookupRecipient = debounce(async (accountNumber) => {
    if (!accountNumber || accountNumber.length < 8) {
      feedbackEl.textContent = "";
      feedbackEl.className = "input-feedback";
      return;
    }

    feedbackEl.textContent = "Verifying account...";
    feedbackEl.className = "input-feedback loading";

    try {
      const res = await fetch(
        `${API_BASE_URL}/accounts/recipient?account_number=${encodeURIComponent(
          accountNumber,
        )}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Verification failed");
      }

      const data = await res.json();

      if (data.success) {
        feedbackEl.textContent = `Recipient: ${data.name}`;
        feedbackEl.className = "input-feedback success";
        // Optional: store for transfer submission
        toAccountInput.dataset.validRecipient = "true";
        toAccountInput.dataset.recipientName = data.name;
        toAccountInput.dataset.accountId = data.account_id;
      } else {
        throw new Error("Account not found");
      }
    } catch (err) {
      feedbackEl.textContent = err.message.includes("not found")
        ? "No account found with this number"
        : "Could not verify account";
      feedbackEl.className = "input-feedback error";
      toAccountInput.dataset.validRecipient = "false";
    }
  }, 700); // 700ms delay — feels responsive but avoids spam

  // Trigger on input + blur (good combo)
  toAccountInput.addEventListener("input", (e) => {
    const val = e.target.value.trim().replace(/\D/g, ""); // only digits
    e.target.value = val; // enforce numbers only
    lookupRecipient(val);
  });

  toAccountInput.addEventListener("blur", (e) => {
    lookupRecipient(e.target.value.trim());
  });
}

// ==================== EXTERNAL TRANSFER FUNCTIONS ====================

let externalProviders = [];
let selectedProvider = null;

// Load external transfer history
async function loadExternalTransfers(page = 1, status = "all") {
  try {
    let url = `${API_BASE_URL}/user/external-transfers?page=${page}`;
    if (status !== "all") {
      url += `&status=${status}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      renderExternalTransfersTable(data.transfers);
      updatePagination("externalTransfersPagination", data.pagination, (p) =>
        loadExternalTransfers(p, status),
      );
    }
  } catch (error) {
    console.error("Error loading external transfers:", error);
  }
}

// Render external transfers table
function renderExternalTransfersTable(transfers) {
  const tbody = document.getElementById("externalTransfersTableBody");
  if (!tbody) return;

  if (!transfers || transfers.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <i class="fas fa-exchange-alt" style="font-size: 48px; color: #94a3b8;"></i>
                    <p style="margin-top: 10px;">No external transfers found</p>
                </td>
            </tr>
        `;
    return;
  }

  tbody.innerHTML = transfers
    .map((transfer) => {
      let statusClass = "";
      let statusText = "";

      switch (transfer.status) {
        case "pending":
          statusClass = "status-pending";
          statusText = "Pending Approval";
          break;
        case "completed":
          statusClass = "status-completed";
          statusText = "Completed";
          break;
        case "rejected":
          statusClass = "status-rejected";
          statusText = "Rejected";
          break;
        default:
          statusClass = "status-pending";
          statusText = transfer.status;
      }

      return `
            <tr>
                <td>${new Date(transfer.created_at).toLocaleDateString()}</td>
                <td><strong>${transfer.bank_name}</strong></td>
                <td>${transfer.recipient_name}<br><small>${
                  transfer.recipient_account || transfer.recipient_email || ""
                }</small></td>
                <td class="amount">₦${transfer.amount.toFixed(2)}</td>
                <td><span class="external-transfer-status ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="action-btn view" onclick="viewExternalTransferDetails('${
                      transfer.id
                    }')">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </td>
            </tr>
        `;
    })
    .join("");
}

// View external transfer details
window.viewExternalTransferDetails = async function (transferId) {
  try {
    const response = await fetch(`${API_BASE_URL}/user/external-transfers`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Since we don't have a single transfer endpoint, we'll show a modal with info
    showExternalTransferInfoModal(transferId);
  } catch (error) {
    console.error("Error fetching transfer details:", error);
  }
};

function showExternalTransferInfoModal(transferId) {
  // Fetch the specific transfer from the list
  fetch(`${API_BASE_URL}/user/external-transfers`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((data) => {
      const transfer = data.transfers.find((t) => t.id === transferId);
      if (!transfer) return;

      const modal = document.createElement("div");
      modal.className = "modal show";
      modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>External Transfer Details</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 15px;">
                        <strong>Bank/Provider:</strong> ${transfer.bank_name}
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Recipient:</strong> ${
                          transfer.recipient_name
                        }<br>
                        <small>${
                          transfer.recipient_account ||
                          transfer.recipient_email ||
                          "N/A"
                        }</small>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Amount:</strong> <span style="font-size: 20px; color: var(--primary-color);">₦${transfer.amount.toFixed(
                          2,
                        )}</span>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Status:</strong> <span class="external-transfer-status status-${
                          transfer.status
                        }">${transfer.status.toUpperCase()}</span>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Date:</strong> ${new Date(
                          transfer.created_at,
                        ).toLocaleString()}
                    </div>
                    ${
                      transfer.admin_note
                        ? `
                        <div style="margin-bottom: 15px;">
                            <strong>Admin Note:</strong> ${transfer.admin_note}
                        </div>
                    `
                        : ""
                    }
                    ${
                      transfer.status === "pending"
                        ? `
                        <div class="warning-box" style="background: #fef3c7; padding: 12px; border-radius: 8px;">
                            <i class="fas fa-clock"></i>
                            This transfer is pending admin approval. Funds have been deducted and will be processed once approved.
                        </div>
                    `
                        : transfer.status === "rejected"
                          ? `
                        <div class="warning-box" style="background: #fee2e2; padding: 12px; border-radius: 8px;">
                            <i class="fas fa-exclamation-circle"></i>
                            This transfer was rejected. Funds have been refunded to your account.
                        </div>
                    `
                          : `
                        <div class="warning-box" style="background: #d1fae5; padding: 12px; border-radius: 8px;">
                            <i class="fas fa-check-circle"></i>
                            Transfer completed. Funds should arrive within 2-3 business days.
                        </div>
                    `
                    }
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;

      document.body.appendChild(modal);
      modal
        .querySelector(".close-modal")
        .addEventListener("click", () => modal.remove());
    });
}

// Load providers for external transfer
async function loadExternalProviders() {
  try {
    const response = await fetch(`${API_BASE_URL}/external/providers`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      externalProviders = await response.json();
      renderProvidersGrid();
    }
  } catch (error) {
    console.error("Error loading providers:", error);
  }
}

// Render providers grid
function renderProvidersGrid() {
  const grid = document.getElementById("providersGrid");
  if (!grid) return;

  grid.innerHTML = externalProviders
    .map(
      (provider) => `
        <div class="provider-card" data-provider='${JSON.stringify(
          provider,
        )}' onclick="selectProvider(this, '${provider.id}')"> 
           <div class="provider-logo">
            <img src="${provider.logo}" 
            alt="${provider.name}"
            onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22 viewBox=%220 0 24 24%22 fill=%22%234f46e5%22%3E%3Ctext x=%2250%25%22 y=%2250%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-size=%2212%22 fill=%22white%22%3E${
              provider.name[0]
            }%3C/text%3E%3C/svg%3E'">
        </div>
            <div class="provider-name">${provider.name}</div>
        </div>
    `,
    )
    .join("");
}

// Select provider
window.selectProvider = function (element, providerId) {
  // Remove selected class from all
  document.querySelectorAll(".provider-card").forEach((card) => {
    card.classList.remove("selected");
  });
  element.classList.add("selected");

  const provider = externalProviders.find((p) => p.id === providerId);
  if (provider) {
    selectedProvider = provider;
    showProviderDetailsForm(provider);
  }
};

// Show provider details form
function showProviderDetailsForm(provider) {
  document.getElementById("stepProviderSelection").style.display = "none";
  document.getElementById("stepProviderDetails").style.display = "block";
  document.getElementById("selectedProviderName").textContent = provider.name;
  document.getElementById("externalProviderId").value = provider.id;
  document.getElementById("externalProviderName").value = provider.name;

  // Generate dynamic fields based on provider
  const dynamicFields = document.getElementById("dynamicFields");
  dynamicFields.innerHTML = "";

  provider.fields.forEach((field) => {
    const fieldHtml = `
            <div class="form-group">
                <label>${field.label} ${field.required ? "*" : ""}</label>
                <input type="${field.type}" id="ext_${
                  field.name
                }" class="form-control" ${field.required ? "required" : ""}>
            </div>
        `;
    dynamicFields.insertAdjacentHTML("beforeend", fieldHtml);
  });

  // Populate accounts dropdown
  const accountSelect = document.getElementById("externalFromAccount");
  accountSelect.innerHTML = '<option value="">Select account</option>';
  accounts.forEach((account) => {
    accountSelect.innerHTML += `
            <option value="${account.id}">${account.account_type} (${
              account.account_number
            }) - ₦${account.available_balance.toFixed(2)}</option>
        `;
  });
}

// Back to providers
document.getElementById("backToProvidersBtn")?.addEventListener("click", () => {
  document.getElementById("stepProviderSelection").style.display = "block";
  document.getElementById("stepProviderDetails").style.display = "none";
  selectedProvider = null;
});

// Submit external transfer
document
  .getElementById("externalTransferForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fromAccountId = document.getElementById("externalFromAccount").value;
    const amount = parseFloat(document.getElementById("externalAmount").value);
    const description = document.getElementById("externalDescription").value;
    const providerId = document.getElementById("externalProviderId").value;
    const providerName = document.getElementById("externalProviderName").value;

    // Collect dynamic fields
    const dynamicData = {};
    if (selectedProvider) {
      selectedProvider.fields.forEach((field) => {
        const input = document.getElementById(`ext_${field.name}`);
        if (input) {
          dynamicData[field.name] = input.value;
        }
      });
    }

    // Validate amount
    if (isNaN(amount) || amount < 10 || amount > 10000) {
      showNotification("Amount must be between $10 and $10,000", "error");
      return;
    }

    // Validate required fields
    const missingFields = selectedProvider.fields.filter(
      (f) => f.required && !dynamicData[f.name],
    );
    if (missingFields.length > 0) {
      showNotification(
        `Please fill in: ${missingFields.map((f) => f.label).join(", ")}`,
        "error",
      );
      return;
    }

    const submitBtn = document.getElementById("submitExternalTransfer");
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
      const transferData = {
        from_account_id: fromAccountId,
        provider_id: providerId,
        bank_name: providerName,
        recipient_name:
          dynamicData.recipient_name || dynamicData.recipient_email || "N/A",
        recipient_account: dynamicData.recipient_account || null,
        recipient_email: dynamicData.recipient_email || null,
        recipient_phone: dynamicData.recipient_phone || null,
        amount: amount,
        description: description,
      };

      const response = await fetch(`${API_BASE_URL}/user/external-transfer`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transferData),
      });

      const data = await response.json();

      if (response.ok) {
        showNotification(data.message, "success");
        // Close modal
        document
          .getElementById("externalTransferModal")
          .classList.remove("show");
        // Reset form
        document.getElementById("externalTransferForm").reset();
        document.getElementById("stepProviderSelection").style.display =
          "block";
        document.getElementById("stepProviderDetails").style.display = "none";
        // Refresh accounts and transfers
        await loadAccounts();
        await loadExternalTransfers(1, "all");
      } else {
        showNotification(data.error || "Transfer failed", "error");
      }
    } catch (error) {
      console.error("External transfer error:", error);
      showNotification("Transfer failed. Please try again.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML =
        '<i class="fas fa-paper-plane"></i> Initiate Transfer';
    }
  });

// Open external transfer modal
document
  .getElementById("newExternalTransferBtn")
  ?.addEventListener("click", async () => {
    await loadExternalProviders();
    document.getElementById("externalTransferModal").classList.add("show");
  });

// Receive Money
document
  .getElementById("receiveMoneyBtn")
  ?.addEventListener("click", async () => {
    // Populate country dropdown with ISO countries
    const countrySelect = document.getElementById("receiveCountry");
    if (countrySelect.options.length === 0) {
      const countries = await fetchCountries(); // fetch from your list or use a hardcoded list
      countrySelect.innerHTML =
        '<option value="">Select Country</option>' +
        countries
          .map((c) => `<option value="${c.code}">${c.name}</option>`)
          .join("");
      // Set default to user's country if available
      if (currentUser?.country) {
        countrySelect.value = currentUser.country;
      }
    }
    document.getElementById("receiveMoneyModal").classList.add("show");
  });

// Submit receive request
document
  .getElementById("receiveMoneyForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const amount = parseFloat(document.getElementById("receiveAmount").value);
    const country = document.getElementById("receiveCountry").value;
    const method = document.querySelector(
      'input[name="receiveMethod"]:checked',
    )?.value;
    const description = document.getElementById("receiveDescription").value;

    if (!amount || amount <= 0) {
      showNotification("Please enter a valid amount", "error");
      return;
    }
    if (!country) {
      showNotification("Please select a country", "error");
      return;
    }
    if (!method) {
      showNotification("Please select a method", "error");
      return;
    }

    const submitBtn = document.getElementById("submitReceiveBtn");
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Generating...';

    try {
      const response = await fetch(`${API_BASE_URL}/user/receive-request`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          country_code: country,
          method_type: method,
          description,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Show details
        const detailsDiv = document.getElementById("receiveDetails");
        const detailsContent = document.getElementById("receiveDetailsContent");
        detailsContent.innerHTML = "";

        if (method === "bank") {
          detailsContent.innerHTML = `
                    <p><strong>Bank Name:</strong> ${
                      data.payment_details.bank_name || "N/A"
                    }</p>
                    <p><strong>Account Number:</strong> ${
                      data.payment_details.account_number || "N/A"
                    }</p>
                    <p><strong>Account Name:</strong> ${
                      data.payment_details.account_name || "N/A"
                    }</p>
                    <p><strong>SWIFT Code:</strong> ${
                      data.payment_details.swift || "N/A"
                    }</p>
                    <p><strong>Reference:</strong> ${data.request_id}</p>
                    <p><strong>Amount:</strong> ₦${amount.toFixed(2)}</p>
                    <button class="btn btn-outline" onclick="copyToClipboard('Bank: ${
                      data.payment_details.bank_name
                    }, Account: ${data.payment_details.account_number}, Name: ${
                      data.payment_details.account_name
                    }, Amount: ₦${amount.toFixed(2)}, Ref: ${
                      data.request_id
                    }')">Copy Details</button>
                `;
        } else {
          detailsContent.innerHTML = `
                    <p><strong>Crypto Address:</strong> ${
                      data.payment_details.crypto_address || "N/A"
                    }</p>
                    <p><strong>Network:</strong> ${
                      data.payment_details.network || "N/A"
                    }</p>
                    <p><strong>Amount:</strong> ₦${amount.toFixed(2)}</p>
                    <button class="btn btn-outline" onclick="copyToClipboard('Crypto Address: ${
                      data.payment_details.crypto_address
                    }, Network: ${
                      data.payment_details.network
                    }, Amount: ₦${amount.toFixed(2)}')">Copy Address</button>
                `;
        }

        detailsDiv.style.display = "block";
        // Reset form
        document.getElementById("receiveMoneyForm").reset();
      } else {
        showNotification(
          data.error || "Failed to create receive request",
          "error",
        );
      }
    } catch (error) {
      console.error("Receive request error:", error);
      showNotification("Failed to create receive request", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Generate Receive Details";
    }
  });

// Helper: copy to clipboard
window.copyToClipboard = (text) => {
  navigator.clipboard.writeText(text).then(() => {
    showNotification("Copied to clipboard", "success");
  });
};

// Helper: fetch countries (you may have this already)
async function fetchCountries() {
  // You can use a static list or fetch from an API
  return [
    { code: "AF", name: "Afghanistan" },
    { code: "AL", name: "Albania" },
    { code: "DZ", name: "Algeria" },
    { code: "AD", name: "Andorra" },
    { code: "AO", name: "Angola" },
    { code: "AG", name: "Antigua and Barbuda" },
    { code: "AR", name: "Argentina" },
    { code: "AM", name: "Armenia" },
    { code: "AU", name: "Australia" },
    { code: "AT", name: "Austria" },
    { code: "AZ", name: "Azerbaijan" },
    { code: "BS", name: "Bahamas" },
    { code: "BH", name: "Bahrain" },
    { code: "BD", name: "Bangladesh" },
    { code: "BB", name: "Barbados" },
    { code: "BY", name: "Belarus" },
    { code: "BE", name: "Belgium" },
    { code: "BZ", name: "Belize" },
    { code: "BJ", name: "Benin" },
    { code: "BT", name: "Bhutan" },
    { code: "BO", name: "Bolivia" },
    { code: "BA", name: "Bosnia and Herzegovina" },
    { code: "BW", name: "Botswana" },
    { code: "BR", name: "Brazil" },
    { code: "BN", name: "Brunei Darussalam" },
    { code: "BG", name: "Bulgaria" },
    { code: "BF", name: "Burkina Faso" },
    { code: "BI", name: "Burundi" },
    { code: "CV", name: "Cabo Verde" },
    { code: "KH", name: "Cambodia" },
    { code: "CM", name: "Cameroon" },
    { code: "CA", name: "Canada" },
    { code: "CF", name: "Central African Republic" },
    { code: "TD", name: "Chad" },
    { code: "CL", name: "Chile" },
    { code: "CN", name: "China" },
    { code: "CO", name: "Colombia" },
    { code: "KM", name: "Comoros" },
    { code: "CG", name: "Congo" },
    { code: "CD", name: "Congo, Democratic Republic of the" },
    { code: "CR", name: "Costa Rica" },
    { code: "CI", name: "Côte d'Ivoire" },
    { code: "HR", name: "Croatia" },
    { code: "CU", name: "Cuba" },
    { code: "CY", name: "Cyprus" },
    { code: "CZ", name: "Czechia" },
    { code: "DK", name: "Denmark" },
    { code: "DJ", name: "Djibouti" },
    { code: "DM", name: "Dominica" },
    { code: "DO", name: "Dominican Republic" },
    { code: "EC", name: "Ecuador" },
    { code: "EG", name: "Egypt" },
    { code: "SV", name: "El Salvador" },
    { code: "GQ", name: "Equatorial Guinea" },
    { code: "ER", name: "Eritrea" },
    { code: "EE", name: "Estonia" },
    { code: "SZ", name: "Eswatini" },
    { code: "ET", name: "Ethiopia" },
    { code: "FJ", name: "Fiji" },
    { code: "FI", name: "Finland" },
    { code: "FR", name: "France" },
    { code: "GA", name: "Gabon" },
    { code: "GM", name: "Gambia" },
    { code: "GE", name: "Georgia" },
    { code: "DE", name: "Germany" },
    { code: "GH", name: "Ghana" },
    { code: "GR", name: "Greece" },
    { code: "GD", name: "Grenada" },
    { code: "GT", name: "Guatemala" },
    { code: "GN", name: "Guinea" },
    { code: "GW", name: "Guinea-Bissau" },
    { code: "GY", name: "Guyana" },
    { code: "HT", name: "Haiti" },
    { code: "HN", name: "Honduras" },
    { code: "HU", name: "Hungary" },
    { code: "IS", name: "Iceland" },
    { code: "IN", name: "India" },
    { code: "ID", name: "Indonesia" },
    { code: "IR", name: "Iran" },
    { code: "IQ", name: "Iraq" },
    { code: "IE", name: "Ireland" },
    { code: "IL", name: "Israel" },
    { code: "IT", name: "Italy" },
    { code: "JM", name: "Jamaica" },
    { code: "JP", name: "Japan" },
    { code: "JO", name: "Jordan" },
    { code: "KZ", name: "Kazakhstan" },
    { code: "KE", name: "Kenya" },
    { code: "KI", name: "Kiribati" },
    { code: "KP", name: "Korea, Democratic People's Republic of" },
    { code: "KR", name: "Korea, Republic of" },
    { code: "KW", name: "Kuwait" },
    { code: "KG", name: "Kyrgyzstan" },
    { code: "LA", name: "Lao People's Democratic Republic" },
    { code: "LV", name: "Latvia" },
    { code: "LB", name: "Lebanon" },
    { code: "LS", name: "Lesotho" },
    { code: "LR", name: "Liberia" },
    { code: "LY", name: "Libya" },
    { code: "LI", name: "Liechtenstein" },
    { code: "LT", name: "Lithuania" },
    { code: "LU", name: "Luxembourg" },
    { code: "MG", name: "Madagascar" },
    { code: "MW", name: "Malawi" },
    { code: "MY", name: "Malaysia" },
    { code: "MV", name: "Maldives" },
    { code: "ML", name: "Mali" },
    { code: "MT", name: "Malta" },
    { code: "MH", name: "Marshall Islands" },
    { code: "MR", name: "Mauritania" },
    { code: "MU", name: "Mauritius" },
    { code: "MX", name: "Mexico" },
    { code: "FM", name: "Micronesia, Federated States of" },
    { code: "MD", name: "Moldova" },
    { code: "MC", name: "Monaco" },
    { code: "MN", name: "Mongolia" },
    { code: "ME", name: "Montenegro" },
    { code: "MA", name: "Morocco" },
    { code: "MZ", name: "Mozambique" },
    { code: "MM", name: "Myanmar" },
    { code: "NA", name: "Namibia" },
    { code: "NR", name: "Nauru" },
    { code: "NP", name: "Nepal" },
    { code: "NL", name: "Netherlands" },
    { code: "NZ", name: "New Zealand" },
    { code: "NI", name: "Nicaragua" },
    { code: "NE", name: "Niger" },
    { code: "NG", name: "Nigeria" },
    { code: "MK", name: "North Macedonia" },
    { code: "NO", name: "Norway" },
    { code: "OM", name: "Oman" },
    { code: "PK", name: "Pakistan" },
    { code: "PW", name: "Palau" },
    { code: "PA", name: "Panama" },
    { code: "PG", name: "Papua New Guinea" },
    { code: "PY", name: "Paraguay" },
    { code: "PE", name: "Peru" },
    { code: "PH", name: "Philippines" },
    { code: "PL", name: "Poland" },
    { code: "PT", name: "Portugal" },
    { code: "QA", name: "Qatar" },
    { code: "RO", name: "Romania" },
    { code: "RU", name: "Russian Federation" },
    { code: "RW", name: "Rwanda" },
    { code: "KN", name: "Saint Kitts and Nevis" },
    { code: "LC", name: "Saint Lucia" },
    { code: "VC", name: "Saint Vincent and the Grenadines" },
    { code: "WS", name: "Samoa" },
    { code: "SM", name: "San Marino" },
    { code: "ST", name: "Sao Tome and Principe" },
    { code: "SA", name: "Saudi Arabia" },
    { code: "SN", name: "Senegal" },
    { code: "RS", name: "Serbia" },
    { code: "SC", name: "Seychelles" },
    { code: "SL", name: "Sierra Leone" },
    { code: "SG", name: "Singapore" },
    { code: "SK", name: "Slovakia" },
    { code: "SI", name: "Slovenia" },
    { code: "SB", name: "Solomon Islands" },
    { code: "SO", name: "Somalia" },
    { code: "ZA", name: "South Africa" },
    { code: "SS", name: "South Sudan" },
    { code: "ES", name: "Spain" },
    { code: "LK", name: "Sri Lanka" },
    { code: "SD", name: "Sudan" },
    { code: "SR", name: "Suriname" },
    { code: "SE", name: "Sweden" },
    { code: "CH", name: "Switzerland" },
    { code: "SY", name: "Syrian Arab Republic" },
    { code: "TJ", name: "Tajikistan" },
    { code: "TZ", name: "Tanzania, United Republic of" },
    { code: "TH", name: "Thailand" },
    { code: "TL", name: "Timor-Leste" },
    { code: "TG", name: "Togo" },
    { code: "TO", name: "Tonga" },
    { code: "TT", name: "Trinidad and Tobago" },
    { code: "TN", name: "Tunisia" },
    { code: "TR", name: "Türkiye" },
    { code: "TM", name: "Turkmenistan" },
    { code: "TV", name: "Tuvalu" },
    { code: "UG", name: "Uganda" },
    { code: "UA", name: "Ukraine" },
    { code: "AE", name: "United Arab Emirates" },
    { code: "GB", name: "United Kingdom" },
    { code: "US", name: "United States" },
    { code: "UY", name: "Uruguay" },
    { code: "UZ", name: "Uzbekistan" },
    { code: "VU", name: "Vanuatu" },
    { code: "VE", name: "Venezuela" },
    { code: "VN", name: "Viet Nam" },
    { code: "YE", name: "Yemen" },
    { code: "ZM", name: "Zambia" },
    { code: "ZW", name: "Zimbabwe" },
    // ... add all 195 countries or use a library
  ];
}

// OTP Modal
function showOTPModal(transactionId, type) {
  const modal = document.getElementById("otpModal");
  if (!modal) return;

  modal.classList.add("show");

  const inputs = modal.querySelectorAll(".otp-digit");
  inputs.forEach((input) => (input.value = ""));
  inputs[0].focus();

  // Handle OTP input
  inputs.forEach((input, index) => {
    input.onkeyup = (e) => {
      if (e.key >= "0" && e.key <= "9") {
        if (index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      } else if (e.key === "Backspace") {
        if (index > 0) {
          inputs[index - 1].focus();
        }
      }

      // Auto-submit when all digits are filled
      const allFilled = Array.from(inputs).every((i) => i.value.length === 1);
      if (allFilled) {
        verifyOTP(transactionId, inputs);
      }
    };
  });

  // Verify OTP button
  document.getElementById("verifyOtp").onclick = () =>
    verifyOTP(transactionId, inputs);

  // Cancel button
  document.getElementById("cancelOtp").onclick = () => {
    modal.classList.remove("show");
  };

  // Close modal
  modal.querySelector(".close-modal").onclick = () => {
    modal.classList.remove("show");
  };
}

async function verifyOTP(transactionId, inputs) {
  const otpCode = Array.from(inputs)
    .map((i) => i.value)
    .join("");

  if (otpCode.length !== 6) {
    showNotification("Please enter complete OTP", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/user/verify-otp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction_id: transactionId,
        otp_code: otpCode,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      document.getElementById("otpModal").classList.remove("show");
      showNotification("Transaction completed successfully", "success");
      await loadAccounts();
      await loadTransactions();
    } else {
      showNotification(data.error || "Invalid OTP", "error");
    }
  } catch (error) {
    console.error("OTP verification error:", error);
    showNotification("OTP verification failed", "error");
  }
}

// Purchase card modal
const purchaseCardBtn = document.getElementById("purchaseCardBtn");
if (purchaseCardBtn) {
  purchaseCardBtn.addEventListener("click", () => {
    const modal = document.getElementById("purchaseCardModal");
    modal.classList.add("show");
  });
}

// Confirm purchase
document
  .getElementById("confirmPurchase")
  ?.addEventListener("click", async () => {
    const cardType = document.getElementById("cardType").value;
    const paymentMethod = document.querySelector(
      'input[name="paymentMethod"]:checked',
    )?.value;

    if (!paymentMethod) {
      showNotification("Please select a payment method", "error");
      return;
    }

    const confirmBtn = document.getElementById("confirmPurchase");
    confirmBtn.disabled = true;
    confirmBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
      const response = await fetch(`${API_BASE_URL}/user/purchase-card`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          card_type: cardType,
          purchase_method: paymentMethod,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        document.getElementById("purchaseCardModal").classList.remove("show");

        if (paymentMethod === "crypto") {
          showCryptoPaymentModal(data.payment_instructions);
        } else {
          showNotification("Card purchased successfully", "success");
          await loadCards();
        }
      } else {
        showNotification(data.error || "Failed to purchase card", "error");
      }
    } catch (error) {
      console.error("Card purchase error:", error);
      showNotification("Failed to purchase card", "error");
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = "Purchase";
    }
  });

// Crypto payment modal
function showCryptoPaymentModal(instructions) {
  console.log("showing crypto details");
}

// Copy to clipboard
window.copyToClipboard = (text) => {
  navigator.clipboard.writeText(text).then(() => {
    showNotification("Address copied to clipboard", "success");
  });
};

// New ticket modal
document.getElementById("newTicketBtn")?.addEventListener("click", () => {
  const modal = document.getElementById("newTicketModal");
  modal.classList.add("show");
});

//Live support
let currentChatSubscription = null;

async function loadLiveChat() {
  const container = document.getElementById("chatMessages");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE_URL}/chat/live`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Failed to load chat");

    const { messages } = await res.json();

    container.innerHTML = messages
      .map(
        (msg) => `
        <div class="message ${
          msg.is_from_admin ? "admin-message" : "user-message"
        }">
          <div class="bubble">${msg.message}</div>
          <div class="time">${new Date(msg.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}</div>
        </div>
      `,
      )
      .join("");

    container.scrollTop = container.scrollHeight;
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="error">Could not load chat history</p>`;
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Send message
document.getElementById("sendChatBtn").addEventListener("click", async () => {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  //if (!text) return;

  sendMessage();
});

// Send message - optimistic + API + realtime confirmation
async function sendMessage() {
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendChatBtn");
  if (!input || !sendBtn) return;

  const message = input.value.trim();
  if (!message) return;

  // Disable button + visual feedback
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    const res = await fetch(`${API_BASE_URL}/chat/live`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("Send message failed:", res.status, text.substring(0, 150));
      showNotification("Failed to send message. Try again.", "error");
      return;
    }

    const data = await res.json();

    // Clear input
    input.value = "";

    // Immediately show the message we just sent (optimistic UI)
    appendMessageToChat({
      message: message,
      is_from_admin: false,
      created_at: new Date().toISOString(),
    });

    // Optional: refresh full history or rely on realtime later
    // await loadLiveChat();
  } catch (err) {
    console.error("sendMessage error:", err);
    showNotification("Could not send message. Check connection.", "error");
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send';
  }
}
// Helper: append single message to chat UI (optimistic update)
function appendMessageToChat(msg) {
  const container = document.getElementById("chatMessages");
  if (!container) return;

  const div = document.createElement("div");
  div.className = `message ${
    msg.is_from_admin ? "admin-message" : "user-message"
  }`;
  div.innerHTML = `
    <div class="bubble">${msg.message}</div>
    <div class="time">${new Date(msg.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Optional: send on Enter key
document
  .getElementById("live-chat-input")
  ?.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

// Submit ticket
document.getElementById("submitTicket")?.addEventListener("click", async () => {
  const subject = document.getElementById("ticketSubject").value;
  const priority = document.getElementById("ticketPriority").value;
  const message = document.getElementById("ticketMessage").value;

  if (!subject || !message) {
    showNotification("Please fill in all fields", "error");
    return;
  }

  const submitBtn = document.getElementById("submitTicket");
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

  try {
    const response = await fetch(`${API_BASE_URL}/user/tickets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subject, priority, message }),
    });

    if (response.ok) {
      document.getElementById("newTicketModal").classList.remove("show");
      showNotification("Ticket created successfully", "success");
      document.getElementById("newTicketForm").reset();
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to create ticket", "error");
    }
  } catch (error) {
    console.error("Ticket creation error:", error);
    showNotification("Failed to create ticket", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = "Submit";
  }
});

// Request unfreeze OTP
document
  .getElementById("requestUnfreezeBtn")
  ?.addEventListener("click", async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/user/request-unfreeze-otp`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();

      if (response.ok) {
        if (data.requires_payment) {
          PaymentModal(data.payment_details);
        }
        showNotification(
          "Unfreeze request sent. Check chat for OTP.",
          "success",
        );
      } else {
        showNotification(data.error || "Failed to request unfreeze", "error");
      }
    } catch (error) {
      console.error("Unfreeze request error:", error);
      showNotification("Failed to request unfreeze", "error");
    }
  });

// Initialize charts
/*function initializeCharts() {
  // Spending chart
  const spendingCtx = document
    .getElementById("spendingChart")
    ?.getContext("2d");
  if (spendingCtx) {
    charts.spending = new Chart(spendingCtx, {
      type: "doughnut",
      data: {
        labels: ["Shopping", "Food", "Transport", "Bills", "Entertainment"],
        datasets: [
          {
            data: [650, 450, 300, 850, 200],
            backgroundColor: [
              "#2563eb",
              "#10b981",
              "#f59e0b",
              "#ef4444",
              "#8b5cf6",
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
          },
        },
      },
    });
  }

  // Trend chart
  const trendCtx = document.getElementById("trendChart")?.getContext("2d");
  if (trendCtx) {
    charts.trend = new Chart(trendCtx, {
      type: "line",
      data: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        datasets: [
          {
            label: "Income",
            data: [3000, 3200, 3100, 3400, 3300, 3600],
            borderColor: "#10b981",
            tension: 0.4,
          },
          {
            label: "Expenses",
            data: [2500, 2700, 2600, 2900, 2800, 3100],
            borderColor: "#ef4444",
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
          },
        },
      },
    });
  }
}*/

let chartInitialized = false;

async function lazyLoadSpendingChart() {
  // Only load chart when it becomes visible
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !chartInitialized) {
          chartInitialized = true;
          loadSpendingByCategory();
          observer.disconnect();
        }
      });
    },
    { threshold: 0.1 },
  );

  const canvas = document.getElementById("spendingChart");
  if (canvas) {
    observer.observe(canvas);
  }
}

// Add near other load functions
async function loadSpendingByCategory() {
  try {
    // Safety: prevent double call
    const canvas = document.getElementById("spendingChar");
    if (!canvas) return;
    if (canvas.dataset.loaded === "true") return; // already loaded this session

    canvas.dataset.loaded = "true";

    const response = await fetch(
      `${API_BASE_URL}/user/transactions/category-summary`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json(); // → [{category: "Food", total: 245.50}, ...]

    // Destroy previous chart instance safely
    if (charts.spending) {
      charts.spending.destroy();
    }

    const ctx = canvas.getContext("2d");
    charts.spending = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: data.map((item) => item.category),
        datasets: [
          {
            data: data.map((item) => item.total),
            backgroundColor: [
              "#4f46e5",
              "#10b981",
              "#f59e0b",
              "#ef4444",
              "#8b5cf6",
              "#ec4899",
              "#14b8a6",
              "#f97316",
              "#64748b",
            ],
            borderWidth: 1,
            borderColor: "#ffffff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { font: { size: 13 } },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed;
                return ` $${value.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}`;
              },
            },
          },
          title: {
            display: true,
            text: "Spending by Category (Last 30 Days)",
            font: { size: 16 },
            padding: { top: 10, bottom: 20 },
          },
        },
      },
    });
  } catch (err) {
    console.error("Spending by category error:", err);
    showNotification("Could not load spending breakdown", "error");

    // Optional fallback fake data (for development only)
    renderFakeSpendingChart();
  }
}

// Optional fallback – only use during testing
/*function renderFakeSpendingChart() {
  const fakeData = [
    { category: "Food & Dining", total: 285.4 },
    { category: "Transportation", total: 142.8 },
    { category: "Shopping", total: 398.2 },
    { category: "Bills & Utilities", total: 175.6 },
    { category: "Entertainment", total: 89.5 },
    { category: "Other", total: 67.3 },
  ];

  // same Chart.js code as above, but using fakeData
  // ...
}*/

// Add to dashboard.js

// ==================== BILLS & SERVICES ====================

// Initialize bills grid
function initBillsGrid() {
  const billItems = document.querySelectorAll(".bill-item[data-service]");
  billItems.forEach((item) => {
    item.addEventListener("click", () => {
      const service = item.dataset.service;
      showPaymentModal(service);
    });
  });

  document
    .getElementById("moreServicesBtn")
    ?.addEventListener("click", showMoreServicesModal);
  document
    .getElementById("viewAllServicesBtn")
    ?.addEventListener("click", showMoreServicesModal);
}

// Show payment modal for specific service
function showPaymentModal(service) {
  const modal = document.getElementById("paymentServiceModal");
  const title = document.getElementById("paymentServiceTitle");
  const phoneGroup = document.getElementById("phoneNumberGroup");
  const meterGroup = document.getElementById("meterNumberGroup");
  const smartCardGroup = document.getElementById("smartCardGroup");
  const providerGroup = document.getElementById("serviceProviderGroup");

  // Reset all groups
  phoneGroup.style.display = "none";
  meterGroup.style.display = "none";
  smartCardGroup.style.display = "none";
  providerGroup.style.display = "none";

  document.getElementById("serviceType").value = service;

  // Show relevant fields based on service
  switch (service) {
    case "airtime":
    case "data":
      title.textContent = `Buy ${service.charAt(0).toUpperCase() + service.slice(1)}`;
      phoneGroup.style.display = "block";
      break;
    case "electricity":
      title.textContent = "Pay Electricity Bill";
      meterGroup.style.display = "block";
      providerGroup.style.display = "block";
      loadElectricityProviders();
      break;
    case "tv":
      title.textContent = "Pay TV Subscription";
      smartCardGroup.style.display = "block";
      providerGroup.style.display = "block";
      loadTVProviders();
      break;
    case "betting":
      title.textContent = "Betting Deposit";
      phoneGroup.style.display = "block";
      providerGroup.style.display = "block";
      loadBettingProviders();
      break;
    default:
      title.textContent = "Make Payment";
  }

  // Load user accounts
  loadAccountsForPayment();

  modal.classList.add("show");
}

async function loadAccountsForPayment() {
  const select = document.getElementById("paymentFromAccount");
  select.innerHTML = '<option value="">Select account</option>';

  accounts.forEach((account) => {
    select.innerHTML += `<option value="${account.id}">${account.account_type} (${account.account_number}) - ₦${account.available_balance.toFixed(2)}</option>`;
  });
}

async function loadElectricityProviders() {
  const select = document.getElementById("serviceProvider");
  select.innerHTML = '<option value="">Select Provider</option>';
  select.innerHTML += `
        <option value="ikeja">Ikeja Electric</option>
        <option value="eko">Eko Electric</option>
        <option value="abuja">Abuja Electric</option>
        <option value="kano">Kano Electric</option>
    `;
}

async function loadTVProviders() {
  const select = document.getElementById("serviceProvider");
  select.innerHTML = '<option value="">Select Provider</option>';
  select.innerHTML += `
        <option value="dstv">DStv</option>
        <option value="gotv">GOtv</option>
        <option value="startimes">StarTimes</option>
        <option value="showmax">Showmax</option>
    `;
}

async function loadBettingProviders() {
  const select = document.getElementById("serviceProvider");
  select.innerHTML = '<option value="">Select Provider</option>';
  select.innerHTML += `
        <option value="bet9ja">Bet9ja</option>
        <option value="sportybet">SportyBet</option>
        <option value="1xbet">1xBet</option>
        <option value="betking">BetKing</option>
    `;
}

// Process payment
document
  .getElementById("confirmPaymentBtn")
  ?.addEventListener("click", async () => {
    const serviceType = document.getElementById("serviceType").value;
    const fromAccountId = document.getElementById("paymentFromAccount").value;
    const amount = parseFloat(document.getElementById("paymentAmount").value);

    if (!fromAccountId || !amount || amount <= 0) {
      showNotification("Please fill all required fields", "error");
      return;
    }

    // Build payment data
    const paymentData = {
      service_type: serviceType,
      from_account_id: fromAccountId,
      amount: amount,
    };

    switch (serviceType) {
      case "airtime":
      case "data":
        paymentData.phone_number = document.getElementById("phoneNumber").value;
        if (!paymentData.phone_number) {
          showNotification("Please enter phone number", "error");
          return;
        }
        break;
      case "electricity":
        paymentData.meter_number = document.getElementById("meterNumber").value;
        paymentData.provider = document.getElementById("serviceProvider").value;
        if (!paymentData.meter_number || !paymentData.provider) {
          showNotification("Please fill all fields", "error");
          return;
        }
        break;
      case "tv":
        paymentData.smart_card_number =
          document.getElementById("smartCardNumber").value;
        paymentData.provider = document.getElementById("serviceProvider").value;
        if (!paymentData.smart_card_number || !paymentData.provider) {
          showNotification("Please fill all fields", "error");
          return;
        }
        break;
      case "betting":
        paymentData.phone_number = document.getElementById("phoneNumber").value;
        paymentData.provider = document.getElementById("serviceProvider").value;
        if (!paymentData.phone_number || !paymentData.provider) {
          showNotification("Please fill all fields", "error");
          return;
        }
        break;
    }

    const btn = document.getElementById("confirmPaymentBtn");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
      const response = await fetch(`${API_BASE_URL}/user/bill-payment`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentData),
      });

      const data = await response.json();

      if (response.ok) {
        showNotification("Payment successful!", "success");
        closeModal("paymentServiceModal");
        await loadAccounts();
        await loadTransactions();
      } else {
        showNotification(data.error || "Payment failed", "error");
      }
    } catch (error) {
      console.error("Payment error:", error);
      showNotification("Payment failed. Please try again.", "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = "Pay Now";
    }
  });

// Show more services modal
async function showMoreServicesModal() {
  const modal = document.getElementById("moreServicesModal");
  modal.classList.add("show");
  await loadServicesContent("ecommerce");

  // Setup tab switching
  document.querySelectorAll(".services-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".services-tab-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadServicesContent(btn.dataset.category);
    });
  });
}

async function loadServicesContent(category) {
  const container = document.getElementById("servicesContent");

  const services = {
    ecommerce: [
      { name: "Oraimo", icon: "fab fa-shopify", endpoint: "/oraimo" },
      { name: "AliExpress", icon: "fab fa-alipay", endpoint: "/aliexpress" },
      { name: "Jumia", icon: "fas fa-store", endpoint: "/jumia" },
      { name: "Konga", icon: "fas fa-shopping-bag", endpoint: "/konga" },
      { name: "Netflix", icon: "fab fa-netflix", endpoint: "/netflix" },
      { name: "Spotify", icon: "fab fa-spotify", endpoint: "/spotify" },
    ],
    bills: [
      { name: "Airtime", icon: "fas fa-signal", endpoint: "/airtime" },
      { name: "Data", icon: "fas fa-wifi", endpoint: "/data" },
      { name: "Electricity", icon: "fas fa-bolt", endpoint: "/electricity" },
      { name: "TV Subscription", icon: "fas fa-tv", endpoint: "/tv" },
      { name: "Internet", icon: "fas fa-globe", endpoint: "/internet" },
      { name: "Water Bill", icon: "fas fa-tint", endpoint: "/water" },
    ],
    finance: [
      { name: "Harvest Plan", icon: "fas fa-seedling", endpoint: "/harvest" },
      {
        name: "Fixed Savings",
        icon: "fas fa-lock",
        endpoint: "/fixed-savings",
      },
      { name: "SaveBox", icon: "fas fa-box", endpoint: "/savebox" },
      {
        name: "Target Savings",
        icon: "fas fa-bullseye",
        endpoint: "/target-savings",
      },
      {
        name: "Investments",
        icon: "fas fa-chart-line",
        endpoint: "/investments",
      },
    ],
    others: [
      { name: "SMS Alert", icon: "fas fa-sms", endpoint: "/sms" },
      { name: "Email Alert", icon: "fas fa-envelope", endpoint: "/email" },
      {
        name: "Account Statement",
        icon: "fas fa-file-alt",
        endpoint: "/statement",
      },
      { name: "Card Request", icon: "fas fa-credit-card", endpoint: "/card" },
    ],
  };

  const serviceList = services[category] || [];

  container.innerHTML = `
        <div class="services-grid">
            ${serviceList
              .map(
                (service) => `
                <div class="service-item" onclick="handleServiceClick('${category}', '${service.name}')">
                    <div class="service-icon"><i class="${service.icon}"></i></div>
                    <span class="service-name">${service.name}</span>
                </div>
            `,
              )
              .join("")}
        </div>
    `;
}

function handleServiceClick(category, serviceName) {
  closeModal("moreServicesModal");

  if (category === "finance") {
    // Map to savings modal
    const savingsTypeMap = {
      "Harvest Plan": "harvest",
      "Fixed Savings": "fixed",
      SaveBox: "savebox",
      "Target Savings": "target",
    };
    if (savingsTypeMap[serviceName]) {
      showSavingsModal(savingsTypeMap[serviceName]);
    }
  } else {
    // Show payment modal for bills/ecommerce
    showPaymentModal(serviceName.toLowerCase().replace(/ /g, "_"));
  }
}

// ==================== COMPLETE SAVINGS SYSTEM ====================
// Global variable to track if a savings plan exists for the type
let existingSavingsPlans = {
  harvest: null,
  fixed: null,
  savebox: null,
  target: null,
  spare_change: null,
};

// Load existing savings plans data
async function loadExistingSavingsPlans() {
  try {
    const response = await fetch(`${API_BASE_URL}/user/savings`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.log("Failed to load savings plans");
      return;
    }

    const allSavings = await response.json();

    // Reset existing plans
    existingSavingsPlans = {
      harvest: null,
      fixed: null,
      savebox: null,
      target: null,
      spare_change: null,
    };

    // Categorize existing savings
    allSavings.forEach((saving) => {
      const type = saving.type;
      // Only track active or matured plans
      if (saving.status === "active" || saving.status === "matured") {
        existingSavingsPlans[type] = saving;
      }
    });

    console.log("Existing savings plans loaded:", existingSavingsPlans);
  } catch (error) {
    console.error("Error loading existing savings plans:", error);
  }
}

// Show savings modal (start new plan)
async function showSavingsModal(type) {
  // Show loading while checking existing plans
  loadingManager.show("Loading savings options...");

  try {
    await loadExistingSavingsPlans();

    const modal = document.getElementById("savingsModal");
    const title = document.getElementById("savingsModalTitle");
    const harvestPlansList = document.getElementById("harvestPlansList");
    const targetDateGroup = document.getElementById(
      "targetWithdrawalDateGroup",
    );
    const infoText = document.getElementById("savingsInfo");
    const amountInput = document.getElementById("savingsAmount");
    const autoSaveGroup = document.getElementById("autoSaveGroup");
    const autoSaveCheckbox = document.getElementById("autoSaveCheckbox");
    const amountGroup = document.getElementById("amountGroup");
    const formContainer = document.getElementById("savingsForm");

    // Check if user already has this type of savings (except harvest which allows multiple)
    if (type !== "harvest") {
      const existingPlan = existingSavingsPlans[type];

      if (existingPlan && existingPlan.status !== "withdrawn") {
        loadingManager.hide();
        showNotification(
          `You already have an active ${getSavingsTypeName(type)} plan.`,
          "warning",
        );
        closeModal("savingsModal");
        loadSavingsDetails(type, existingPlan.id);
        return;
      }
    }

    // Reset form
    document.getElementById("savingsType").value = type;
    harvestPlansList.style.display = "none";
    targetDateGroup.style.display = "none";

    if (amountGroup) amountGroup.style.display = "block";
    if (amountInput) {
      amountInput.readOnly = false;
      amountInput.value = "";
      amountInput.style.display = "block";
    }

    if (autoSaveGroup) {
      const alwaysAutoSave = ["fixed", "savebox"];
      if (alwaysAutoSave.includes(type)) {
        autoSaveGroup.style.display = "none";
      } else {
        autoSaveGroup.style.display = "block";
      }
    }

    if (autoSaveCheckbox) {
      autoSaveCheckbox.checked = true;
    }

    infoText.innerHTML = "";

    switch (type) {
      case "harvest":
        title.textContent = "Start Harvest Plan";
        harvestPlansList.style.display = "block";
        infoText.innerHTML =
          '<i class="fas fa-info-circle" style="color: #2563eb;"></i> Save daily and receive food items at the end of the plan period. You can have multiple harvest plans!';
        await loadHarvestPlansForUser();
        break;
      case "fixed":
        title.textContent = "Fixed Savings";
        infoText.innerHTML =
          '<i class="fas fa-lock" style="color: #f59e0b;"></i> Your savings will be locked for 30 days. After maturity, you can withdraw freely for 2 days.';
        if (amountInput) {
          amountInput.placeholder = "Enter amount (min ₦100)";
          amountInput.min = 100;
        }
        break;
      case "savebox":
        title.textContent = "SaveBox";
        infoText.innerHTML =
          '<i class="fas fa-box" style="color: #10b981;"></i> Withdraw anytime (4% fee) or wait for target date.';
        if (amountInput) {
          amountInput.placeholder = "Enter amount (min ₦100)";
          amountInput.min = 100;
        }
        break;
      case "target":
        title.textContent = "Target Savings";
        targetDateGroup.style.display = "block";
        infoText.innerHTML =
          '<i class="fas fa-bullseye" style="color: #8b5cf6;"></i> Set a target amount and withdrawal date. Daily auto-savings will begin.';
        if (amountInput) {
          amountInput.placeholder = "Enter target amount";
          amountInput.min = 100;
        }
        const dateInput = document.getElementById("targetWithdrawalDate");
        if (dateInput) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          dateInput.min = tomorrow.toISOString().split("T")[0];
          const defaultDate = new Date();
          defaultDate.setDate(defaultDate.getDate() + 30);
          dateInput.value = defaultDate.toISOString().split("T")[0];
        }
        break;
      case "spare_change":
        title.textContent = "Spare Change Savings";
        infoText.innerHTML =
          '<i class="fas fa-coins" style="color: #f59e0b;"></i> Automatically save 3% of every transfer you make. Withdraw anytime with no fees!';
        if (amountGroup) amountGroup.style.display = "none";
        if (autoSaveGroup) autoSaveGroup.style.display = "none";
        break;
    }

    loadingManager.hide();
    modal.classList.add("show");
  } catch (error) {
    loadingManager.hide();
    console.error("Error loading savings options:", error);
    showNotification("Failed to load savings options", "error");
  }
}

// Check existing plan and warn (with fallback for missing API)
async function checkExistingPlanAndWarn(type) {
  try {
    const response = await fetch(`${API_BASE_URL}/user/savings/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // If API returns 404, it means no savings exist yet (first time)
    if (response.status === 404) {
      console.log(
        "Savings summary API not available yet - assuming no existing plans",
      );
      return; // No existing plans to warn about
    }

    if (!response.ok) {
      console.log("Failed to fetch savings summary, continuing anyway");
      return;
    }

    const summary = await response.json();
    let hasPlan = false;
    let planType = "";

    switch (type) {
      case "fixed":
        hasPlan = summary.active_plans?.fixed !== null;
        planType = "Fixed Savings";
        break;
      case "savebox":
        hasPlan = summary.active_plans?.savebox !== null;
        planType = "SaveBox";
        break;
      case "target":
        hasPlan = summary.active_plans?.target !== null;
        planType = "Target Savings";
        break;
      case "spare_change":
        hasPlan = summary.active_plans?.spare_change !== null;
        planType = "Spare Change Savings";
        break;
    }

    if (hasPlan) {
      showNotification(
        `You already have an active ${planType} plan. Only one ${planType} plan is allowed per user.`,
        "warning",
      );
    }
  } catch (err) {
    // Silently fail - don't block the user from starting savings
    console.log("Could not check existing plans:", err.message);
  }
}

async function loadHarvestPlansForUser() {
  try {
    const response = await fetch(`${API_BASE_URL}/user/harvest-plans`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const plans = await response.json();
      const select = document.getElementById("harvestPlanSelect");
      const amountInput = document.getElementById("savingsAmount");

      if (!select) return;

      select.innerHTML = '<option value="">Choose a plan</option>';
      if (plans && plans.length > 0) {
        plans.forEach((plan) => {
          select.innerHTML += `<option value="${plan.id}" data-daily="${plan.daily_amount}" data-duration="${plan.duration_days}" data-total="${plan.total_amount}">${plan.name} - ₦${plan.daily_amount}/day for ${plan.duration_days} days (Total: ₦${plan.total_amount})</option>`;
        });
      } else {
        select.innerHTML =
          '<option value="">No active harvest plans available</option>';
        if (amountInput) amountInput.readOnly = true;
      }

      select.onchange = () => {
        const option = select.options[select.selectedIndex];
        const dailyAmount = option.dataset?.daily;
        const totalAmount = option.dataset?.total;
        if (dailyAmount && parseFloat(dailyAmount) > 0) {
          if (amountInput) {
            amountInput.value = dailyAmount;
            amountInput.readOnly = true;
          }
          const infoText = document.getElementById("savingsInfo");
          if (infoText && totalAmount) {
            infoText.innerHTML = `<i class="fas fa-info-circle"></i> Total savings: ₦${parseFloat(totalAmount).toLocaleString()} over ${option.dataset.duration} days`;
          }
        } else {
          if (amountInput) {
            amountInput.value = "";
            amountInput.readOnly = false;
          }
        }
      };
    }
  } catch (error) {
    console.error("Error loading harvest plans:", error);
  }
}

// Confirm savings start
document
  .getElementById("confirmSavingsBtn")
  ?.addEventListener("click", async () => {
    const savingsType = document.getElementById("savingsType").value;
    let amount = parseFloat(document.getElementById("savingsAmount").value);
    const harvestPlanId = document.getElementById("harvestPlanSelect")?.value;
    const targetWithdrawalDate = document.getElementById(
      "targetWithdrawalDate",
    )?.value;
    const autoSaveCheckbox = document.getElementById("autoSaveCheckbox");
    const autoSave = autoSaveCheckbox ? autoSaveCheckbox.checked : true;

    // Validate amount (skip for spare_change)
    if (savingsType !== "spare_change") {
      if (isNaN(amount) || amount <= 0) {
        showNotification("Please enter a valid amount", "error");
        return;
      }
    }

    // Validate minimum amounts
    if (savingsType === "fixed" && amount < 100) {
      showNotification("Minimum fixed savings amount is ₦100", "error");
      return;
    }
    if (savingsType === "savebox" && amount < 100) {
      showNotification("Minimum SaveBox amount is ₦100", "error");
      return;
    }
    if (savingsType === "target" && amount < 100) {
      showNotification("Minimum target savings amount is ₦100", "error");
      return;
    }

    if (savingsType === "harvest" && (!harvestPlanId || harvestPlanId === "")) {
      showNotification("Please select a harvest plan", "error");
      return;
    }

    if (
      savingsType === "target" &&
      (!targetWithdrawalDate || targetWithdrawalDate === "")
    ) {
      showNotification("Please select a withdrawal date", "error");
      return;
    }

    // Show loading
    loadingManager.show("Starting your savings plan...");

    try {
      const savingsData = {
        type: savingsType,
        auto_save: autoSave,
      };

      if (savingsType !== "spare_change") {
        savingsData.amount = amount;
      }

      if (savingsType === "harvest") {
        savingsData.plan_id = harvestPlanId;
      }
      if (savingsType === "target") {
        savingsData.target_withdrawal_date = targetWithdrawalDate;
      }

      const response = await fetch(`${API_BASE_URL}/user/savings/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(savingsData),
      });

      const data = await response.json();

      if (response.ok) {
        // Close the savings modal first
        closeModal("savingsModal");

        // Reset form
        document.getElementById("savingsAmount").value = "";
        if (document.getElementById("harvestPlanSelect")) {
          document.getElementById("harvestPlanSelect").value = "";
        }
        if (document.getElementById("targetWithdrawalDate")) {
          document.getElementById("targetWithdrawalDate").value = "";
        }

        // Refresh data in background
        await loadAccounts();
        await loadMySavings();
        await loadExistingSavingsPlans();

        // CRITICAL: Show the details modal BEFORE hiding the loading overlay
        // This ensures smooth transition with no glitch
        if (data.savings && data.savings.id) {
          // First, prepare and show the details modal while overlay is still active
          await prepareAndShowSavingsDetailsModal(savingsType, data.savings.id);
        }

        // NOW hide the loading overlay after modal is visible
        loadingManager.hide();

        // Show success notification after modal is visible
        setTimeout(() => {
          showNotification(
            `${savingsType.charAt(0).toUpperCase() + savingsType.slice(1)} savings started!`,
            "success",
          );
        }, 100);
      } else {
        loadingManager.hide();
        showNotification(data.error || "Failed to start savings", "error");
      }
    } catch (error) {
      console.error("Savings error:", error);
      loadingManager.hide();
      showNotification("Failed to start savings. Please try again.", "error");
    }
  });

// New helper function to prepare and show savings details modal
async function prepareAndShowSavingsDetailsModal(type, id) {
  try {
    const response = await fetch(`${API_BASE_URL}/user/savings/${type}/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error("Failed to load savings details");
    }

    const savings = await response.json();

    // Store the current savings in our tracking
    existingSavingsPlans[type] = savings;

    // Show the modal immediately (overlay is still active)
    showSavingsDetailsModal(savings, type);

    return savings;
  } catch (error) {
    console.error("Prepare savings details error:", error);
    throw error;
  }
}

// Update loadMySavings to refresh existing plans
async function loadMySavings() {
  const container = document.getElementById("mySavingsList");
  if (!container) return;

  try {
    // First load existing plans
    await loadExistingSavingsPlans();

    const response = await fetch(`${API_BASE_URL}/user/savings`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const savings = await response.json();

      if (!savings || savings.length === 0) {
        container.innerHTML =
          '<div class="empty-state" style="text-align: center; padding: 40px; color: #64748b;">No active savings yet. Start saving today!</div>';
        return;
      }

      container.innerHTML = savings
        .map((saving) => {
          let displayAmount = "";
          let displayInfo = "";
          let statusBadge = "";
          let progressPercent = 0;
          let onClickHandler = `onclick="loadSavingsDetails('${saving.type}', '${saving.id}')"`;

          switch (saving.type) {
            case "harvest":
              const totalDays = saving.total_days || 0;
              progressPercent =
                totalDays > 0
                  ? Math.round((saving.days_completed / totalDays) * 100)
                  : 0;
              displayAmount = `₦${(saving.total_saved || 0).toLocaleString()}`;
              displayInfo = `${saving.days_completed || 0}/${totalDays || 0} days • ${progressPercent}% complete`;
              statusBadge = `<span class="status-badge ${saving.auto_save ? "active" : "inactive"}">Auto: ${saving.auto_save ? "ON" : "OFF"}</span>`;
              break;
            case "fixed":
              const maturityDate = new Date(saving.maturity_date);
              const daysUntilMaturity = Math.max(
                0,
                Math.ceil((maturityDate - new Date()) / (1000 * 60 * 60 * 24)),
              );
              const isMatured = maturityDate <= new Date();
              displayAmount = `₦${(saving.current_saved || 0).toLocaleString()} / ₦${(saving.amount || 0).toLocaleString()}`;
              displayInfo = isMatured
                ? "Ready for withdrawal!"
                : `${daysUntilMaturity} days left • ${saving.interest_rate || 5}% APY`;
              statusBadge = `<span class="status-badge ${isMatured ? "success" : "active"}">${isMatured ? "Matured" : "Locked"}</span>`;
              break;
            case "savebox":
              const targetDate = new Date(saving.target_date);
              const daysUntilTarget = Math.max(
                0,
                Math.ceil((targetDate - new Date()) / (1000 * 60 * 60 * 24)),
              );
              displayAmount = `₦${(saving.current_saved || 0).toLocaleString()}`;
              displayInfo = `${daysUntilTarget} days left • ${saving.early_withdrawal_fee_percent || 4}% early fee`;
              statusBadge = `<span class="status-badge active">Auto: ${saving.auto_save ? "ON" : "OFF"}</span>`;
              break;
            case "target":
              const currentSaved = saving.current_saved || 0;
              const targetAmount = saving.target_amount || 0;
              const dailyAmountTarget = saving.daily_savings_amount || 0;
              const totalDaysTarget =
                saving.days_remaining + (saving.days_completed || 0) || 30;
              const daysCompletedTarget =
                dailyAmountTarget > 0
                  ? Math.floor(currentSaved / dailyAmountTarget)
                  : 0;
              progressPercent =
                targetAmount > 0
                  ? Math.min(
                      100,
                      Math.round((currentSaved / targetAmount) * 100),
                    )
                  : 0;
              displayAmount = `₦${currentSaved.toLocaleString()} / ₦${targetAmount.toLocaleString()}`;
              displayInfo = `${progressPercent}% complete • ${daysCompletedTarget} of ${totalDaysTarget} days completed`;
              statusBadge = `<span class="status-badge active">Auto: ${saving.auto_save ? "ON" : "OFF"}</span>`;
              break;
            case "spare_change":
              displayAmount = `₦${(saving.current_saved || 0).toLocaleString()}`;
              displayInfo = `Total saved: ₦${(saving.total_saved || 0).toLocaleString()} • No fees!`;
              statusBadge = `<span class="status-badge active">Auto: ${saving.auto_save ? "ON" : "OFF"}</span>`;
              break;
          }

          // For spare change, show the percentage rate prominently
          if (saving.type === "spare_change") {
            const percentageRate = saving.percentage_rate || 3;
            displayAmount = `₦${(saving.current_saved || 0).toLocaleString()}`;
            displayInfo = `${percentageRate}% of every transfer • Total: ₦${(saving.total_saved || 0).toLocaleString()}`;
            statusBadge = `<span class="status-badge ${saving.auto_save ? "active" : "inactive"}">Auto: ${saving.auto_save ? "ON (${percentageRate}%)" : "OFF"}</span>`;
          }

          return `
                        <div class="savings-item" style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: white; border-radius: 12px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); cursor: pointer;" ${onClickHandler}>
                            <div class="savings-info" style="flex: 1;">
                                <h4 style="margin-bottom: 4px; font-size: 14px; font-weight: 600;">
                                    ${getSavingsTypeName(saving.type)}
                                    ${statusBadge}
                                </h4>
                                <p style="font-size: 12px; color: #64748b; margin: 0;">${displayInfo}</p>
                                ${progressPercent > 0 ? `<div class="progress-bar" style="margin-top: 8px; height: 4px;"><div class="progress" style="width: ${progressPercent}%; height: 4px; background: #10b981; border-radius: 2px;"></div></div>` : ""}
                            </div>
                            <div class="savings-amount" style="font-weight: 700; color: #10b981; text-align: right;">
                                ${displayAmount}
                                <i class="fas fa-chevron-right" style="font-size: 12px; color: #94a3b8; margin-left: 8px;"></i>
                            </div>
                        </div>
                    `;
        })
        .join("");
    }
  } catch (error) {
    console.error("Error loading savings:", error);
    container.innerHTML =
      '<div class="empty-state" style="text-align: center; padding: 40px; color: #ef4444;">Error loading savings. Please refresh.</div>';
  }
}

function getSavingsTypeName(type) {
  const types = {
    harvest: "🌱 Harvest Plan",
    fixed: "🔒 Fixed Savings",
    savebox: "📦 SaveBox",
    target: "🎯 Target Savings",
    spare_change: "💰 Spare Change",
  };
  return types[type] || type;
}

// Load savings details and show appropriate modal based on status - IMPROVED VERSION
/*async function loadSavingsDetails(type, id) {
  // Show loading
  loadingManager.show("Loading savings details...");

  try {
    const response = await fetch(`${API_BASE_URL}/user/savings/${type}/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = await response.json();
      loadingManager.hide();
      showNotification(
        error.error || "Failed to load savings details",
        "error",
      );
      return;
    }

    const savings = await response.json();

    // Hide loading BEFORE showing modal
    loadingManager.hide();

    // Store the current savings in our tracking
    existingSavingsPlans[type] = savings;

    // Show appropriate modal based on type and status
    showSavingsDetailsModal(savings, type);
  } catch (error) {
    console.error("Load savings details error:", error);
    loadingManager.hide();
    showNotification("Failed to load savings details", "error");
  }
}*/

// Load savings details and show appropriate modal based on status
async function loadSavingsDetails(type, id) {
  // Only show loading if this is called independently (not from create flow)
  const isFromCreate = document.querySelector("#savingsDetailsModal") !== null;

  if (!isFromCreate) {
    loadingManager.show("Loading savings details...");
  }

  try {
    const response = await fetch(`${API_BASE_URL}/user/savings/${type}/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = await response.json();
      if (!isFromCreate) loadingManager.hide();
      showNotification(
        error.error || "Failed to load savings details",
        "error",
      );
      return;
    }

    const savings = await response.json();

    if (!isFromCreate) {
      loadingManager.hide();
    }

    // Store the current savings in our tracking
    existingSavingsPlans[type] = savings;

    // Show appropriate modal based on type and status
    showSavingsDetailsModal(savings, type);
  } catch (error) {
    console.error("Load savings details error:", error);
    if (!isFromCreate) loadingManager.hide();
    showNotification("Failed to load savings details", "error");
  }
}

// Show appropriate modal based on savings status - FULLY FIXED
function showSavingsDetailsModal(savings, type) {
  let existingModal = document.getElementById("savingsDetailsModal");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div");
  modal.className = "modal show";
  modal.id = "savingsDetailsModal";

  let modalContent = "";

  switch (type) {
    case "fixed":
      modalContent = getFixedSavingsModal(savings);
      break;
    case "savebox":
      modalContent = getSaveboxSavingsModal(savings);
      break;
    case "target":
      modalContent = getTargetSavingsModal(savings);
      break;
    case "harvest":
      modalContent = getHarvestSavingsModal(savings);
      break;
    case "spare_change":
      modalContent = getSpareChangeModal(savings);
      break;
  }

  modal.innerHTML = modalContent;
  document.body.appendChild(modal);

  // Add close handler
  const closeBtn = modal.querySelector(".close-modal");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => modal.remove());
  }

  // Add click outside to close
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

// FIXED: Fixed Savings Modal - Shows correct modal based on status
function getFixedSavingsModal(savings) {
  const today = new Date();
  const maturityDate = new Date(savings.maturity_date);
  const isMatured = maturityDate <= today;
  const freeWithdrawalDate = savings.next_free_withdrawal_date
    ? new Date(savings.next_free_withdrawal_date)
    : null;
  const isFreeWithdrawal =
    isMatured && freeWithdrawalDate && today <= freeWithdrawalDate;

  // FIXED: Calculate interest based on total saved amount
  const totalSaved = savings.current_saved || 0;
  const interestEarned = totalSaved * (savings.interest_rate / 100);
  const totalWithInterest = totalSaved + interestEarned;

  // Calculate days completed (if daily_amount exists)
  const dailyAmount = savings.daily_amount || savings.amount / 30;
  const daysCompleted = Math.floor(totalSaved / dailyAmount);
  const totalDays = 30;

  if (isMatured) {
    // WITHDRAWAL MODAL - Show when matured
    return `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>✅ Fixed Savings - Ready for Withdrawal</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="background: #d1fae5; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-check-circle" style="font-size: 48px; color: #10b981;"></i>
                        <h3 style="margin: 10px 0;">Savings Matured!</h3>
                        <p>Your fixed savings is now available for withdrawal.</p>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <p><strong>Daily Savings Amount:</strong> ₦${dailyAmount.toLocaleString()}</p>
                        <p><strong>Days Completed:</strong> ${daysCompleted} of ${totalDays}</p>
                        <p><strong>Amount Saved:</strong> ₦${totalSaved.toLocaleString()}</p>
                        <p><strong>Interest Earned:</strong> ₦${interestEarned.toLocaleString()}</p>
                        <p><strong>Total Available:</strong> <span style="font-size: 24px; color: #10b981;">₦${totalWithInterest.toLocaleString()}</span></p>
                        ${isFreeWithdrawal ? '<p class="success" style="color: #10b981;">✓ Free withdrawal available today!</p>' : '<p class="warning" style="color: #f59e0b;">⚠️ Fee may apply after free period</p>'}
                    </div>
                    <div class="savings-actions">
                        <button class="btn btn-success" style="width: 100%;" onclick="withdrawFromSavings('fixed', '${savings.id}')">
                            <i class="fas fa-money-bill-wave"></i> Withdraw ₦${totalWithInterest.toLocaleString()}
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;
  } else {
    // COUNTDOWN MODAL - Show while active
    const daysUntilMaturity = Math.max(
      0,
      Math.ceil((maturityDate - today) / (1000 * 60 * 60 * 24)),
    );
    const progressPercent = (totalSaved / (dailyAmount * totalDays)) * 100;

    return `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>🔒 Fixed Savings - Active</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="background: #fef3c7; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-lock" style="font-size: 48px; color: #f59e0b;"></i>
                        <h3>Locked until maturity</h3>
                        <div class="countdown-value" style="font-size: 32px; font-weight: 700; margin: 10px 0;">${daysUntilMaturity} days remaining</div>
                        <div class="progress-bar" style="margin: 10px 0;"><div class="progress" style="width: ${Math.min(100, progressPercent)}%; background: #f59e0b;"></div></div>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <p><strong>Daily Savings:</strong> ₦${dailyAmount.toLocaleString()}/day</p>
                        <p><strong>Saved so far:</strong> ₦${totalSaved.toLocaleString()}</p>
                        <p><strong>Days Completed:</strong> ${daysCompleted} of ${totalDays}</p>
                        <p><strong>Target Total:</strong> ₦${(dailyAmount * totalDays).toLocaleString()}</p>
                        <p><strong>Maturity date:</strong> ${new Date(savings.maturity_date).toLocaleDateString()}</p>
                        <p><strong>Interest at maturity:</strong> ₦${interestEarned.toLocaleString()} (${savings.interest_rate}%)</p>
                    </div>
                    <div class="savings-actions">
                        <label class="checkbox" style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                            <input type="checkbox" ${savings.auto_save ? "checked" : ""} onchange="toggleAutoSave('fixed', '${savings.id}', ${savings.auto_save})">
                            <span>Auto-save daily (₦${dailyAmount.toLocaleString()}/day)</span>
                        </label>
                        <button class="btn btn-warning" style="width: 100%;" onclick="cancelSavingsPlan('fixed', '${savings.id}')">
                            <i class="fas fa-stop"></i> Cancel Plan (Keep Saved Money)
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;
  }
}

// FIXED: Savebox Savings Modal
function getSaveboxSavingsModal(savings) {
  const today = new Date();
  const targetDate = new Date(savings.target_date);
  const daysUntilTarget = Math.max(
    0,
    Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24)),
  );
  const earlyFee = savings.early_withdrawal_fee_percent || 4;
  const withdrawalAmount = savings.current_saved || 0;
  const feeAmount = withdrawalAmount * (earlyFee / 100);
  const isTargetReached = daysUntilTarget === 0;

  if (isTargetReached || withdrawalAmount >= savings.amount) {
    // Target reached - show withdrawal modal
    return `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>📦 SaveBox - Target Reached!</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="background: #d1fae5; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-gift" style="font-size: 48px; color: #10b981;"></i>
                        <h3 style="margin: 10px 0;">Congratulations!</h3>
                        <p>You've reached your SaveBox target!</p>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <p><strong>Amount Saved:</strong> ₦${withdrawalAmount.toLocaleString()}</p>
                        <p><strong>Withdrawal:</strong> No fee (target reached!)</p>
                        <p><strong>Total to withdraw:</strong> <span style="font-size: 24px; color: #10b981;">₦${withdrawalAmount.toLocaleString()}</span></p>
                    </div>
                    <button class="btn btn-success" style="width: 100%;" onclick="withdrawFromSavings('savebox', '${savings.id}')">
                        <i class="fas fa-money-bill-wave"></i> Withdraw Now
                    </button>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;
  } else {
    // Active - show with withdrawal option
    const progressPercent = (withdrawalAmount / (savings.amount || 1)) * 100;

    return `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>📦 SaveBox - Active</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="background: #e0f2fe; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-box" style="font-size: 48px; color: #0ea5e9;"></i>
                        <div class="countdown-value" style="font-size: 24px; font-weight: 700; margin: 10px 0;">${daysUntilTarget} days until target</div>
                        <div class="progress-bar" style="margin: 10px 0;"><div class="progress" style="width: ${progressPercent}%; background: #0ea5e9;"></div></div>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <p><strong>Target:</strong> ₦${(savings.amount || 0).toLocaleString()}</p>
                        <p><strong>Saved:</strong> ₦${withdrawalAmount.toLocaleString()}</p>
                        <p><strong>Daily auto-save:</strong> ₦${(savings.daily_amount || savings.amount / 90).toFixed(2)}/day</p>
                        ${
                          withdrawalAmount > 0
                            ? `<p class="warning" style="color: #f59e0b;">⚠️ Early withdrawal fee: ${earlyFee}% (₦${feeAmount.toLocaleString()})</p>
                        <p>After fee: ₦${(withdrawalAmount - feeAmount).toLocaleString()}</p>`
                            : ""
                        }
                    </div>
                    <div class="savings-actions">
                        <label class="checkbox" style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                            <input type="checkbox" ${savings.auto_save ? "checked" : ""} onchange="toggleAutoSave('savebox', '${savings.id}', ${savings.auto_save})">
                            <span>Auto-save daily</span>
                        </label>
                        ${
                          withdrawalAmount > 0
                            ? `
                        <button class="btn btn-primary" style="width: 100%; margin-bottom: 10px;" onclick="withdrawFromSavings('savebox', '${savings.id}')">
                            <i class="fas fa-download"></i> Withdraw Now (${earlyFee}% fee)
                        </button>`
                            : ""
                        }
                        <button class="btn btn-outline" style="width: 100%;" onclick="cancelSavingsPlan('savebox', '${savings.id}')">
                            <i class="fas fa-stop"></i> Stop Auto-Save Only
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;
  }
}

// FIXED: Target Savings Modal
function getTargetSavingsModal(savings) {
  const today = new Date();
  const withdrawalDate = new Date(savings.withdrawal_date);
  const isTargetMet = savings.current_saved >= savings.target_amount;
  const canWithdraw = isTargetMet || withdrawalDate <= today;
  const percentComplete =
    savings.target_amount > 0
      ? Math.min(100, (savings.current_saved / savings.target_amount) * 100)
      : 0;
  const daysUntilWithdrawal = Math.max(
    0,
    Math.ceil((withdrawalDate - today) / (1000 * 60 * 60 * 24)),
  );

  // Calculate days completed based on current_saved / daily_amount
  const dailyAmount = savings.daily_savings_amount || 0;
  const daysCompleted =
    dailyAmount > 0
      ? Math.floor((savings.current_saved || 0) / dailyAmount)
      : 0;
  const totalDays =
    Math.ceil((savings.target_amount || 0) / dailyAmount) ||
    savings.days_remaining + daysCompleted ||
    30;
  const remainingToSave =
    (savings.target_amount || 0) - (savings.current_saved || 0);

  if ((canWithdraw || isTargetMet) && savings.current_saved > 0) {
    // Target reached - withdrawal modal
    return `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>🎯 Target Savings - Goal Reached!</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div style="background: #d1fae5; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
            <i class="fas fa-trophy" style="font-size: 48px; color: #10b981;"></i>
            <h3 style="margin: 10px 0;">Congratulations!</h3>
            <p>You've reached your savings goal!</p>
          </div>
          <div style="margin-bottom: 20px;">
            <p><strong>Daily Savings Amount:</strong> ₦${dailyAmount.toLocaleString()}/day</p>
            <p><strong>Days Completed:</strong> ${daysCompleted} of ${totalDays}</p>
            <p><strong>Target Amount:</strong> ₦${(savings.target_amount || 0).toLocaleString()}</p>
            <p><strong>Amount Saved:</strong> ₦${(savings.current_saved || 0).toLocaleString()}</p>
            <p><strong>Ready for withdrawal:</strong> <span style="font-size: 24px; color: #10b981;">₦${(savings.current_saved || 0).toLocaleString()}</span></p>
          </div>
          <button class="btn btn-success" style="width: 100%;" onclick="withdrawFromSavings('target', '${savings.id}')">
            <i class="fas fa-money-bill-wave"></i> Withdraw Now
          </button>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Close</button>
        </div>
      </div>
    `;
  } else {
    // Active - countdown modal
    return `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>🎯 Target Savings - Active</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div style="background: #fef3c7; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
            <i class="fas fa-bullseye" style="font-size: 48px; color: #f59e0b;"></i>
            <div class="countdown-value" style="font-size: 32px; font-weight: 700; margin: 10px 0;">${percentComplete.toFixed(1)}% Complete</div>
            <div class="progress-bar" style="margin: 10px 0;"><div class="progress" style="width: ${percentComplete}%; background: #f59e0b;"></div></div>
            <p>${daysUntilWithdrawal} days remaining until withdrawal date</p>
          </div>
          <div style="margin-bottom: 20px;">
            <p><strong>Daily Savings Amount:</strong> ₦${dailyAmount.toLocaleString()}/day</p>
            <p><strong>Days Completed:</strong> ${daysCompleted} of ${totalDays}</p>
            <p><strong>Target Total:</strong> ₦${(savings.target_amount || 0).toLocaleString()}</p>
            <p><strong>Saved so far:</strong> ₦${(savings.current_saved || 0).toLocaleString()}</p>
            <p><strong>Remaining to save:</strong> ₦${remainingToSave.toLocaleString()}</p>
            <p><strong>Withdrawal date:</strong> ${new Date(savings.withdrawal_date).toLocaleDateString()}</p>
          </div>
          <div class="savings-actions">
            <label class="checkbox" style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
              <input type="checkbox" ${savings.auto_save ? "checked" : ""} onchange="toggleAutoSave('target', '${savings.id}', ${savings.auto_save})">
              <span>Auto-save daily (₦${dailyAmount.toLocaleString()}/day)</span>
            </label>
            <button class="btn btn-warning" style="width: 100%;" onclick="cancelSavingsPlan('target', '${savings.id}')">
              <i class="fas fa-stop"></i> Cancel Plan
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Close</button>
        </div>
      </div>
    `;
  }
}

// FIXED: Harvest Savings Modal
function getHarvestSavingsModal(savings) {
  const today = new Date();
  const totalDays =
    savings.total_days ||
    savings.duration_days ||
    savings.harvest_plans?.duration_days ||
    0;
  const daysCompleted = savings.days_completed || 0;
  const harvestProgress =
    totalDays > 0 ? Math.round((daysCompleted / totalDays) * 100) : 0;
  const isCompleted = savings.status === "completed";

  if (isCompleted) {
    return `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>🌱 Harvest Plan - Completed!</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div style="background: #d1fae5; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
            <i class="fas fa-seedling" style="font-size: 48px; color: #10b981;"></i>
            <h3>Congratulations!</h3>
            <p>You've completed your Harvest Plan!</p>
          </div>
          <div style="margin-bottom: 20px;">
            <p><strong>Plan:</strong> ${savings.plan_name || "Harvest Plan"}</p>
            <p><strong>Total Saved:</strong> ₦${(savings.total_saved || 0).toLocaleString()}</p>
            <p><strong>Days Completed:</strong> ${daysCompleted} of ${totalDays}</p>
            ${savings.reward_items ? `<p><strong>Rewards:</strong> ${JSON.parse(savings.reward_items).join(", ")}</p>` : ""}
          </div>
          <p style="text-align: center; color: #64748b; margin-top: 10px;">
            <i class="fas fa-info-circle"></i> Your funds remain in your harvest account. Contact support for any withdrawal needs.
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Close</button>
        </div>
      </div>
    `;
  } else {
    return `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>🌱 Harvest Plan - Active</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div style="background: #f0fdf4; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
            <div class="countdown-value" style="font-size: 24px; font-weight: 700;">${harvestProgress}% Complete</div>
            <div class="progress-bar" style="margin: 10px 0;"><div class="progress" style="width: ${harvestProgress}%; background: #10b981;"></div></div>
            <p>Day ${daysCompleted} of ${totalDays}</p>
          </div>
          <div style="margin-bottom: 20px;">
            <p><strong>Plan:</strong> ${savings.plan_name || "Harvest Plan"}</p>
            <p><strong>Total Saved:</strong> ₦${(savings.total_saved || 0).toLocaleString()}</p>
            <p><strong>Daily Amount:</strong> ₦${(savings.daily_amount || 0).toLocaleString()}</p>
            ${savings.reward_items ? `<p><strong>Rewards at completion:</strong> ${JSON.parse(savings.reward_items).join(", ")}</p>` : ""}
          </div>
          <div class="savings-actions">
            <label class="checkbox" style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
              <input type="checkbox" ${savings.auto_save ? "checked" : ""} onchange="toggleAutoSave('harvest', '${savings.id}', ${savings.auto_save})">
              <span>Auto-save daily (₦${(savings.daily_amount || 0).toLocaleString()}/day)</span>
            </label>
            <button class="btn btn-warning" style="width: 100%;" onclick="requestHarvestWithdrawal('${savings.id}', '${savings.plan_name || "Harvest Plan"}', ${savings.total_saved || 0})">
              <i class="fas fa-question-circle"></i> Request Withdrawal (Admin Approval)
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Close</button>
        </div>
      </div>
    `;
  }
}

// Request harvest plan withdrawal (requires admin approval)
async function requestHarvestWithdrawal(savingsId, planName, amount) {
  if (
    !confirm(
      `Request withdrawal from ${planName}?\n\nAmount: ₦${amount.toLocaleString()}\n\nYour request will be reviewed by an admin. Withdrawal is only allowed in special circumstances.\n\nContinue?`,
    )
  ) {
    return;
  }

  const reason = prompt(
    "Please explain why you need to withdraw from this Harvest Plan:",
    "",
  );

  if (reason === null) return;

  if (!reason || reason.trim().length < 10) {
    showNotification(
      "Please provide a detailed reason for withdrawal request",
      "error",
    );
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/user/savings/harvest/${savingsId}/request-withdrawal`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: reason.trim() }),
      },
    );

    const data = await response.json();

    if (response.ok) {
      showNotification(data.message, "success");
      // Refresh savings list
      await loadMySavings();
      // Close the modal
      const modal = document.getElementById("savingsDetailsModal");
      if (modal) modal.remove();
    } else {
      showNotification(
        data.error || "Failed to submit withdrawal request",
        "error",
      );
    }
  } catch (error) {
    console.error("Withdrawal request error:", error);
    showNotification("Failed to submit withdrawal request", "error");
  }
}

// Make function globally available
window.requestHarvestWithdrawal = requestHarvestWithdrawal;

function getSpareChangeModal(savings) {
  return `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>💰 Spare Change Savings</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div style="background: #e0e7ff; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
                    <i class="fas fa-coins" style="font-size: 48px; color: #6366f1;"></i>
                    <div class="countdown-value" style="font-size: 32px; font-weight: 700; margin: 10px 0;">₦${(savings.current_saved || 0).toLocaleString()}</div>
                    <p>${savings.percentage_rate || 3}% of every transfer you make</p>
                </div>
                <div style="margin-bottom: 20px;">
                    <p><strong>Total saved to date:</strong> ₦${(savings.total_saved || 0).toLocaleString()}</p>
                    <p><strong>No withdrawal fees!</strong> Withdraw anytime.</p>
                </div>
                <div class="savings-actions">
                    <label class="checkbox" style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <input type="checkbox" ${savings.auto_save ? "checked" : ""} onchange="toggleAutoSave('spare_change', '${savings.id}', ${savings.auto_save})">
                        <span>Auto-save ${savings.percentage_rate || 3}% of transfers</span>
                    </label>
                    ${
                      (savings.current_saved || 0) > 0
                        ? `
                    <button class="btn btn-success" style="width: 100%;" onclick="withdrawFromSavings('spare_change', '${savings.id}')">
                        <i class="fas fa-money-bill-wave"></i> Withdraw ₦${(savings.current_saved || 0).toLocaleString()}
                    </button>`
                        : `
                    <p style="text-align: center; color: #64748b;">No funds to withdraw yet. Make transfers to start saving!</p>`
                    }
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Close</button>
            </div>
        </div>
    `;
}

// Update the toggleAutoSave function for spare_change to allow percentage adjustment
/*async function toggleAutoSave(type, id, currentState) {
  let additionalData = {};

  // For spare change, allow percentage adjustment
  if (type === "spare_change") {
    let newPercentage = null;
    if (!currentState) {
      // If turning ON, ask for percentage
      newPercentage = prompt("Enter spare change percentage (1-10%):", "3");
      if (newPercentage === null) return; // User cancelled
      newPercentage = parseInt(newPercentage);
      if (isNaN(newPercentage) || newPercentage < 1 || newPercentage > 10) {
        showNotification(
          "Please enter a valid percentage between 1 and 10",
          "error",
        );
        return;
      }
      additionalData = { percentage_rate: newPercentage };
    }
    currentState = false; // Always toggle to true when setting percentage
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/user/savings/${type}/${id}/toggle-auto`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auto_save: !currentState,
          ...additionalData,
        }),
      },
    );

    const data = await response.json();

    if (response.ok) {
      showNotification(data.message, "success");
      await loadMySavings();

      // Refresh the modal if open
      const modal = document.getElementById("savingsDetailsModal");
      if (modal && modal.classList.contains("show")) {
        await loadSavingsDetails(type, id);
      }
    } else {
      showNotification(data.error || "Failed to toggle auto-save", "error");
    }
  } catch (error) {
    console.error("Toggle auto-save error:", error);
    showNotification("Failed to toggle auto-save", "error");
  }
}*/

async function toggleAutoSave(type, id, currentState) {
  let additionalData = {};

  // For spare change, allow percentage adjustment
  if (type === "spare_change" && !currentState) {
    const percentage = await showNumberInputModal({
      title: "Set Spare Change Percentage",
      message: "Enter spare change percentage (1-10%):",
      defaultValue: "3",
      min: 1,
      max: 10,
    });

    if (percentage === null) return;
    additionalData = { percentage_rate: percentage };
    currentState = false;
  }

  const action = !currentState ? "enable" : "disable";

  // Show confirmation modal - it will automatically be on top
  const confirmed = await confirmAction({
    title: `${action === "enable" ? "Enable" : "Disable"} Auto-Save`,
    message: `Are you sure you want to ${action} auto-save for this savings plan?`,
    type: "info",
    confirmText: `Yes, ${action} Auto-Save`,
  });

  if (!confirmed) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/user/savings/${type}/${id}/toggle-auto`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auto_save: !currentState,
          ...additionalData,
        }),
      },
    );

    const data = await response.json();

    if (response.ok) {
      showToast(data.message, "success");
      await loadMySavings();

      const modal = document.getElementById("savingsDetailsModal");
      if (modal && modal.classList.contains("show")) {
        await loadSavingsDetails(type, id);
      }
    } else {
      showToast(data.error || "Failed to toggle auto-save", "error");
    }
  } catch (error) {
    console.error("Toggle auto-save error:", error);
    showToast("Failed to toggle auto-save", "error");
  }
}

// Withdraw from savings
/*async function withdrawFromSavings(type, id) {
  let message = "Are you sure you want to withdraw your savings?";
  if (type === "savebox") {
    message =
      "⚠️ Early withdrawal may incur a fee. Are you sure you want to withdraw now?";
  }

  const confirmed = await confirmAction({
    title: "Withdraw Savings",
    message: message,
    type: "warning",
    confirmText: "Yes, Withdraw",
  });

  if (!confirmed) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/user/savings/${type}/${id}/withdraw`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();

    if (response.ok) {
      showToast(data.message, "success");
      document
        .querySelectorAll(".modal.show")
        .forEach((modal) => modal.classList.remove("show"));
      await loadMySavings();
      await loadAccounts();
    } else {
      showToast(data.error || "Withdrawal failed", "error");
    }
  } catch (error) {
    console.error("Withdrawal error:", error);
    showToast("Failed to process withdrawal", "error");
  }
}*/

async function withdrawFromSavings(type, id) {
  let message = "Are you sure you want to withdraw your savings?";
  if (type === "savebox") {
    message =
      "⚠️ Early withdrawal may incur a fee. Are you sure you want to withdraw now?";
  }

  const confirmed = await confirmAction({
    title: "Withdraw Savings",
    message: message,
    type: "warning",
    confirmText: "Yes, Withdraw",
  });

  if (!confirmed) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/user/savings/${type}/${id}/withdraw`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();

    if (response.ok) {
      showToast(data.message, "success");
      // Close all modals properly
      document.querySelectorAll(".modal.show").forEach((modal) => {
        if (modal.id !== "confirmationModal") {
          modal.classList.remove("show");
        }
      });
      await loadMySavings();
      await loadAccounts();
    } else {
      showToast(data.error || "Withdrawal failed", "error");
    }
  } catch (error) {
    console.error("Withdrawal error:", error);
    showToast("Failed to process withdrawal", "error");
  }
}

// Cancel savings plan
/*async function cancelSavingsPlan(type, id) {
  const confirmed = await confirmAction({
    title: "Cancel Savings Plan",
    message:
      "Cancelling this savings plan will stop all future auto-deductions. Your saved funds will remain available for withdrawal. Continue?",
    type: "warning",
    confirmText: "Yes, Cancel Plan",
  });

  if (!confirmed) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/user/savings/${type}/${id}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();

    if (response.ok) {
      showToast(data.message, "success");
      await loadMySavings();
      const modal = document.getElementById("savingsDetailsModal");
      if (modal) modal.classList.remove("show");
    } else {
      showToast(data.error || "Failed to cancel plan", "error");
    }
  } catch (error) {
    console.error("Cancel error:", error);
    showToast("Failed to cancel savings plan", "error");
  }
}*/

async function cancelSavingsPlan(type, id) {
  const confirmed = await confirmAction({
    title: "Cancel Savings Plan",
    message:
      "Cancelling this savings plan will stop all future auto-deductions. Your saved funds will remain available for withdrawal. Continue?",
    type: "warning",
    confirmText: "Yes, Cancel Plan",
  });

  if (!confirmed) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/user/savings/${type}/${id}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();

    if (response.ok) {
      showToast(data.message, "success");
      await loadMySavings();
      // Close the savings details modal after cancellation
      const savingsModal = document.getElementById("savingsDetailsModal");
      if (savingsModal && savingsModal.classList.contains("show")) {
        savingsModal.classList.remove("show");
      }
    } else {
      showToast(data.error || "Failed to cancel plan", "error");
    }
  } catch (error) {
    console.error("Cancel error:", error);
    showToast("Failed to cancel savings plan", "error");
  }
}

// Make functions globally available
window.showSavingsModal = showSavingsModal;
window.loadSavingsDetails = loadSavingsDetails;
window.toggleAutoSave = toggleAutoSave;
window.withdrawFromSavings = withdrawFromSavings;
window.cancelSavingsPlan = cancelSavingsPlan;

async function showNumberInputModal(options) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "modal show";
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h3>${options.title}</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <p>${options.message}</p>
          <input type="number" id="numberInputValue" class="form-control" 
                 value="${options.defaultValue || ""}" 
                 min="${options.min || 1}" 
                 max="${options.max || 100}"
                 step="${options.step || 1}"
                 autofocus>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="numberInputCancel">Cancel</button>
          <button class="btn btn-primary" id="numberInputConfirm">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector("#numberInputValue");
    const confirmBtn = modal.querySelector("#numberInputConfirm");
    const cancelBtn = modal.querySelector("#numberInputCancel");
    const closeBtn = modal.querySelector(".close-modal");

    const cleanup = () => modal.remove();

    confirmBtn.onclick = () => {
      const value = parseInt(input.value);
      if (isNaN(value)) {
        showToast("Please enter a valid number", "error");
        return;
      }
      if (options.min && value < options.min) {
        showToast(`Value must be at least ${options.min}`, "error");
        return;
      }
      if (options.max && value > options.max) {
        showToast(`Value must be at most ${options.max}`, "error");
        return;
      }
      cleanup();
      resolve(value);
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };

    closeBtn.onclick = () => {
      cleanup();
      resolve(null);
    };

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(null);
      }
    });

    input.focus();
    input.select();
  });
}

// Update bottom navigation
function initBottomNav() {
  const bottomNavItems = document.querySelectorAll(".bottom-nav-item");
  bottomNavItems.forEach((item) => {
    item.addEventListener("click", () => {
      const page = item.dataset.page;
      switchToPage(page);

      bottomNavItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");
    });
  });
}

// Override switchToPage to update bottom nav
const originalSwitchToPage = window.switchToPage;
window.switchToPage = function (page) {
  if (originalSwitchToPage) originalSwitchToPage(page);

  // Update bottom nav
  document.querySelectorAll(".bottom-nav-item").forEach((item) => {
    if (item.dataset.page === page) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
};

// Close modal helper
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("show");
}

// Real-time updates
/*function startRealTimeUpdates() {
  // update account balance every 10 seconds
  setInterval(async () => {
    if (document.visibilityState === "visible") {
      updateTotalBalance();
      await loadAccounts();
    }
  }, 12000);
  // Update transactions every 30 seconds
  setInterval(async () => {
    if (document.visibilityState === "visible") {
      await loadTransactions();
    }
  }, 30000);

  // Update notifications every 15 seconds
  setInterval(async () => {
    if (document.visibilityState === "visible") {
      await loadNotifications();
    }
  }, 15000);

  setInterval(async () => {
    if (document.visibilityState === "visible") {
      await loadLiveChat();
    }
  }, 12000);
}*/

// ==================== OPTIMIZED REAL-TIME UPDATES ====================

// Track last update times to prevent unnecessary refreshes
let lastUpdateTimes = {
  accounts: 0,
  transactions: 0,
  notifications: 0,
  savings: 0,
};

// Update intervals (increased significantly)
const UPDATE_INTERVALS = {
  accounts: 60000, // 60 seconds (was 12s)
  transactions: 120000, // 2 minutes (was 30s)
  notifications: 45000, // 45 seconds (was 15s)
  savings: 90000, // 90 seconds
};

// Use requestIdleCallback for non-critical updates
function scheduleIdleUpdate(callback, timeout = 2000) {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => callback(), { timeout });
  } else {
    setTimeout(callback, 100);
  }
}

// Optimized refresh function - only updates what's visible
async function refreshVisibleData() {
  const activePage =
    document.querySelector(".page.active")?.id || "page-overview";
  const now = Date.now();

  switch (activePage) {
    case "page-overview":
      // Only update transactions if they're old
      if (now - lastUpdateTimes.transactions > UPDATE_INTERVALS.transactions) {
        scheduleIdleUpdate(async () => {
          await loadTransactions();
          lastUpdateTimes.transactions = Date.now();
        });
      }
      // Update balance if needed
      if (now - lastUpdateTimes.accounts > UPDATE_INTERVALS.accounts) {
        scheduleIdleUpdate(updateTotalBalance);
        lastUpdateTimes.accounts = Date.now();
      }
      break;

    case "page-transactions":
      if (now - lastUpdateTimes.transactions > UPDATE_INTERVALS.transactions) {
        await loadFullTransactions(currentTransPage);
        lastUpdateTimes.transactions = Date.now();
      }
      break;

    case "page-accounts":
      if (now - lastUpdateTimes.accounts > UPDATE_INTERVALS.accounts) {
        await loadAccounts();
        lastUpdateTimes.accounts = Date.now();
      }
      break;
  }

  // Always update notifications less frequently
  if (now - lastUpdateTimes.notifications > UPDATE_INTERVALS.notifications) {
    scheduleIdleUpdate(async () => {
      await loadNotifications();
      lastUpdateTimes.notifications = Date.now();
    });
  }
}

// Start optimized real-time updates
function startOptimizedRealTimeUpdates() {
  // Use requestAnimationFrame for smooth UI
  let lastFrameTime = 0;

  function updateLoop(timestamp) {
    if (document.visibilityState === "visible") {
      refreshVisibleData();
    }
    requestAnimationFrame(updateLoop);
  }

  requestAnimationFrame(updateLoop);

  // Also use Page Visibility API to stop updates when tab is hidden
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      console.log("Tab hidden - reducing updates");
    } else {
      console.log("Tab visible - resuming updates");
      refreshVisibleData(); // Immediate refresh when tab becomes visible
    }
  });
}

// Update date and time
function updateDateTime() {
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

// Time ago formatter
function timeAgo(date) {
  const now = new Date();
  const past = new Date(date);
  const seconds = Math.floor((now - past) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? "" : "s"} ago`;
    }
  }

  return "just now";
}

function updateTransferDisplay() {
  const amountInput = document.getElementById("amount");
  if (amountInput && amountInput.placeholder === "0.00") {
    amountInput.placeholder = "0.00";
  }

  // Update currency indicator
  const currencySpan = document.querySelector(".currency-input span");
  if (currencySpan) {
    currencySpan.textContent = "₦";
  }
}

// Toggle balance visibility
let balanceVisible = true;
document.getElementById("toggleBalance")?.addEventListener("click", () => {
  const balanceElement = document.getElementById("totalBalance");
  if (balanceVisible) {
    balanceElement.textContent = "••••••";
    document
      .getElementById("toggleBalance")
      .classList.replace("fa-eye", "fa-eye-slash");
  } else {
    updateTotalBalance();
    document
      .getElementById("toggleBalance")
      .classList.replace("fa-eye-slash", "fa-eye");
  }
  balanceVisible = !balanceVisible;
});

// In dashboard.js — replace the existing nav-item listener block
document.querySelectorAll(".sidebar-nav .nav-item").forEach((item) => {
  item.addEventListener("click", async (e) => {
    e.preventDefault();

    const page = item.dataset.page;
    if (!page) return;

    // ── Visual update first ───────────────────────────────────────
    document
      .querySelectorAll(".nav-item")
      .forEach((nav) => nav.classList.remove("active"));
    item.classList.add("active");

    document
      .querySelectorAll(".page")
      .forEach((p) => p.classList.remove("active"));
    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) targetPage.classList.add("active");

    document.getElementById("pageTitle").textContent =
      item.querySelector("span").textContent || "Overview";

    currentPage = page;

    const sidebar = document.getElementById("sidebar");
    if (sidebar && window.innerWidth <= 1024) {
      // matches your @media (max-width: 1024px)
      sidebar.classList.remove("show");
    }

    // ── Lazy-load / refresh content when tab becomes visible ───────
    try {
      switch (page) {
        case "overview":
          await updateTotalBalance();
          //await loadSpendingByCategory();
          await showPrimaryAccountNumber();
          // usually already loaded — but can refresh charts/notifications if needed
          break;

        case "accounts":
          await loadAccounts(); // refresh balances
          await updateTotalBalance();
          break;

        case "add-money":
          loadSavedCards();
          break;

        case "transfers":
          await loadAccounts();
          //await loadBeneficiariesForTransfer(); // if you have dropdown of recipients
          //await loadAccountsForTransfer(); // refresh from/to selects
          break;

        case "external-transfers":
          loadExternalTransfers(1, "all");
          break;

        case "transactions":
          loadFullTransactions(1);
          break;

        case "cards":
          await loadCards(); // refresh card list
          break;

        case "bills":
          //await loadBills(); // if you show bill list or upcoming payments
          break;

        case "beneficiaries":
          //await loadBeneficiaries(); // refresh list & form selects
          break;

        case "budgets":
          //await loadBudgets(); // refresh chart or list
          break;

        case "live-support":
          document.getElementById("page-live-support").classList.add("active");
          loadLiveChat();
          break;

        case "support":
          await loadNotifications(); // or loadTickets() if you have support tickets here
          break;

        case "settings":
          // usually static — but can reload user profile if needed
          break;

        default:
          console.log(`No loader for page: ${page}`);
      }
    } catch (err) {
      console.error(`Error loading ${page}:`, err);
      showNotification(`Failed to load ${page} content`, "error");
    }
  });
});

// PWA Installation Logic

// ========== PWA INSTALL BANNER (Improved) ==========
/*(function() {
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
    }

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
})();*/

// ========== PWA INSTALL BANNER (iOS + Android friendly) ==========
(function () {
  let deferredPrompt = null;
  let bannerShown = false;

  // Detect iOS
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  // Check if app is already installed (standalone mode)
  function isPWAInstalled() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  // Check if inside Capacitor native wrapper (future use)
  function isNativeApp() {
    return (
      typeof window.Capacitor !== "undefined" &&
      window.Capacitor.isNativePlatform()
    );
  }

  // Should we show the banner?
  function shouldShowBanner() {
    if (isPWAInstalled()) return false;
    if (isNativeApp()) return false;
    if (localStorage.getItem("pwaBannerDismissed") === "true") return false;
    return true;
  }

  // Show the banner with animation
  function showPwaBanner() {
    const banner = document.getElementById("pwaInstallBanner");
    if (!banner || bannerShown) return;
    if (shouldShowBanner()) {
      banner.style.display = "block";
      bannerShown = true;
    }
  }

  // Hide banner and optionally remember dismissal
  function dismissPwaBanner(permanent = true) {
    const banner = document.getElementById("pwaInstallBanner");
    if (banner) banner.style.display = "none";
    if (permanent) localStorage.setItem("pwaBannerDismissed", "true");
    bannerShown = false;
  }

  // Show iOS instructions modal
  function showIosInstructions() {
    const modal = document.getElementById("pwaInstructionsModal");
    if (modal) {
      modal.classList.add("show");
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

  // DOM ready: attach events and decide if banner should appear
  document.addEventListener("DOMContentLoaded", () => {
    const banner = document.getElementById("pwaInstallBanner");
    const installBtn = document.getElementById("pwaInstallBtn");
    const dismissBtn = document.getElementById("pwaDismissBtn");

    if (installBtn) installBtn.addEventListener("click", installPwa);
    if (dismissBtn)
      dismissBtn.addEventListener("click", () => dismissPwaBanner(true));

    // Close iOS instructions modal
    const closeModalBtn = document.getElementById("closeInstructionsModal");
    const gotItBtn = document.getElementById("gotItBtn");
    const modal = document.getElementById("pwaInstructionsModal");
    const closeModal = () => {
      if (modal) modal.classList.remove("show");
    };
    if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
    if (gotItBtn) gotItBtn.addEventListener("click", closeModal);
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // If beforeinstallprompt already fired, show banner immediately
    if (deferredPrompt && shouldShowBanner()) {
      showPwaBanner();
    } else if (!isIos && !deferredPrompt && shouldShowBanner()) {
      // On Android/Chrome, wait 2 seconds, then show banner (if still not installed)
      setTimeout(() => {
        if (shouldShowBanner()) showPwaBanner();
      }, 2000);
    } else if (isIos && shouldShowBanner()) {
      // On iOS, show banner after 2 seconds (no native prompt)
      setTimeout(() => {
        if (shouldShowBanner()) showPwaBanner();
      }, 2000);
    }
  });

  // Listen for beforeinstallprompt (Android/Chrome only)
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => showPwaBanner());
    } else {
      showPwaBanner();
    }
  });

  // If user installs from browser menu, hide banner on next visibility change
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && isPWAInstalled()) {
      dismissPwaBanner(false);
    }
  });
})();

// Sidebar toggle
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
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

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", logout);
document.getElementById("logoutDropdown")?.addEventListener("click", logout);

async function logout() {
  const confirmed = await confirmAction({
    title: "Logout",
    message: "Are you sure you want to logout?",
    type: "question",
    confirmText: "Yes, Logout",
  });

  if (!confirmed) return;

  localStorage.removeItem("token");
  localStorage.removeItem("remember");
  window.location.href = "index.html";
}

// Initialize event listeners
function initializeEventListeners() {
  // ... your other listeners ...

  // Better modal closing
  document.addEventListener("click", function closeModals(e) {
    // Clicked on close button or cancel
    if (
      e.target.closest(
        ".close-modal, .btn-outline[id*='cancel'], #cancelOtp, #cancelPurchase, #cancelTicket",
      )
    ) {
      const modal = e.target.closest(".modal");
      if (modal) {
        modal.classList.remove("show");
      }
      return;
    }

    // Clicked outside modal (backdrop)
    if (
      e.target.classList.contains("modal") &&
      e.target.classList.contains("show")
    ) {
      e.target.classList.remove("show");
    }
  });

  // Optional: ESC key closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal.show").forEach((modal) => {
        modal.classList.remove("show");
      });
    }
  });

  // Transaction history filters
  document.getElementById("transSearch")?.addEventListener(
    "input",
    debounce((e) => {
      currentTransFilters.search = e.target.value.trim();
      loadFullTransactions(1);
    }, 600),
  );

  document
    .getElementById("transTypeFilter")
    ?.addEventListener("change", (e) => {
      currentTransFilters.type = e.target.value;
      loadFullTransactions(1);
    });

  document
    .getElementById("transStatusFilter")
    ?.addEventListener("change", (e) => {
      currentTransFilters.status = e.target.value;
      loadFullTransactions(1);
    });
}

// ==================== PULL TO REFRESH INTEGRATION ====================

let pullToRefresh = null;

// Initialize pull-to-refresh with error handling
function initPullToRefresh() {
  try {
    if (typeof PullToRefresh === "undefined") {
      console.warn("PullToRefresh library not loaded yet");
      return;
    }

    pullToRefresh = new PullToRefresh({
      threshold: 80,
      maxPull: 150,
      refreshTimeout: 10000,
      onRefresh: async () => {
        console.log("Pull to refresh triggered");
        await refreshAllDashboardData();
      },
    });

    console.log("Pull to refresh initialized for dashboard");
  } catch (error) {
    console.error("Failed to initialize pull to refresh:", error);
  }
}

// Call initialization safely
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      initPullToRefresh();
      addRefreshButton();
    }, 500);
  });
} else {
  setTimeout(() => {
    initPullToRefresh();
    addRefreshButton();
  }, 500);
}

// Refresh all dashboard data
async function refreshAllDashboardData() {
  console.log("Starting full dashboard refresh...");

  try {
    // Get current active page
    const activePage =
      document.querySelector(".page.active")?.id || "page-overview";

    // Refresh user data first
    await loadUserData();

    // Refresh based on current page
    switch (activePage) {
      case "page-overview":
        await updateTotalBalance();
        await loadTransactions();
        await loadSpendingByCategory();
        await showPrimaryAccountNumber();
        await loadMySavings();
        break;

      case "page-accounts":
        await loadAccounts();
        await updateTotalBalance();
        break;

      case "page-transfers":
        await loadAccounts();
        break;

      case "page-transactions":
        await loadFullTransactions(1);
        break;

      case "page-cards":
        await loadCards();
        break;

      case "page-beneficiaries":
        await loadBeneficiaries();
        break;

      case "page-support":
        await loadTickets();
        break;

      case "page-settings":
        // Settings page usually static, but refresh profile
        await loadUserData();
        break;

      case "page-live-support":
        await loadLiveChat();
        break;

      case "page-external-transfers":
        await loadExternalTransfers(1, "all");
        break;
    }

    // Always refresh notifications and savings
    await loadNotifications();
    await loadMySavings();

    // Update last refresh time
    updateLastRefreshTime();

    console.log("Dashboard refresh completed");
  } catch (error) {
    console.error("Refresh error:", error);
    throw error;
  }
}

// Update last refresh time display
function updateLastRefreshTime() {
  let refreshIndicator = document.getElementById("lastRefreshTime");

  if (!refreshIndicator) {
    // Create the indicator if it doesn't exist
    refreshIndicator = document.createElement("div");
    refreshIndicator.id = "lastRefreshTime";
    refreshIndicator.style.cssText = `
            position: fixed;
            bottom: 70px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            z-index: 999;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            white-space: nowrap;
        `;
    document.body.appendChild(refreshIndicator);
  }

  const now = new Date();
  const timeString = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  refreshIndicator.textContent = `Last updated: ${timeString}`;
  refreshIndicator.style.opacity = "1";

  setTimeout(() => {
    refreshIndicator.style.opacity = "0";
  }, 2000);
}

// Add keyboard shortcut for refresh (Ctrl+R or Cmd+R intercept)
function handleKeyboardRefresh(e) {
  // Check for Ctrl+R or Cmd+R
  if ((e.ctrlKey || e.metaKey) && e.key === "r") {
    e.preventDefault();
    if (pullToRefresh) {
      pullToRefresh.manualRefresh();
    }
    return false;
  }
  return true;
}

// Add refresh button to top bar (optional)
function addRefreshButton() {
  const topBarRight = document.querySelector(".top-bar-right");
  if (topBarRight && !document.getElementById("refreshButton")) {
    const refreshBtn = document.createElement("button");
    refreshBtn.id = "refreshButton";
    refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
    refreshBtn.title = "Refresh (Pull down or click)";
    refreshBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 18px;
            color: var(--gray-600);
            cursor: pointer;
            padding: 8px;
            border-radius: 50%;
            transition: all 0.3s;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

    refreshBtn.addEventListener("click", async () => {
      refreshBtn.classList.add("fa-spin");
      await refreshAllDashboardData();
      setTimeout(() => {
        refreshBtn.classList.remove("fa-spin");
      }, 1000);
    });

    refreshBtn.addEventListener("mouseenter", () => {
      refreshBtn.style.background = "var(--gray-100)";
    });

    refreshBtn.addEventListener("mouseleave", () => {
      refreshBtn.style.background = "none";
    });

    // Insert before notifications
    const notifications = document.querySelector(".notifications");
    if (notifications) {
      topBarRight.insertBefore(refreshBtn, notifications);
    } else {
      topBarRight.appendChild(refreshBtn);
    }
  }
}

// Initialize pull-to-refresh on DOM load
/*document.addEventListener("DOMContentLoaded", () => {
  // Initialize after a short delay to ensure DOM is ready
  setTimeout(() => {
    initPullToRefresh();
    addRefreshButton();

    // Add keyboard listener for refresh
    document.addEventListener("keydown", handleKeyboardRefresh);

    // Add swipe down instruction for first-time users (optional)
    showPullToRefreshHint();
  }, 1000);
});*/

// Show hint for first-time users
function showPullToRefreshHint() {
  const hintShown = localStorage.getItem("pullToRefreshHintShown");
  if (hintShown) return;

  const hint = document.createElement("div");
  hint.className = "refresh-toast";
  hint.innerHTML = `
        <i class="fas fa-arrow-down"></i>
        <span>Pull down from top to refresh</span>
    `;
  hint.style.bottom = "50%";
  hint.style.transform = "translateX(-50%) translateY(-50%)";
  hint.style.opacity = "1";
  hint.style.visibility = "visible";
  document.body.appendChild(hint);

  setTimeout(() => {
    hint.style.opacity = "0";
    setTimeout(() => hint.remove(), 500);
  }, 3000);

  localStorage.setItem("pullToRefreshHintShown", "true");
}

// ==================== SETTINGS PAGE FUNCTIONS ====================

// View full transaction history
async function viewFullTransactionHistory() {
  //loadingManager.show("Loading Transactions...,",100);
  const modal = document.getElementById("transactionHistoryModal");
  /*if (viewFullTransactionHistory) {
    setTimeout(() => {
      loadingManager.show("Loading Transactions...,");
    }, 600);
  }
  loadingManager.hide();*/
  modal.classList.add("show");
  await loadTransactionHistory();
}

let currentHistoryPage = 1;

async function loadTransactionHistory(page = 1, filters = {}) {
  currentHistoryPage = page;

  try {
    let url = `${API_BASE_URL}/user/transactions?page=${page}&limit=20`;
    if (filters.start_date) url += `&start_date=${filters.start_date}`;
    if (filters.end_date) url += `&end_date=${filters.end_date}`;
    if (filters.type) url += `&type=${filters.type}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      renderTransactionHistory(data.transactions);
      updatePagination("historyPagination", data.pagination, (p) =>
        loadTransactionHistory(p, filters),
      );

      // Update totals
      const total = data.transactions.reduce(
        (sum, t) =>
          sum + (t.to_user_id === currentUser?.id ? t.amount : -t.amount),
        0,
      );
      document.getElementById("historyTotal").textContent =
        `₦${total.toLocaleString()}`;
    }
  } catch (error) {
    console.error("Error loading transaction history:", error);
    showNotification("Failed to load transaction history", "error");
  }
}

function renderTransactionHistory(transactions) {
  const tbody = document.getElementById("transactionHistoryBody");
  if (!tbody) return;

  tbody.innerHTML = transactions
    .map((t) => {
      const isCredit = t.to_user_id === currentUser?.id;
      return `
            <tr>
                <td>${new Date(t.created_at).toLocaleDateString("en-NG")} ${new Date(t.created_at).toLocaleTimeString()}</td>
                <td>${t.description || t.transaction_type || "Transaction"}</td>
                <td>${isCredit ? "Credit" : "Debit"}</td>
                <td class="${isCredit ? "positive" : "negative"}">₦${Math.abs(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td><span class="status-badge ${t.status}">${t.status}</span></td>
            </tr>
        `;
    })
    .join("");
}

function filterTransactionHistory() {
  const filters = {
    start_date: document.getElementById("historyStartDate").value,
    end_date: document.getElementById("historyEndDate").value,
    type: document.getElementById("historyTypeFilter").value,
  };
  loadTransactionHistory(1, filters);
}

async function exportTransactionHistory() {
  try {
    const response = await fetch(`${API_BASE_URL}/user/transactions/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transaction_history_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showNotification("Export completed", "success");
    }
  } catch (error) {
    console.error("Export error:", error);
    showNotification("Export failed", "error");
  }
}

// Account Limits
async function showAccountLimits() {
  const modal = document.getElementById("accountLimitsModal");
  modal.classList.add("show");
  await loadAccountLimits();
}

async function loadAccountLimits() {
  try {
    const response = await fetch(`${API_BASE_URL}/user/account-limits`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const limits = await response.json();

      document.getElementById("dailyLimitDisplay").textContent =
        `₦${limits.daily_limit.toLocaleString()}`;
      document.getElementById("weeklyLimitDisplay").textContent =
        `₦${limits.weekly_limit.toLocaleString()}`;
      document.getElementById("monthlyLimitDisplay").textContent =
        `₦${limits.monthly_limit.toLocaleString()}`;
      document.getElementById("singleTxLimitDisplay").textContent =
        `₦${limits.single_transaction_limit.toLocaleString()}`;
      document.getElementById("dailyUsed").textContent =
        `₦${limits.daily_used.toLocaleString()}`;
      document.getElementById("weeklyUsed").textContent =
        `₦${limits.weekly_used.toLocaleString()}`;
      document.getElementById("monthlyUsed").textContent =
        `₦${limits.monthly_used.toLocaleString()}`;
    }
  } catch (error) {
    console.error("Error loading limits:", error);
  }
}

// View Bank Cards
function viewBankCards() {
  switchToPage("cards");
}

function viewBills() {
  switchToPage("bills");
}

// Security Center
function showSecurityCenter() {
  const modal = document.getElementById("securityCenterModal");
  modal.classList.add("show");

  // Setup tab switching
  document.querySelectorAll(".sec-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".sec-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const tabName = tab.dataset.tab;
      document
        .querySelectorAll(".security-tab")
        .forEach((content) => (content.style.display = "none"));
      if (tabName === "scams")
        document.getElementById("scamsTab").style.display = "block";
      else if (tabName === "password")
        document.getElementById("passwordTab").style.display = "block";
      else if (tabName === "love")
        document.getElementById("loveScamsTab").style.display = "block";
      else if (tabName === "family")
        document.getElementById("familyScamsTab").style.display = "block";
    });
  });
}

// Change Password Modal
function showChangePasswordModal() {
  document.getElementById("changePasswordModal").classList.add("show");
  document.getElementById("changePasswordForm").reset();
}

// Change Password Modal Handler - FIXED
/*document
  .getElementById("confirmChangePassword")
  ?.addEventListener("click", async () => {
    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmNewPassword =
      document.getElementById("confirmNewPassword").value;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showNotification("Please fill in all fields", "error");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showNotification("New passwords do not match", "error");
      return;
    }

    // Check password strength
    const strength = checkPasswordStrength(newPassword);
    if (strength.score < 2) {
      showNotification("Please use a stronger password", "error");
      return;
    }

    // Get fresh token from localStorage
    const token = localStorage.getItem("token");
    if (!token) {
      showNotification("Session expired. Please login again.", "error");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);
      return;
    }

    // Disable button to prevent multiple submissions
    const confirmBtn = document.getElementById("confirmChangePassword");
    const originalText = confirmBtn.innerHTML;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    try {
      console.log("Sending password change request...");

      const response = await fetch(`${API_BASE_URL}/user/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showNotification("Password changed successfully", "success");
        // Close the modal
        const modal = document.getElementById("changePasswordModal");
        if (modal) modal.classList.remove("show");
        // Clear the form
        document.getElementById("changePasswordForm").reset();
      } else {
        // Handle specific error cases
        if (response.status === 401) {
          showNotification("Session expired. Please login again.", "error");
          setTimeout(() => {
            localStorage.removeItem("token");
            window.location.href = "login.html";
          }, 2000);
        } else {
          showNotification(data.error || "Failed to change password", "error");
        }
      }
    } catch (error) {
      console.error("Password change error:", error);
      showNotification("Network error. Please try again.", "error");
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = originalText;
    }
  });
*/

// REPLACE the entire change password event listener with this
document.addEventListener("DOMContentLoaded", () => {
  // Change Password Modal Handler - FIXED VERSION
  const confirmChangePasswordBtn = document.getElementById("confirmChangePassword");
  if (confirmChangePasswordBtn) {
    // Remove any existing listeners to prevent duplicates
    const newBtn = confirmChangePasswordBtn.cloneNode(true);
    confirmChangePasswordBtn.parentNode.replaceChild(newBtn, confirmChangePasswordBtn);
    
    newBtn.addEventListener("click", async () => {
      console.log("Change password button clicked");
      
      const currentPassword = document.getElementById("currentPassword")?.value;
      const newPassword = document.getElementById("newPassword")?.value;
      const confirmNewPassword = document.getElementById("confirmNewPassword")?.value;

      // Validation
      if (!currentPassword || !newPassword || !confirmNewPassword) {
        showNotification("Please fill in all fields", "error");
        return;
      }

      if (newPassword !== confirmNewPassword) {
        showNotification("New passwords do not match", "error");
        return;
      }

      if (newPassword.length < 6) {
        showNotification("Password must be at least 6 characters", "error");
        return;
      }

      // Get token
      const token = localStorage.getItem("token");
      console.log("Token exists:", !!token);
      
      if (!token) {
        showNotification("Please login again", "error");
        setTimeout(() => window.location.href = "login.html", 1500);
        return;
      }

      // Disable button
      const btn = newBtn;
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

      loadingManager.show("updating...")

      try {
        console.log("Making API call to change password...");
        
        const response = await fetch(`${API_BASE_URL}/user/change-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword
          }),
        });

        console.log("Response status:", response.status);
        const data = await response.json();
        console.log("Response data:", data);

        if (response.ok) {
          loadingManager.hide();

          showNotification("Password changed successfully", "success");
          // Close modal
          const modal = document.getElementById("changePasswordModal");
          if (modal) modal.classList.remove("show");
          // Reset form
          const form = document.getElementById("changePasswordForm");
          if (form) form.reset();
          // Clear password strength display
          const strengthBar = document.querySelector("#changePasswordModal .strength-bar");
          const strengthText = document.querySelector("#changePasswordModal .strength-text");
          if (strengthBar) strengthBar.style.width = "0%";
          if (strengthText) strengthText.textContent = "";
        } else {
          loadingManager.hide();

          if (response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem("token");
            showNotification("Session expired. Please login again.", "error");
            setTimeout(() => window.location.href = "login.html", 1500);
          } else {
            loadingManager.hide();

            showNotification(data.error || "Failed to change password", "error");
          }
        }
      } catch (error) {
        loadingManager.hide();

        console.error("Password change error:", error);
        showNotification("Network error. Please try again.", "error");
      } finally {
        loadingManager.hide();

        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  }
});


// Password strength checker
function checkPasswordStrength(password) {
  let score = 0;
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  // Calculate score
  if (checks.length) score++;
  if (checks.uppercase) score++;
  if (checks.lowercase) score++;
  if (checks.numbers) score++;
  if (checks.special) score++;

  let strength = "weak";
  let message = "";

  if (score >= 4) {
    strength = "strong";
    message = "Strong password";
  } else if (score >= 3) {
    strength = "medium";
    message = "Medium password";
  } else {
    strength = "weak";
    message = "Weak password";
  }

  return {
    score,
    strength,
    message,
    checks,
  };
}

// Add this function to verify token validity before making requests
async function ensureValidToken() {
  const token = localStorage.getItem("token");
  if (!token) {
    showNotification("Session expired. Please login again.", "error");
    setTimeout(() => {
      localStorage.removeItem("token");
      window.location.href = "login.html";
    }, 1500);
    return false;
  }
  
  // Optional: Verify token with backend
  try {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      localStorage.removeItem("token");
      showNotification("Session expired. Please login again.", "error");
      setTimeout(() => window.location.href = "login.html", 1500);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Token validation error:", error);
    return true; // Assume valid if can't verify
  }
}

// Add password strength meter listener when modal opens
function showChangePasswordModal() {
  const modal = document.getElementById("changePasswordModal");
  if (!modal) return;

  // Clear form
  document.getElementById("changePasswordForm")?.reset();

  // Add password strength listener
  const newPasswordInput = document.getElementById("newPassword");
  const removeListener = () => {
    newPasswordInput?.removeEventListener("input", passwordStrengthHandler);
  };

  const passwordStrengthHandler = () => {
    const strength = checkPasswordStrength(newPasswordInput.value);
    updatePasswordStrengthDisplay(strength);
  };

  newPasswordInput?.addEventListener("input", passwordStrengthHandler);

  // Remove listener when modal closes
  const closeHandler = () => {
    removeListener();
    modal.removeEventListener("modalClosed", closeHandler);
  };
  modal.addEventListener("modalClosed", closeHandler);

  modal.classList.add("show");
}

function updatePasswordStrengthDisplay(strengthData) {
  const strengthBar = document.querySelector(
    "#changePasswordModal .strength-bar",
  );
  const strengthText = document.querySelector(
    "#changePasswordModal .strength-text",
  );

  if (strengthBar) {
    strengthBar.setAttribute("data-strength", strengthData.strength);
    // Update width based on strength
    let width = "33%";
    if (strengthData.strength === "medium") width = "66%";
    if (strengthData.strength === "strong") width = "100%";
    strengthBar.style.width = width;
  }

  if (strengthText) {
    strengthText.textContent = strengthData.message;
    strengthText.className = `strength-text ${strengthData.strength}`;
  }
}

// Make function globally available
window.showChangePasswordModal = showChangePasswordModal;

// Transfer PIN Management
let pendingTransactionData = null;
let pinAttempts = 0;
const MAX_PIN_ATTEMPTS = 4;

async function showTransferPinModal() {
  const modal = document.getElementById("transferPinModal");
  const title = document.getElementById("pinModalTitle");
  const message = document.getElementById("pinModalMessage");

  // Check if user has existing PIN
  const hasPin = await checkUserHasPin();

  if (hasPin) {
    title.textContent = "Change Transfer PIN";
    message.textContent = "Enter your new 4-digit PIN below.";
  } else {
    title.textContent = "Set Transfer PIN";
    message.textContent = "Set a 4-digit PIN for transaction verification.";
  }

  document.getElementById("transferPinForm").reset();
  modal.classList.add("show");
}

async function checkUserHasPin() {
  try {
    const response = await fetch(`${API_BASE_URL}/user/has-pin`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return data.has_pin;
  } catch (error) {
    return false;
  }
}

document
  .getElementById("confirmTransferPin")
  ?.addEventListener("click", async () => {
    const newPin = document.getElementById("newPin").value;
    const confirmPin = document.getElementById("confirmPin").value;

    if (!newPin || !confirmPin) {
      showNotification("Please enter PIN", "error");
      return;
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      showNotification("PIN must be exactly 4 digits", "error");
      return;
    }

    if (newPin !== confirmPin) {
      showNotification("PINs do not match", "error");
      return;
    }

    try {
      loadingManager.show("processing...");

      const response = await fetch(`${API_BASE_URL}/user/set-transfer-pin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin: newPin }),
      });

      const data = await response.json();

      if (response.ok) {
        loadingManager.hide();

        showNotification("Transfer PIN set successfully", "success");
        closeModal("transferPinModal");
      } else {
        loadingManager.hide();

        showNotification(data.error || "Failed to set PIN", "error");
      }
    } catch (error) {
      loadingManager.hide();
      console.error("PIN setting error:", error);
      showNotification("Failed to set PIN", "error");
    }
  });

// PIN Verification for Transactions
async function verifyPinForTransaction(transactionData, onSuccess) {
  pendingTransactionData = { ...transactionData, onSuccess };
  pinAttempts = 0;

  showPinVerificationModal();
}

function showPinVerificationModal() {
  const modal = document.getElementById("pinVerificationModal");
  const input = document.getElementById("verificationPin");
  const attemptsDisplay = document.getElementById("pinAttemptsDisplay");

  input.value = "";
  attemptsDisplay.textContent = `You have ${MAX_PIN_ATTEMPTS - pinAttempts} attempts remaining`;
  modal.classList.add("show");
  input.focus();
}

/*document
  .getElementById("confirmPinVerification")
  ?.addEventListener("click", async () => {
    const enteredPin = document.getElementById("verificationPin").value;

    if (!enteredPin || enteredPin.length !== 4) {
      showNotification("Please enter your 4-digit PIN", "error");
      return;
    }

    // Show loading while verifying PIN
    loadingManager.show("Verifying PIN...");

    try {
      const response = await fetch(`${API_BASE_URL}/user/verify-transfer-pin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin: enteredPin }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        // PIN verified successfully
        closeModal("pinVerificationModal");
        loadingManager.show("Processing transaction...");

        if (pendingTransactionData && pendingTransactionData.onSuccess) {
          await pendingTransactionData.onSuccess();
        }
        pendingTransactionData = null;
        pinAttempts = 0;
      } else {
        loadingManager.hide();
        // Incorrect PIN
        pinAttempts++;
        const remainingAttempts = MAX_PIN_ATTEMPTS - pinAttempts;

        if (pinAttempts >= MAX_PIN_ATTEMPTS) {
          // Too many attempts - freeze account
          await freezeAccountDueToPinAttempts();
        } else {
          showIncorrectPinModal(remainingAttempts);
          document.getElementById("verificationPin").value = "";
          document.getElementById("verificationPin").focus();
          document.getElementById("pinAttemptsDisplay").textContent =
            `You have ${remainingAttempts} attempts remaining`;
        }
      }
    } catch (error) {
      loadingManager.hide();
      console.error("PIN verification error:", error);
      showNotification("PIN verification failed", "error");
    }
  });
*/

document
  .getElementById("confirmPinVerification")
  ?.addEventListener("click", async () => {
    const enteredPin = document.getElementById("verificationPin").value;

    if (!enteredPin || enteredPin.length !== 4) {
      showNotification("Please enter your 4-digit PIN", "error");
      return;
    }

    // Show loading while verifying PIN
    loadingManager.show("Verifying PIN...");

    try {
      const response = await fetch(`${API_BASE_URL}/user/verify-transfer-pin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin: enteredPin }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        // PIN verified successfully - close PIN modal
        closeModal("pinVerificationModal");

        // IMPORTANT: Hide the PIN verification loading immediately
        loadingManager.hide();

        // Execute the transfer (it will show its own loading)
        if (pendingTransactionData && pendingTransactionData.onSuccess) {
          await pendingTransactionData.onSuccess();
        }
        pendingTransactionData = null;
        pinAttempts = 0;
      } else {
        loadingManager.hide();
        // Incorrect PIN
        pinAttempts++;
        const remainingAttempts = MAX_PIN_ATTEMPTS - pinAttempts;

        if (pinAttempts >= MAX_PIN_ATTEMPTS) {
          await freezeAccountDueToPinAttempts();
        } else {
          showIncorrectPinModal(remainingAttempts);
          document.getElementById("verificationPin").value = "";
          document.getElementById("verificationPin").focus();
          document.getElementById("pinAttemptsDisplay").textContent =
            `You have ${remainingAttempts} attempts remaining`;
        }
      }
    } catch (error) {
      loadingManager.hide();
      console.error("PIN verification error:", error);
      showNotification("PIN verification failed", "error");
    }
  });

document
  .getElementById("cancelPinVerification")
  ?.addEventListener("click", () => {
    closeModal("pinVerificationModal");
    pendingTransactionData = null;
    pinAttempts = 0;
  });

function showIncorrectPinModal(remainingAttempts) {
  const modal = document.getElementById("incorrectPinModal");
  const message = document.getElementById("incorrectPinMessage");

  if (remainingAttempts > 0) {
    message.textContent = `Incorrect PIN. You have ${remainingAttempts} attempt(s) remaining. After ${remainingAttempts} more incorrect attempt(s), your account will be frozen.`;
  } else {
    message.textContent =
      "Too many incorrect PIN attempts. Your account has been frozen for security reasons. Please contact support.";
  }

  modal.classList.add("show");
}

document.getElementById("retryPinBtn")?.addEventListener("click", () => {
  closeModal("incorrectPinModal");
  document.getElementById("verificationPin").focus();
});

document
  .getElementById("changePinFromAttemptBtn")
  ?.addEventListener("click", () => {
    closeModal("incorrectPinModal");
    closeModal("pinVerificationModal");
    showTransferPinModal();
  });

async function freezeAccountDueToPinAttempts() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/user/freeze-due-to-pin-attempts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.ok) {
      showNotification(
        "Your account has been frozen due to too many incorrect PIN attempts. Please contact support.",
        "error",
      );
      // Reload to show frozen state
      setTimeout(() => window.location.reload(), 3000);
    }
  } catch (error) {
    console.error("Freeze error:", error);
  }
}

// First-time PIN creation flow
async function requirePinForTransaction(transactionData, onSuccess) {
  const hasPin = await checkUserHasPin();

  if (!hasPin) {
    // Show PIN creation modal
    showPinCreateModal(transactionData, onSuccess);
  } else {
    // Show PIN verification modal
    verifyPinForTransaction(transactionData, onSuccess);
  }
}

function showPinCreateModal(transactionData, onSuccess) {
  const modal = document.getElementById("pinCreateModal");
  pendingTransactionData = { ...transactionData, onSuccess };
  modal.classList.add("show");
  document.getElementById("pinCreateForm").reset();
}

document
  .getElementById("confirmPinCreate")
  ?.addEventListener("click", async () => {
    const newPin = document.getElementById("createPin").value;
    const confirmPin = document.getElementById("confirmCreatePin").value;

    if (!newPin || !confirmPin) {
      showNotification("Please enter PIN", "error");
      return;
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      showNotification("PIN must be exactly 4 digits", "error");
      return;
    }

    if (newPin !== confirmPin) {
      showNotification("PINs do not match", "error");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/user/set-transfer-pin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin: newPin }),
      });

      const data = await response.json();

      if (response.ok) {
        showNotification("PIN created successfully", "success");
        closeModal("pinCreateModal");
        // Continue with the original transaction
        if (pendingTransactionData && pendingTransactionData.onSuccess) {
          await pendingTransactionData.onSuccess();
        }
        pendingTransactionData = null;
      } else {
        showNotification(data.error || "Failed to create PIN", "error");
      }
    } catch (error) {
      console.error("PIN creation error:", error);
      showNotification("Failed to create PIN", "error");
    }
  });

document.getElementById("cancelPinCreate")?.addEventListener("click", () => {
  closeModal("pinCreateModal");
  pendingTransactionData = null;
  showNotification("Transaction cancelled", "info");
});

// Currency conversion to Naira (NGN)
function convertToNaira(amountInUSD) {
  // Fixed exchange rate: 1 USD = 1500 NGN (you can make this dynamic via API)
  const EXCHANGE_RATE = 1500;
  return amountInUSD * EXCHANGE_RATE;
}

function formatCurrency(amount, currency = "NGN") {
  if (currency === "NGN" || currency === "naira") {
    return `₦${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Update all amount displays to Naira
function updateAllCurrencyDisplay() {
  const amountElements = document.querySelectorAll(
    ".amount, .balance-amount, .transaction-amount",
  );
  amountElements.forEach((el) => {
    const text = el.textContent;
    const match = text.match(/\$?([\d,]+\.?\d*)/);
    if (match) {
      const usdAmount = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(usdAmount)) {
        const ngnAmount = convertToNaira(usdAmount);
        el.textContent = `₦${ngnAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      }
    }
  });
}

// Call this after loading user data
async function loadUserDataWithCurrency() {
  await loadUserData();
  updateAllCurrencyDisplay();
}

// ==================== ACCOUNT SECURITY FUNCTIONS ====================

let currentUserProfile = null;
let logoutTimer = null;
let lastActivityTime = Date.now();

// Show Account Security Modal
function showAccountSecurityModal() {
  const modal = document.getElementById("accountSecurityModal");
  if (modal) modal.classList.add("show");
}

// Show User Profile Modal
// Show User Profile Modal (Read-only except address)
async function showUserProfileModal() {
  loadingManager.show("Loading profile...");

  try {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error("Failed to load profile");

    currentUserProfile = await response.json();

    // Fetch account number
    const accountsResponse = await fetch(`${API_BASE_URL}/user/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    let accountNumber = "Not available";
    if (accountsResponse.ok) {
      const accounts = await accountsResponse.json();
      const primaryAccount =
        accounts.find((a) => a.account_type === "checking") || accounts[0];
      if (primaryAccount) accountNumber = primaryAccount.account_number;
    }

    const profileContent = document.getElementById("userProfileContent");
    profileContent.innerHTML = `
      <div class="profile-readonly">
        <div class="profile-field">
          <div class="profile-field-label">ACCOUNT NUMBER</div>
          <div class="profile-field-value">${accountNumber}</div>
        </div>
        <div class="profile-field">
          <div class="profile-field-label">FULL NAME</div>
          <div class="profile-field-value">${escapeHtml(currentUserProfile.first_name || "")} ${escapeHtml(currentUserProfile.last_name || "")}</div>
        </div>
        <div class="profile-field">
          <div class="profile-field-label">MOBILE NUMBER</div>
          <div class="profile-field-value">${escapeHtml(currentUserProfile.phone || "Not set")}</div>
        </div>
        <div class="profile-field">
          <div class="profile-field-label">EMAIL ADDRESS</div>
          <div class="profile-field-value">${escapeHtml(currentUserProfile.email || "")}</div>
        </div>
        <div class="profile-field">
          <div class="profile-field-label">DATE OF BIRTH</div>
          <div class="profile-field-value">${currentUserProfile.date_of_birth ? new Date(currentUserProfile.date_of_birth).toLocaleDateString() : "Not set"}</div>
        </div>
        <div class="profile-field">
          <div class="profile-field-label">ADDRESS</div>
          <div class="profile-field-value">
            <span class="address-clickable" onclick="showFullAddressModal()">
              ${currentUserProfile.address ? currentUserProfile.address.substring(0, 60) + (currentUserProfile.address.length > 60 ? "..." : "") : "Click to add/edit address"}
              <i class="fas fa-pencil-alt" style="font-size: 11px; margin-left: 5px;"></i>
            </span>
          </div>
        </div>
        <div class="profile-edit-section">
          <button class="btn btn-outline edit-address-btn" onclick="editAddressOnly()">
            <i class="fas fa-map-marker-alt"></i> Edit Address
          </button>
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 12px;">
            <i class="fas fa-lock"></i> For security, personal information cannot be edited directly. Contact support for changes.
          </p>
        </div>
      </div>
    `;

    loadingManager.hide();

    closeModal("accountSecurityModal");
    document.getElementById("userProfileModal").classList.add("show");
  } catch (error) {
    loadingManager.hide();
    showToast("Failed to load profile", "error");
  }
}

// Edit Address Only (with confirmation)
async function editAddressOnly() {
  const currentAddress = currentUserProfile?.address || "";

  const modal = document.createElement("div");
  modal.className = "modal show";
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 450px;">
      <div class="modal-header">
        <h3><i class="fas fa-map-marker-alt"></i> Edit Address</h3>
        <button class="close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Street Address</label>
          <textarea id="editAddressStreet" class="form-control" rows="2" placeholder="Enter your street address">${escapeHtml(currentAddress || "")}</textarea>
        </div>
        <div class="form-group">
          <label>City</label>
          <input type="text" id="editAddressCity" class="form-control" value="${escapeHtml(currentUserProfile?.city || "")}" placeholder="City">
        </div>
        <div class="form-group">
          <label>Country</label>
          <input type="text" id="editAddressCountry" class="form-control" value="${escapeHtml(currentUserProfile?.country || "")}" placeholder="Country">
        </div>
        <div class="form-group">
          <label>Postal Code</label>
          <input type="text" id="editAddressPostal" class="form-control" value="${escapeHtml(currentUserProfile?.postal_code || "")}" placeholder="Postal Code">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Cancel</button>
        <button class="btn btn-primary" onclick="saveAddressOnly(this)">Save Address</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector(".close-modal").onclick = () => modal.remove();
}

async function saveAddressOnly(btn) {
  const modal = btn.closest(".modal");
  const address = document.getElementById("editAddressStreet")?.value || "";
  const city = document.getElementById("editAddressCity")?.value || "";
  const country = document.getElementById("editAddressCountry")?.value || "";
  const postal_code = document.getElementById("editAddressPostal")?.value || "";

  const confirmed = await confirmAction({
    title: "Update Address",
    message: "Are you sure you want to update your address?",
    type: "info",
    confirmText: "Yes, Update",
  });

  if (!confirmed) return;

  loadingManager.show("Updating address...");

  try {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address, city, country, postal_code }),
    });

    if (response.ok) {
      loadingManager.hide();
      showToast("Address updated successfully", "success");
      modal?.remove();
      await showUserProfileModal();
    } else {
      loadingManager.hide();
      showToast("Failed to update address", "error");
    }
  } catch (error) {
    loadingManager.hide();
    showToast("Error updating address", "error");
  }
}

async function fetchUserAccountNumber() {
  try {
    const response = await fetch(`${API_BASE_URL}/user/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const accounts = await response.json();
      const primaryAccount =
        accounts.find((a) => a.account_type === "checking") || accounts[0];
      if (primaryAccount && document.getElementById("profileAccountNumber")) {
        document.getElementById("profileAccountNumber").textContent =
          primaryAccount.account_number;
      }
    }
  } catch (error) {
    console.error("Error fetching account number:", error);
  }
}

// Show Full Address Modal
function showFullAddressModal() {
  const addressContent = document.getElementById("addressDetailsContent");
  addressContent.innerHTML = `
    <div style="padding: 10px;">
      <p><strong>Street Address:</strong><br>${currentUserProfile.address || "Not set"}</p>
      <p><strong>City:</strong><br>${currentUserProfile.city || "Not set"}</p>
      <p><strong>Country:</strong><br>${currentUserProfile.country || "Not set"}</p>
      <p><strong>Postal Code:</strong><br>${currentUserProfile.postal_code || "Not set"}</p>
    </div>
  `;
  closeModal("userProfileModal");
  document.getElementById("addressDetailsModal").classList.add("show");
}

// Edit Address
function editAddress() {
  const newAddress = prompt(
    "Enter your full address:",
    currentUserProfile.address || "",
  );
  if (newAddress !== null) {
    updateUserField("address", newAddress);
  }
}

// Edit User Profile
function editUserProfile() {
  const firstName = prompt(
    "Enter first name:",
    currentUserProfile.first_name || "",
  );
  const lastName = prompt(
    "Enter last name:",
    currentUserProfile.last_name || "",
  );
  const dob = prompt(
    "Enter date of birth (YYYY-MM-DD):",
    currentUserProfile.date_of_birth || "",
  );

  if (firstName !== null && lastName !== null) {
    updateUserFields({
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dob,
    });
  }
}

async function updateUserField(field, value) {
  loadingManager.show("Updating profile...");
  try {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ [field]: value }),
    });

    if (response.ok) {
      showNotification("Profile updated successfully", "success");
      await showUserProfileModal();
    } else {
      showNotification("Failed to update profile", "error");
    }
  } catch (error) {
    showNotification("Error updating profile", "error");
  } finally {
    loadingManager.hide();
  }
}

async function updateUserFields(fields) {
  loadingManager.show("Updating profile...");
  try {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fields),
    });

    if (response.ok) {
      showNotification("Profile updated successfully", "success");
      await showUserProfileModal();
    } else {
      showNotification("Failed to update profile", "error");
    }
  } catch (error) {
    showNotification("Error updating profile", "error");
  } finally {
    loadingManager.hide();
  }
}

// Lock Account Functions
function showLockAccountModal() {
  closeModal("accountSecurityModal");
  document.getElementById("lockAccountModal").classList.add("show");
}

async function confirmLockAccount() {
  const selectedReason = document.querySelector(
    'input[name="lockReason"]:checked',
  );
  if (!selectedReason) {
    showToast("Please select a reason for freezing your account", "error");
    return;
  }

  const confirmed = await confirmAction({
    title: "Freeze Account",
    message: `Are you sure you want to freeze your account? Reason: "${selectedReason.value}"\n\nYou will need to contact support to unfreeze your account.`,
    type: "danger",
    confirmText: "Yes, Freeze Account",
  });

  if (!confirmed) return;

  loadingManager.show("Freezing your account...");

  try {
    const response = await fetch(`${API_BASE_URL}/user/lock-account`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: selectedReason.value,
        unfreeze_method: "support",
      }),
    });

    if (response.ok) {
      loadingManager.hide();
      showToast("Your account has been frozen successfully", "warning");
      closeModal("lockAccountModal");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      const data = await response.json();
      loadingManager.hide();
      showToast(data.error || "Failed to freeze account", "error");
    }
  } catch (error) {
    loadingManager.hide();
    showToast("Error freezing account", "error");
  }
}

// Change Phone Number Functions
async function showChangePhoneModal() {
  loadingManager.show("Loading...");

  // Load current phone number
  const response = await fetch(`${API_BASE_URL}/user/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const user = await response.json();

  document.getElementById("currentPhoneDisplay").value =
    user.phone || "Not set";
  document.getElementById("newPhoneNumber").value = "";
  document.getElementById("confirmNewPhone").value = "";

  loadingManager.hide();

  closeModal("accountSecurityModal");
  document.getElementById("changePhoneModal").classList.add("show");
}

async function updatePhoneNumber() {
  const newPhone = document.getElementById("newPhoneNumber").value.trim();
  const confirmPhone = document.getElementById("confirmNewPhone").value.trim();

  if (!newPhone) {
    showNotification("Please enter a phone number", "error");
    return;
  }

  if (newPhone !== confirmPhone) {
    showNotification("Phone numbers do not match", "error");
    return;
  }

  loadingManager.show("Updating phone number...");

  try {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone: newPhone }),
    });

    if (response.ok) {
      loadingManager.hide();
      showNotification("Phone number updated successfully", "success");
      closeModal("changePhoneModal");
      await loadUserData();
    } else {
      loadingManager.hide();
      showNotification("Failed to update phone number", "error");
    }
  } catch (error) {
    loadingManager.hide();
    showNotification("Error updating phone number", "error");
  }
}

// Close Account Functions
function showCloseAccountModal() {
  closeModal("accountSecurityModal");
  document.getElementById("closeAccountWarningModal").classList.add("show");
}

function proceedToCloseAccountReason() {
  closeModal("closeAccountWarningModal");
  document.getElementById("closeAccountReasonModal").classList.add("show");
}

function goBackToWarningModal() {
  closeModal("closeAccountReasonModal");
  document.getElementById("closeAccountWarningModal").classList.add("show");
}

async function finalizeCloseAccount() {
  const selectedReason = document.querySelector(
    'input[name="closeReason"]:checked',
  );
  if (!selectedReason) {
    showNotification(
      "Please select a reason for closing your account",
      "error",
    );
    return;
  }

  loadingManager.show("Checking account eligibility...");

  try {
    // Check eligibility
    const eligibilityResponse = await fetch(
      `${API_BASE_URL}/user/check-close-eligibility`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const eligibility = await eligibilityResponse.json();

    if (!eligibility.eligible) {
      loadingManager.hide();

      const issues = [];
      if (eligibility.balance > 0)
        issues.push(
          `• Account balance: ₦${eligibility.balance.toFixed(2)} (must be ₦0.00)`,
        );
      if (eligibility.has_active_savings)
        issues.push("• You have active savings plans");
      if (eligibility.recent_transaction_days > 0)
        issues.push(
          `• Last transaction was ${eligibility.recent_transaction_days} days ago (must be 7+ days inactive)`,
        );
      if (
        eligibility.active_plans_list &&
        eligibility.active_plans_list.length > 0
      ) {
        issues.push("• Active savings plans:");
        eligibility.active_plans_list.forEach((plan) =>
          issues.push(`  - ${plan}`),
        );
      }

      const eligibilityContent = document.getElementById("eligibilityContent");
      eligibilityContent.innerHTML = `
        <div style="padding: 10px;">
          <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #f59e0b; display: block; text-align: center; margin-bottom: 20px;"></i>
          <p style="text-align: center; margin-bottom: 20px;"><strong>Your account cannot be closed for the following reasons:</strong></p>
          <ul style="color: #dc2626;">
            ${issues.map((issue) => `<li style="margin-bottom: 8px;">${issue}</li>`).join("")}
          </ul>
          <p style="margin-top: 20px; text-align: center;">Please resolve these issues before closing your account.</p>
        </div>
      `;

      document
        .getElementById("closeAccountEligibilityModal")
        .classList.add("show");
      return;
    }

    // Proceed with account closure
    loadingManager.show("Closing your account...");

    const response = await fetch(`${API_BASE_URL}/user/close-account`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: selectedReason.value }),
    });

    if (response.ok) {
      loadingManager.hide();
      showNotification("Your account has been closed successfully", "success");
      closeModal("closeAccountReasonModal");

      // Logout user
      setTimeout(() => {
        localStorage.removeItem("token");
        window.location.href = "index.html";
      }, 2000);
    } else {
      const data = await response.json();
      loadingManager.hide();
      showNotification(data.error || "Failed to close account", "error");
    }
  } catch (error) {
    loadingManager.hide();
    showNotification("Error checking account eligibility", "error");
  }
}

// Logout Settings Functions
function showLogoutSettingsModal() {
  closeModal("accountSecurityModal");

  // Load saved setting
  const savedSetting = localStorage.getItem("logoutSetting") || "free";
  const radio = document.querySelector(
    `input[name="logoutSetting"][value="${savedSetting}"]`,
  );
  if (radio) radio.checked = true;

  document.getElementById("logoutSettingsModal").classList.add("show");
}

function saveLogoutSettings() {
  const selected = document.querySelector(
    'input[name="logoutSetting"]:checked',
  );
  if (selected) {
    localStorage.setItem("logoutSetting", selected.value);
    showNotification("Logout settings saved", "success");
    closeModal("logoutSettingsModal");

    // Reset timer if needed
    resetLogoutTimer();
  }
}

function resetLogoutTimer() {
  if (logoutTimer) {
    clearTimeout(logoutTimer);
    logoutTimer = null;
  }

  const setting = localStorage.getItem("logoutSetting") || "free";

  if (setting === "60min") {
    // Set timer for 60 minutes
    logoutTimer = setTimeout(
      () => {
        if (document.visibilityState === "hidden") {
          performAutoLogout();
        }
      },
      60 * 60 * 1000,
    );
  } else if (setting === "always") {
    // Listen for visibility change
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
}

function handleVisibilityChange() {
  const setting = localStorage.getItem("logoutSetting") || "free";

  if (setting === "always") {
    if (document.hidden) {
      // Start 15 second timer
      if (logoutTimer) clearTimeout(logoutTimer);
      logoutTimer = setTimeout(() => {
        performAutoLogout();
      }, 15000);
    } else {
      // Reset timer when app becomes visible again
      if (logoutTimer) {
        clearTimeout(logoutTimer);
        logoutTimer = null;
      }
    }
  } else if (setting === "60min") {
    if (document.hidden) {
      // Track time when hidden
      lastActivityTime = Date.now();
    }
  }
}

function performAutoLogout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

// Initialize logout settings on page load
function initLogoutSettings() {
  resetLogoutTimer();

  // Track user activity
  const events = ["click", "mousemove", "keypress", "scroll", "touchstart"];
  events.forEach((event) => {
    document.addEventListener(event, () => {
      lastActivityTime = Date.now();
      resetLogoutTimer();
    });
  });
}

// Make functions globally available
window.showAccountSecurityModal = showAccountSecurityModal;
window.showUserProfileModal = showUserProfileModal;
window.showFullAddressModal = showFullAddressModal;
window.editAddress = editAddress;
window.editUserProfile = editUserProfile;
window.showLockAccountModal = showLockAccountModal;
window.confirmLockAccount = confirmLockAccount;
window.showChangePhoneModal = showChangePhoneModal;
window.updatePhoneNumber = updatePhoneNumber;
window.showCloseAccountModal = showCloseAccountModal;
window.proceedToCloseAccountReason = proceedToCloseAccountReason;
window.goBackToWarningModal = goBackToWarningModal;
window.finalizeCloseAccount = finalizeCloseAccount;
window.showLogoutSettingsModal = showLogoutSettingsModal;
window.saveLogoutSettings = saveLogoutSettings;

// ==================== CONFIRMATION MODAL SYSTEM ====================

class ConfirmationModal {
  constructor() {
    this.modal = document.getElementById("confirmationModal");
    this.resolveCallback = null;
    this.rejectCallback = null;
    this.init();
  }

  init() {
    if (!this.modal) return;

    const confirmBtn = document.getElementById("confirmationConfirmBtn");
    const cancelBtn = document.getElementById("confirmationCancelBtn");
    const closeBtn = this.modal.querySelector(".close-modal");

    const closeHandler = () => {
      this.hide();
      if (this.rejectCallback) this.rejectCallback();
    };

    if (confirmBtn)
      confirmBtn.onclick = () => {
        this.hide();
        if (this.resolveCallback) this.resolveCallback(true);
      };

    if (cancelBtn) cancelBtn.onclick = closeHandler;
    if (closeBtn) closeBtn.onclick = closeHandler;

    // Close on backdrop click
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) closeHandler();
    });
  }

  show(options) {
    return new Promise((resolve, reject) => {
      this.resolveCallback = resolve;
      this.rejectCallback = reject;

      const title = document.getElementById("confirmationTitle");
      const message = document.getElementById("confirmationMessage");
      const icon = document.getElementById("confirmationIcon");
      const confirmBtn = document.getElementById("confirmationConfirmBtn");

      if (title) title.textContent = options.title || "Confirm Action";
      if (message)
        message.textContent =
          options.message || "Are you sure you want to proceed?";

      // Set icon based on type
      if (icon) {
        const type = options.type || "warning";
        const icons = {
          warning: "⚠️",
          danger: "🔴",
          success: "✅",
          info: "ℹ️",
          question: "❓",
        };
        icon.textContent = icons[type] || icons.warning;
        icon.style.color =
          type === "danger"
            ? "#ef4444"
            : type === "warning"
              ? "#f59e0b"
              : "#3b82f6";
      }

      // Style confirm button based on type
      if (confirmBtn) {
        if (options.type === "danger") {
          confirmBtn.className = "btn btn-danger";
        } else if (options.type === "warning") {
          confirmBtn.className = "btn btn-warning";
        } else {
          confirmBtn.className = "btn btn-primary";
        }
        confirmBtn.textContent = options.confirmText || "Confirm";
      }

      const cancelBtn = document.getElementById("confirmationCancelBtn");
      if (cancelBtn) cancelBtn.textContent = options.cancelText || "Cancel";

      this.modal.classList.add("show");
    });
  }

  hide() {
    if (this.modal) this.modal.classList.remove("show");
  }
}

// Toast Notification System
class ToastNotification {
  static show(message, type = "info", duration = 3000) {
    const toast = document.getElementById("toastNotification");
    const toastMessage = document.getElementById("toastMessage");

    if (!toast || !toastMessage) return;

    // Remove existing classes
    toast.className = "toast-notification";
    toast.classList.add(type);

    toastMessage.textContent = message;
    toast.style.display = "block";

    setTimeout(() => {
      toast.style.display = "none";
    }, duration);
  }
}

// Initialize confirmation modal
const confirmationModal = new ConfirmationModal();

// Replace all alert/confirm calls with this
async function confirmAction(options) {
  try {
    return await confirmationModal.show(options);
  } catch (error) {
    // User cancelled - return false instead of throwing
    return false;
  }
}

// Toast notification wrapper
function showToast(message, type = "info") {
  ToastNotification.show(message, type);
}

// Override showNotification to use toast for better mobile experience
const originalShowNotification = window.showNotification;
window.showNotification = function (message, type = "info") {
  if (typeof ToastNotification !== "undefined") {
    ToastNotification.show(message, type);
  } else if (originalShowNotification) {
    originalShowNotification(message, type);
  }
};

// ==================== PUSH NOTIFICATION SERVICE ====================
// Add this to your dashboard.js

// Push Notification Manager
class PushNotificationManager {
  constructor() {
    this.isSupported = "Notification" in window;
    this.permission = "default";
    this.swRegistration = null;
    this.vapidPublicKey =
      "BK0pBHV1kG7SH9Y9GkCDpvgulCmn3qiM79mrZzGTSLvnGxvVUxJYKj4LD5DxI2z0QwW9tR-dqP_aNFG1Y0k10xE"; // You'll need to generate this
  }

  // Initialize push notifications
  async init() {
    if (!this.isSupported) {
      console.log("Push notifications not supported");
      return false;
    }

    // Check permission
    this.permission = Notification.permission;

    // Register service worker
    if ("serviceWorker" in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register("/sw.js");
        console.log("Service Worker registered");
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    }

    return true;
  }

  // Request permission
  async requestPermission() {
    if (!this.isSupported) {
      showNotification("Notifications not supported in your browser", "error");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;

      if (permission === "granted") {
        await this.subscribeToPush();
        showNotification("Notifications enabled!", "success");
        return true;
      } else {
        showNotification(
          "Please enable notifications in your browser settings",
          "warning",
        );
        return false;
      }
    } catch (error) {
      console.error("Permission request error:", error);
      return false;
    }
  }

  // Subscribe to push notifications
  async subscribeToPush() {
    if (!this.swRegistration) return;

    try {
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey),
      });

      // Send subscription to backend
      await this.sendSubscriptionToServer(subscription);
      return subscription;
    } catch (error) {
      console.error("Push subscription error:", error);
    }
  }

  async sendSubscriptionToServer(subscription) {
    try {
      // The subscription object needs to be stringified for storage
      const subscriptionData = {
        push_token: JSON.stringify(subscription), // Stringify here
        platform: this.getPlatform(),
        device_name: this.getDeviceName(),
      };

      console.log("Sending subscription to server");

      const response = await fetch(`${API_BASE_URL}/user/register-push-token`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscriptionData),
      });

      const result = await response.json();

      if (response.ok) {
        console.log("Push token registered successfully");
      } else {
        console.error("Server error:", result.error);
      }
    } catch (error) {
      console.error("Failed to send subscription:", error);
    }
  }

  // Get platform
  getPlatform() {
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return "ios";
    if (/Android/.test(navigator.userAgent)) return "android";
    return "web";
  }

  // Get device name
  getDeviceName() {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return "iPhone";
    if (/iPad/.test(ua)) return "iPad";
    if (/Android/.test(ua)) {
      const match = ua.match(/Android\s([0-9.]+)/);
      return match ? `Android ${match[1]}` : "Android";
    }
    return "Web Browser";
  }

  // Helper: Convert base64 to Uint8Array
  urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, "+")
      .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Show local notification (for web)
  showLocalNotification(title, options) {
    if (this.permission !== "granted") return;

    const notification = new Notification(title, {
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      vibrate: [200, 100, 200],
      ...options,
    });

    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      if (options.data && options.data.url) {
        window.location.href = options.data.url;
      }
      notification.close();
    };

    return notification;
  }
}

// Initialize push notification manager
const pushManager = new PushNotificationManager();

// Load push notification settings
async function loadPushSettings() {
  try {
    const response = await fetch(`${API_BASE_URL}/user/push-settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const settings = await response.json();
      document
        .getElementById("pushTransfers")
        ?.addEventListener("change", updatePushSetting);
      document
        .getElementById("pushSavings")
        ?.addEventListener("change", updatePushSetting);
      document
        .getElementById("pushSecurity")
        ?.addEventListener("change", updatePushSetting);
      document
        .getElementById("pushPromotions")
        ?.addEventListener("change", updatePushSetting);
      document
        .getElementById("pushBills")
        ?.addEventListener("change", updatePushSetting);
    }
  } catch (error) {
    console.error("Error loading push settings:", error);
  }
}

// Update push notification settings
async function updatePushSetting(e) {
  const setting = e.target.id.replace("push", "").toLowerCase();
  const value = e.target.checked;

  try {
    const response = await fetch(`${API_BASE_URL}/user/push-settings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ [setting]: value }),
    });

    if (response.ok) {
      showNotification("Notification settings updated", "success");
    }
  } catch (error) {
    console.error("Error updating push settings:", error);
  }
}

// Enable push notifications button handler
function enablePushNotifications() {
  pushManager.requestPermission();
}

// Escape HTML to prevent XSS attacks
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
