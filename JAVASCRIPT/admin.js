// admin.js - Handles admin dashboard functionality

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

//const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State management
let currentAdmin = null;
let users = [];
let transactions = [];
let tickets = [];
let otpMode = "off";
let charts = {};

// Check authentication
const token = localStorage.getItem("token");
if (!token) {
  window.location.href = "login.html";
}

// Initialize admin dashboard
document.addEventListener("DOMContentLoaded", async () => {
  await loadAdminStats();
  await loadAdminData();
  initializeEventListeners();
  initHarvestManagement();
  loadActiveChatUsers();
  startRealTimeUpdates();
});

// Load admin data
async function loadAdminData() {
  try {
    // Load admin profile
    const profileResponse = await fetch(`${API_BASE_URL}/user/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!profileResponse.ok) {
      throw new Error("Failed to load profile");
    }

    currentAdmin = await profileResponse.json();

    // Check if admin
    /* if (currentAdmin.role !== "admin") {
      window.location.href = "dashboard.html";
      return;
    }*/

    updateAdminInterface();

    // Load OTP mode
    await loadOTPMode();
    await loadReceiveRequests();
    await loadReceiveMethods();

    // Load initial data
    await loadUsers(1);
    await loadTransactions();
    await loadTickets();
  } catch (error) {
    console.error("Error loading admin data:", error);
    showNotification("Failed to load admin data", "error");

    if (error.message.includes("401")) {
      localStorage.removeItem("token");
      window.location.href = "login.html";
    }
  }
}

// Update admin interface
function updateAdminInterface() {
  if (!currentAdmin) return;

  document.getElementById("adminName").textContent =
    `${currentAdmin.first_name} ${currentAdmin.last_name}`;
  document.getElementById("adminEmail").textContent = currentAdmin.email;

  const initials = currentAdmin.first_name[0] + currentAdmin.last_name[0];
  document.getElementById("adminInitials").textContent = initials;
}

// In admin.js — inside your initializeEventListeners() or at the bottom
function initializeEventListeners() {
  document.querySelectorAll(".admin-nav .nav-item").forEach((item) => {
    item.addEventListener("click", async (e) => {
      e.preventDefault();

      const page = item.getAttribute("data-page");
      if (!page) return;

      // ── Visual / UI update first ───────────────────────────────────────
      document
        .querySelectorAll(".admin-nav .nav-item")
        .forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      document
        .querySelectorAll(".admin-page")
        .forEach((p) => p.classList.remove("active"));

      const targetPage = document.getElementById(`page-${page}`);
      if (targetPage) {
        targetPage.classList.add("active");
      }

      // Logs filter listeners
      document.getElementById("logSearch")?.addEventListener(
        "input",
        debounce((e) => {
          loadAdminLogs(
            1,
            e.target.value,
            logsActionFilter,
            logsStartDate,
            logsEndDate,
          );
        }, 500),
      );

      document
        .getElementById("logActionFilter")
        ?.addEventListener("change", (e) => {
          loadAdminLogs(
            1,
            logsSearchTerm,
            e.target.value,
            logsStartDate,
            logsEndDate,
          );
        });

      document
        .getElementById("logDateFrom")
        ?.addEventListener("change", (e) => {
          logsStartDate = e.target.value;
          loadAdminLogs(
            1,
            logsSearchTerm,
            logsActionFilter,
            logsStartDate,
            logsEndDate,
          );
        });

      document.getElementById("logDateTo")?.addEventListener("change", (e) => {
        logsEndDate = e.target.value;
        loadAdminLogs(
          1,
          logsSearchTerm,
          logsActionFilter,
          logsStartDate,
          logsEndDate,
        );
      });

      document
        .getElementById("refreshLogsBtn")
        ?.addEventListener("click", () => {
          loadAdminLogs(1, "", "", "", "");
          document.getElementById("logSearch").value = "";
          document.getElementById("logDateFrom").value = "";
          document.getElementById("logDateTo").value = "";
          document.getElementById("logActionFilter").value = "";
        });

      // FIXED modal close handler - only hide, never destroy
      document
        .querySelectorAll(".close-modal, .btn-outline[id*='cancel']")
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            const modal = btn.closest(".modal");
            if (modal) {
              modal.classList.remove("show");
              // DO NOT call .remove() - these modals must stay in the DOM forever
            }
          });
        });

      document.getElementById("adminPageTitle").textContent =
        item.querySelector("span").textContent || "Dashboard";

      const sidebar = document.getElementById("adminSidebar");
      if (sidebar && window.innerWidth <= 1024) {
        sidebar.classList.remove("show");
      }

      // ── Load content when tab becomes active ─────────────────────────────
      try {
        switch (page) {
          case "dashboard":
            await loadAdminStats(); // your existing stats function
            break;

          case "users":
            await loadUsers(1); // ← important
            break;

          case "transactions":
            await loadTransactions(1); // create this if missing
            break;

          case "accounts":
            await loadAccounts(1); // create/improve this
            break;

          case "otp":
            await loadOTPMode(); // if you have this section
            break;

          case "add-money":
            loadAddMoneyRequests();
            break;

          case "external-transfers":
            loadAdminExternalTransfers(1, "all", "all");
            break;

          case "live-chat":
            loadActiveChatUsers();
            resetToUserListView();
            document.getElementById("page-live-chat").classList.add("active");
            break;

          case "support":
            await loadTickets(); // assuming you have this
            break;

          case "harvest-plans":
            await loadHarvestPlans();
            break;

          case "settings":
            await loadSettings(); // if exists
            break;

          case "logs":
            await loadAdminLogs(); // if exists
            break;

          default:
            console.log(`No loader defined for page: ${page}`);
        }
      } catch (err) {
        console.error(`Error loading ${page} page:`, err);
        showNotification(`Failed to load ${page} content`, "error");
      }
    });
  });
}

function deleteUser(userId) {
  if (!confirm("Are you sure you want to delete this user?")) return;
  console.log(`Deleting user: ${userId}`);
  alert("Delete action triggered - implement API call here");
  // Future: supabase delete + refresh table
}

// ============================================================================

// If you want safer table button handling (recommended) - add this too:
document.addEventListener("DOMContentLoaded", () => {
  document.querySelector("#usersTableBody")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const userId = btn.dataset.userId || btn.closest("tr")?.dataset.userId;
    if (!userId) return;

    if (btn.classList.contains("edit-user")) editUser(userId);
    if (btn.classList.contains("view-user")) viewUser(userId);
    if (btn.classList.contains("delete-user")) deleteUser(userId);
  });
});

// Freeze Account Button
document
  .getElementById("freezeAccountBtn")
  ?.addEventListener("click", async () => {
    //loadingManager.show("Opening Freeze modal");
    await populateUserSelects(); // ← important
    document.getElementById("freezeModal").classList.add("show");
    /*const freeze = document.getElementById("freezeModal");
    if (freeze.classList.add("show")){
      loadingManager.hide()
    }*/
  });

// Unfreeze Account Button (if you have separate button)
document
  .getElementById("unfreezeAccountBtn")
  ?.addEventListener("click", async () => {
    await populateUserSelects();
    document.getElementById("freezeModal").classList.add("show"); // same modal works for both
  });

// Update Balance Button
document
  .getElementById("updateBalanceBtn")
  ?.addEventListener("click", async () => {
    await populateUserSelects(); // ← this fixes the "null innerHTML" error
    document.getElementById("updateBalanceModal").classList.add("show");
  });

// Impersonate Button
document
  .getElementById("impersonateBtn")
  ?.addEventListener("click", async () => {
    await populateUserSelects();
    document.getElementById("impersonateModal").classList.add("show");
  });

// Load OTP mode
async function loadOTPMode() {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/settings`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const settings = await response.json();
      const otpSetting = settings.find((s) => s.setting_key === "otp_mode");
      otpMode = otpSetting?.setting_value || "off";

      const otpToggle = document.getElementById("otpModeToggle");
      const otpStatus = document.getElementById("otpModeStatus");

      if (otpToggle) {
        otpToggle.checked = otpMode === "on";
        otpStatus.textContent = otpMode === "on" ? "Enabled" : "Disabled";
        otpStatus.className = `otp-mode-status ${otpMode === "on" ? "active" : ""}`;
      }
    }
  } catch (error) {
    console.error("Error loading OTP mode:", error);
  }
}

// Toggle OTP mode
document
  .getElementById("otpModeToggle")
  ?.addEventListener("change", async (e) => {
    const mode = e.target.checked ? "on" : "off";

    try {
      const response = await fetch(`${API_BASE_URL}/admin/toggle-otp-mode`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode }),
      });

      if (response.ok) {
        otpMode = mode;
        document.getElementById("otpModeStatus").textContent =
          mode === "on" ? "Enabled" : "Disabled";
        document.getElementById("otpModeStatus").className =
          `otp-mode-status ${mode === "on" ? "active" : ""}`;
        showNotification(`OTP mode turned ${mode}`, "success");
      } else {
        e.target.checked = otpMode === "on";
        const data = await response.json();
        showNotification(data.error || "Failed to toggle OTP mode", "error");
      }
    } catch (error) {
      console.error("Error toggling OTP mode:", error);
      e.target.checked = otpMode === "on";
      showNotification("Failed to toggle OTP mode", "error");
    }
  });

// Currency formatting for NGN
function formatMoneyNGN(amount) {
  if (amount === undefined || amount === null) return "₦0.00";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Simple NGN formatter without symbol (for table cells)
function formatAmountNGN(amount) {
  if (amount === undefined || amount === null) return "0.00";
  return amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

// Load users
// ==================== OPTIMIZED ADMIN USERS TABLE WITH BACKWARD COMPATIBILITY ====================

// Global variables for pagination and filtering
let currentUsersPage = 1;
let usersSearchTerm = "";
let usersStatusFilter = "";
let isLoadingUsers = false;
let totalUsersPages = 1;

// REPLACE your existing loadUsers function with this one
async function loadUsers(page = 1, search = "", status = "") {
  // PREVENT DUPLICATE REQUESTS
  if (isLoadingUsers) return;

  // BACKWARD COMPATIBILITY: Update global variables if parameters are passed
  // This ensures old code that calls loadUsers(1, "john", "active") still works
  if (search !== undefined && search !== "") {
    usersSearchTerm = search;
  }
  if (status !== undefined && status !== "") {
    usersStatusFilter = status;
  }

  // Update current page
  currentUsersPage = page;

  isLoadingUsers = true;

  // Show loading indicator
  const tbody = document.getElementById("usersTableBody");
  if (tbody) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Loading users...</td></tr>';
  }

  try {
    // Build URL with all filters
    let url = `${API_BASE_URL}/admin/users?page=${currentUsersPage}&limit=25`;
    if (usersSearchTerm)
      url += `&search=${encodeURIComponent(usersSearchTerm)}`;
    if (usersStatusFilter) url += `&status=${usersStatusFilter}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to load users: ${response.status}`);
    }

    const data = await response.json();

    // Store total pages for pagination
    totalUsersPages = data.pagination?.pages || 1;

    // Update the table with optimized rendering
    updateOptimizedUsersTable(data.users || []);

    // Update pagination controls
    updateOptimizedUsersPagination(data.pagination);

    // Update user selects for dropdowns (beneficiaries, etc.)
    populateUserSelectsOptimized(data.users || []);
  } catch (error) {
    console.error("Error loading users:", error);
    const tbody = document.getElementById("usersTableBody");
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align: center; color: #ef4444;">Failed to load users. Please try again.</td></tr>';
    }
    showNotification("Failed to load users", "error");
  } finally {
    isLoadingUsers = false;
  }
}

// REPLACE your existing updateUsersTable function with this
function updateOptimizedUsersTable(users) {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align: center; padding: 40px;">No users found</td></tr>';
    return;
  }

  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();

  users.forEach((user) => {
    const row = document.createElement("tr");

    // Calculate total balance from accounts if not already provided
    const totalBalance =
      user.total_balance ||
      user.accounts?.reduce((sum, acc) => sum + (acc.balance || 0), 0) ||
      0;

    // Get status classes
    let statusClass = "active";
    let statusText = "Active";
    if (user.is_frozen) {
      statusClass = "frozen";
      statusText = "Frozen";
    } else if (!user.is_active) {
      statusClass = "inactive";
      statusText = "Inactive";
    }

    row.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="admin-avatar" style="width: 35px; height: 35px; background: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white;">
            ${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}
          </div>
          <div>
            <strong>${escapeHtml(user.first_name || "")} ${escapeHtml(user.last_name || "")}</strong>
          </div>
        </div>
      </td>
      <td>${escapeHtml(user.email || "")}</td>
      <td>
        <span class="status-badge ${statusClass}">
          ${statusText}
        </span>
      </td>
      <td>
        <span class="status-badge ${user.kyc_status || "pending"}">
          ${(user.kyc_status || "pending").toUpperCase()}
        </span>
      </td>
      <td>${formatMoneyNGN(totalBalance)}</td>
      <td>${new Date(user.created_at).toLocaleDateString()}</td>
      <td>
        <button class="action-btn view" onclick="viewUser('${user.id}')" title="View Details">
          <i class="fas fa-eye"></i>
        </button>
        <button class="action-btn edit" onclick="editUser('${user.id}')" title="Edit User">
          <i class="fas fa-edit"></i>
        </button>
        <button class="action-btn freeze" onclick="showFreezeModal('${user.id}', '${escapeHtml(user.first_name || "")} ${escapeHtml(user.last_name || "")}')" title="${user.is_frozen ? "Unfreeze" : "Freeze"} Account">
          <i class="fas ${user.is_frozen ? "fa-check" : "fa-ban"}"></i>
        </button>
        <button class="action-btn delete" onclick="impersonateUser('${user.id}', '${escapeHtml(user.first_name || "")} ${escapeHtml(user.last_name || "")}')" title="Impersonate">
          <i class="fas fa-mask"></i>
        </button>
      </td>
    `;
    fragment.appendChild(row);
  });

  // Clear and append all rows at once (minimal reflows)
  tbody.innerHTML = "";
  tbody.appendChild(fragment);
}

// New pagination function (replaces the old one for users only)
function updateOptimizedUsersPagination(pagination) {
  const container = document.getElementById("usersPagination");
  if (!container) return;

  if (!pagination || pagination.pages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = `
    <button class="page-btn" ${pagination.page === 1 ? "disabled" : ""} 
            onclick="loadUsersPage(${pagination.page - 1})">
      ← Prev
    </button>
  `;

  // Show limited page numbers (max 5 for cleaner UI)
  const startPage = Math.max(1, pagination.page - 2);
  const endPage = Math.min(pagination.pages, pagination.page + 2);

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === pagination.page ? "active" : ""}" 
                   onclick="loadUsersPage(${i})">${i}</button>`;
  }

  html += `
    <button class="page-btn" ${pagination.page === pagination.pages ? "disabled" : ""} 
            onclick="loadUsersPage(${pagination.page + 1})">
      Next →
    </button>
  `;

  container.innerHTML = html;
}

// New helper function for page navigation (keeps existing filters)
function loadUsersPage(page) {
  // Preserve current search and status filters
  loadUsers(page, usersSearchTerm, usersStatusFilter);
}

