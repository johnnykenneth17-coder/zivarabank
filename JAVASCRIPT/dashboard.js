// dashboard.js - Handles user dashboard functionality

// API Base URL
const API_BASE_URL = "https://bank-backend-blush.vercel.app/api";

// State management
let currentUser = null;
let accounts = [];
let transactions = [];
let cards = [];
let notifications = [];
let currentPage = "overview";
let charts = {};

// Check authentication
const token = localStorage.getItem("token");
if (!token) {
  window.location.href = "login.html";
}

// Initialize dashboard
document.addEventListener("DOMContentLoaded", async () => {
  await loadUserData();
  debounce();
  //loadSpendingByCategory();
  //initializeEventListeners();
  startRealTimeUpdates();
  updateDateTime();
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
        <i class="fas fa-${type === "success" ? "check-circle" : type === "error" ? "exclamation-circle" : "info-circle"}"></i>
        <span>${message}</span>
    `;

  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6"};
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
    updateUserInterface();

    // Check if account is frozen
    if (currentUser.is_frozen) {
      showFreezeNotification(currentUser.freeze_reason);
    }

    // Load accounts
    await loadAccounts();

    // Load transactions
    await loadTransactions();

    // Load cards
    await loadCards();

    // Load notifications
    await loadNotifications();

    // Initialize charts
    await loadSpendingByCategory();
    //initializeCharts();
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

// Update user interface with profile data
function updateUserInterface() {
  if (!currentUser) return;

  // Update user info
  document.getElementById("userName").textContent =
    `${currentUser.first_name} ${currentUser.last_name}`;
  document.getElementById("userEmail").textContent = currentUser.email;
  document.getElementById("welcomeName").textContent = currentUser.first_name;

  // Update avatar
  const initials = currentUser.first_name[0] + currentUser.last_name[0];
  document.getElementById("userInitials").textContent = initials;
  document.getElementById("userMenuAvatar").src =
    `https://ui-avatars.com/api/?name=${initials}&background=2563eb&color=fff`;
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

  accountsList.innerHTML = accounts
    .map(
      (account) => `
        <div class="balance-card">
            <div class="balance-label">
                <span>${account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)} Account</span>
                <span>${account.account_number}</span>
            </div>
            <div class="balance-amount">$${account.balance.toFixed(2)}</div>
            <div class="balance-change positive">
                <i class="fas fa-arrow-up"></i>
                <span>Available: $${account.available_balance.toFixed(2)}</span>
            </div>
            <div class="progress-bar">
                <div class="progress" style="width: ${(account.available_balance / account.balance) * 100}%"></div>
            </div>
        </div>
    `,
    )
    .join("");

  // Update account select in transfer form
  const fromAccountSelect = document.getElementById("fromAccount");
  if (fromAccountSelect) {
    fromAccountSelect.innerHTML = `
            <option value="">Select account</option>
            ${accounts
              .map(
                (account) => `
                <option value="${account.id}">${account.account_type} (${account.account_number}) - $${account.available_balance.toFixed(2)}</option>
            `,
              )
              .join("")}
        `;
  }
}

// Update total balance
function updateTotalBalance() {
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  document.getElementById("totalBalance").textContent =
    `$${totalBalance.toFixed(2)}`;
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

// Update transactions display
function updateTransactionsDisplay() {
  const recentTransactions = document.getElementById("recentTransactions");
  if (!recentTransactions) return;

  recentTransactions.innerHTML = transactions
    .slice(0, 5)
    .map((t) => {
      const isCredit =
        t.to_account_id ===
        accounts.find((a) => a.user_id === currentUser.id)?.id;
      return `
            <div class="transaction-item">
                <div class="transaction-icon">
                    <i class="fas fa-${t.transaction_type === "transfer" ? "exchange-alt" : t.transaction_type === "bill_payment" ? "file-invoice" : "credit-card"}"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-name">${t.description || t.transaction_type}</div>
                    <div class="transaction-date">${new Date(t.created_at).toLocaleDateString()}</div>
                </div>
                <div class="transaction-amount ${isCredit ? "positive" : "negative"}">
                    ${isCredit ? "+" : "-"}$${t.amount.toFixed(2)}
                </div>
            </div>
        `;
    })
    .join("");
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

// Update cards display
function updateCardsDisplay() {
  const cardsList = document.getElementById("cardsList");
  if (!cardsList) return;

  cardsList.innerHTML = cards
    .map(
      (card) => `
        <div class="card-item">
            <div class="card-chip"></div>
            <div class="card-number">•••• •••• •••• ${card.card_number.slice(-4)}</div>
            <div class="card-details">
                <div>${card.card_type.toUpperCase()}</div>
                <div>${new Date(card.expiry_date).toLocaleDateString("en-US", { month: "2-digit", year: "2-digit" })}</div>
            </div>
            <span class="card-status ${card.card_status}">${card.card_status}</span>
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
      showNotification(`Card ${action}d successfully`, "success");
      await loadCards();
    } else {
      const data = await response.json();
      showNotification(data.error || `Failed to ${action} card`, "error");
    }
  } catch (error) {
    console.error("Error toggling card:", error);
    showNotification("Failed to update card", "error");
  }
}

// Report card
async function reportCard(cardId) {
  if (!confirm("Are you sure you want to report this card as lost/stolen?"))
    return;

  try {
    const response = await fetch(`${API_BASE_URL}/user/report-card/${cardId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      showNotification(
        "Card reported successfully. Support ticket created.",
        "success",
      );
      await loadCards();
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to report card", "error");
    }
  } catch (error) {
    console.error("Error reporting card:", error);
    showNotification("Failed to report card", "error");
  }
}

// Load notifications
async function loadNotifications() {
  try {
    const response = await fetch(`${API_BASE_URL}/user/notifications`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      notifications = await response.json();
      updateNotificationsDisplay();
    }
  } catch (error) {
    console.error("Error loading notifications:", error);
  }
}

// Update notifications display
function updateNotificationsDisplay() {
  const notificationsList = document.getElementById("notificationsList");
  const badge = document.getElementById("notificationBadge");

  if (!notificationsList) return;

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  badge.textContent = unreadCount;
  badge.style.display = unreadCount > 0 ? "block" : "none";

  notificationsList.innerHTML = notifications
    .slice(0, 5)
    .map(
      (n) => `
        <div class="notification-item ${!n.is_read ? "unread" : ""}" onclick="markNotificationRead('${n.id}')">
            <div class="notification-title">${n.title}</div>
            <div class="notification-message">${n.message}</div>
            <div class="notification-time">${timeAgo(n.created_at)}</div>
        </div>
    `,
    )
    .join("");
}

// Mark notification as read
async function markNotificationRead(notificationId) {
  try {
    await fetch(`${API_BASE_URL}/user/notifications/${notificationId}/read`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    await loadNotifications();
  } catch (error) {
    console.error("Error marking notification read:", error);
  }
}

// Show freeze notification
function showFreezeNotification(reason) {
  const freezeNotification = document.getElementById("freezeNotification");
  const freezeReason = document.getElementById("freezeReason");

  if (freezeNotification && freezeReason) {
    freezeReason.textContent =
      reason || "Your account has been frozen. Please contact support.";
    freezeNotification.style.display = "flex";
  }
}

// Transfer form handler
const transferForm = document.getElementById("transferForm");
if (transferForm) {
  transferForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const transferData = {
      from_account_id: document.getElementById("fromAccount").value,
      to_account_number: document.getElementById("toAccount").value,
      amount: parseFloat(document.getElementById("amount").value),
      description: document.getElementById("description").value,
    };

    const transferBtn = document.getElementById("transferBtn");
    transferBtn.disabled = true;
    transferBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
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
          // Show OTP modal
          showOTPModal(data.transaction_id, "transfer");
        } else {
          showNotification("Transfer completed successfully", "success");
          transferForm.reset();
          await loadAccounts();
          await loadTransactions();
        }
      } else {
        showNotification(data.error || "Transfer failed", "error");
      }
    } catch (error) {
      console.error("Transfer error:", error);
      showNotification("Transfer failed", "error");
    } finally {
      transferBtn.disabled = false;
      transferBtn.innerHTML =
        '<span>Continue Transfer</span><i class="fas fa-arrow-right"></i>';
    }
  });
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
        `${API_BASE_URL}/accounts/recipient?account_number=${encodeURIComponent(accountNumber)}`,
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
  const modal = document.createElement("div");
  modal.className = "modal show";
  modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Complete Payment</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <p>Send exactly <strong>$${instructions.amount}</strong> in cryptocurrency to the following address:</p>
                <div class="crypto-address">
                    <code>${instructions.crypto_address}</code>
                    <button onclick="copyToClipboard('${instructions.crypto_address}')">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <p>Reference: <strong>${instructions.reference}</strong></p>
                <p class="warning">The card will be activated once the payment is confirmed.</p>
            </div>
        </div>
    `;

  document.body.appendChild(modal);

  modal.querySelector(".close-modal").onclick = () => modal.remove();
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
          showCryptoPaymentModal(data.payment_details);
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
                return ` $${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
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
function renderFakeSpendingChart() {
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
}

// Real-time updates
function startRealTimeUpdates() {
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
          await loadSpendingByCategory();
          // usually already loaded — but can refresh charts/notifications if needed
          break;

        case "accounts":
          await loadAccounts(); // refresh balances
          await updateTotalBalance();
          break;

        case "transfers":
          await loadAccounts();
          //await loadBeneficiariesForTransfer(); // if you have dropdown of recipients
          //await loadAccountsForTransfer(); // refresh from/to selects
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

function logout() {
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
}
