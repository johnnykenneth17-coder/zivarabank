// admin.js - Handles admin dashboard functionality

// API Base URL
const API_BASE_URL = "https://bank-backend-blush.vercel.app/api";

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
  await loadAdminData();
  initializeEventListeners();
  loadActiveChatUsers();
  startRealTimeUpdates();
  loadAdminStats();
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

    // Load initial data
    await loadUsers();
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
// Call initialization after DOM is ready (already in your DOMContentLoaded)
// Just make sure this line exists:
// initializeEventListeners();
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
    await populateUserSelects(); // ← important
    document.getElementById("freezeModal").classList.add("show");
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

// Load users
async function loadUsers(page = 1, search = "", status = "") {
  try {
    let url = `${API_BASE_URL}/admin/users?page=${page}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (status) url += `&status=${status}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      users = data.users;
      updateUsersTable(data);
      populateAllUserSelects(users);
    }
  } catch (error) {
    console.error("Error loading users:", error);
  }
}

// Inside loadUsers(), after fetching users
function populateAllUserSelects(users) {
  const selects = [
    document.getElementById("userSelect"), // top of users page
    document.getElementById("freezeUserSelect"),
    document.getElementById("balanceUserSelect"),
    document.getElementById("accountUserSelect"), // if exists
    document.getElementById("otpUserSelect"), // ← OTP tab select
    // add any others — check your HTML!
  ].filter(Boolean); // remove null/undefined

  console.log(`Populating ${selects.length} user selects`);

  const placeholder = '<option value="">Select User</option>';

  selects.forEach((select) => {
    let options = placeholder;

    users.forEach((user) => {
      const name =
        `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Unnamed";
      const label = `${name} (${user.email || "no email"})`;
      options += `<option value="${user.id}">${label}</option>`;
    });

    select.innerHTML = options;

    // Optional: reset to placeholder
    select.value = "";
  });
}

// Update users table
function updateUsersTable(data) {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;

  tbody.innerHTML = data.users
    .map(
      (user) => `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="admin-avatar" style="width: 35px; height: 35px; background: #2563eb;">
                        ${user.first_name[0]}${user.last_name[0]}
                    </div>
                    <div>
                        <strong>${user.first_name} ${user.last_name}</strong>
                    </div>
                </div>
            </td>
            <td>${user.email}</td>
            <td>
                <span class="status-badge ${user.is_frozen ? "frozen" : user.is_active ? "active" : "inactive"}">
                    ${user.is_frozen ? "Frozen" : user.is_active ? "Active" : "Inactive"}
                </span>
            </td>
            <td>
                <span class="status-badge ${user.kyc_status}">
                    ${user.kyc_status.toUpperCase()}
                </span>
            </td>
            <td>$${user.accounts?.reduce((sum, acc) => sum + acc.balance, 0).toFixed(2) || "0.00"}</td>
            <td>${new Date(user.created_at).toLocaleDateString()}</td>
            <td>
                <button class="action-btn view" onclick="viewUser('${user.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="action-btn edit" onclick="editUser('${user.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn freeze" onclick="showFreezeModal('${user.id}', '${user.first_name} ${user.last_name}')">
                    <i class="fas fa-ban"></i>
                </button>
                <button class="action-btn delete" onclick="impersonateUser('${user.id}', '${user.first_name} ${user.last_name}')">
                    <i class="fas fa-mask"></i>
                </button>
            </td>
        </tr>
    `,
    )
    .join("");

  // Update pagination
  updatePagination("usersPagination", data.pagination, (page) =>
    loadUsers(page),
  );
}

// View user details function
async function viewUser(userId) {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load user details");
    }

    const user = await response.json();
    showUserDetailsModal(user);
  } catch (error) {
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
                    <h4 style="margin-bottom: 15px;">Total Balance: <strong>$${totalBalance.toFixed(2)}</strong></h4>
                    <div style="display: grid; gap: 15px;">
                        ${
                          user.accounts
                            ?.map(
                              (account) => `
                            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                    <strong>${account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)} Account</strong>
                                    <span>${account.account_number}</span>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                                    <div>
                                        <div class="detail-label">Balance</div>
                                        <div class="detail-value">$${account.balance.toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div class="detail-label">Available</div>
                                        <div class="detail-value">$${account.available_balance.toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div class="detail-label">Currency</div>
                                        <div class="detail-value">${account.currency}</div>
                                    </div>
                                    <div>
                                        <div class="detail-label">Status</div>
                                        <div class="detail-value">
                                            <span class="status-badge ${account.status}">
                                                ${account.status.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <div class="detail-label">Daily Limit</div>
                                        <div class="detail-value">$${account.daily_limit?.toFixed(2) || "N/A"}</div>
                                    </div>
                                    <div>
                                        <div class="detail-label">Monthly Limit</div>
                                        <div class="detail-value">$${account.monthly_limit?.toFixed(2) || "N/A"}</div>
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
                                    <strong>${card.card_type.charAt(0).toUpperCase() + card.card_type.slice(1)} Card</strong>
                                    <span class="status-badge ${card.card_status}">${card.card_status}</span>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                                    <div>
                                        <div class="detail-label">Card Number</div>
                                        <div class="detail-value">•••• •••• •••• ${card.card_number.slice(-4)}</div>
                                    </div>
                                    <div>
                                        <div class="detail-label">Expiry</div>
                                        <div class="detail-value">${new Date(card.expiry_date).toLocaleDateString("en-US", { month: "2-digit", year: "2-digit" })}</div>
                                    </div>
                                    <div>
                                        <div class="detail-label">Spending Limit</div>
                                        <div class="detail-value">$${card.spending_limit?.toFixed(2) || "N/A"}</div>
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
                                        <td>${t.transaction_type.replace("_", " ").toUpperCase()}</td>
                                        <td>${t.description || "-"}</td>
                                        <td style="color: ${t.to_user_id === user.id ? "#10b981" : "#ef4444"}">
                                            ${t.to_user_id === user.id ? "+" : "-"}$${t.amount.toFixed(2)}
                                        </td>
                                        <td>
                                            <span class="status-badge ${t.status}">${t.status}</span>
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
  try {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load user data");
    }

    const user = await response.json();
    showEditUserModal(user);
  } catch (error) {
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
                    
                    <!-- ID Information -->
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
      throw new Error("Failed to load transaction details");
    }

    const transaction = await response.json();
    showTransactionDetailsModal(transaction);
  } catch (error) {
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
                        <div class="detail-value">$${transaction.amount.toFixed(2)} ${transaction.currency}</div>
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
      showNotification("Transaction approved", "success");
      closeUserDetailsModal();
      await loadTransactions();
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to approve transaction", "error");
    }
  } catch (error) {
    console.error("Error approving transaction:", error);
    showNotification("Failed to approve transaction", "error");
  }
};

// Reject transaction
window.rejectTransaction = async function (transactionId) {
  const reason = prompt("Please enter reason for rejection:");
  if (reason === null) return;

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
      showNotification("Transaction rejected", "success");
      closeUserDetailsModal();
      await loadTransactions();
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to reject transaction", "error");
    }
  } catch (error) {
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
            <td>$${t.amount.toFixed(2)}</td>
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.ok) {
      const messages = await response.json();
      displayTicketChat(ticketId, messages);
    }
  } catch (error) {
    console.error("Error loading ticket chat:", error);
  }
}

// Display ticket chat
function displayTicketChat(ticketId, messages) {
  const chatContainer = document.getElementById("adminTicketChat");
  if (!chatContainer) return;

  chatContainer.innerHTML = `
        <div class="chat-header">
            <h4>Support Conversation</h4>
        </div>
        <div class="chat-messages" id="ticketMessages">
            ${messages
              .map(
                (msg) => `
                <div class="message ${msg.is_admin_reply ? "admin" : "user"}">
                    <div class="message-avatar">
                        ${msg.sender?.first_name?.[0] || "A"}
                    </div>
                    <div class="message-content">
                        <div>${msg.message}</div>
                        <div class="message-time">${new Date(msg.created_at).toLocaleString()}</div>
                    </div>
                </div>
            `,
              )
              .join("")}
        </div>
        <div class="chat-input">
            <input type="text" id="ticketReplyInput" placeholder="Type your reply...">
            <button class="btn btn-primary" onclick="sendTicketReply('${ticketId}')">Send</button>
        </div>
    `;

  // Scroll to bottom
  const messagesDiv = document.getElementById("ticketMessages");
  if (messagesDiv) {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

// Send ticket reply
async function sendTicketReply(ticketId) {
  const input = document.getElementById("ticketReplyInput");
  const message = input.value.trim();

  if (!message) return;

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
      input.value = "";
      await loadTicketChat(ticketId);
      await loadTickets();
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to send reply", "error");
    }
  } catch (error) {
    console.error("Error sending reply:", error);
    showNotification("Failed to send reply", "error");
  }
}

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
        <td class="amount">$${acc.balance?.toFixed(2) || "0.00"}</td>
        <td class="amount">$${acc.available_balance?.toFixed(2) || "0.00"}</td>
        <td>
          <span class="status-badge status-${acc.status}">
            ${acc.status}
          </span>
        </td>
        <td>${user.kyc_status || "—"}</td>
        <td>${new Date(acc.created_at).toLocaleDateString()}</td>
        <td class="actions">
          <button class="btn-icon" onclick="viewAccount('${acc.id}')">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn-icon" onclick="adjustBalance('${acc.id}', '${ownerName}')">
            <i class="fas fa-dollar-sign"></i>
          </button>
          ${
            acc.status !== "frozen"
              ? `
            <button class="btn-icon danger" onclick="freezeAccount('${acc.user_id}')">
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
  try {
    const res = await fetch(`${API_BASE_URL}/admin/users?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { users } = await res.json();

    // Freeze modal
    const freezeSelect = document.getElementById("freezeUserSelect");
    if (freezeSelect) {
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
    /*if (unfreezeSelect) {
      unfreezeSelect.innerHTML =
        '<option value="">Select User</option>' +
        users
          .map(
            (u) =>
              `<option value="${u.id}">${u.first_name} ${u.last_name} (${u.email})</option>`,
          )
          .join("");
    }*/

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

    if (!userId || !reason) {
      showNotification("Please select user and provide reason", "error");
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
          body: JSON.stringify({ freeze: true, reason }),
        },
      );

      if (response.ok) {
        document.getElementById("freezeModal").classList.remove("show");
        showNotification("Account frozen successfully", "success");
        document.getElementById("freezeReason").value = "";
        await loadAccounts();
        //await loadUsers();
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
  // Populate users
  /*userSelect.innerHTML =
    '<option value="">Select User</option>' +
    users
      .map(
        (u) =>
          `<option value="${u.id}">${u.first_name} ${u.last_name} (${u.email})</option>`,
      )
      .join("");*/

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
      document.getElementById("todayVolume").textContent =
        `$${stats.todayVolume.toFixed(2)}`;
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
                    <strong class="amount-value">$${parseFloat(req.amount).toFixed(2)}</strong>
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
                <td class="amount">$${transfer.amount.toFixed(2)}</td>
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
    `Reject transfer to ${bankName} for $${amount.toFixed(2)}?\n\nEnter reason for rejection (this will refund the user):`,
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
                    <div><strong>Amount:</strong> <span style="font-size: 20px; color: var(--primary-color);">$${transfer.amount.toFixed(2)}</span></div>
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