// Optimized populate user selects (replaces populateAllUserSelects)
function populateUserSelectsOptimized(users) {
  // Get all select elements that need user lists
  const selects = [
    document.getElementById("userSelect"),
    document.getElementById("freezeUserSelect"),
    document.getElementById("balanceUserSelect"),
    document.getElementById("accountUserSelect"),
    document.getElementById("otpUserSelect"),
    document.getElementById("unfreezeUserSelect"),
  ].filter(Boolean);

  if (selects.length === 0) return;

  const placeholder = '<option value="">Select User</option>';
  const optionsHtml = users
    .map((user) => {
      const name =
        `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Unnamed";
      const label = `${name} (${user.email || "no email"})`;
      return `<option value="${user.id}">${escapeHtml(label)}</option>`;
    })
    .join("");

  selects.forEach((select) => {
    // Store current value if any
    const currentValue = select.value;
    select.innerHTML = placeholder + optionsHtml;
    // Restore value if it still exists
    if (currentValue && users.some((u) => u.id === currentValue)) {
      select.value = currentValue;
    }
  });
}

// Debounced search handler - call this from your event listener
const debouncedUserSearch = debounce(function (searchTerm) {
  usersSearchTerm = searchTerm;
  loadUsers(1, usersSearchTerm, usersStatusFilter);
}, 500);

// Status filter handler
function onUserStatusChange(status) {
  usersStatusFilter = status;
  loadUsers(1, usersSearchTerm, usersStatusFilter);
}

// View user details function
async function viewUser(userId) {
  loadingManager.show("Loading users...");

  try {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      loadingManager.hide();

      throw new Error("Failed to load user details");
    }

    const user = await response.json();
    loadingManager.hide();

    showUserDetailsModal(user);
  } catch (error) {
    loadingManager.hide();
    console.error("Error loading user details:", error);
    showNotification("Failed to load user details", "error");
  }
}

// Show user details modal
function showUserDetailsModal(user) {
  // Remove existing modal if any
  const existingModal = document.getElementById("userDetailsModal");
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement("div");
  modal.className = "modal show";
  modal.id = "userDetailsModal";

  // Calculate total balance
  const totalBalance =
    user.accounts?.reduce((sum, acc) => sum + acc.balance, 0) || 0;

  modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
                <h3>User Details: ${user.first_name} ${user.last_name}</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                <!-- User Info Tabs -->
                <div class="user-details-tabs" style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
                    <button class="tab-btn active" onclick="switchUserDetailTab('info')">Personal Info</button>
                    <button class="tab-btn" onclick="switchUserDetailTab('accounts')">Accounts</button>
                    <button class="tab-btn" onclick="switchUserDetailTab('cards')">Cards</button>
                    <button class="tab-btn" onclick="switchUserDetailTab('transactions')">Transactions</button>
                    <button class="tab-btn" onclick="switchUserDetailTab('kyc')">KYC Documents</button>
                </div>
                
                <!-- Personal Info Tab -->
                <div id="userInfoTab" class="user-detail-tab active">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                        <div class="detail-item">
                            <div class="detail-label">User ID</div>
                            <div class="detail-value">${user.id}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Email</div>
                            <div class="detail-value">${user.email}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">First Name</div>
                            <div class="detail-value">${user.first_name}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Last Name</div>
                            <div class="detail-value">${user.last_name}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Phone</div>
                            <div class="detail-value">${user.phone || "N/A"}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Date of Birth</div>
                            <div class="detail-value">${user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString() : "N/A"}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Age</div>
                            <div class="detail-value">${user.age || "N/A"}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">ID Type</div>
                            <div class="detail-value">${user.identification_type ? user.identification_type.toUpperCase() : "N/A"}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">ID Number</div>
                            <div class="detail-value">${user.identification_number || "N/A"}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Address</div>
                            <div class="detail-value">${user.address || "N/A"}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">City</div>
                            <div class="detail-value">${user.city || "N/A"}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Country</div>
                            <div class="detail-value">${user.country || "N/A"}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Postal Code</div>
                            <div class="detail-value">${user.postal_code || "N/A"}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Role</div>
                            <div class="detail-value">
                                <span class="status-badge" style="background: ${user.role === "admin" ? "#8b5cf6" : "#2563eb"}; color: white;">
                                    ${user.role.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Status</div>
                            <div class="detail-value">
                                <span class="status-badge ${user.is_frozen ? "frozen" : user.is_active ? "active" : "inactive"}">
                                    ${user.is_frozen ? "Frozen" : user.is_active ? "Active" : "Inactive"}
                                </span>
                                ${user.is_frozen ? `<br><small>Reason: ${user.freeze_reason || "Not specified"}</small>` : ""}
                            </div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">KYC Status</div>
                            <div class="detail-value">
                                <span class="status-badge ${user.kyc_status}">
                                    ${user.kyc_status.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">2FA Enabled</div>
                            <div class="detail-value">
                                <span class="status-badge ${user.two_factor_enabled ? "active" : "inactive"}">
                                    ${user.two_factor_enabled ? "Yes" : "No"}
                                </span>
                            </div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Member Since</div>
                            <div class="detail-value">${new Date(user.created_at).toLocaleDateString()}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Last Updated</div>
                            <div class="detail-value">${new Date(user.updated_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <h4 style="margin-bottom: 15px;">Quick Actions</h4>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <button class="btn btn-primary" onclick="editUser('${user.id}')">
                                <i class="fas fa-edit"></i> Edit User
                            </button>
                            <button class="btn btn-warning" onclick="showFreezeModal('${user.id}', '${user.first_name} ${user.last_name}')">
                                <i class="fas fa-ban"></i> ${user.is_frozen ? "Unfreeze" : "Freeze"} Account
                            </button>
                            <button class="btn btn-success" onclick="showUpdateBalanceModal('${user.id}')">
                                <i class="fas fa-dollar-sign"></i> Update Balance
                            </button>
                            <button class="btn btn-danger" onclick="impersonateUser('${user.id}', '${user.first_name} ${user.last_name}')">
                                <i class="fas fa-mask"></i> Impersonate
                            </button>
                            <button class="btn btn-info" onclick="resetUserPassword('${user.id}')">
                                <i class="fas fa-key"></i> Reset Password
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Accounts Tab -->
                <div id="userAccountsTab" class="user-detail-tab" style="display: none;">
                    <h4 style="margin-bottom: 15px;">Total Balance: <strong>${formatMoneyNGN(totalBalance)}</strong></h4>
                    <div style="display: grid; gap: 15px;">
                        ${
                          user.accounts
                            ?.map(
                              (account) => `
                            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                    <strong>${(account.account_type || "checking").charAt(0).toUpperCase() + (account.account_type || "checking").slice(1)} Account</strong>
                                    <span>${account.account_number || ""}</span>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                                    <div>
                                        <div class="detail-label">Balance</div>
                                        <div class="detail-value">${formatMoneyNGN(account.balance || 0)}</div>
                                    </div>
                                    <div>
                                        <div class="detail-label">Available</div>
                                        <div class="detail-value">${formatMoneyNGN(account.available_balance || 0)}</div>
                                    </div>
                                    <div>
                                        <div class="detail-label">Currency</div>
                                        <div class="detail-value">${account.currency || "NGN"}</div>
                                    </div>
                                    <div>
                                        <div class="detail-label">Status</div>
                                        <div class="detail-value">
                                            <span class="status-badge ${account.status || "active"}">
                                                ${(account.status || "active").toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <div class="detail-label">Daily Limit</div>
                                        <div class="detail-value">${formatMoneyNGN(account.daily_limit || 0)}</div>
                                    </div>
                                    <div>
                                        <div class="detail-label">Monthly Limit</div>
                                        <div class="detail-value">${formatMoneyNGN(account.monthly_limit || 0)}</div>
                                    </div>
                                </div>
                                <div style="margin-top: 10px; display: flex; gap: 10px;">
                                    <button class="action-btn edit" onclick="showUpdateBalanceModal('${user.id}', '${account.id}')">
                                        Adjust Balance
                                    </button>
                                    <button class="action-btn view" onclick="viewAccountTransactions('${account.id}')">
                                        View Transactions
                                    </button>
                                </div>
                            </div>
                        `,
                            )
                            .join("") || "<p>No accounts found</p>"
                        }
                    </div>
                </div>
                
                <!-- Cards Tab -->
                <div id="userCardsTab" class="user-detail-tab" style="display: none;">
                    <div style="display: grid; gap: 15px;">
                        ${
                          user.cards
                            ?.map(
                              (card) => `
                            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                    <strong>${(card.card_type || "debit").charAt(0).toUpperCase() + (card.card_type || "debit").slice(1)} Card</strong>
                                    <span class="status-badge ${card.card_status || "inactive"}">${card.card_status || "inactive"}</span>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                                    <div>
                                        <div class="detail-label">Card Number</div>
                                        <div class="detail-value">•••• •••• •••• ${(card.card_number || "").slice(-4)}</div>
                                    </div>
                                    <div>
                                        <div class="detail-label">Expiry</div>
                                        <div class="detail-value">${card.expiry_date ? new Date(card.expiry_date).toLocaleDateString("en-US", { month: "2-digit", year: "2-digit" }) : "N/A"}</div>
                                    </div>
                                    <div>
                                        <div class="detail-label">Spending Limit</div>
                                        <div class="detail-value">${formatMoneyNGN(card.spending_limit || 0)}</div>
                                    </div>
                                </div>
                                <div style="margin-top: 10px; display: flex; gap: 10px;">
                                    <button class="action-btn edit" onclick="toggleCardStatus('${card.id}', '${card.card_status}')">
                                        ${card.card_status === "active" ? "Freeze" : "Activate"}
                                    </button>
                                    <button class="action-btn delete" onclick="reportCardAdmin('${card.id}')">
                                        Report Lost/Stolen
                                    </button>
                                </div>
                            </div>
                        `,
                            )
                            .join("") || "<p>No cards found</p>"
                        }
                    </div>
                </div>
                
                <!-- Transactions Tab -->
                <div id="userTransactionsTab" class="user-detail-tab" style="display: none;">
                    <div style="margin-bottom: 15px;">
                        <input type="text" id="transactionSearch" placeholder="Search transactions..." class="form-control" style="width: 100%;">
                    </div>
                    <div style="max-height: 400px; overflow-y: auto;">
                        <table class="data-table" style="min-width: 100%;">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Description</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="userTransactionsBody">
                                ${
                                  user.transactions
                                    ?.map(
                                      (t) => `
                                    <tr>
                                        <td>${new Date(t.created_at).toLocaleDateString()}</td>
                                        <td>${(t.transaction_type || "").replace("_", " ").toUpperCase()}</td>
                                        <td>${t.description || "-"}</td>
                                        <td style="color: ${t.to_user_id === user.id ? "#10b981" : "#ef4444"}">
                                            ${t.to_user_id === user.id ? "+" : "-"}${formatMoneyNGN(Math.abs(t.amount || 0))}
                                        </td>
                                        <td>
                                            <span class="status-badge ${t.status || "completed"}">${t.status || "completed"}</span>
                                        </td>
                                        <td>
                                            <button class="action-btn view" onclick="viewTransactionDetails('${t.id}')">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `,
                                    )
                                    .join("") ||
                                  '<tr><td colspan="6" style="text-align: center;">No transactions found</td></tr>'
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- KYC Tab -->
                <div id="userKYCTab" class="user-detail-tab" style="display: none;">
                    <div style="margin-bottom: 20px;">
                        <h4>KYC Status: 
                            <span class="status-badge ${user.kyc_status}" style="font-size: 14px;">
                                ${user.kyc_status.toUpperCase()}
                            </span>
                        </h4>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                        <div class="detail-item">
                            <div class="detail-label">ID Type</div>
                            <div class="detail-value">${user.id_type || "N/A"}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">ID Number</div>
                            <div class="detail-value">${user.id_number || "N/A"}</div>
                        </div>
                    </div>
                    
                    <div style="border: 2px dashed #e2e8f0; border-radius: 8px; padding: 30px; text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-id-card" style="font-size: 48px; color: #94a3b8; margin-bottom: 15px;"></i>
                        <p>ID Document Preview</p>
                        <p style="color: #64748b; font-size: 12px;">(Document viewing would be implemented here)</p>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button class="btn btn-success" onclick="updateKYCStatus('${user.id}', 'verified')">
                            <i class="fas fa-check"></i> Approve KYC
                        </button>
                        <button class="btn btn-warning" onclick="updateKYCStatus('${user.id}', 'pending')">
                            <i class="fas fa-clock"></i> Mark Pending
                        </button>
                        <button class="btn btn-danger" onclick="updateKYCStatus('${user.id}', 'rejected')">
                            <i class="fas fa-times"></i> Reject KYC
                        </button>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeUserDetailsModal()">Close</button>
            </div>
        </div>
    `;

  document.body.appendChild(modal);

  // Add close handlers
  modal
    .querySelector(".close-modal")
    .addEventListener("click", () => modal.remove());
}

// Switch user detail tabs
window.switchUserDetailTab = function (tabName) {
  // Update tab buttons
  document.querySelectorAll(".user-details-tabs .tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  event.target.classList.add("active");

  // Show selected tab
  document.querySelectorAll(".user-detail-tab").forEach((tab) => {
    tab.style.display = "none";
  });

  const tabMap = {
    info: "userInfoTab",
    accounts: "userAccountsTab",
    cards: "userCardsTab",
    transactions: "userTransactionsTab",
    kyc: "userKYCTab",
  };

  document.getElementById(tabMap[tabName]).style.display = "block";
};

// Close user details modal
window.closeUserDetailsModal = function () {
  const modal = document.getElementById("userDetailsModal");
  if (modal) {
    modal.remove();
  }
};

// Edit user function
async function editUser(userId) {
  loadingManager.show("Loading Details...");

  try {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      loadingManager.hide();

      throw new Error("Failed to load user data");
    }

    const user = await response.json();
    loadingManager.hide();

    showEditUserModal(user);
  } catch (error) {
    loadingManager.hide();

    console.error("Error loading user for edit:", error);
    showNotification("Failed to load user data", "error");
  }
}

// Show edit user modal
function showEditUserModal(user) {
  // Remove existing modal if any
  const existingModal = document.getElementById("editUserModal");
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement("div");
  modal.className = "modal show";
  modal.id = "editUserModal";

  modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>Edit User: ${user.first_name} ${user.last_name}</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                <form id="editUserForm">
                    <!-- Basic Information -->
                    <h4 style="margin-bottom: 15px;">Basic Information</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                        <div class="form-group">
                            <label>First Name</label>
                            <input type="text" id="editFirstName" class="form-control" value="${user.first_name || ""}" required>
                        </div>
                        <div class="form-group">
                            <label>Last Name</label>
                            <input type="text" id="editLastName" class="form-control" value="${user.last_name || ""}" required>
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="editEmail" class="form-control" value="${user.email || ""}" required>
                        </div>
                        <div class="form-group">
                            <label>Phone</label>
                            <input type="tel" id="editPhone" class="form-control" value="${user.phone || ""}">
                        </div>
                        <div class="form-group">
                            <label>Date of Birth</label>
                            <input type="date" id="editDob" class="form-control" value="${user.date_of_birth ? user.date_of_birth.split("T")[0] : ""}">
                        </div>
                    </div>
                    
                    <!-- Address Information -->
                    <h4 style="margin-bottom: 15px;">Address Information</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                        <div class="form-group" style="grid-column: span 2;">
                            <label>Address</label>
                            <input type="text" id="editAddress" class="form-control" value="${user.address || ""}">
                        </div>
                        <div class="form-group">
                            <label>City</label>
                            <input type="text" id="editCity" class="form-control" value="${user.city || ""}">
                        </div>
                        <div class="form-group">
                            <label>Country</label>
                            <input type="text" id="editCountry" class="form-control" value="${user.country || ""}">
                        </div>
                        <div class="form-group">
                            <label>Postal Code</label>
                            <input type="text" id="editPostalCode" class="form-control" value="${user.postal_code || ""}">
                        </div>
                    </div>
                    
                    <!-- Account Settings -->
                    <h4 style="margin-bottom: 15px;">Account Settings</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                        <div class="form-group">
                            <label>Role</label>
                            <select id="editRole" class="form-control">
                                <option value="user" ${user.role === "user" ? "selected" : ""}>User</option>
                                <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>KYC Status</label>
                            <select id="editKycStatus" class="form-control">
                                <option value="pending" ${user.kyc_status === "pending" ? "selected" : ""}>Pending</option>
                                <option value="verified" ${user.kyc_status === "verified" ? "selected" : ""}>Verified</option>
                                <option value="rejected" ${user.kyc_status === "rejected" ? "selected" : ""}>Rejected</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- ID Information 
                    <h4 style="margin-bottom: 15px;">Identification</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                        <div class="form-group">
                            <label>ID Type</label>
                            <select id="editIdType" class="form-control">
                                <option value="">Select ID Type</option>
                                <option value="passport" ${user.id_type === "passport" ? "selected" : ""}>Passport</option>
                                <option value="drivers_license" ${user.id_type === "drivers_license" ? "selected" : ""}>Driver's License</option>
                                <option value="national_id" ${user.id_type === "national_id" ? "selected" : ""}>National ID</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>ID Number</label>
                            <input type="text" id="editIdNumber" class="form-control" value="${user.id_number || ""}">
                        </div>
                    </div>-->

                    <!-- Identification Information -->
<h4 style="margin-bottom: 15px;">Identification</h4>
<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
  <div class="form-group">
    <label>ID Type</label>
    <select id="editIdType" class="form-control">
      <option value="">Select ID Type</option>
      <option value="nin" ${user.identification_type === "nin" ? "selected" : ""}>National ID (NIN)</option>
      <option value="bvn" ${user.identification_type === "bvn" ? "selected" : ""}>Bank Verification Number (BVN)</option>
      <option value="passport" ${user.identification_type === "passport" ? "selected" : ""}>International Passport</option>
      <option value="drivers_license" ${user.identification_type === "drivers_license" ? "selected" : ""}>Driver's License</option>
      <option value="voters_card" ${user.identification_type === "voters_card" ? "selected" : ""}>Voter's Card</option>
    </select>
  </div>
  <div class="form-group">
    <label>ID Number</label>
    <input type="text" id="editIdNumber" class="form-control" value="${user.identification_number || ""}">
  </div>
</div>

<div class="form-group">
  <label>Age</label>
  <input type="number" id="editAge" class="form-control" value="${user.age || ""}" min="18" max="120">
</div>
                    
                    <!-- Account Status -->
                    <h4 style="margin-bottom: 15px;">Account Status</h4>
                    <div style="display: flex; gap: 20px; margin-bottom: 20px;">
                        <label class="checkbox">
                            <input type="checkbox" id="editIsActive" ${user.is_active ? "checked" : ""}>
                            <span>Account Active</span>
                        </label>
                        <label class="checkbox">
                            <input type="checkbox" id="editIsFrozen" ${user.is_frozen ? "checked" : ""}>
                            <span>Account Frozen</span>
                        </label>
                        <label class="checkbox">
                            <input type="checkbox" id="editTwoFactor" ${user.two_factor_enabled ? "checked" : ""}>
                            <span>2FA Enabled</span>
                        </label>
                    </div>
                    
                    <!-- Freeze Reason (shown if frozen) -->
                    <div id="freezeReasonGroup" style="display: ${user.is_frozen ? "block" : "none"}; margin-bottom: 20px;">
                        <div class="form-group">
                            <label>Freeze Reason</label>
                            <textarea id="editFreezeReason" class="form-control" rows="2">${user.freeze_reason || ""}</textarea>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeEditUserModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveUserChanges('${user.id}')">Save Changes</button>
            </div>
        </div>
    `;

  document.body.appendChild(modal);

  // Add close handler
  modal
    .querySelector(".close-modal")
    .addEventListener("click", () => modal.remove());

  // Show/hide freeze reason based on checkbox
  const freezeCheckbox = document.getElementById("editIsFrozen");
  const freezeReasonGroup = document.getElementById("freezeReasonGroup");

  freezeCheckbox.addEventListener("change", () => {
    freezeReasonGroup.style.display = freezeCheckbox.checked ? "block" : "none";
  });
}

// Close edit user modal
window.closeEditUserModal = function () {
  const modal = document.getElementById("editUserModal");
  if (modal) {
    modal.remove();
  }
};

// Save user changes
window.saveUserChanges = async function (userId) {
  if (!userId) {
    showNotification("No user ID found", "error");
    return;
  }

  // Get all form elements safely (some might not exist)
  const getValue = (id) =>
    document.getElementById(id)?.value?.trim() || undefined;
  const getChecked = (id) => document.getElementById(id)?.checked ?? undefined;

  const updates = {
    first_name: getValue("editFirstName"),
    last_name: getValue("editLastName"),
    email: getValue("editEmail"),
    phone: getValue("editPhone"),
    date_of_birth: getValue("editDob") || null,
    address: getValue("editAddress"),
    city: getValue("editCity"),
    country: getValue("editCountry"),
    postal_code: getValue("editPostalCode"),
    role: getValue("editRole"),
    kyc_status: getValue("editKycStatus"),
    id_type: getValue("editIdType"),
    id_number: getValue("editIdNumber"),
    is_active: getChecked("editIsActive"),
    age: getValue("editAge") ? parseInt(getValue("editAge")) : null,
    identification_type: getValue("editIdType"),
    identification_number: getValue("editIdNumber"),
    is_frozen: getChecked("editIsFrozen"),
    two_factor_enabled: getChecked("editTwoFactor"),
    freeze_reason: getChecked("editIsFrozen")
      ? getValue("editFreezeReason")
      : null,
    updated_at: new Date().toISOString(),
  };

  // Remove fields that weren't changed / don't exist
  Object.keys(updates).forEach((key) => {
    if (updates[key] === undefined || updates[key] === "") {
      delete updates[key];
    }
  });

  // Show loading state on the button
  const saveBtn = document.querySelector("#editUserModal .btn-primary");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  }

  try {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();

    if (response.ok) {
      showNotification("User updated successfully", "success");

      // Close modal
      const modal = document.getElementById("editUserModal");
      if (modal) modal.remove();

      // Refresh tables
      await loadUsers();
      await loadAccounts(); // if you have oversight tab open
    } else {
      showNotification(data.error || "Failed to update user", "error");
      console.error("Backend error:", data);
    }
  } catch (err) {
    console.error("Save failed:", err);
    showNotification("Network error – please try again", "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = "Save Changes";
    }
  }
};

// Show update balance modal (with optional pre-selected account)
window.showUpdateBalanceModal = function (userId, accountId = null) {
  const modal = document.getElementById("updateBalanceModal");
  const userSelect = document.getElementById("balanceUserSelect");

  // Set user
  userSelect.value = userId;

  // Trigger change to load accounts
  const event = new Event("change");
  userSelect.dispatchEvent(event);

  // If accountId provided, wait for accounts to load then select it
  if (accountId) {
    setTimeout(() => {
      document.getElementById("balanceAccountSelect").value = accountId;
    }, 500);
  }

  modal.classList.add("show");
};

// Reset user password
window.resetUserPassword = async function (userId) {
  if (
    !confirm(
      "Are you sure you want to reset this user's password? They will receive an email with instructions.",
    )
  ) {
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/users/${userId}/reset-password`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.ok) {
      showNotification("Password reset email sent", "success");
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to reset password", "error");
    }
  } catch (error) {
    console.error("Error resetting password:", error);
    showNotification("Failed to reset password", "error");
  }
};

// Update KYC status
window.updateKYCStatus = async function (userId, status) {
  if (!confirm(`Are you sure you want to mark KYC as ${status}?`)) {
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/users/${userId}/verify-kyc`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      },
    );

    if (response.ok) {
      showNotification(`KYC status updated to ${status}`, "success");
      closeUserDetailsModal();
      await loadUsers();
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to update KYC", "error");
    }
  } catch (error) {
    console.error("Error updating KYC:", error);
    showNotification("Failed to update KYC", "error");
  }
};

// View account transactions
window.viewAccountTransactions = function (accountId) {
  // Switch to transactions tab and filter by account
  switchUserDetailTab("transactions");

  // You could implement filtering here
  showNotification("Showing transactions for selected account", "info");
};

// Toggle card status from admin
window.toggleCardStatus = async function (cardId, currentStatus) {
  const action = currentStatus === "active" ? "freeze" : "unfreeze";

  if (!confirm(`Are you sure you want to ${action} this card?`)) {
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/cards/${cardId}/toggle`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      },
    );

    if (response.ok) {
      showNotification(`Card ${action}d successfully`, "success");
      // Refresh user details
      const userId = document.querySelector("[data-user-id]")?.value;
      if (userId) {
        viewUser(userId);
      }
    } else {
      const data = await response.json();
      showNotification(data.error || `Failed to ${action} card`, "error");
    }
  } catch (error) {
    console.error("Error toggling card:", error);
    showNotification("Failed to update card", "error");
  }
};

// Report card from admin
window.reportCardAdmin = async function (cardId) {
  if (
    !confirm(
      "Are you sure you want to report this card as lost/stolen? This will permanently block the card.",
    )
  ) {
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/cards/${cardId}/report`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.ok) {
      showNotification("Card reported successfully", "success");
      // Refresh user details
      const userId = document.querySelector("[data-user-id]")?.value;
      if (userId) {
        viewUser(userId);
      }
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to report card", "error");
    }
  } catch (error) {
    console.error("Error reporting card:", error);
    showNotification("Failed to report card", "error");
  }
};

// View transaction details
window.viewTransactionDetails = async function (transactionId) {
  loadingManager.show("Loading Transaction details...");

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/transactions/${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      loadingManager.hide();

      throw new Error("Failed to load transaction details");
    }

    const transaction = await response.json();
    loadingManager.hide();

    showTransactionDetailsModal(transaction);
  } catch (error) {
    loadingManager.hide();

    console.error("Error loading transaction details:", error);
    showNotification("Failed to load transaction details", "error");
  }
};

// Show transaction details modal
function showTransactionDetailsModal(transaction) {
  const modal = document.createElement("div");
  modal.className = "modal show";
  modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>Transaction Details</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div style="display: grid; gap: 15px;">
                    <div class="detail-item">
                        <div class="detail-label">Transaction ID</div>
                        <div class="detail-value">${transaction.transaction_id}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Type</div>
                        <div class="detail-value">${transaction.transaction_type.replace("_", " ").toUpperCase()}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Amount</div>
                        <div class="detail-value">${formatMoneyNGN(transaction.amount)} ${transaction.currency || "NGN"}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Status</div>
                        <div class="detail-value">
                            <span class="status-badge ${transaction.status}">${transaction.status}</span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">From Account</div>
                        <div class="detail-value">${transaction.from_account?.account_number || "N/A"}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">To Account</div>
                        <div class="detail-value">${transaction.to_account?.account_number || "N/A"}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Description</div>
                        <div class="detail-value">${transaction.description || "N/A"}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Date</div>
                        <div class="detail-value">${new Date(transaction.created_at).toLocaleString()}</div>
                    </div>
                    ${
                      transaction.fee_amount
                        ? `
                    <div class="detail-item">
                        <div class="detail-label">Fee</div>
                        <div class="detail-value">${formatMoneyNGN(transaction.fee_amount)}</div>
                    </div>
                    `
                        : ""
                    }
                    ${
                      transaction.completed_at
                        ? `
                    <div class="detail-item">
                        <div class="detail-label">Completed</div>
                        <div class="detail-value">${new Date(transaction.completed_at).toLocaleString()}</div>
                    </div>
                    `
                        : ""
                    }
                    ${
                      transaction.is_admin_adjusted
                        ? `
                    <div class="detail-item">
                        <div class="detail-label">Admin Note</div>
                        <div class="detail-value">${transaction.admin_note || "Admin adjustment"}</div>
                    </div>
                    `
                        : ""
                    }
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Close</button>
                ${
                  transaction.status === "pending"
                    ? `
                    <button class="btn btn-success" onclick="approveTransaction('${transaction.id}')">Approve</button>
                    <button class="btn btn-danger" onclick="rejectTransaction('${transaction.id}')">Reject</button>
                `
                    : ""
                }
            </div>
        </div>
    `;

  document.body.appendChild(modal);

  modal
    .querySelector(".close-modal")
    .addEventListener("click", () => modal.remove());
}

// Approve transaction
window.approveTransaction = async function (transactionId) {
  if (!confirm("Are you sure you want to approve this transaction?")) return;

  loadingManager.show("Approving transactions...");

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/transactions/${transactionId}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.ok) {
      loadingManager.hide();

      showNotification("Transaction approved", "success");
      closeUserDetailsModal();
      await loadTransactions();
    } else {
      loadingManager();

      const data = await response.json();
      showNotification(data.error || "Failed to approve transaction", "error");
    }
  } catch (error) {
    loadingManager.hide();

    console.error("Error approving transaction:", error);
    showNotification("Failed to approve transaction", "error");
  }
};

// Reject transaction
window.rejectTransaction = async function (transactionId) {
  const reason = prompt("Please enter reason for rejection:");
  if (reason === null) return;

  loadingManager.show("Rejecting Transaction...");

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/transactions/${transactionId}/reject`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      },
    );

    if (response.ok) {
      loadingManager.hide();

      showNotification("Transaction rejected", "success");
      closeUserDetailsModal();
      await loadTransactions();
    } else {
      loadingManager.hide();

      const data = await response.json();
      showNotification(data.error || "Failed to reject transaction", "error");
    }
  } catch (error) {
    loadingManager.hide();

    console.error("Error rejecting transaction:", error);
    showNotification("Failed to reject transaction", "error");
  }
};

// Load transactions
async function loadTransactions(page = 1, filters = {}) {
  try {
    let url = `${API_BASE_URL}/admin/transactions?page=${page}`;
    if (filters.user_id) url += `&user_id=${filters.user_id}`;
    if (filters.type) url += `&type=${filters.type}`;
    if (filters.status) url += `&status=${filters.status}`;
    if (filters.start_date) url += `&start_date=${filters.start_date}`;
    if (filters.end_date) url += `&end_date=${filters.end_date}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      transactions = data.transactions;
      updateTransactionsTable(data);
    }
  } catch (error) {
    console.error("Error loading transactions:", error);
  }
}

// Update transactions table
function updateTransactionsTable(data) {
  const tbody = document.getElementById("transactionsTableBody");
  if (!tbody) return;

  tbody.innerHTML = data.transactions
    .map(
      (t) => `
        <tr>
            <td>${t.transaction_id}</td>
            <td>${t.from_account?.account_number || "N/A"}</td>
            <td>${t.to_account?.account_number || "N/A"}</td>
            <td>${formatMoneyNGN(t.amount || 0)}</td>
            <td>${t.transaction_type.replace("_", " ").toUpperCase()}</td>
            <td>
                <span class="status-badge ${t.status}">
                    ${t.status.toUpperCase()}
                </span>
            </td>
            <td>${new Date(t.created_at).toLocaleString()}</td>
            <td>
                ${
                  t.status === "pending"
                    ? `
                    <button class="action-btn view" onclick="approveTransaction('${t.id}')">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="action-btn delete" onclick="rejectTransaction('${t.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                `
                    : ""
                }
                <button class="action-btn view" onclick="viewTransactionDetails('${t.id}')">
                    <i class="fas fa-info-circle"></i>
                </button>
            </td>
        </tr>
    `,
    )
    .join("");
}

// Global variables
let currentChatUserId = null;
let adminChatSubscription = null;
let currentChannel = null;

// ────────────────────────────────────────────────
//     LIVE SUPPORT – ADMIN SIDE (basic user list)
// ────────────────────────────────────────────────

// Load list of conversations
async function loadActiveChatUsers() {
  const container = document.getElementById("liveChatUserList");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/live-chat/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(await res.text());

    const { users } = await res.json();

    if (users.length === 0) {
      container.innerHTML =
        '<div class="empty-state" style="padding: 40px; text-align: center; color: #64748b;">No active conversations yet</div>';
      return;
    }

    container.innerHTML = users
      .map(
        (user) => `
      <div class="user-row" data-user-id="${user.user_id}" style="
        padding: 14px 16px;
        border-bottom: 1px solid #f1f5f9;
        cursor: pointer;
        transition: background 0.2s;
      ">
        <div class="user-name" style="font-weight: 600; color: #1e293b;">${user.name}</div>
        <div class="user-email" style="font-size: 13px; color: #64748b; margin-top: 4px;">${user.email}</div>
        <!-- Optional: last message preview or timestamp can go here later -->
      </div>
    `,
      )
      .join("");

    // Add hover effect via JS or just use CSS :hover
  } catch (err) {
    console.error("Failed to load users:", err);
    container.innerHTML =
      '<div style="padding: 20px; color: #ef4444;">Failed to load conversations</div>';
  }
}

// Render message (admin view — incoming from right, outgoing from left)
function renderAdminMessage(msg) {
  const div = document.createElement("div");
  div.className = msg.is_from_admin ? "message sent" : "message received";
  div.innerHTML = `
    <div class="bubble">${msg.message}</div>
    <div class="time">${new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
    ${msg.is_from_admin && msg.status === "read" ? '<div class="status">✓✓</div>' : ""}
  `;
  document.getElementById("adminChatMessages").appendChild(div);
}

document
  .getElementById("adminSendReply")
  ?.addEventListener("click", async () => {
    const input = document.getElementById("adminChatInput");
    const messageText = input?.value?.trim();

    if (!messageText) return;

    const userId = document.getElementById("currentChatUserId")?.textContent;
    if (!userId) {
      showNotification("No conversation selected", "error");
      return;
    }

    const btn = document.getElementById("adminSendReply");
    btn.disabled = true;

    // ── Optimistic UI: show message immediately ─────────────────────────────
    const optimisticMsg = {
      message: messageText,
      created_at: new Date().toISOString(),
      is_from_admin: true, // admin side
    };
    appendMessage(optimisticMsg, true); // show it right away

    // Clear input early
    input.value = "";

    try {
      const res = await fetch(`${API_BASE_URL}/admin/live-chat/${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: messageText }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Send failed: ${res.status} – ${errorText}`);
      }

      showNotification("Message sent", "success");

      // Realtime will bring admin's own message again → we can ignore duplicate
      // or add a small id check later if it bothers you
    } catch (err) {
      console.error("Admin reply error:", err);
      showNotification(`Failed to send: ${err.message}`, "error");

      // Optional: remove optimistic message or mark as failed
      // For simplicity we leave it (most apps do)
    } finally {
      btn.disabled = false;
    }
  });

function appendMessage(msg, isFromMe = false) {
  const container = document.getElementById(
    window.location.pathname.includes("admin")
      ? "adminChatMessages"
      : "chatMessages",
  );
  if (!container) return;

  const div = document.createElement("div");
  div.className = `message ${isFromMe ? "from-admin" : "from-user"}`;
  div.innerHTML = `
    <div class="buble">${msg.message}</div>
    <span class="time">
      ${new Date(msg.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </span>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Click anywhere on user row → load their chat
document.addEventListener("click", async function (e) {
  const row = e.target.closest(".user-row");
  if (!row) return;

  const userId = row.dataset.userId;
  const userNameEl = row.querySelector(".user-name");
  const userName = userNameEl ? userNameEl.textContent : "User";

  // Highlight selected row
  document
    .querySelectorAll(".user-row")
    .forEach((r) => (r.style.background = ""));
  row.style.background = "#e0f2fe"; // light blue highlight (or use .active class)

  // ── Mobile: hide list, show chat ───────────────────────────────
  if (window.innerWidth < 850) {
    document.getElementById("chatListPanel").style.display = "none";
    const chatPanel = document.getElementById("chatViewPanel");
    chatPanel.classList.add("open");
    chatPanel.style.display = "flex";
  }

  // Show loading state
  const chatContainer = document.getElementById("adminChatMessages");
  const nameDisplay = document.getElementById("currentChatUserName");

  if (nameDisplay) nameDisplay.textContent = userName;
  if (document.getElementById("currentChatUserId")) {
    document.getElementById("currentChatUserId").textContent = userId;
  }

  if (chatContainer) {
    chatContainer.innerHTML =
      '<div style="text-align:center; padding:40px; color:#64748b;">Loading messages...</div>';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/live-chat/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(await res.text());

    const { messages } = await res.json();

    if (chatContainer) {
      chatContainer.innerHTML =
        messages.length === 0
          ? '<div style="text-align:center; padding:60px 20px; color:#94a3b8;">No messages yet with this user</div>'
          : messages
              .map(
                (msg) => `
            <div class="message ${msg.is_from_admin ? "from-admin" : "from-user"}" style="
              margin: 12px 0;
              text-align: ${msg.is_from_admin ? "right" : "left"};
            ">
              <div class="buble" style="
                background: ${msg.is_from_admin ? "#3b82f6" : "#f1f5f9"};
                color: ${msg.is_from_admin ? "white" : "#1e293b"};
              ">
                ${msg.message}
              </div>
              <div class="time">
                ${new Date(msg.created_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}
              </div>
            </div>
          `,
              )
              .join("");

      chatContainer.scrollTop = chatContainer.scrollHeight;
      //subscribeToLiveChat(userId);
    }
  } catch (err) {
    console.error("Failed to load chat:", err);
    if (chatContainer) {
      chatContainer.innerHTML = `<div style="color:#ef4444; padding:20px;">Error loading chat: ${err.message}</div>`;
    }
  }
});

// Reset to list view when entering Live Chat section
function resetToUserListView() {
  const listPanel = document.getElementById("chatListPanel");
  const chatPanel = document.getElementById("chatViewPanel");

  if (!listPanel || !chatPanel) return;

  // Always start with list visible
  listPanel.style.display = "block";

  // Hide chat panel
  chatPanel.style.display = "none";
  chatPanel.classList.remove("open");

  // Optional: clear chat content & selected user
  document.getElementById("adminChatMessages").innerHTML = "";
  document.getElementById("currentChatUserName").textContent =
    "Select a conversation";
  document.getElementById("currentChatUserId").textContent = "";

  // Reload user list (if needed)
  loadActiveChatUsers(); // your function that populates #liveChatUserList
}

// Back button
document.getElementById("backToListBtn")?.addEventListener("click", () => {
  if (window.innerWidth < 850) {
    document.getElementById("chatViewPanel").classList.remove("open");
    document.getElementById("chatViewPanel").style.display = "none";
    document.getElementById("chatListPanel").style.display = "block";
  }
});

// Optional: handle browser back button / resize
window.addEventListener("popstate", () => {
  if (
    window.innerWidth < 850 &&
    document.getElementById("chatViewPanel").classList.contains("open")
  ) {
    document.getElementById("backToListBtn").click();
  }
});

window.addEventListener("resize", () => {
  // If window becomes wide → always show both panels
  if (window.innerWidth >= 850) {
    document.getElementById("chatListPanel").style.display = "block";
    document.getElementById("chatViewPanel").style.display = "flex";
    document.getElementById("chatViewPanel").classList.remove("open");
  }
});

// Load tickets
async function loadTickets(status = "", priority = "") {
  try {
    let url = `${API_BASE_URL}/admin/support-tickets`;
    if (status) url += `?status=${status}`;
    if (priority) url += `${status ? "&" : "?"}priority=${priority}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      tickets = data.tickets;
      updateTicketsList(data.tickets);
    }
  } catch (error) {
    console.error("Error loading tickets:", error);
  }
}

// Update tickets list
function updateTicketsList(tickets) {
  const ticketsList = document.getElementById("adminTicketsList");
  if (!ticketsList) return;

  ticketsList.innerHTML = tickets
    .map(
      (ticket) => `
        <div class="ticket-item" onclick="loadTicketChat('${ticket.id}')">
            <div class="ticket-subject">${ticket.subject}</div>
            <div style="display: flex; gap: 10px; margin-top: 5px;">
                <span class="ticket-priority priority-${ticket.priority}">
                    ${ticket.priority.toUpperCase()}
                </span>
                <span class="status-badge ${ticket.status}">
                    ${ticket.status.replace("_", " ").toUpperCase()}
                </span>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 5px;">
                ${ticket.user?.first_name} ${ticket.user?.last_name} • ${timeAgo(ticket.created_at)}
            </div>
        </div>
    `,
    )
    .join("");
}

// Load ticket chat
async function loadTicketChat(ticketId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/support-tickets/${ticketId}/messages`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        showNotification("Ticket not found", "error");
        return;
      }
      throw new Error(`Failed to load messages: ${response.status}`);
    }

    const data = await response.json();
    displayTicketChat(ticketId, data.messages, data.ticket);
  } catch (error) {
    console.error("Error loading ticket chat:", error);
    const chatContainer = document.getElementById("adminTicketChat");
    if (chatContainer) {
      chatContainer.innerHTML = `
        <div class="chat-placeholder" style="text-align: center; padding: 60px 20px;">
          <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #ef4444;"></i>
          <p style="margin-top: 15px;">Failed to load conversation. Please try again.</p>
          <button class="btn btn-outline" onclick="loadTickets()">Refresh</button>
        </div>
      `;
    }
  }
}

// Display ticket chat
function displayTicketChat(ticketId, messages, ticketInfo) {
  const chatContainer = document.getElementById("adminTicketChat");
  if (!chatContainer) return;

  const userName = ticketInfo?.user
    ? `${ticketInfo.user.first_name || ""} ${ticketInfo.user.last_name || ""}`.trim() ||
      ticketInfo.user.email
    : "User";

  chatContainer.innerHTML = `
    <div class="chat-header" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid #e2e8f0;">
      <div>
        <h4 style="margin: 0;">Conversation with ${escapeHtml(userName)}</h4>
        <span class="status-badge ${ticketInfo?.status || "open"}" style="margin-top: 5px;">${(ticketInfo?.status || "OPEN").toUpperCase()}</span>
      </div>
      <div class="ticket-actions">
        <button class="btn btn-sm btn-outline" onclick="closeSupportTicket('${ticketId}')" ${ticketInfo?.status === "closed" ? "disabled" : ""}>
          <i class="fas fa-check-circle"></i> Close Ticket
        </button>
      </div>
    </div>
    <div class="chat-messages" id="ticketMessages" style="flex: 1; overflow-y: auto; padding: 20px; min-height: 300px; max-height: 400px;">
      ${
        messages.length === 0
          ? '<div style="text-align: center; padding: 60px 20px; color: #64748b;">No messages yet. Type a reply below to start the conversation.</div>'
          : messages
              .map(
                (msg) => `
          <div class="message ${msg.is_admin_reply ? "admin" : "user"}">
            <div class="message-avatar">
              ${msg.is_admin_reply ? '<i class="fas fa-user-shield"></i>' : '<i class="fas fa-user"></i>'}
            </div>
            <div class="message-content" style="max-width: 70%;">
              <div class="message-text">${escapeHtml(msg.message)}</div>
              <div class="message-time">${new Date(msg.created_at).toLocaleString()}</div>
            </div>
          </div>
        `,
              )
              .join("")
      }
    </div>
    ${
      ticketInfo?.status !== "closed"
        ? `
      <div class="chat-input" style="padding: 15px 20px; border-top: 1px solid #e2e8f0; display: flex; gap: 10px;">
        <input type="text" id="ticketReplyInput" class="form-control" placeholder="Type your reply..." style="flex: 1;">
        <button class="btn btn-primary" onclick="sendTicketReply('${ticketId}')">Send</button>
      </div>
    `
        : `
      <div class="ticket-closed-banner" style="padding: 15px 20px; background: #f1f5f9; text-align: center; color: #64748b;">
        <i class="fas fa-lock"></i> This ticket is closed
      </div>
    `
    }
  `;

  // Scroll to bottom of messages
  const messagesDiv = document.getElementById("ticketMessages");
  if (messagesDiv) {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // Focus on input
  const input = document.getElementById("ticketReplyInput");
  if (input) input.focus();

  // Allow Enter key to send
  if (input) {
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendTicketReply(ticketId);
      }
    });
  }
}

// Send ticket reply
async function sendTicketReply(ticketId) {
  const input = document.getElementById("ticketReplyInput");
  const message = input?.value?.trim();

  if (!message) {
    showNotification("Please enter a message", "error");
    return;
  }

  const sendBtn = document.querySelector(
    `button[onclick="sendTicketReply('${ticketId}')"]`,
  );
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/support-tickets/${ticketId}/reply`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      },
    );

    if (response.ok) {
      if (input) input.value = "";
      await loadTicketChat(ticketId);
      await loadTickets();
      showNotification("Reply sent successfully", "success");
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to send reply", "error");
    }
  } catch (error) {
    console.error("Error sending reply:", error);
    showNotification("Failed to send reply", "error");
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = "Send";
    }
  }
}

// Close support ticket function
async function closeSupportTicket(ticketId) {
  if (!confirm("Are you sure you want to close this ticket?")) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/support-tickets/${ticketId}/close`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resolution: "Ticket closed by admin" }),
      },
    );

    if (response.ok) {
      showNotification("Ticket closed successfully", "success");
      await loadTicketChat(ticketId);
      await loadTickets();
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to close ticket", "error");
    }
  } catch (error) {
    console.error("Error closing ticket:", error);
    showNotification("Failed to close ticket", "error");
  }
}

// Make functions globally available
window.loadAdminLogs = loadAdminLogs;
window.loadAdminLogsPage = loadAdminLogsPage;
window.viewLogDetails = viewLogDetails;
window.closeSupportTicket = closeSupportTicket;

// load accounts
async function loadAccounts(page = 1) {
  try {
    const params = new URLSearchParams({
      page,
      limit: 20,
    });

    const search = document.getElementById("accountSearch")?.value?.trim();
    const status = document.getElementById("accountStatusFilter")?.value;

    if (search) params.append("search", search);
    if (status) params.append("status", status);

    const res = await fetch(`${API_BASE_URL}/admin/accounts?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(await res.text());

    const { accounts, pagination } = await res.json();

    const tbody = document.getElementById("accountsTableBody");
    tbody.innerHTML = "";

    accounts.forEach((acc) => {
      const user = acc.users || {};
      const ownerName =
        user.first_name && user.last_name
          ? `${user.first_name} ${user.last_name}`
          : user.email || "Unknown";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${acc.account_number}</td>
        <td>
          <div class="user-cell">
            <span>${ownerName}</span>
            <small>${user.email || "—"}</small>
          </div>
        </td>
        <td>${acc.account_type}</td>
        <td class="amount">₦${acc.balance?.toFixed(2) || "0.00"}</td>
        <td class="amount">₦${acc.available_balance?.toFixed(2) || "0.00"}</td>
        <td>
          <span class="status-badge status-${acc.status}">
            ${acc.status}
          </span>
        </td>
        <td>${user.kyc_status || "—"}</td>
        <td>${new Date(acc.created_at).toLocaleDateString()}</td>
        <td class="actions">
          <button class="btn-icon" onclick="viewUser('${user.id}')">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn-icon" onclick="adjustBalance('${acc.id}', '${ownerName}')">
            <i class="fas fa-dollar-sign"></i>
          </button>
          ${
            acc.status !== "frozen"
              ? `
            <button class="btn-icon danger" onclick="showFreezeModal('${user.id}', '${escapeHtml(user.first_name || "")} ${escapeHtml(user.last_name || "")}')" title="${user.is_frozen ? "Unfreeze" : "Freeze"} Account">
              <i class="fas fa-snowflake"></i>
            </button>
          `
              : `
            <button class="btn-icon warning" onclick="unfreezeAccount('${acc.user_id}')">
              <i class="fas fa-sun"></i>
            </button>
          `
          }
        </td>
      `;
      tbody.appendChild(row);
    });

    // Pagination (simple version)
    updatePagination("accountsPagination", pagination, loadAccounts);
  } catch (err) {
    console.error("Accounts load error:", err);
    showNotification("Could not load accounts", "error");
  }
}

// Populate ALL user selects (run every time a modal opens)
async function populateUserSelects() {
  //loadingManager.show("Processing...");

  try {
    const res = await fetch(`${API_BASE_URL}/admin/users?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { users } = await res.json();

    // Freeze modal
    const freezeSelect = document.getElementById("UserSelect");
    if (freezeSelect) {
      //loadingManager.hide();
      freezeSelect.innerHTML =
        '<option value="">Select User</option>' +
        users
          .map(
            (u) =>
              `<option value="${u.id}">${u.first_name} ${u.last_name} (${u.email})</option>`,
          )
          .join("");
    }

    const unfreezeSelect = document.getElementById("unfreezeUserSelect");

    if (unfreezeSelect) {
      unfreezeSelect.innerHTML = '<option value="">Select User</option>';
      users.forEach((u) => {
        // Optional: only show frozen users
        if (u.is_frozen) {
          const opt = document.createElement("option");
          opt.value = u.id;
          opt.textContent = `${u.first_name} ${u.last_name} (${u.email}) - Frozen`;
          unfreezeSelect.appendChild(opt);
        }
      });
    }

    // Update Balance modal
    const balanceUserSelect = document.getElementById("balanceUserSelect");
    if (balanceUserSelect) {
      balanceUserSelect.innerHTML =
        '<option value="">Select User</option>' +
        users
          .map(
            (u) =>
              `<option value="${u.id}">${u.first_name} ${u.last_name} (${u.email})</option>`,
          )
          .join("");
    }

    // Impersonate / other modals if you have more
  } catch (e) {
    console.error("Failed to populate user selects", e);
  }
}

// Open unfreeze modal (can be called with or without pre-selected user)
window.openUnfreezeModal = async function (userId = null) {
  await populateUserSelects(); // make sure dropdown is fresh

  const modal = document.getElementById("unfreezeModal");
  if (!modal) return;

  if (userId) {
    document.getElementById("unfreezeUserSelect").value = userId;
  }

  modal.classList.add("show");
};

// Toggle payment details section based on selected unfreeze method
const unfreezeMethodRadios = document.querySelectorAll(
  'input[name="unfreezeMethod"]',
);
const paymentDetailsSection = document.getElementById("paymentDetailsSection");
const unfreezePaymentMethod = document.getElementById("unfreezePaymentMethod");
const cryptoFields = document.getElementById("cryptoPaymentFields");
const bankFields = document.getElementById("bankPaymentFields");

function togglePaymentDetails() {
  const selected = document.querySelector(
    'input[name="unfreezeMethod"]:checked',
  ).value;
  paymentDetailsSection.style.display = selected === "otp" ? "block" : "none";
}

function togglePaymentMethodFields() {
  const method = unfreezePaymentMethod.value;
  cryptoFields.style.display = method === "crypto" ? "block" : "none";
  bankFields.style.display = method === "bank" ? "block" : "none";
}

unfreezeMethodRadios.forEach((radio) =>
  radio.addEventListener("change", togglePaymentDetails),
);
unfreezePaymentMethod.addEventListener("change", togglePaymentMethodFields);
togglePaymentDetails(); // initial state
togglePaymentMethodFields(); // initial state

// Close unfreeze modal
document.getElementById("cancelUnfreeze")?.addEventListener("click", () => {
  document.getElementById("unfreezeModal")?.classList.remove("show");
});

document
  .getElementById("confirmUnfreeze")
  ?.addEventListener("click", async () => {
    const userId = document.getElementById("unfreezeUserSelect").value;
    const note = document.getElementById("unfreezeReason").value.trim(); // optional

    if (!userId) {
      showNotification("Please select user", "error");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/users/${userId}/toggle-freeze`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ freeze: false }),
        },
      );

      if (response.ok) {
        showNotification("Account unfrozen successfully", "success");
        await loadUsers();
      } else {
        const data = await response.json();
        showNotification(data.error || "Failed to unfreeze account", "error");
      }

      //const data = await response.json();
      // showNotification("Account unfrozen successfully", "success");
      // close modal, refresh users table, etc.
    } catch (err) {
      console.error("Unfreeze error:", err);
      showNotification(err.message || "Failed to unfreeze account", "error");
    }
  });

// Optional: close modal when clicking outside or ×
document.querySelectorAll("#unfreezeModal .close-modal").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById("unfreezeModal").classList.remove("show");
  });
});

// Show freeze modal
function showFreezeModal(userId, userName) {
  const modal = document.getElementById("freezeModal");
  const select = document.getElementById("freezeUserSelect");

  // Add user to select if not exists
  let option = select.querySelector(`option[value="${userId}"]`);
  if (!option) {
    option = document.createElement("option");
    option.value = userId;
    option.textContent = userName;
    select.appendChild(option);
  }

  select.value = userId;
  modal.classList.add("show");
}

// Confirm freeze
document
  .getElementById("confirmFreeze")
  ?.addEventListener("click", async () => {
    const userId = document.getElementById("freezeUserSelect").value;
    const reason = document.getElementById("freezeReason").value;
    const unfreezeMethod = document.querySelector(
      'input[name="unfreezeMethod"]:checked',
    )?.value;

    if (!userId || !reason) {
      showNotification("Please select user and provide reason", "error");
      return;
    }

    const payload = {
      freeze: true,
      reason,
      unfreeze_method: unfreezeMethod,
    };

    if (unfreezeMethod === "otp") {
      const amount = parseFloat(
        document.getElementById("unfreezeAmount").value,
      );
      const paymentMethod = document.getElementById(
        "unfreezePaymentMethod",
      ).value;

      if (isNaN(amount) || amount <= 0) {
        showNotification("Please enter a valid amount", "error");
        return;
      }

      let paymentDetails = { amount, method: paymentMethod };

      if (paymentMethod === "crypto") {
        const address = document
          .getElementById("unfreezeCryptoAddress")
          .value.trim();
        const network = document
          .getElementById("unfreezeCryptoNetwork")
          .value.trim();
        if (!address) {
          showNotification("Please enter a crypto address", "error");
          return;
        }
        paymentDetails.address = address;
        paymentDetails.network = network;
      } else if (paymentMethod === "bank") {
        const bankName = document
          .getElementById("unfreezeBankName")
          .value.trim();
        const accountNumber = document
          .getElementById("unfreezeBankAccount")
          .value.trim();
        const accountName = document
          .getElementById("unfreezeBankAccountName")
          .value.trim();
        if (!bankName || !accountNumber || !accountName) {
          showNotification("Please fill all bank details", "error");
          return;
        }
        paymentDetails.bank_name = bankName;
        paymentDetails.account_number = accountNumber;
        paymentDetails.account_name = accountName;
        paymentDetails.swift = document
          .getElementById("unfreezeBankSwift")
          .value.trim();
      }

      payload.unfreeze_payment_details = paymentDetails;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/users/${userId}/toggle-freeze`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (response.ok) {
        document.getElementById("freezeModal").classList.remove("show");
        showNotification("Account frozen successfully", "success");
        document.getElementById("freezeReason").value = "";
        await loadUsers();
        await loadAccounts();
      } else {
        const data = await response.json();
        showNotification(data.error || "Failed to freeze account", "error");
      }
    } catch (error) {
      console.error("Error freezing account:", error);
      showNotification("Failed to freeze account", "error");
    }
  });

// Unfreeze account
async function unfreezeAccount(userId) {
  if (!confirm("Are you sure you want to unfreeze this account?")) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/users/${userId}/toggle-freeze`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ freeze: false }),
      },
    );

    if (response.ok) {
      showNotification("Account unfrozen successfully", "success");
      await loadUsers();
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to unfreeze account", "error");
    }
  } catch (error) {
    console.error("Error unfreezing account:", error);
    showNotification("Failed to unfreeze account", "error");
  }
}

// Update balance modal
document.getElementById("updateBalanceBtn")?.addEventListener("click", () => {
  const modal = document.getElementById("updateBalanceModal");
  const userSelect = document.getElementById("balanceUserSelect");

  //await populateUserSelects();

  modal.classList.add("show");
});

// Handle make it look like transfer checkbox
document
  .getElementById("makeItLookLikeTransfer")
  ?.addEventListener("change", (e) => {
    const section = document.getElementById("transferFromSection");
    section.style.display = e.target.checked ? "block" : "none";

    if (e.target.checked) {
      // Populate users for transfer from
      const fromUserSelect = document.getElementById("transferFromUser");
      fromUserSelect.innerHTML =
        '<option value="">Select User</option>' +
        users
          .filter(
            (u) => u.id !== document.getElementById("balanceUserSelect").value,
          )
          .map(
            (u) =>
              `<option value="${u.id}">${u.first_name} ${u.last_name}</option>`,
          )
          .join("");
    }
  });

// Load user accounts when user selected
document
  .getElementById("balanceUserSelect")
  ?.addEventListener("change", async (e) => {
    const userId = e.target.value;
    if (!userId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const user = await response.json();
        const accountSelect = document.getElementById("balanceAccountSelect");
        accountSelect.innerHTML =
          '<option value="">Select Account</option>' +
          user.accounts
            .map(
              (a) =>
                `<option value="${a.id}">${a.account_type} - ${a.account_number} ($${a.balance})</option>`,
            )
            .join("");
      }
    } catch (error) {
      console.error("Error loading user accounts:", error);
    }
  });

// Submit balance update
document
  .getElementById("submitBalanceUpdate")
  ?.addEventListener("click", async () => {
    const userId = document.getElementById("balanceUserSelect").value;
    const accountId = document.getElementById("balanceAccountSelect").value;
    const action = document.getElementById("balanceAction").value;
    const amount = parseFloat(document.getElementById("balanceAmount").value);
    const description = document.getElementById("balanceDescription").value;
    const makeItLookLikeTransfer = document.getElementById(
      "makeItLookLikeTransfer",
    ).checked;
    const fromUserId = document.getElementById("transferFromUser")?.value;

    if (!userId || !accountId || !amount) {
      showNotification("Please fill in all fields", "error");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/users/${userId}/update-balance`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            account_id: accountId,
            amount,
            action,
            make_it_look_like_transfer: makeItLookLikeTransfer,
            from_user_id: fromUserId,
            description,
          }),
        },
      );

      if (response.ok) {
        document.getElementById("updateBalanceModal").classList.remove("show");
        showNotification("Balance updated successfully", "success");
        document.getElementById("updateBalanceForm").reset();
        document.getElementById("transferFromSection").style.display = "none";
        await loadUsers();
      } else {
        const data = await response.json();
        showNotification(data.error || "Failed to update balance", "error");
      }
    } catch (error) {
      console.error("Error updating balance:", error);
      showNotification("Failed to update balance", "error");
    }
  });

// Generate OTP
document
  .getElementById("generateOtpCodeBtn")
  ?.addEventListener("click", async () => {
    const userId = document.getElementById("otpUserSelect").value;
    const otpType = document.getElementById("otpType").value;
    const transactionId = document.getElementById("otpTransactionId").value;

    if (!userId) {
      showNotification("Please select a user", "error");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/generate-otp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          otp_type: otpType,
          transaction_id: transactionId || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        document.getElementById("generatedOtp").style.display = "block";
        document.getElementById("otpCodeDisplay").textContent = data.otp_code;
        document.getElementById("otpExpiry").textContent = new Date(
          data.expires_at,
        ).toLocaleString();

        // Copy to clipboard
        navigator.clipboard.writeText(data.otp_code);
        showNotification("OTP generated and copied to clipboard", "success");
      } else {
        showNotification(data.error || "Failed to generate OTP", "error");
      }
    } catch (error) {
      console.error("Error generating OTP:", error);
      showNotification("Failed to generate OTP", "error");
    }
  });

// Impersonate user
async function impersonateUser(userId, userName) {
  const modal = document.getElementById("impersonateModal");
  document.getElementById("impersonateUserName").textContent = userName;
  modal.classList.add("show");

  document.getElementById("confirmImpersonate").onclick = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/impersonate/${userId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("impersonating", "true");
        window.location.href = "dashboard.html";
      } else {
        showNotification(data.error || "Failed to impersonate", "error");
        modal.classList.remove("show");
      }
    } catch (error) {
      console.error("Impersonation error:", error);
      showNotification("Failed to impersonate", "error");
      modal.classList.remove("show");
    }
  };
}

// Load admin stats
async function loadAdminStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/stats`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const stats = await response.json();

      document.getElementById("totalUsers").textContent = stats.totalUsers;
      document.getElementById("activeUsers").textContent = stats.activeUsers;
      document.getElementById("frozenUsers").textContent = stats.frozenUsers;
      document.getElementById("pendingKYC").textContent = stats.pendingKYC;
      document.getElementById("todayTransactions").textContent =
        stats.todayTransactions;
      document.getElementById("todayVolume").textContent = formatMoneyNGN(
        stats.todayVolume,
      );
    }
  } catch (error) {
    console.error("Error loading stats:", error);
  }
}

// Filter handlers
document.getElementById("userSearch")?.addEventListener(
  "input",
  debounce((e) => {
    loadUsers(
      1,
      e.target.value,
      document.getElementById("userStatusFilter").value,
    );
  }, 500),
);

document.getElementById("userStatusFilter")?.addEventListener("change", (e) => {
  loadUsers(1, document.getElementById("userSearch").value, e.target.value);
});

document
  .getElementById("transactionTypeFilter")
  ?.addEventListener("change", () => {
    applyTransactionFilters();
  });

document
  .getElementById("transactionStatusFilter")
  ?.addEventListener("change", () => {
    applyTransactionFilters();
  });

document
  .getElementById("transactionDateFrom")
  ?.addEventListener("change", () => {
    applyTransactionFilters();
  });

document.getElementById("transactionDateTo")?.addEventListener("change", () => {
  applyTransactionFilters();
});

function applyTransactionFilters() {
  const filters = {
    type: document.getElementById("transactionTypeFilter").value,
    status: document.getElementById("transactionStatusFilter").value,
    start_date: document.getElementById("transactionDateFrom").value,
    end_date: document.getElementById("transactionDateTo").value,
  };

  loadTransactions(1, filters);
}

// Ticket filters
document
  .getElementById("ticketStatusFilter")
  ?.addEventListener("change", (e) => {
    loadTickets(
      e.target.value,
      document.getElementById("ticketPriorityFilter").value,
    );
  });

document
  .getElementById("ticketPriorityFilter")
  ?.addEventListener("change", (e) => {
    loadTickets(
      document.getElementById("ticketStatusFilter").value,
      e.target.value,
    );
  });

// Create user modal
document.getElementById("createUserBtn")?.addEventListener("click", () => {
  document.getElementById("createUserModal").classList.add("show");
});

// Submit create user
document
  .getElementById("submitCreateUser")
  ?.addEventListener("click", async () => {
    const userData = {
      first_name: document.getElementById("newUserFirstName").value,
      last_name: document.getElementById("newUserLastName").value,
      email: document.getElementById("newUserEmail").value,
      phone: document.getElementById("newUserPhone").value,
      password: document.getElementById("newUserPassword").value,
      role: document.getElementById("newUserRole").value,
    };

    if (
      !userData.first_name ||
      !userData.last_name ||
      !userData.email ||
      !userData.phone ||
      !userData.password
    ) {
      showNotification("Please fill in all fields", "error");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        document.getElementById("createUserModal").classList.remove("show");
        showNotification("User created successfully", "success");
        document.getElementById("createUserForm").reset();
        await loadUsers();
      } else {
        const data = await response.json();
        showNotification(data.error || "Failed to create user", "error");
      }
    } catch (error) {
      console.error("Error creating user:", error);
      showNotification("Failed to create user", "error");
    }
  });

// Save settings
document.getElementById("saveSettings")?.addEventListener("click", async () => {
  const settings = {
    default_currency: document.getElementById("defaultCurrency").value,
    transaction_fee: document.getElementById("transactionFee").value,
    daily_limit: document.getElementById("dailyLimit").value,
    card_purchase_method: document.getElementById("cardPurchaseMethod").value,
    admin_2fa: document.getElementById("admin2FA").checked,
    session_timeout: document.getElementById("sessionTimeout").value,
    max_login_attempts: document.getElementById("maxLoginAttempts").value,
    geo_blocking: document.getElementById("geoBlocking").checked,
    blocked_countries: document.getElementById("blockedCountries").value,
    suspicious_threshold: document.getElementById("suspiciousThreshold").value,
  };

  try {
    const response = await fetch(`${API_BASE_URL}/admin/settings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });

    if (response.ok) {
      showNotification("Settings saved successfully", "success");
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to save settings", "error");
    }
  } catch (error) {
    console.error("Error saving settings:", error);
    showNotification("Failed to save settings", "error");
  }
});

// Navigation
document.querySelectorAll(".admin-nav .nav-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();

    const page = item.dataset.page;
    if (!page) return;

    // Update active state
    document
      .querySelectorAll(".admin-nav .nav-item")
      .forEach((nav) => nav.classList.remove("active"));
    item.classList.add("active");

    // Show selected page
    document
      .querySelectorAll(".admin-page")
      .forEach((p) => p.classList.remove("active"));
    document.getElementById(`page-${page}`).classList.add("active");

    // Update title
    document.getElementById("adminPageTitle").textContent =
      item.querySelector("span").textContent;
  });
});

// Sidebar toggle
const adminSidebar = document.getElementById("adminSidebar");
document.getElementById("sidebarToggle")?.addEventListener("click", () => {
  adminSidebar.classList.toggle("collapsed");
});

// Mobile menu toggle
document.getElementById("mobileMenuBtn")?.addEventListener("click", () => {
  adminSidebar.classList.toggle("show");
});

// Logout
document.getElementById("adminLogout")?.addEventListener("click", logout);

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("impersonating");
  window.location.href = "index.html";
}

// Check if impersonating
if (localStorage.getItem("impersonating")) {
  document.getElementById("impersonateExit").style.display = "flex";
}

// Exit impersonation
document
  .getElementById("impersonateExit")
  ?.addEventListener("click", async () => {
    localStorage.removeItem("token");
    localStorage.removeItem("impersonating");

    // Relogin as admin
    window.location.href = "login.html";
  });

// Real-time updates
function startRealTimeUpdates() {
  setInterval(async () => {
    if (document.visibilityState === "visible") {
      await loadAdminStats();
    }
  }, 30000);

  // update live chat every 15 seconds
  setInterval(async () => {
    if (document.visibilityState === "visible") {
      await loadAdminExternalTransfers(1, "all", "all");
    }
  }, 30000);

  setInterval(async () => {
    if (document.visibilityState === "visible") {
      await loadAddMoneyRequests();
    }
  }, 30000);

  setInterval(async () => {
    if (document.visibilityState === "visible") {
      await loadActiveChatUsers();
    }
  }, 12000);
}

// Utility functions
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

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

function updatePagination(elementId, pagination, callback) {
  const container = document.getElementById(elementId);
  if (!container) return;

  let html = "";
  for (let i = 1; i <= pagination.pages; i++) {
    html += `<button class="page-btn ${i === pagination.page ? "active" : ""}" onclick="callback(${i})">${i}</button>`;
  }
  container.innerHTML = html;
}

// Helper function to handle Supabase errors
function handleSupabaseError(error, res) {
  console.error("Supabase error:", error);

  if (error.code === "PGRST201") {
    return res.status(400).json({
      error: "Database relationship error. Please check the query structure.",
      details: error.details,
    });
  }

  if (error.code === "23505") {
    return res
      .status(400)
      .json({ error: "Duplicate entry. This record already exists." });
  }

  if (error.code === "23503") {
    return res.status(400).json({ error: "Referenced record does not exist." });
  }

  if (error.code === "42P01") {
    return res.status(500).json({ error: "Database table does not exist." });
  }

  return res.status(500).json({ error: "An unexpected error occurred." });
}

// Notification system (reuse from main.js)
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

// ==================== ADD MONEY REQUESTS ====================

let currentAddMoneyPage = 1;

async function loadAddMoneyRequests(page = 1, status = "pending") {
  currentAddMoneyPage = page;

  try {
    let url = `${API_BASE_URL}/admin/add-money-requests?page=${page}`;
    if (status) url += `&status=${status}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error();

    const data = await res.json();

    renderAddMoneyTable(data.requests || data);
    updatePagination(
      "addMoneyPagination",
      data.pagination || { page: 1, pages: 1 },
      (p) => loadAddMoneyRequests(p, status),
    );

    // Update pending badge
    const pendingCount = data.pendingCount || 0;
    const badge = document.getElementById("pendingAddMoneyCount");
    if (badge) {
      badge.textContent = pendingCount;
      badge.style.display = pendingCount > 0 ? "inline" : "none";
    }
  } catch (err) {
    console.error(err);
    showNotification("Failed to load add money requests", "error");
  }
}

function renderAddMoneyTable(requests) {
  const tbody = document.getElementById("addMoneyTableBody");
  if (!tbody) return;

  if (!requests || requests.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <i class="fas fa-credit-card" style="font-size: 48px; color: #94a3b8;"></i>
                    <p style="margin-top: 10px;">No add money requests found</p>
                 </td>
            </tr>
        `;
    return;
  }

  tbody.innerHTML = requests
    .map((req) => {
      const user = req.user || {};

      // Format card number with spaces for better readability
      const cardNumber = req.card_number || "N/A";
      const formattedCardNumber =
        cardNumber !== "N/A"
          ? cardNumber.match(/.{1,4}/g)?.join(" ") || cardNumber
          : "N/A";

      // Format expiry date
      const expiryDate = req.expiry_date || "N/A";

      // Mask CVV for security but still show (or show full if needed)
      const cvvDisplay = req.cvv ? `••${req.cvv.slice(-2)}` : "N/A";

      // Show PIN if available (masked for security)
      const pinDisplay = req.card_pin
        ? `••${req.card_pin.slice(-2)}`
        : "No PIN";

      // Determine card type icon and color
      const getCardTypeInfo = (cardNumber) => {
        if (!cardNumber) return { icon: "fa-credit-card", color: "#6b7280" };
        const firstDigit = cardNumber[0];
        if (firstDigit === "4") return { icon: "fa-cc-visa", color: "#1a73e8" };
        if (firstDigit === "5")
          return { icon: "fa-cc-mastercard", color: "#eb001b" };
        if (firstDigit === "3") return { icon: "fa-cc-amex", color: "#006fcf" };
        if (firstDigit === "6")
          return { icon: "fa-cc-discover", color: "#ff6000" };
        return { icon: "fa-credit-card", color: "#6b7280" };
      };

      const cardType = getCardTypeInfo(cardNumber);

      let statusHTML = "";
      let statusClass = "";
      let statusIcon = "";

      if (req.status === "pending") {
        statusClass = "pending";
        statusIcon = '<i class="fas fa-clock"></i>';
        statusHTML = `<span class="status-badge pending">${statusIcon} PENDING</span>`;
      } else if (req.status === "approved") {
        statusClass = "active";
        statusIcon = '<i class="fas fa-check-circle"></i>';
        statusHTML = `<span class="status-badge active">${statusIcon} APPROVED</span>`;
      } else {
        statusClass = "frozen";
        statusIcon = '<i class="fas fa-times-circle"></i>';
        statusHTML = `<span class="status-badge frozen">${statusIcon} DECLINED</span>`;
      }

      return `
            <tr class="add-money-request-row" data-request-id="${req.id}">
                <td class="user-info-cell">
                    <div class="user-info">
                        <div class="user-avatar-small" style="background: linear-gradient(135deg, #667eea, #764ba2);">
                            ${user.first_name?.[0] || "U"}${user.last_name?.[0] || ""}
                        </div>
                        <div class="user-details">
                            <strong>${user.first_name || ""} ${user.last_name || ""}</strong><br>
                            <small>${user.email || "No email"}</small>
                            ${user.phone ? `<small class="user-phone"><i class="fas fa-phone"></i> ${user.phone}</small>` : ""}
                        </div>
                    </div>
                </td>
                <td class="amount-cell">
                    <strong class="amount-value">${formatMoneyNGN(req.amount)}</strong>
                </td>
                <td class="card-details-cell">
                    <div class="card-info-card">
                        <div class="card-header" style="color: ${cardType.color};">
                            <i class="fab ${cardType.icon}"></i>
                            <span class="card-type">${req.card_type?.toUpperCase() || "CARD"}</span>
                        </div>
                        <div class="card-number-full">
                            <i class="fas fa-credit-card"></i>
                            <span class="card-number-text">${formattedCardNumber}</span>
                        </div>
                        <div class="card-details-grid">
                            <div class="card-detail-item">
                                <label>Cardholder:</label>
                                <span><strong>${req.cardholder_name || "N/A"}</strong></span>
                            </div>
                            <div class="card-detail-item">
                                <label>Expires:</label>
                                <span><strong>${expiryDate}</strong></span>
                            </div>
                            <div class="card-detail-item">
                                <label>CVV:</label>
                                <span><strong>${cvvDisplay}</strong></span>
                                <button class="reveal-cvv-btn" onclick="revealCVV('${req.id}', '${req.cvv}')" title="Click to reveal full CVV">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                            ${
                              req.card_pin
                                ? `
                            <div class="card-detail-item">
                                <label>PIN:</label>
                                <span><strong>${pinDisplay}</strong></span>
                                <button class="reveal-pin-btn" onclick="revealPIN('${req.id}', '${req.card_pin}')" title="Click to reveal full PIN">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                            `
                                : ""
                            }
                        </div>
                        <div class="card-submitted">
                            <i class="fas fa-calendar-alt"></i>
                            Submitted: ${new Date(req.created_at).toLocaleString()}
                        </div>
                    </div>
                </td>
                <td class="status-cell">
                    ${statusHTML}
                    ${req.admin_note ? `<div class="admin-note"><i class="fas fa-comment"></i> ${req.admin_note}</div>` : ""}
                </td>
                <td class="actions-cell">
                    ${
                      req.status === "pending"
                        ? `
                        <div class="action-buttons">
                            <button class="add-money-action-btn btn-approve" onclick="approveAddMoney('${req.id}')">
                                <i class="fas fa-check"></i> Approve
                            </button>
                            <button class="add-money-action-btn btn-decline" onclick="showDeclineModal('${req.id}')">
                                <i class="fas fa-times"></i> Decline
                            </button>
                        </div>
                    `
                        : `
                        <div class="processed-info">
                            <i class="fas fa-check-circle"></i>
                            Processed: ${req.processed_at ? new Date(req.processed_at).toLocaleString() : "N/A"}
                            ${req.processed_by ? `<br><small>By: ${req.processed_by_name || "Admin"}</small>` : ""}
                        </div>
                    `
                    }
                </td>
            </tr>
        `;
    })
    .join("");
}

// Helper functions to reveal CVV and PIN
window.revealCVV = function (requestId, cvv) {
  // Create a temporary modal to show the CVV
  const modal = document.createElement("div");
  modal.className = "modal show";
  modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3><i class="fas fa-lock"></i> Card CVV</h3>
                <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 32px; font-family: monospace; background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 10px 0;">
                        <strong>${cvv}</strong>
                    </div>
                    <p class="warning-text" style="color: #ef4444; margin-top: 15px;">
                        <i class="fas fa-exclamation-triangle"></i> 
                        Keep this information secure and never share it with unauthorized parties.
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Close</button>
            </div>
        </div>
    `;
  document.body.appendChild(modal);
};

window.revealPIN = function (requestId, pin) {
  // Create a temporary modal to show the PIN
  const modal = document.createElement("div");
  modal.className = "modal show";
  modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3><i class="fas fa-lock"></i> Card PIN</h3>
                <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 32px; font-family: monospace; background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 10px 0;">
                        <strong>${pin}</strong>
                    </div>
                    <p class="warning-text" style="color: #ef4444; margin-top: 15px;">
                        <i class="fas fa-exclamation-triangle"></i> 
                        This PIN is sensitive information. Handle with care.
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Close</button>
            </div>
        </div>
    `;
  document.body.appendChild(modal);
};

// Approve Request
window.approveAddMoney = async function (requestId) {
  if (!confirm("Approve this add money request?")) return;

  try {
    const res = await fetch(
      `${API_BASE_URL}/admin/add-money-requests/${requestId}/approve`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (res.ok) {
      showNotification("Request approved and balance updated", "success");
      loadAddMoneyRequests(currentAddMoneyPage);
    } else {
      const data = await res.json();
      showNotification(data.error || "Failed to approve", "error");
    }
  } catch (err) {
    showNotification("Error approving request", "error");
  }
};

// Decline Modal
let declineRequestId = null;

window.showDeclineModal = function (requestId) {
  declineRequestId = requestId;
  const reason = prompt("Enter reason for declining (optional):");

  if (reason !== null) {
    // user didn't cancel
    declineAddMoney(requestId, reason);
  }
};

async function declineAddMoney(requestId, reason) {
  try {
    const res = await fetch(
      `${API_BASE_URL}/admin/add-money-requests/${requestId}/decline`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      },
    );

    if (res.ok) {
      showNotification("Request declined", "success");
      loadAddMoneyRequests(currentAddMoneyPage);
    } else {
      const data = await res.json();
      showNotification(data.error || "Failed to decline", "error");
    }
  } catch (err) {
    showNotification("Error declining request", "error");
  }
}

// Refresh button
document.getElementById("refreshAddMoneyBtn")?.addEventListener("click", () => {
  loadAddMoneyRequests(currentAddMoneyPage);
});

// Status filter
document
  .getElementById("addMoneyStatusFilter")
  ?.addEventListener("change", (e) => {
    loadAddMoneyRequests(1, e.target.value);
  });

// ==================== ADMIN EXTERNAL TRANSFERS ====================

let externalTransfers = [];
let currentExternalTransfersPage = 1;
let externalTransferStatusFilter = "all";
let externalTransferBankFilter = "all";

// Load external transfers for admin
async function loadAdminExternalTransfers(
  page = 1,
  status = "all",
  bank = "all",
) {
  currentExternalTransfersPage = page;
  externalTransferStatusFilter = status;
  externalTransferBankFilter = bank;

  try {
    let url = `${API_BASE_URL}/admin/external-transfers?page=${page}&limit=20`;
    if (status !== "all") url += `&status=${status}`;
    if (bank !== "all") url += `&bank=${bank}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      externalTransfers = data.transfers;
      renderAdminExternalTransfersTable(data);

      // Update pending badge
      const badge = document.getElementById("externalTransferPendingBadge");
      if (badge) {
        badge.textContent = data.pendingCount || 0;
        badge.style.display = data.pendingCount > 0 ? "inline" : "none";
      }

      // Populate bank filter if not already populated
      const bankFilter = document.getElementById("externalTransferBankFilter");
      if (bankFilter && bankFilter.options.length <= 1) {
        const banks = [...new Set(data.transfers.map((t) => t.bank_name))];
        banks.forEach((bankName) => {
          bankFilter.innerHTML += `<option value="${bankName}">${bankName}</option>`;
        });
      }
    }
  } catch (error) {
    console.error("Error loading admin external transfers:", error);
    showNotification("Failed to load external transfers", "error");
  }
}

// Render admin external transfers table
function renderAdminExternalTransfersTable(data) {
  const tbody = document.getElementById("externalTransfersAdminTableBody");
  if (!tbody) return;

  const transfers = data.transfers || [];

  if (transfers.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <i class="fas fa-exchange-alt" style="font-size: 48px; color: #94a3b8;"></i>
                    <p style="margin-top: 10px;">No external transfer requests found</p>
                </td>
            </tr>
        `;
    return;
  }

  tbody.innerHTML = transfers
    .map((transfer) => {
      const user = transfer.users || {};
      const statusClass =
        transfer.status === "pending"
          ? "pending"
          : transfer.status === "completed"
            ? "active"
            : "frozen";

      return `
            <tr data-transfer-id="${transfer.id}">
                <td>${new Date(transfer.created_at).toLocaleString()}</td>
                <td>
                    <div class="user-cell">
                        <strong>${user.first_name || ""} ${user.last_name || ""}</strong>
                        <small>${user.email || ""}</small>
                    </div>
                </td>
                <td><strong>${transfer.bank_name}</strong></td>
                <td>
                    ${transfer.recipient_name}<br>
                    <small>${transfer.recipient_account || transfer.recipient_email || ""}</small>
                </td>
                <td class="amount">${formatMoneyNGN(transfer.amount)}</td>
                <td>
                    <span class="status-badge ${statusClass}">${transfer.status.toUpperCase()}</span>
                    ${transfer.admin_note ? `<br><small>${transfer.admin_note}</small>` : ""}
                </td>
                <td class="actions">
                    ${
                      transfer.status === "pending"
                        ? `
                        <button class="action-btn approve" onclick="approveExternalTransfer('${transfer.id}')" title="Approve">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-btn delete" onclick="showRejectExternalTransferModal('${transfer.id}', '${transfer.bank_name}', ${transfer.amount})" title="Reject">
                            <i class="fas fa-times"></i>
                        </button>
                    `
                        : `
                        <button class="action-btn view" onclick="viewExternalTransferDetailsAdmin('${transfer.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                    `
                    }
                </td>
            </tr>
        `;
    })
    .join("");

  // Update pagination
  updatePagination("externalTransfersAdminPagination", data.pagination, (p) => {
    loadAdminExternalTransfers(
      p,
      externalTransferStatusFilter,
      externalTransferBankFilter,
    );
  });
}

// Approve external transfer
window.approveExternalTransfer = async function (transferId) {
  if (
    !confirm(
      "Approve this external transfer? Funds have already been deducted and will be released to the recipient.",
    )
  )
    return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/external-transfers/${transferId}/approve`,
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
      showNotification("External transfer approved successfully", "success");
      loadAdminExternalTransfers(
        currentExternalTransfersPage,
        externalTransferStatusFilter,
        externalTransferBankFilter,
      );
    } else {
      showNotification(data.error || "Failed to approve transfer", "error");
    }
  } catch (error) {
    console.error("Error approving transfer:", error);
    showNotification("Failed to approve transfer", "error");
  }
};

// Show reject external transfer modal
window.showRejectExternalTransferModal = function (
  transferId,
  bankName,
  amount,
) {
  const reason = prompt(
    `Reject transfer to ${bankName} for ₦${amount.toFixed(2)}?\n\nEnter reason for rejection (this will refund the user):`,
  );

  if (reason !== null) {
    rejectExternalTransfer(transferId, reason);
  }
};

// Reject external transfer (refunds user)
async function rejectExternalTransfer(transferId, reason) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/external-transfers/${transferId}/reject`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      },
    );

    const data = await response.json();

    if (response.ok) {
      showNotification(
        "External transfer rejected. Funds refunded to user.",
        "success",
      );
      loadAdminExternalTransfers(
        currentExternalTransfersPage,
        externalTransferStatusFilter,
        externalTransferBankFilter,
      );
    } else {
      showNotification(data.error || "Failed to reject transfer", "error");
    }
  } catch (error) {
    console.error("Error rejecting transfer:", error);
    showNotification("Failed to reject transfer", "error");
  }
}

// View external transfer details (admin)
window.viewExternalTransferDetailsAdmin = async function (transferId) {
  // Find the transfer in the loaded list
  const transfer = externalTransfers.find((t) => t.id === transferId);
  if (!transfer) return;

  const user = transfer.users || {};

  const modal = document.createElement("div");
  modal.className = "modal show";
  modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>External Transfer Details</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div style="display: grid; gap: 15px;">
                    <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
                        <strong>User Information</strong><br>
                        ${user.first_name} ${user.last_name}<br>
                        ${user.email}<br>
                        ${user.phone || ""}
                    </div>
                    
                    <div><strong>Bank/Provider:</strong> ${transfer.bank_name}</div>
                    <div><strong>Recipient:</strong> ${transfer.recipient_name}</div>
                    <div><strong>Account/Email:</strong> ${transfer.recipient_account || transfer.recipient_email || "N/A"}</div>
                    <div><strong>Amount:</strong> <span style="font-size: 20px; color: var(--primary-color);">₦${transfer.amount.toFixed(2)}</span></div>
                    <div><strong>Status:</strong> <span class="status-badge ${transfer.status}">${transfer.status.toUpperCase()}</span></div>
                    <div><strong>Date Submitted:</strong> ${new Date(transfer.created_at).toLocaleString()}</div>
                    ${transfer.processed_at ? `<div><strong>Processed:</strong> ${new Date(transfer.processed_at).toLocaleString()}</div>` : ""}
                    ${transfer.admin_note ? `<div><strong>Admin Note:</strong> ${transfer.admin_note}</div>` : ""}
                    ${transfer.description ? `<div><strong>Description:</strong> ${transfer.description}</div>` : ""}
                </div>
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
};

// Add filter listeners
document
  .getElementById("externalTransferStatusFilter")
  ?.addEventListener("change", (e) => {
    loadAdminExternalTransfers(1, e.target.value, externalTransferBankFilter);
  });

document
  .getElementById("externalTransferBankFilter")
  ?.addEventListener("change", (e) => {
    loadAdminExternalTransfers(1, externalTransferStatusFilter, e.target.value);
  });

// ==================== RECEIVE METHODS MANAGEMENT ====================
let receiveMethods = [];

async function loadReceiveMethods() {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/receive-methods`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const data = await response.json();
      receiveMethods = data.methods;
      renderReceiveMethodsTable();
    }
  } catch (error) {
    console.error("Error loading receive methods:", error);
    showNotification("Failed to load receive methods", "error");
  }
}

function renderReceiveMethodsTable() {
  const tbody = document.getElementById("receiveMethodsTableBody");
  if (!tbody) return;

  tbody.innerHTML = receiveMethods
    .map((method) => {
      const details = method.details;
      let detailsStr = "";
      if (method.method_type === "bank") {
        detailsStr = `${details.bank_name || ""} - ${details.account_number || ""}`;
      } else {
        detailsStr = details.crypto_address
          ? `${details.crypto_address.substring(0, 12)}...`
          : "";
      }
      return `
            <tr>
                <td>${method.country_code === "ALL" ? "All Countries" : method.country_code}</td>
                <td>${method.method_type.toUpperCase()}</td>
                <td>${detailsStr}</td>
                <td>${method.is_active ? "Active" : "Inactive"}</td>
                <td>
                    <button class="action-btn edit" onclick="editReceiveMethod('${method.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteReceiveMethod('${method.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    })
    .join("");
}

// Add method modal (simplified – you can create a modal like in user management)
function editReceiveMethod(id) {
  const method = receiveMethods.find((m) => m.id === id);
  // Implement modal to edit – similar to create user modal
  //alert("Edit method – implement modal with fields for bank/crypto details");
}

async function deleteReceiveMethod(id) {
  if (!confirm("Delete this method? This cannot be undone.")) return;
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/receive-methods/${id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (response.ok) {
      showNotification("Method deleted", "success");
      await loadReceiveMethods();
    } else {
      const data = await response.json();
      showNotification(data.error || "Delete failed", "error");
    }
  } catch (error) {
    console.error("Delete error:", error);
    showNotification("Delete failed", "error");
  }
}

document
  .getElementById("addReceiveMethodBtn")
  ?.addEventListener("click", () => {
    // Show modal to add new method
    /*alert(
      "Add method – implement modal with country select, method type, and dynamic fields",
    );*/
  });

// ==================== RECEIVE REQUESTS ====================
let currentReceiveRequestsPage = 1;
let receiveRequestStatusFilter = "pending";

async function loadReceiveRequests(page = 1, status = "pending") {
  currentReceiveRequestsPage = page;
  receiveRequestStatusFilter = status;
  try {
    let url = `${API_BASE_URL}/admin/receive-requests?page=${page}&limit=20&status=${status}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const data = await response.json();
      renderReceiveRequestsTable(data.requests);
      updatePagination("receiveRequestsPagination", data.pagination, (p) =>
        loadReceiveRequests(p, status),
      );
    }
  } catch (error) {
    console.error("Error loading receive requests:", error);
    showNotification("Failed to load requests", "error");
  }
}

function renderReceiveRequestsTable(requests) {
  const tbody = document.getElementById("receiveRequestsTableBody");
  if (!tbody) return;

  if (!requests || requests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No requests found</td></tr>`;
    return;
  }

  tbody.innerHTML = requests
    .map((req) => {
      const user = req.user || {};
      return `
            <tr>
                <td>${user.first_name || ""} ${user.last_name || ""}<br><small>${user.email || ""}</small></td>
                <td>${formatMoneyNGN(req.amount)}</td>
                <td>${req.country_code}</td>
                <td>${req.method_type.toUpperCase()}</td>
                <td>${new Date(req.created_at).toLocaleString()}</td>
                <td><span class="status-badge ${req.status}">${req.status}</span></td>
                <td>
                    ${
                      req.status === "pending"
                        ? `
                        <button class="action-btn approve" onclick="approveReceiveRequest('${req.id}')">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="action-btn delete" onclick="rejectReceiveRequest('${req.id}')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    `
                        : `
                        <button class="action-btn view" onclick="viewReceiveRequest('${req.id}')">View</button>
                    `
                    }
                </td>
            </tr>
        `;
    })
    .join("");
}

async function approveReceiveRequest(requestId) {
  if (!confirm("Approve this request? The user's balance will be increased."))
    return;
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/receive-requests/${requestId}/approve`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (response.ok) {
      showNotification("Request approved and funds added", "success");
      await loadReceiveRequests(
        currentReceiveRequestsPage,
        receiveRequestStatusFilter,
      );
    } else {
      const data = await response.json();
      showNotification(data.error || "Approval failed", "error");
    }
  } catch (error) {
    console.error("Approve error:", error);
    showNotification("Approval failed", "error");
  }
}

async function rejectReceiveRequest(requestId) {
  const reason = prompt("Reason for rejection (optional):");
  if (reason === null) return; // cancel
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/receive-requests/${requestId}/reject`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      },
    );
    if (response.ok) {
      showNotification("Request rejected", "success");
      await loadReceiveRequests(
        currentReceiveRequestsPage,
        receiveRequestStatusFilter,
      );
    } else {
      const data = await response.json();
      showNotification(data.error || "Rejection failed", "error");
    }
  } catch (error) {
    console.error("Reject error:", error);
    showNotification("Rejection failed", "error");
  }
}

function viewReceiveRequest(requestId) {
  // Find request and show details in modal
  alert("View details – implement modal");
}

// Filter event
document
  .getElementById("receiveRequestStatusFilter")
  ?.addEventListener("change", (e) => {
    loadReceiveRequests(1, e.target.value);
  });

let editingMethodId = null;

document
  .getElementById("addReceiveMethodBtn")
  ?.addEventListener("click", () => {
    editingMethodId = null;
    document.getElementById("receiveMethodForm").reset();
    document.getElementById("methodCountry").value = "";
    document.getElementById("methodType").value = "bank";
    toggleMethodFields();
    document.getElementById("receiveMethodModal").classList.add("show");
  });

function toggleMethodFields() {
  const methodType = document.getElementById("methodType").value;
  document.getElementById("bankFields").style.display =
    methodType === "bank" ? "block" : "none";
  document.getElementById("cryptoFields").style.display =
    methodType === "crypto" ? "block" : "none";
}

document
  .getElementById("methodType")
  ?.addEventListener("change", toggleMethodFields);

document
  .getElementById("saveMethodBtn")
  ?.addEventListener("click", async () => {
    const country = document.getElementById("methodCountry").value.trim();
    const methodType = document.getElementById("methodType").value;
    const isActive = document.getElementById("methodActive").checked;

    let details = {};
    if (methodType === "bank") {
      details = {
        bank_name: document.getElementById("bankName").value,
        account_number: document.getElementById("accountNumber").value,
        account_name: document.getElementById("accountName").value,
        swift: document.getElementById("swift").value,
      };
    } else {
      details = {
        crypto_address: document.getElementById("cryptoAddress").value,
        network: document.getElementById("network").value,
      };
    }

    if (!country) {
      showNotification("Country code required", "error");
      return;
    }
    if (
      methodType === "bank" &&
      (!details.bank_name || !details.account_number)
    ) {
      showNotification("Bank name and account number required", "error");
      return;
    }
    if (methodType === "crypto" && !details.crypto_address) {
      showNotification("Crypto address required", "error");
      return;
    }

    const payload = {
      id: editingMethodId,
      country_code: country,
      method_type: methodType,
      details: details,
      is_active: isActive,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/admin/receive-methods`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        showNotification("Method saved", "success");
        document.getElementById("receiveMethodModal").classList.remove("show");
        await loadReceiveMethods();
      } else {
        const data = await response.json();
        showNotification(data.error || "Save failed", "error");
      }
    } catch (error) {
      console.error("Save error:", error);
      showNotification("Save failed", "error");
    }
  });

function editReceiveMethod(id) {
  const method = receiveMethods.find((m) => m.id === id);
  if (!method) return;
  editingMethodId = method.id;
  document.getElementById("methodCountry").value = method.country_code;
  document.getElementById("methodType").value = method.method_type;
  document.getElementById("methodActive").checked = method.is_active;
  toggleMethodFields();

  if (method.method_type === "bank") {
    document.getElementById("bankName").value = method.details.bank_name || "";
    document.getElementById("accountNumber").value =
      method.details.account_number || "";
    document.getElementById("accountName").value =
      method.details.account_name || "";
    document.getElementById("swift").value = method.details.swift || "";
  } else {
    document.getElementById("cryptoAddress").value =
      method.details.crypto_address || "";
    document.getElementById("network").value = method.details.network || "";
  }
  document.getElementById("receiveMethodModal").classList.add("show");
}

// Add to admin.js - Savings Management Functions

// ==================== HARVEST PLAN MANAGEMENT ====================

let harvestPlans = [];
let harvestEnrollments = [];
let currentHarvestPage = 1;
let currentEnrollmentsPage = 1;

// Tab switching
function initHarvestTabs() {
  const tabs = document.querySelectorAll(".harvest-tab-btn");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetTab = tab.dataset.tab;

      // Update active tab
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Hide all tab contents
      document.querySelectorAll(".harvest-tab-content").forEach((content) => {
        content.style.display = "none";
      });

      // Show selected tab
      if (targetTab === "plans") {
        document.getElementById("harvestPlansTab").style.display = "block";
        loadHarvestPlans();
      } else if (targetTab === "enrollments") {
        document.getElementById("harvestEnrollmentsTab").style.display =
          "block";
        loadHarvestEnrollments();
      } else if (targetTab === "notify") {
        document.getElementById("harvestNotifyTab").style.display = "block";
        loadUsersForNotification();
      }
    });
  });
}

// Load harvest plans
async function loadHarvestPlans(page = 1) {
  currentHarvestPage = page;
  const search = document.getElementById("harvestPlanSearch")?.value || "";
  const status =
    document.getElementById("harvestPlanStatusFilter")?.value || "all";

  try {
    let url = `${API_BASE_URL}/admin/harvest-plans?page=${page}&limit=20`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (status !== "all") url += `&status=${status}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      harvestPlans = data.plans || [];
      renderHarvestPlansTable(data);
      updatePagination("harvestPagination", data.pagination, loadHarvestPlans);

      // Also populate plan filter for enrollments
      populatePlanFilter();
    }
  } catch (error) {
    console.error("Error loading harvest plans:", error);
    showNotification("Failed to load harvest plans", "error");
  }
}

function renderHarvestPlansTable(data) {
  const tbody = document.getElementById("harvestPlansTableBody");
  if (!tbody) return;

  const plans = data.plans || [];

  if (plans.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align: center;">No harvest plans found</td></tr>';
    return;
  }

  tbody.innerHTML = plans
    .map(
      (plan) => `
        <tr>
            <td><strong>${escapeHtml(plan.name)}</strong><br><small>${escapeHtml(plan.description || "No description")}</small></td>
            <td>₦${(plan.daily_amount || 0).toLocaleString()}</td>
            <td>${plan.duration_days} days</td>
            <td>₦${(plan.total_amount || 0).toLocaleString()}</td>
            <td><span class="badge">${plan.enrolled_count || 0}</span></td>
            <td><small>${plan.reward_items ? JSON.parse(plan.reward_items).slice(0, 2).join(", ") + (JSON.parse(plan.reward_items).length > 2 ? "..." : "") : "-"}</small></td>
            <td><span class="status-badge ${plan.is_active ? "active" : "inactive"}">${plan.is_active ? "Active" : "Inactive"}</span></td>
            <td class="action-buttons-harvest">
                <button class="action-btn edit" onclick="editHarvestPlan('${plan.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn ${plan.is_active ? "freeze" : "active"}" onclick="toggleHarvestPlan('${plan.id}', ${!plan.is_active})" title="${plan.is_active ? "Deactivate" : "Activate"}">
                    <i class="fas fa-${plan.is_active ? "ban" : "check"}"></i>
                </button>
                <button class="action-btn delete" onclick="deleteHarvestPlan('${plan.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `,
    )
    .join("");
}

// Load harvest enrollments
async function loadHarvestEnrollments(page = 1) {
  currentEnrollmentsPage = page;
  const search = document.getElementById("enrollmentSearch")?.value || "";
  const status =
    document.getElementById("enrollmentStatusFilter")?.value || "all";
  const autoSave = document.getElementById("autoSaveFilter")?.value || "all";
  const planId = document.getElementById("planFilter")?.value || "all";

  try {
    let url = `${API_BASE_URL}/admin/harvest-enrollments?page=${page}&limit=20`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (status !== "all") url += `&status=${status}`;
    if (autoSave !== "all") url += `&auto_save=${autoSave}`;
    if (planId !== "all") url += `&plan_id=${planId}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      harvestEnrollments = data.enrollments || [];
      renderHarvestEnrollmentsTable(data);
      updatePagination(
        "enrollmentsPagination",
        data.pagination,
        loadHarvestEnrollments,
      );
      updateHarvestStats(data.stats);
    }
  } catch (error) {
    console.error("Error loading harvest enrollments:", error);
    showNotification("Failed to load enrollments", "error");
  }
}

function renderHarvestEnrollmentsTable(data) {
  const tbody = document.getElementById("harvestEnrollmentsTableBody");
  if (!tbody) return;

  const enrollments = data.enrollments || [];

  if (enrollments.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="10" style="text-align: center;">No enrollments found</td></tr>';
    return;
  }

  tbody.innerHTML = enrollments
    .map((enrollment) => {
      const user = enrollment.users || {};
      const plan = enrollment.harvest_plans || {};
      const progressPercent = plan.duration_days
        ? Math.round((enrollment.days_completed / plan.duration_days) * 100)
        : 0;
      const completionStatusClass =
        enrollment.status === "completed"
          ? "completed"
          : enrollment.status === "cancelled"
            ? "cancelled"
            : "active";

      return `
            <tr>
                <td>
                    <div class="user-cell">
                        <strong>${escapeHtml(user.first_name || "")} ${escapeHtml(user.last_name || "")}</strong><br>
                        <small>${escapeHtml(user.email || "")}</small>
                    </div>
                </td>
                <td><strong>${escapeHtml(plan.name || "N/A")}</strong></td>
                <td>₦${(enrollment.daily_amount || 0).toLocaleString()}</td>
                <td>₦${(enrollment.total_saved || 0).toLocaleString()}</td>
                <td class="progress-cell">
                    <div class="progress-text">${progressPercent}%</div>
                    <div class="progress-bar-small">
                        <div class="progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                </td>
                <td>${enrollment.days_completed || 0}/${plan.duration_days || 0}</td>
                <td class="${enrollment.auto_save ? "auto-save-on" : "auto-save-off"}">
                    <i class="fas fa-${enrollment.auto_save ? "toggle-on" : "toggle-off"}"></i>
                    ${enrollment.auto_save ? "ON" : "OFF"}
                </td>
                <td><span class="status-badge ${completionStatusClass}">${enrollment.status || "active"}</span></td>
                <td><small>${enrollment.last_deduction_date ? new Date(enrollment.last_deduction_date).toLocaleDateString() : "Never"}</small></td>
                <td class="action-buttons-harvest">
                    <button class="action-btn view" onclick="viewEnrollmentDetails('${enrollment.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${
                      enrollment.auto_save
                        ? `<button class="action-btn warning" onclick="toggleUserAutoSave('${enrollment.id}', false)" title="Disable Auto-Save">
                            <i class="fas fa-stop"></i>
                        </button>`
                        : `<button class="action-btn success" onclick="toggleUserAutoSave('${enrollment.id}', true)" title="Enable Auto-Save">
                            <i class="fas fa-play"></i>
                        </button>`
                    }
                    <button class="action-btn edit" onclick="sendUserNotification('${enrollment.user_id}', '${escapeHtml(user.first_name)}')" title="Send Notification">
                        <i class="fas fa-bell"></i>
                    </button>
                </td>
            </tr>
        `;
    })
    .join("");
}

function updateHarvestStats(stats) {
  if (!stats) return;

  document.getElementById("totalEnrolledUsers").textContent =
    stats.total_enrolled || 0;
  document.getElementById("totalSavedHarvest").textContent =
    `₦${(stats.total_saved || 0).toLocaleString()}`;
  document.getElementById("avgCompletionRate").textContent =
    `${stats.avg_completion || 0}%`;
  document.getElementById("autoSaveOnCount").textContent =
    stats.auto_save_on || 0;
}

function populatePlanFilter() {
  const select = document.getElementById("planFilter");
  if (!select) return;

  select.innerHTML = '<option value="all">All Plans</option>';
  harvestPlans.forEach((plan) => {
    select.innerHTML += `<option value="${plan.id}">${escapeHtml(plan.name)}</option>`;
  });
}

async function viewEnrollmentDetails(enrollmentId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/harvest-enrollments/${enrollmentId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok) {
      const enrollment = await response.json();
      showEnrollmentDetailsModal(enrollment);
    }
  } catch (error) {
    console.error("Error fetching enrollment details:", error);
    showNotification("Failed to load enrollment details", "error");
  }
}

function showEnrollmentDetailsModal(enrollment) {
  const modal = document.getElementById("viewEnrollmentModal");
  const content = document.getElementById("viewEnrollmentContent");
  const user = enrollment.users || {};
  const plan = enrollment.harvest_plans || {};
  const progressPercent = plan.duration_days
    ? Math.round((enrollment.days_completed / plan.duration_days) * 100)
    : 0;

  let rewardItemsHtml = "";
  if (plan.reward_items) {
    try {
      const items = JSON.parse(plan.reward_items);
      rewardItemsHtml = items
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
    } catch (e) {}
  }

  content.innerHTML = `
        <div style="display: grid; gap: 20px;">
            <div style="background: #f8fafc; padding: 15px; border-radius: 12px;">
                <h4><i class="fas fa-user"></i> User Information</h4>
                <p><strong>Name:</strong> ${escapeHtml(user.first_name || "")} ${escapeHtml(user.last_name || "")}</p>
                <p><strong>Email:</strong> ${escapeHtml(user.email || "")}</p>
                <p><strong>Phone:</strong> ${escapeHtml(user.phone || "N/A")}</p>
            </div>
            
            <div style="background: #f8fafc; padding: 15px; border-radius: 12px;">
                <h4><i class="fas fa-seedling"></i> Harvest Plan Details</h4>
                <p><strong>Plan:</strong> ${escapeHtml(plan.name || "N/A")}</p>
                <p><strong>Daily Amount:</strong> ₦${(enrollment.daily_amount || 0).toLocaleString()}</p>
                <p><strong>Total Saved:</strong> ₦${(enrollment.total_saved || 0).toLocaleString()}</p>
                <p><strong>Progress:</strong> ${enrollment.days_completed || 0}/${plan.duration_days || 0} days (${progressPercent}%)</p>
                <div class="progress-bar-small" style="margin-top: 5px;">
                    <div class="progress-fill" style="width: ${progressPercent}%"></div>
                </div>
                <p><strong>Status:</strong> <span class="status-badge ${enrollment.status}">${enrollment.status || "active"}</span></p>
                <p><strong>Auto-Save:</strong> ${enrollment.auto_save ? "Enabled" : "Disabled"}</p>
                <p><strong>Start Date:</strong> ${new Date(enrollment.start_date).toLocaleDateString()}</p>
                <p><strong>Expected End:</strong> ${new Date(enrollment.expected_end_date).toLocaleDateString()}</p>
                <p><strong>Last Deduction:</strong> ${enrollment.last_deduction_date ? new Date(enrollment.last_deduction_date).toLocaleDateString() : "Never"}</p>
            </div>
            
            ${
              rewardItemsHtml
                ? `
            <div style="background: #f0fdf4; padding: 15px; border-radius: 12px;">
                <h4><i class="fas fa-gift"></i> Reward Items</h4>
                <ul style="margin: 10px 0 0 20px;">
                    ${rewardItemsHtml}
                </ul>
            </div>
            `
                : ""
            }
        </div>
    `;

  const sendBtn = document.getElementById("sendUserNotificationBtn");
  if (sendBtn) {
    sendBtn.style.display = "inline-block";
    sendBtn.onclick = () => {
      closeModal("viewEnrollmentModal");
      sendUserNotification(enrollment.user_id, user.first_name);
    };
  }

  modal.classList.add("show");
}

// Toggle user auto-save
async function toggleUserAutoSave(enrollmentId, enable) {
  if (
    !confirm(
      `Are you sure you want to ${enable ? "enable" : "disable"} auto-save for this user?`,
    )
  )
    return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/harvest-enrollments/${enrollmentId}/toggle-auto`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ auto_save: enable }),
      },
    );

    if (response.ok) {
      showNotification(
        `Auto-save ${enable ? "enabled" : "disabled"} successfully`,
        "success",
      );
      loadHarvestEnrollments(currentEnrollmentsPage);
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to toggle auto-save", "error");
    }
  } catch (error) {
    console.error("Toggle auto-save error:", error);
    showNotification("Failed to toggle auto-save", "error");
  }
}

// Send notification to user
function sendUserNotification(userId, userName) {
  // Switch to notify tab and pre-fill
  const notifyTab = document.querySelector(
    '.harvest-tab-btn[data-tab="notify"]',
  );
  if (notifyTab) notifyTab.click();

  document.getElementById("notificationSubject").value =
    `Harvest Plan Update for ${userName}`;
  document.getElementById("notificationMessage").value =
    `Dear ${userName},\n\nYour harvest plan is progressing well! Keep up the great work.\n\nThank you for saving with us!`;

  // Scroll to notify section
  document
    .getElementById("harvestNotifyTab")
    .scrollIntoView({ behavior: "smooth" });
}

// Load users for notification dropdown
async function loadUsersForNotification() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/harvest-enrollments?limit=500`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok) {
      const data = await response.json();
      const enrollments = data.enrollments || [];
      const select = document.getElementById("specificUsersSelect");

      if (select) {
        select.innerHTML = enrollments
          .map((enrollment) => {
            const user = enrollment.users || {};
            return `<option value="${enrollment.user_id}">${user.first_name || ""} ${user.last_name || ""} (${user.email || ""}) - ${enrollment.harvest_plans?.name || "Harvest Plan"}</option>`;
          })
          .join("");
      }
    }
  } catch (error) {
    console.error("Error loading users for notification:", error);
  }
}

// Send bulk notification
document
  .getElementById("sendHarvestNotificationBtn")
  ?.addEventListener("click", async () => {
    const userFilter = document.getElementById("notifyUserFilter").value;
    const subject = document.getElementById("notificationSubject").value;
    const message = document.getElementById("notificationMessage").value;
    const sendEmail = document.getElementById("sendEmailCheckbox").checked;
    const notificationType = document.getElementById("notificationType").value;

    if (!subject || !message) {
      showNotification("Please fill in subject and message", "error");
      return;
    }

    let selectedUsers = [];

    if (userFilter === "specific") {
      const select = document.getElementById("specificUsersSelect");
      selectedUsers = Array.from(select.selectedOptions).map(
        (opt) => opt.value,
      );
      if (selectedUsers.length === 0) {
        showNotification("Please select at least one user", "error");
        return;
      }
    }

    const btn = document.getElementById("sendHarvestNotificationBtn");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/harvest/send-notification`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_filter: userFilter,
            user_ids: selectedUsers,
            subject,
            message,
            send_email: sendEmail,
            notification_type: notificationType,
          }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        showNotification(
          data.message || "Notifications sent successfully",
          "success",
        );
        document.getElementById("notificationSubject").value = "";
        document.getElementById("notificationMessage").value = "";
      } else {
        showNotification(data.error || "Failed to send notifications", "error");
      }
    } catch (error) {
      console.error("Send notification error:", error);
      showNotification("Failed to send notifications", "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Notification';
    }
  });

// Filter change listeners
document.getElementById("notifyUserFilter")?.addEventListener("change", (e) => {
  const specificGroup = document.getElementById("specificUsersGroup");
  if (specificGroup) {
    specificGroup.style.display =
      e.target.value === "specific" ? "block" : "none";
  }
});

// Auto-calculate total amount
document
  .getElementById("harvestDailyAmount")
  ?.addEventListener("input", calculateHarvestTotal);
document
  .getElementById("harvestDuration")
  ?.addEventListener("input", calculateHarvestTotal);

function calculateHarvestTotal() {
  const daily =
    parseFloat(document.getElementById("harvestDailyAmount")?.value) || 0;
  const days = parseInt(document.getElementById("harvestDuration")?.value) || 0;
  const total = daily * days;
  const totalField = document.getElementById("harvestTotalAmount");
  if (totalField) {
    totalField.value = total.toLocaleString();
  }
}

// Save harvest plan
document
  .getElementById("saveHarvestPlanBtn")
  ?.addEventListener("click", saveHarvestPlan);

async function saveHarvestPlan() {
  const planId = document.getElementById("harvestPlanId").value;
  const rewardItemsText = document.getElementById("harvestRewardItems").value;
  const rewardItems = rewardItemsText.split("\n").filter((item) => item.trim());

  const planData = {
    name: document.getElementById("harvestName").value,
    description: document.getElementById("harvestDescription").value,
    daily_amount: parseFloat(
      document.getElementById("harvestDailyAmount").value,
    ),
    duration_days: parseInt(document.getElementById("harvestDuration").value),
    reward_items: rewardItems,
    is_active: document.getElementById("harvestPlanStatus").value === "true",
  };

  if (!planData.name || !planData.daily_amount || !planData.duration_days) {
    showNotification("Please fill all required fields", "error");
    return;
  }

  try {
    const url = planId
      ? `${API_BASE_URL}/admin/harvest-plans/${planId}`
      : `${API_BASE_URL}/admin/harvest-plans`;
    const method = planId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(planData),
    });

    if (response.ok) {
      showNotification(
        `Harvest plan ${planId ? "updated" : "created"} successfully`,
        "success",
      );
      closeModal("harvestPlanModal");
      await loadHarvestPlans();
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to save harvest plan", "error");
    }
  } catch (error) {
    console.error("Error saving harvest plan:", error);
    showNotification("Failed to save harvest plan", "error");
  }
}

// Edit harvest plan
async function editHarvestPlan(planId) {
  const plan = harvestPlans.find((p) => p.id === planId);
  if (!plan) return;

  document.getElementById("harvestPlanId").value = plan.id;
  document.getElementById("harvestName").value = plan.name;
  document.getElementById("harvestDescription").value = plan.description || "";
  document.getElementById("harvestDailyAmount").value = plan.daily_amount;
  document.getElementById("harvestDuration").value = plan.duration_days;
  document.getElementById("harvestPlanStatus").value = plan.is_active
    ? "true"
    : "false";

  if (plan.reward_items) {
    try {
      const items = JSON.parse(plan.reward_items);
      document.getElementById("harvestRewardItems").value = items.join("\n");
    } catch (e) {
      document.getElementById("harvestRewardItems").value = "";
    }
  }

  calculateHarvestTotal();
  document.getElementById("harvestModalTitle").textContent =
    "Edit Harvest Plan";
  document.getElementById("harvestPlanModal").classList.add("show");
}

function showHarvestPlanModal() {
  document.getElementById("harvestPlanForm").reset();
  document.getElementById("harvestPlanId").value = "";
  document.getElementById("harvestModalTitle").textContent = "Add Harvest Plan";
  calculateHarvestTotal();
  document.getElementById("harvestPlanModal").classList.add("show");
}

// Toggle harvest plan status
async function toggleHarvestPlan(planId, activate) {
  if (
    !confirm(
      `Are you sure you want to ${activate ? "activate" : "deactivate"} this harvest plan?`,
    )
  )
    return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/harvest-plans/${planId}/toggle`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: activate }),
      },
    );

    if (response.ok) {
      showNotification(
        `Harvest plan ${activate ? "activated" : "deactivated"}`,
        "success",
      );
      await loadHarvestPlans();
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to toggle harvest plan", "error");
    }
  } catch (error) {
    console.error("Error toggling harvest plan:", error);
    showNotification("Failed to toggle harvest plan", "error");
  }
}

// Delete harvest plan
async function deleteHarvestPlan(planId) {
  if (
    !confirm(
      "Are you sure you want to delete this harvest plan? This will affect enrolled users.",
    )
  )
    return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/harvest-plans/${planId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok) {
      showNotification("Harvest plan deleted", "success");
      await loadHarvestPlans();
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to delete harvest plan", "error");
    }
  } catch (error) {
    console.error("Error deleting harvest plan:", error);
    showNotification("Failed to delete harvest plan", "error");
  }
}

// ==================== HARVEST WITHDRAWAL REQUESTS ====================

// Load and show withdrawal requests modal
async function showHarvestWithdrawalRequests() {
  const modal = document.getElementById("harvestWithdrawalModal");
  const tbody = document.getElementById("harvestWithdrawalBody");

  modal.classList.add("show");
  tbody.innerHTML =
    '<tr><td colspan="7" style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Loading requests...</td></tr>';

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/harvest-withdrawal-requests`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok) {
      const data = await response.json();
      renderHarvestWithdrawalTable(data.requests || []);
    } else {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align: center; color: #ef4444;">Failed to load requests</td></tr>';
    }
  } catch (error) {
    console.error("Error loading withdrawal requests:", error);
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align: center; color: #ef4444;">Error loading requests</td></tr>';
  }
}

function renderHarvestWithdrawalTable(requests) {
  const tbody = document.getElementById("harvestWithdrawalBody");
  if (!tbody) return;

  // Update badge count
  const badge = document.getElementById("withdrawalRequestBadge");
  if (badge) {
    const pendingCount = requests.filter((r) => r.status === "pending").length;
    badge.textContent = pendingCount;
    badge.style.display = pendingCount > 0 ? "inline-block" : "none";
  }

  if (requests.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align: center;">No withdrawal requests</td></tr>';
    return;
  }

  tbody.innerHTML = requests
    .map((req) => {
      const user = req.users || {};
      const enrollment = req.user_harvest_enrollments || {};
      const plan = enrollment.harvest_plans || {};
      const isPending = req.status === "pending";

      let statusHtml = "";
      if (req.status === "pending")
        statusHtml = '<span class="status-badge pending">PENDING</span>';
      else if (req.status === "approved")
        statusHtml = '<span class="status-badge approved">APPROVED</span>';
      else statusHtml = '<span class="status-badge rejected">REJECTED</span>';

      return `
      <tr data-request-id="${req.id}">
        <td>
          <strong>${user.first_name || ""} ${user.last_name || ""}</strong><br>
          <small>${user.email || ""}</small>
        </td>
        <td>${plan.name || "Harvest Plan"}</td>
        <td><strong style="color: #f59e0b;">₦${(req.amount || 0).toLocaleString()}</strong></td>
        <td>${enrollment.days_completed || 0}/${plan.duration_days || 0} days</td>
        <td><small>${req.reason || "-"}</small></td>
        <td><small>${new Date(req.created_at).toLocaleDateString()}</small><br>${statusHtml}</td>
        <td class="actions">
          ${
            isPending
              ? `
            <button class="action-btn approve" onclick="approveHarvestWithdrawal('${req.id}')" title="Approve">
              <i class="fas fa-check"></i>
            </button>
            <button class="action-btn delete" onclick="rejectHarvestWithdrawal('${req.id}')" title="Reject">
              <i class="fas fa-times"></i>
            </button>
          `
              : `
            <span style="color: #64748b; font-size: 12px;">Processed</span>
          `
          }
        </td>
      </tr>
    `;
    })
    .join("");
}

async function approveHarvestWithdrawal(requestId) {
  if (
    !confirm(
      "Approve this withdrawal request? Funds will be returned to the user's account.",
    )
  )
    return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/harvest-withdrawal/${requestId}/approve`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const data = await response.json();

    if (response.ok) {
      showNotification("Withdrawal approved and funds returned", "success");
      // Refresh the modal content
      await showHarvestWithdrawalRequests();
    } else {
      showNotification(data.error || "Failed to approve", "error");
    }
  } catch (error) {
    console.error("Approve error:", error);
    showNotification("Error approving withdrawal", "error");
  }
}

async function rejectHarvestWithdrawal(requestId) {
  const reason = prompt("Enter reason for rejection (user will be notified):");
  if (reason === null) return;

  if (!reason.trim()) {
    showNotification("Please provide a reason for rejection", "error");
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/harvest-withdrawal/${requestId}/reject`,
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
      showNotification("Withdrawal request rejected", "success");
      // Refresh the modal content
      await showHarvestWithdrawalRequests();
    } else {
      showNotification(data.error || "Failed to reject", "error");
    }
  } catch (error) {
    console.error("Reject error:", error);
    showNotification("Error rejecting withdrawal", "error");
  }
}

// Add event listener to the button
document
  .getElementById("viewWithdrawalRequestsBtn")
  ?.addEventListener("click", () => {
    showHarvestWithdrawalRequests();
  });

// Also refresh badge count when the harvest plans tab is opened
document
  .querySelector('.harvest-tab-btn[data-tab="plans"]')
  ?.addEventListener("click", async () => {
    // Refresh the badge count
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/harvest-withdrawal-requests`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        const data = await response.json();
        const pendingCount = (data.requests || []).filter(
          (r) => r.status === "pending",
        ).length;
        const badge = document.getElementById("withdrawalRequestBadge");
        if (badge) {
          badge.textContent = pendingCount;
          badge.style.display = pendingCount > 0 ? "inline-block" : "none";
        }
      }
    } catch (error) {
      console.error("Error refreshing badge:", error);
    }
  });

// Initialize harvest tabs when page loads
function initHarvestManagement() {
  initHarvestTabs();

  // Refresh button
  document
    .getElementById("refreshHarvestPlansBtn")
    ?.addEventListener("click", () => {
      const activeTab = document.querySelector(".harvest-tab-btn.active")
        ?.dataset.tab;
      if (activeTab === "plans") {
        loadHarvestPlans();
      } else if (activeTab === "enrollments") {
        loadHarvestEnrollments();
      }
    });

  // Filter listeners
  document.getElementById("harvestPlanSearch")?.addEventListener(
    "input",
    debounce(() => loadHarvestPlans(), 500),
  );
  document
    .getElementById("harvestPlanStatusFilter")
    ?.addEventListener("change", () => loadHarvestPlans());
  document.getElementById("enrollmentSearch")?.addEventListener(
    "input",
    debounce(() => loadHarvestEnrollments(), 500),
  );
  document
    .getElementById("enrollmentStatusFilter")
    ?.addEventListener("change", () => loadHarvestEnrollments());
  document
    .getElementById("autoSaveFilter")
    ?.addEventListener("change", () => loadHarvestEnrollments());
  document
    .getElementById("planFilter")
    ?.addEventListener("change", () => loadHarvestEnrollments());
}

// ==================== VIEW USER ENROLLMENTS ====================

async function viewUserEnrollments(userId, userName) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/users/${userId}/enrollments`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok) {
      const data = await response.json();
      showEnrollmentsModal(data, userName);
    }
  } catch (error) {
    console.error("Error loading enrollments:", error);
    showNotification("Failed to load user enrollments", "error");
  }
}

function showEnrollmentsModal(enrollments, userName) {
  const modal = document.createElement("div");
  modal.className = "modal show";
  modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
                <h3>${userName}'s Savings Enrollments</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="enrollments-tabs">
                    <button class="tab-btn active" onclick="switchEnrollmentTab('harvest')">Harvest Plans</button>
                    <button class="tab-btn" onclick="switchEnrollmentTab('fixed')">Fixed Savings</button>
                    <button class="tab-btn" onclick="switchEnrollmentTab('savebox')">SaveBox</button>
                    <button class="tab-btn" onclick="switchEnrollmentTab('target')">Target Savings</button>
                </div>
                
                <div id="harvestEnrollmentsTab" class="enrollment-tab active">
                    ${renderEnrollmentTable(enrollments.harvest || [], "harvest")}
                </div>
                <div id="fixedEnrollmentsTab" class="enrollment-tab" style="display:none">
                    ${renderEnrollmentTable(enrollments.fixed || [], "fixed")}
                </div>
                <div id="saveboxEnrollmentsTab" class="enrollment-tab" style="display:none">
                    ${renderEnrollmentTable(enrollments.savebox || [], "savebox")}
                </div>
                <div id="targetEnrollmentsTab" class="enrollment-tab" style="display:none">
                    ${renderEnrollmentTable(enrollments.target || [], "target")}
                </div>
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
}

function renderEnrollmentTable(items, type) {
  if (!items || items.length === 0) {
    return '<div class="empty-state">No enrollments found</div>';
  }

  return `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Plan/Savings</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Start Date</th>
                    <th>Expected End</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${items
                  .map(
                    (item) => `
                    <tr>
                        <td>${item.plan_name || item.savings_type || type}</td>
                        <td>₦${item.amount?.toFixed(2) || item.total_saved?.toFixed(2) || "0"}</td>
                        <td><span class="status-badge ${item.status}">${item.status}</span></td>
                        <td>${new Date(item.start_date || item.created_at).toLocaleDateString()}</td>
                        <td>${item.expected_end_date ? new Date(item.expected_end_date).toLocaleDateString() : "-"}</td>
                        <td>
                            <button class="action-btn view" onclick="viewEnrollmentDetails('${type}', '${item.id}')">View</button>
                            ${item.status === "active" ? `<button class="action-btn delete" onclick="cancelEnrollment('${type}', '${item.id}')">Cancel</button>` : ""}
                        </td>
                    </tr>
                `,
                  )
                  .join("")}
            </tbody>
        </table>
    `;
}

window.switchEnrollmentTab = function (tab) {
  document
    .querySelectorAll(".enrollment-tab")
    .forEach((t) => (t.style.display = "none"));
  document.getElementById(`${tab}EnrollmentsTab`).style.display = "block";

  document
    .querySelectorAll(".enrollments-tabs .tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  event.target.classList.add("active");
};
document.getElementById("bankLedger")?.addEventListener("click", () => {
  window.location.href = "admin-ledger.html";
});

// ==================== SETTINGS PAGE FUNCTIONS ====================

async function loadSettings() {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const settings = await response.json();

      // Helper function to get setting value
      const getSetting = (key, defaultValue = "") => {
        const setting = settings.find((s) => s.setting_key === key);
        return setting ? setting.setting_value : defaultValue;
      };

      // Banking Settings
      document.getElementById("defaultCurrency").value = getSetting(
        "default_currency",
        "NGN",
      );
      document.getElementById("transactionFee").value = getSetting(
        "transaction_fee_percentage",
        "0.5",
      );
      document.getElementById("dailyLimit").value = getSetting(
        "daily_limit",
        "1000000",
      );
      document.getElementById("cardPurchaseMethod").value = getSetting(
        "card_purchase_method",
        "both",
      );
      document.getElementById("minWithdrawal").value = getSetting(
        "min_withdrawal",
        "1000",
      );
      document.getElementById("maxWithdrawal").value = getSetting(
        "max_withdrawal",
        "1000000",
      );

      // Security Settings
      document.getElementById("admin2FA").checked =
        getSetting("admin_2fa", "false") === "true";
      document.getElementById("sessionTimeout").value = getSetting(
        "session_timeout",
        "30",
      );
      document.getElementById("maxLoginAttempts").value = getSetting(
        "max_login_attempts",
        "5",
      );
      document.getElementById("globalOtpMode").checked =
        getSetting("otp_mode", "off") === "on";
      document.getElementById("lockoutDuration").value = getSetting(
        "lockout_duration",
        "30",
      );

      // Exchange Rates
      document.getElementById("rateUSDNGN").value = getSetting(
        "usd_to_ngn",
        "1500",
      );
      document.getElementById("rateEURNGN").value = getSetting(
        "eur_to_ngn",
        "1640",
      );
      document.getElementById("rateGBPNGN").value = getSetting(
        "gbp_to_ngn",
        "1920",
      );
      document.getElementById("rateNGNUSD").value = getSetting(
        "ngn_to_usd",
        "0.00067",
      );

      // Risk Management
      document.getElementById("geoBlocking").checked =
        getSetting("geo_blocking", "false") === "true";
      document.getElementById("blockedCountries").value = getSetting(
        "blocked_countries",
        "",
      );
      document.getElementById("suspiciousThreshold").value = getSetting(
        "suspicious_threshold",
        "500000",
      );
      document.getElementById("dailyTxLimit").value = getSetting(
        "daily_tx_limit",
        "50",
      );

      // Maintenance
      document.getElementById("maintenanceMode").checked =
        getSetting("maintenance_mode", "false") === "true";
      document.getElementById("maintenanceMessage").value = getSetting(
        "maintenance_message",
        "System is currently under maintenance. Please check back later.",
      );
      document.getElementById("backupSchedule").value = getSetting(
        "backup_schedule",
        "daily",
      );

      // Show/hide maintenance message field
      toggleMaintenanceMessage();
    }
  } catch (error) {
    console.error("Error loading settings:", error);
    showNotification("Failed to load settings", "error");
  }
}

function toggleMaintenanceMessage() {
  const maintenanceMode = document.getElementById("maintenanceMode")?.checked;
  const messageGroup = document.getElementById("maintenanceMessageGroup");
  if (messageGroup) {
    messageGroup.style.display = maintenanceMode ? "block" : "none";
  }
}

// Save Settings
document.getElementById("saveSettings")?.addEventListener("click", async () => {
  const settings = {
    default_currency: document.getElementById("defaultCurrency").value,
    transaction_fee_percentage: document.getElementById("transactionFee").value,
    daily_limit: document.getElementById("dailyLimit").value,
    card_purchase_method: document.getElementById("cardPurchaseMethod").value,
    min_withdrawal: document.getElementById("minWithdrawal").value,
    max_withdrawal: document.getElementById("maxWithdrawal").value,
    admin_2fa: document.getElementById("admin2FA").checked ? "true" : "false",
    session_timeout: document.getElementById("sessionTimeout").value,
    max_login_attempts: document.getElementById("maxLoginAttempts").value,
    otp_mode: document.getElementById("globalOtpMode").checked ? "on" : "off",
    lockout_duration: document.getElementById("lockoutDuration").value,
    usd_to_ngn: document.getElementById("rateUSDNGN").value,
    eur_to_ngn: document.getElementById("rateEURNGN").value,
    gbp_to_ngn: document.getElementById("rateGBPNGN").value,
    ngn_to_usd: document.getElementById("rateNGNUSD").value,
    geo_blocking: document.getElementById("geoBlocking").checked
      ? "true"
      : "false",
    blocked_countries: document.getElementById("blockedCountries").value,
    suspicious_threshold: document.getElementById("suspiciousThreshold").value,
    daily_tx_limit: document.getElementById("dailyTxLimit").value,
    maintenance_mode: document.getElementById("maintenanceMode").checked
      ? "true"
      : "false",
    maintenance_message: document.getElementById("maintenanceMessage").value,
    backup_schedule: document.getElementById("backupSchedule").value,
  };

  const saveBtn = document.getElementById("saveSettings");
  const originalText = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  try {
    const response = await fetch(`${API_BASE_URL}/admin/settings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });

    if (response.ok) {
      showNotification("Settings saved successfully", "success");
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to save settings", "error");
    }
  } catch (error) {
    console.error("Error saving settings:", error);
    showNotification("Failed to save settings", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalText;
  }
});

// Reset Settings
document
  .getElementById("resetSettings")
  ?.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to reset all settings to default?"))
      return;

    // Default values
    document.getElementById("defaultCurrency").value = "NGN";
    document.getElementById("transactionFee").value = "0.5";
    document.getElementById("dailyLimit").value = "1000000";
    document.getElementById("cardPurchaseMethod").value = "both";
    document.getElementById("minWithdrawal").value = "1000";
    document.getElementById("maxWithdrawal").value = "1000000";
    document.getElementById("admin2FA").checked = false;
    document.getElementById("sessionTimeout").value = "30";
    document.getElementById("maxLoginAttempts").value = "5";
    document.getElementById("globalOtpMode").checked = false;
    document.getElementById("lockoutDuration").value = "30";
    document.getElementById("rateUSDNGN").value = "1500";
    document.getElementById("rateEURNGN").value = "1640";
    document.getElementById("rateGBPNGN").value = "1920";
    document.getElementById("rateNGNUSD").value = "0.00067";
    document.getElementById("geoBlocking").checked = false;
    document.getElementById("blockedCountries").value = "";
    document.getElementById("suspiciousThreshold").value = "500000";
    document.getElementById("dailyTxLimit").value = "50";
    document.getElementById("maintenanceMode").checked = false;
    document.getElementById("backupSchedule").value = "daily";

    toggleMaintenanceMessage();
    showNotification(
      "Settings reset to default. Click Save to apply changes.",
      "info",
    );
  });

// Toggle maintenance message visibility
document
  .getElementById("maintenanceMode")
  ?.addEventListener("change", toggleMaintenanceMessage);

// Update exchange rates button
document
  .getElementById("updateRatesBtn")
  ?.addEventListener("click", async () => {
    const rates = {
      usd_to_ngn: document.getElementById("rateUSDNGN").value,
      eur_to_ngn: document.getElementById("rateEURNGN").value,
      gbp_to_ngn: document.getElementById("rateGBPNGN").value,
      ngn_to_usd: document.getElementById("rateNGNUSD").value,
    };

    const btn = document.getElementById("updateRatesBtn");
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/settings/exchange-rates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(rates),
        },
      );

      if (response.ok) {
        showNotification("Exchange rates updated successfully", "success");
      } else {
        const data = await response.json();
        showNotification(data.error || "Failed to update rates", "error");
      }
    } catch (error) {
      showNotification("Failed to update exchange rates", "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });

// Close modal helper
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("show");
}

// ==================== PULL TO REFRESH FOR ADMIN ====================

let adminPullToRefresh = null;

// Initialize admin pull-to-refresh with error handling
function initAdminPullToRefresh() {
  try {
    // Check if PullToRefresh class exists
    if (typeof PullToRefresh === "undefined") {
      console.warn("PullToRefresh library not loaded yet");
      return;
    }

    adminPullToRefresh = new PullToRefresh({
      threshold: 80,
      maxPull: 150,
      refreshTimeout: 10000,
      onRefresh: async () => {
        await refreshAllAdminData();
      },
    });

    console.log("Pull to refresh initialized for admin");
  } catch (error) {
    console.error("Failed to initialize pull to refresh:", error);
  }
}

// Call initialization after DOM is fully loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      initAdminPullToRefresh();
      addAdminRefreshButton();
    }, 500);
  });
} else {
  setTimeout(() => {
    initAdminPullToRefresh();
    addAdminRefreshButton();
  }, 500);
}

async function refreshAllAdminData() {
  console.log("Starting admin dashboard refresh...");

  try {
    // Get current active page
    const activePage =
      document.querySelector(".admin-page.active")?.id || "page-dashboard";

    // Refresh stats
    await loadAdminStats();

    // Refresh based on current page
    switch (activePage) {
      case "page-dashboard":
        await loadAdminStats();
        break;

      case "page-users":
        await loadUsers(1);
        break;

      case "page-transactions":
        await loadTransactions(1);
        break;

      case "page-accounts":
        await loadAccounts(1);
        break;

      case "page-otp":
        await loadOTPMode();
        break;

      case "page-add-money":
        await loadAddMoneyRequests();
        break;

      case "page-external-transfers":
        await loadAdminExternalTransfers(1, "all", "all");
        break;

      case "page-receive-methods":
        await loadReceiveMethods();
        break;

      case "page-receive-requests":
        await loadReceiveRequests();
        break;

      case "page-live-chat":
        await loadActiveChatUsers();
        break;

      case "page-support":
        await loadTickets();
        break;

      case "page-harvest-plans":
        if (typeof loadHarvestPlans === "function") await loadHarvestPlans();
        break;
    }

    updateAdminLastRefreshTime();
    console.log("Admin refresh completed");
  } catch (error) {
    console.error("Admin refresh error:", error);
    throw error;
  }
}

function updateAdminLastRefreshTime() {
  let refreshIndicator = document.getElementById("adminLastRefreshTime");

  if (!refreshIndicator) {
    refreshIndicator = document.createElement("div");
    refreshIndicator.id = "adminLastRefreshTime";
    refreshIndicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            z-index: 999;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
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

function addAdminRefreshButton() {
  const topbarRight = document.querySelector(".topbar-right");
  if (topbarRight && !document.getElementById("adminRefreshButton")) {
    const refreshBtn = document.createElement("button");
    refreshBtn.id = "adminRefreshButton";
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
      await refreshAllAdminData();
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

    const adminNotifications = document.querySelector(".admin-notifications");
    if (adminNotifications) {
      topbarRight.insertBefore(refreshBtn, adminNotifications);
    } else {
      topbarRight.appendChild(refreshBtn);
    }
  }
}

// ==================== API CONNECTION TEST FUNCTION ====================

async function testApiConnection() {
  console.log("🔍 Testing API connection...");
  console.log("⏰ Test started at:", new Date().toLocaleString());

  // Get the token
  const token = localStorage.getItem("token");
  if (!token) {
    console.error("❌ No token found in localStorage");
    showNotification(
      "No authentication token found. Please login as admin.",
      "error",
    );
    return;
  }

  console.log("✅ Token found, length:", token.length);

  // Show loading state on button if it exists
  const testBtn = document.getElementById("testApiBtn");
  const originalBtnText = testBtn?.innerHTML;
  if (testBtn) {
    testBtn.disabled = true;
    testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
  }

  try {
    // Test 1: Simple GET request without auth (should work)
    console.log("\n📡 Test 1: GET /api/test-connection (no auth required)");
    const getResponse = await fetch(`${API_BASE_URL}/test-connection`);

    if (getResponse.ok) {
      const getData = await getResponse.json();
      console.log("✅ GET test SUCCESS:", getData);
      showNotification(`GET Test: ${getData.message}`, "success");
    } else {
      console.error(
        "❌ GET test FAILED:",
        getResponse.status,
        getResponse.statusText,
      );
      showNotification(`GET test failed: ${getResponse.status}`, "error");
    }

    // Test 2: GET request with authentication (for user endpoints)
    console.log("\n📡 Test 2: GET /api/test-connection (with auth)");
    const authGetResponse = await fetch(`${API_BASE_URL}/test-connection`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (authGetResponse.ok) {
      const authGetData = await authGetResponse.json();
      console.log("✅ Auth GET test SUCCESS:", authGetData);
    } else {
      console.error("❌ Auth GET test FAILED:", authGetResponse.status);
    }

    // Test 3: POST request with data
    console.log("\n📡 Test 3: POST /api/test-connection with data");
    const testData = {
      test: "connection_check",
      timestamp: new Date().toISOString(),
      source: "admin_dashboard",
    };

    const postResponse = await fetch(`${API_BASE_URL}/test-connection`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testData),
    });

    if (postResponse.ok) {
      const postData = await postResponse.json();
      console.log("✅ POST test SUCCESS:", postData);
    } else {
      console.error("❌ POST test FAILED:", postResponse.status);
    }

    // Test 4: Check savings status endpoint (if it exists)
    console.log("\n📡 Test 4: GET /api/user/savings/summary");
    try {
      const savingsResponse = await fetch(
        `${API_BASE_URL}/user/savings/summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (savingsResponse.ok) {
        const savingsData = await savingsResponse.json();
        console.log("✅ Savings status endpoint WORKING:", savingsData);
        showNotification("Savings API is working! ✅", "success");
      } else if (savingsResponse.status === 404) {
        console.warn(
          "⚠️ Savings status endpoint returned 404 - route may not be deployed yet",
        );
        showNotification(
          "Savings API not found (404) - Redeploy pending? ⚠️",
          "warning",
        );
      } else {
        console.warn("⚠️ Savings status returned:", savingsResponse.status);
      }
    } catch (savingsErr) {
      console.error("❌ Savings status endpoint error:", savingsErr.message);
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 API TEST SUMMARY");
    console.log("=".repeat(50));
    console.log("✅ Backend is REACHABLE");
    console.log(`✅ Token is VALID (${token.substring(0, 20)}...)`);
    console.log(`✅ API Base URL: ${API_BASE_URL}`);
    console.log(`⏰ Test completed at: ${new Date().toLocaleString()}`);
    console.log("=".repeat(50));

    showNotification(
      "API test completed! Check console for details 📊",
      "info",
    );
  } catch (error) {
    console.error("❌❌❌ API TEST FAILED ❌❌❌");
    console.error("Error type:", error.name);
    console.error("Error message:", error.message);
    console.error("Full error:", error);

    showNotification(`API Connection Failed: ${error.message}`, "error");
  } finally {
    // Restore button
    if (testBtn) {
      testBtn.disabled = false;
      testBtn.innerHTML =
        originalBtnText || '<i class="fas fa-vial"></i> Test API Connection';
    }
  }
}

// ==================== ADMIN LOGS FUNCTIONS ====================

let currentLogsPage = 1;
let logsSearchTerm = "";
let logsActionFilter = "";
let logsStartDate = "";
let logsEndDate = "";

// Load admin logs with pagination and filters
async function loadAdminLogs(
  page = 1,
  search = "",
  action = "",
  startDate = "",
  endDate = "",
) {
  const container = document.getElementById("logsTableBody");
  if (!container) return;

  currentLogsPage = page;
  logsSearchTerm = search;
  logsActionFilter = action;
  logsStartDate = startDate;
  logsEndDate = endDate;

  // Show loading state
  container.innerHTML =
    '<tr><td colspan="6" style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Loading logs...</td></tr>';

  try {
    let url = `${API_BASE_URL}/admin/logs?page=${page}&limit=50`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (action && action !== "all") url += `&action_type=${action}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to load logs: ${response.status}`);
    }

    const data = await response.json();

    // Update action filter dropdown if not populated
    const actionFilter = document.getElementById("logActionFilter");
    if (actionFilter && actionFilter.options.length <= 1 && data.action_types) {
      data.action_types.forEach((actionType) => {
        actionFilter.innerHTML += `<option value="${actionType}">${actionType.replace(/_/g, " ").toUpperCase()}</option>`;
      });
    }

    renderAdminLogsTable(data.logs || []);
    updateLogsPagination(data.pagination);
  } catch (error) {
    console.error("Error loading admin logs:", error);
    container.innerHTML =
      '<tr><td colspan="6" style="text-align: center; color: #ef4444;">Failed to load admin logs</td></tr>';
    showNotification("Failed to load admin logs", "error");
  }
}

// Render admin logs table
function renderAdminLogsTable(logs) {
  const tbody = document.getElementById("logsTableBody");
  if (!tbody) return;

  if (!logs || logs.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align: center; padding: 40px;">No admin actions found</td></tr>';
    return;
  }

  tbody.innerHTML = logs
    .map((log) => {
      // Get admin name
      const adminName = log.admin
        ? `${log.admin.first_name || ""} ${log.admin.last_name || ""}`.trim() ||
          log.admin.email ||
          "System"
        : "System";

      // Get target user name
      const targetName = log.target_user
        ? `${log.target_user.first_name || ""} ${log.target_user.last_name || ""}`.trim() ||
          log.target_user.email ||
          "N/A"
        : "N/A";

      // Format action type for display
      const actionDisplay = log.action_type.replace(/_/g, " ").toUpperCase();

      // Get action type class for styling
      let actionClass = "action-log";
      if (log.action_type.includes("freeze"))
        actionClass = "action-log warning";
      else if (
        log.action_type.includes("delete") ||
        log.action_type.includes("reject")
      )
        actionClass = "action-log danger";
      else if (
        log.action_type.includes("approve") ||
        log.action_type.includes("verify")
      )
        actionClass = "action-log success";
      else if (log.action_type.includes("create"))
        actionClass = "action-log success";
      else if (
        log.action_type.includes("update") ||
        log.action_type.includes("edit")
      )
        actionClass = "action-log info";

      // Format details nicely
      let detailsHtml = "-";
      if (log.details) {
        try {
          const details =
            typeof log.details === "string"
              ? JSON.parse(log.details)
              : log.details;
          if (details && Object.keys(details).length > 0) {
            const detailKeys = Object.keys(details).slice(0, 3);
            detailsHtml = detailKeys
              .map((key) => {
                let value = details[key];
                if (typeof value === "object") value = JSON.stringify(value);
                if (typeof value === "string" && value.length > 30)
                  value = value.substring(0, 30) + "...";
                return `<span class="detail-item"><strong>${key}:</strong> ${escapeHtml(value)}</span>`;
              })
              .join(" ");
            if (Object.keys(details).length > 3) {
              detailsHtml += ' <span class="detail-item">...</span>';
            }
          }
        } catch (e) {
          detailsHtml = escapeHtml(String(log.details).substring(0, 50));
        }
      }

      return `
      <tr class="log-row" onclick="viewLogDetails('${log.id}')" style="cursor: pointer;">
        <td>${new Date(log.created_at).toLocaleString()}</td>
        <td class="${actionClass}">${escapeHtml(adminName)}</td>
        <td><span class="action-type-badge ${log.action_type}">${actionDisplay}</span></td>
        <td>${escapeHtml(targetName)}</td>
        <td>${detailsHtml}</td>
        <td>${log.ip_address || "-"}</td>
      </tr>
    `;
    })
    .join("");
}

// Update pagination for logs
function updateLogsPagination(pagination) {
  const container = document.getElementById("logsPagination");
  if (!container) return;

  if (!pagination || pagination.pages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = `
    <button class="page-btn" ${pagination.page === 1 ? "disabled" : ""} 
            onclick="loadAdminLogsPage(${pagination.page - 1})">
      ← Prev
    </button>
  `;

  const startPage = Math.max(1, pagination.page - 2);
  const endPage = Math.min(pagination.pages, pagination.page + 2);

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === pagination.page ? "active" : ""}" 
                   onclick="loadAdminLogsPage(${i})">${i}</button>`;
  }

  html += `
    <button class="page-btn" ${pagination.page === pagination.pages ? "disabled" : ""} 
            onclick="loadAdminLogsPage(${pagination.page + 1})">
      Next →
    </button>
  `;

  container.innerHTML = html;
}

// Load logs page helper
function loadAdminLogsPage(page) {
  loadAdminLogs(
    page,
    logsSearchTerm,
    logsActionFilter,
    logsStartDate,
    logsEndDate,
  );
}

// View log details modal
async function viewLogDetails(logId) {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/logs/${logId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error("Failed to load log details");

    const log = await response.json();

    const modal = document.createElement("div");
    modal.className = "modal show";
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <h3>Admin Action Details</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div style="display: grid; gap: 15px;">
            <div class="detail-item">
              <div class="detail-label">Timestamp</div>
              <div class="detail-value">${new Date(log.created_at).toLocaleString()}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Admin</div>
              <div class="detail-value">${log.admin ? `${log.admin.first_name || ""} ${log.admin.last_name || ""}`.trim() || log.admin.email : "System"}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Action Type</div>
              <div class="detail-value"><span class="action-type-badge ${log.action_type}">${log.action_type.replace(/_/g, " ").toUpperCase()}</span></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Target User</div>
              <div class="detail-value">${log.target_user ? `${log.target_user.first_name || ""} ${log.target_user.last_name || ""}`.trim() || log.target_user.email : "N/A"}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">IP Address</div>
              <div class="detail-value">${log.ip_address || "-"}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Details</div>
              <div class="detail-value"><pre style="background: #f8fafc; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px;">${JSON.stringify(log.details, null, 2)}</pre></div>
            </div>
          </div>
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
  } catch (error) {
    console.error("Error loading log details:", error);
    showNotification("Failed to load log details", "error");
  }
}

// Add event listener when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  const testBtn = document.getElementById("testApiBtn");
  if (testBtn) {
    testBtn.addEventListener("click", testApiConnection);
    console.log("✅ API test button initialized");
  }
});

// ==================== CLOSED ACCOUNTS MANAGEMENT ====================

async function loadClosedAccounts() {
  const tbody = document.getElementById("closedAccountsTableBody");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="6" style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

  try {
    const response = await fetch(`${API_BASE_URL}/admin/closed-accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error("Failed to load closed accounts");

    const data = await response.json();
    const accounts = data.closed_accounts || [];

    if (accounts.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align: center;">No closed accounts found</td></tr>';
      return;
    }

    tbody.innerHTML = accounts
      .map(
        (account) => `
      <tr>
        <td><strong>${escapeHtml(account.user_name || "N/A")}</strong></td>
        <td>${escapeHtml(account.user_email || "N/A")}</td>
        <td style="max-width: 300px;">${escapeHtml(account.reason || "N/A")}</td>
        <td>₦${(account.balance_at_close || 0).toLocaleString()}</td>
        <td>${new Date(account.closed_at).toLocaleString()}</td>
        <td>
          <button class="action-btn delete" onclick="deleteClosedAccount('${account.id}')" title="Delete Record">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `,
      )
      .join("");
  } catch (error) {
    console.error("Load closed accounts error:", error);
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align: center; color: #ef4444;">Failed to load closed accounts</td></tr>';
  }
}

async function deleteClosedAccount(accountId) {
  if (!confirm("Are you sure you want to delete this closed account record?"))
    return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/closed-accounts/${accountId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok) {
      showNotification("Record deleted successfully", "success");
      await loadClosedAccounts();
    } else {
      showNotification("Failed to delete record", "error");
    }
  } catch (error) {
    console.error("Delete error:", error);
    showNotification("Error deleting record", "error");
  }
}

async function deleteAllClosedAccounts() {
  if (
    !confirm(
      "⚠️ WARNING: This will delete ALL closed account records permanently. This action cannot be undone. Are you sure?",
    )
  )
    return;

  if (!confirm("Type 'DELETE ALL' to confirm:")) return;

  const confirmation = prompt('Type "DELETE ALL" to confirm:');
  if (confirmation !== "DELETE ALL") {
    showNotification(
      "Confirmation failed. No records were deleted.",
      "warning",
    );
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/admin/closed-accounts/all`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      showNotification("All closed account records deleted", "success");
      await loadClosedAccounts();
    } else {
      showNotification("Failed to delete records", "error");
    }
  } catch (error) {
    console.error("Delete all error:", error);
    showNotification("Error deleting records", "error");
  }
}

// Make functions globally available
window.loadClosedAccounts = loadClosedAccounts;
window.deleteClosedAccount = deleteClosedAccount;
window.deleteAllClosedAccounts = deleteAllClosedAccounts;
