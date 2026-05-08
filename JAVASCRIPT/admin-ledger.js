// admin-ledger.js - Bank Ledger Management (FIXED)

const API_BASE_URL = "https://bank-backend-blush.vercel.app/api";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

// State
let currentTab = "general";
let currentPage = 1;
let chartOfAccounts = [];

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  await loadAdminProfile();
  await loadChartOfAccounts();
  await loadGeneralLedger();
  initializeEventListeners();
  initializeTabs();
  loadUserSelects();

  // Set default dates for P&L
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  document.getElementById("plStartDate").value = firstDayOfMonth
    .toISOString()
    .split("T")[0];
  document.getElementById("plEndDate").value = today
    .toISOString()
    .split("T")[0];
  document.getElementById("tbAsOfDate").value = today
    .toISOString()
    .split("T")[0];
  document.getElementById("bsAsOfDate").value = today
    .toISOString()
    .split("T")[0];
  document.getElementById("djDate").value = today.toISOString().split("T")[0];
});

async function loadAdminProfile() {
  try {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const admin = await response.json();
      const adminNameEl = document.getElementById("adminName");
      const adminEmailEl = document.getElementById("adminEmail");
      const adminInitialsEl = document.getElementById("adminInitials");

      if (adminNameEl)
        adminNameEl.textContent = `${admin.first_name} ${admin.last_name}`;
      if (adminEmailEl) adminEmailEl.textContent = admin.email;
      if (adminInitialsEl)
        adminInitialsEl.textContent = admin.first_name[0] + admin.last_name[0];
    }
  } catch (error) {
    console.error("Error loading admin profile:", error);
  }
}

async function loadChartOfAccounts() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/ledger/chart-of-accounts`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (response.ok) {
      const data = await response.json();
      chartOfAccounts = data.accounts || [];
      renderChartOfAccounts();

      // Populate account filter dropdown
      const select = document.getElementById("glAccountFilter");
      if (select) {
        select.innerHTML = '<option value="">All Accounts</option>';
        chartOfAccounts.forEach((account) => {
          select.innerHTML += `<option value="${account.account_code}">${account.account_code} - ${account.account_name}</option>`;
        });
      }
    }
  } catch (error) {
    console.error("Error loading chart of accounts:", error);
    showNotification("Failed to load chart of accounts", "error");
  }
}

function renderChartOfAccounts() {
  const tbody = document.getElementById("chartOfAccountsBody");
  if (!tbody) return;

  if (!chartOfAccounts || chartOfAccounts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">No accounts found</td></tr>';
    return;
  }

  tbody.innerHTML = chartOfAccounts
    .map(
      (account) => `
        <tr>
            <td>${account.account_code || "-"}</td>
            <td>${account.account_name || "-"}</td>
            <td>${account.account_type || "-"}</td>
            <td>${account.normal_balance || "-"}</td>
            <td><span class="status-badge ${account.is_active ? "active" : "inactive"}">${account.is_active ? "Active" : "Inactive"}</span></td>
            <td>
                <button class="action-btn edit" onclick="editAccount('${account.account_code}')">Edit</button>
            </td>
        </tr>
    `,
    )
    .join("");
}

async function loadGeneralLedger(page = 1) {
  currentPage = page;
  const startDate = document.getElementById("glStartDate")?.value;
  const endDate = document.getElementById("glEndDate")?.value;
  const accountCode = document.getElementById("glAccountFilter")?.value;

  try {
    let url = `${API_BASE_URL}/admin/ledger/general?page=${page}&limit=50`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    if (accountCode) url += `&account_code=${accountCode}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      renderGeneralLedger(data);
      updateLedgerSummary(data.summary);
      updatePagination("glPagination", data.pagination, loadGeneralLedger);
    } else {
      console.error("Failed to load general ledger");
      showNotification("Failed to load general ledger", "error");
    }
  } catch (error) {
    console.error("Error loading general ledger:", error);
    showNotification("Failed to load general ledger", "error");
  }
}

function renderGeneralLedger(data) {
  const tbody = document.getElementById("generalLedgerBody");
  const tfoot = document.getElementById("generalLedgerFooter");

  if (!tbody) return;

  if (!data.entries || data.entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11">No entries found</td></tr>';
    if (tfoot) tfoot.innerHTML = "";
    return;
  }

  tbody.innerHTML = data.entries
    .map(
      (entry) => `
        <tr>
            <td>${entry.entry_id || "-"}</td>
            <td>${entry.entry_date ? new Date(entry.entry_date).toLocaleString() : "-"}</td>
            <td>${entry.account_code || "-"}</td>
            <td>${entry.account_name || "-"}</td>
            <td>${entry.users?.first_name || ""} ${entry.users?.last_name || ""}</td>
            <td>${entry.description || "-"}</td>
            <td>${entry.reference || "-"}</td>
            <td class="debit">${entry.debit_amount > 0 ? `₦${entry.debit_amount.toFixed(2)}` : "-"}</td>
            <td class="credit">${entry.credit_amount > 0 ? `₦${entry.credit_amount.toFixed(2)}` : "-"}</td>
            <td>
                <span class="${entry.is_reconciled ? "reconciled" : "unreconciled"}">
                    ${entry.is_reconciled ? "Reconciled" : "Pending"}
                </span>
            </td>
            <td>
                ${!entry.is_reconciled ? `<button class="action-btn edit" onclick="reconcileEntry('${entry.id}')">Reconcile</button>` : "-"}
            </td>
        </tr>
    `,
    )
    .join("");

  if (tfoot && data.summary) {
    tfoot.innerHTML = `
            <tr class="total-row">
                <td colspan="7"><strong>Totals</strong></td>
                <td class="debit"><strong>₦${data.summary.total_debit?.toFixed(2) || "0.00"}</strong></td>
                <td class="credit"><strong>₦${data.summary.total_credit?.toFixed(2) || "0.00"}</strong></td>
                <td colspan="2"></td>
            </tr>
            <tr class="${Math.abs(data.summary.difference || 0) < 0.01 ? "balanced" : "unbalanced"}">
                <td colspan="9">
                    <strong>Difference: ₦${(data.summary.difference || 0).toFixed(2)}</strong>
                    ${Math.abs(data.summary.difference || 0) < 0.01 ? " ✓ Balanced" : " ✗ Unbalanced"}
                </td>
            </tr>
        `;
  }
}

function updateLedgerSummary(summary) {
  const summaryDiv = document.getElementById("ledgerSummary");
  if (!summaryDiv) return;

  summaryDiv.innerHTML = `
        <div class="summary-card">
            <div class="summary-label">Total Debits</div>
            <div class="summary-value">₦${summary?.total_debit?.toFixed(2) || "0.00"}</div>
        </div>
        <div class="summary-card green">
            <div class="summary-label">Total Credits</div>
            <div class="summary-value">₦${summary?.total_credit?.toFixed(2) || "0.00"}</div>
        </div>
        <div class="summary-card blue">
            <div class="summary-label">Net Difference</div>
            <div class="summary-value">₦${summary?.difference?.toFixed(2) || "0.00"}</div>
        </div>
        <div class="summary-card orange">
            <div class="summary-label">Status</div>
            <div class="summary-value">${Math.abs(summary?.difference || 0) < 0.01 ? "Balanced ✓" : "Unbalanced ✗"}</div>
        </div>
    `;
}

async function loadSingleLedger(page = 1) {
  currentPage = page;
  const userId = document.getElementById("slUserFilter")?.value;
  const accountId = document.getElementById("slAccountFilter")?.value;
  const startDate = document.getElementById("slStartDate")?.value;
  const endDate = document.getElementById("slEndDate")?.value;

  try {
    let url = `${API_BASE_URL}/admin/ledger/single?page=${page}&limit=50`;
    if (userId) url += `&user_id=${userId}`;
    if (accountId) url += `&account_id=${accountId}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      renderSingleLedger(data);
      updatePagination("slPagination", data.pagination, loadSingleLedger);
    }
  } catch (error) {
    console.error("Error loading single ledger:", error);
    showNotification("Failed to load single ledger", "error");
  }
}

function renderSingleLedger(data) {
  const tbody = document.getElementById("singleLedgerBody");
  if (!tbody) return;

  if (!data.entries || data.entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9">No entries found</td></tr>';
    return;
  }

  tbody.innerHTML = data.entries
    .map(
      (entry) => `
        <tr>
            <td>${entry.ledger_id || "-"}</td>
            <td>${entry.created_at ? new Date(entry.created_at).toLocaleString() : "-"}</td>
            <td>${entry.account_number || "-"}</td>
            <td>${entry.transaction_type || "-"}</td>
            <td>${entry.description || "-"}</td>
            <td class="${entry.direction === "Debit" ? "debit" : "credit"}">₦${(entry.amount || 0).toFixed(2)}</td>
            <td>${entry.direction || "-"}</td>
            <td>₦${(entry.balance_before || 0).toFixed(2)}</td>
            <td>₦${(entry.balance_after || 0).toFixed(2)}</td>
        </tr>
    `,
    )
    .join("");
}

async function loadTrialBalance() {
  const asOfDate =
    document.getElementById("tbAsOfDate")?.value ||
    new Date().toISOString().split("T")[0];

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/ledger/trial-balance?as_of_date=${asOfDate}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok) {
      const data = await response.json();
      renderTrialBalance(data);
    } else {
      showNotification("Failed to load trial balance", "error");
    }
  } catch (error) {
    console.error("Error loading trial balance:", error);
    showNotification("Failed to load trial balance", "error");
  }
}

function renderTrialBalance(data) {
  const tbody = document.getElementById("trialBalanceBody");
  const tfoot = document.getElementById("trialBalanceFooter");

  if (!tbody) return;

  if (!data.trial_balance || data.trial_balance.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">No data found</td></tr>';
    return;
  }

  tbody.innerHTML = data.trial_balance
    .map(
      (account) => `
        <tr>
            <td>${account.account_code || "-"}</td>
            <td>${account.account_name || "-"}</td>
            <td>${account.account_type || "-"}</td>
            <td class="debit"₦$${(account.debit_total || 0).toFixed(2)}</td>
            <td class="credit">₦${(account.credit_total || 0).toFixed(2)}</td>
            <td>${account.normal_balance || "-"}</td>
            <td class="${account.balance_type === "Debit" ? "debit" : "credit"}">₦${(account.balance || 0).toFixed(2)} ${account.balance_type || ""}</td>
        </tr>
    `,
    )
    .join("");

  if (tfoot) {
    tfoot.innerHTML = `
            <tr class="total-row">
                <td colspan="3"><strong>Totals</strong></td>
                <td class="debit"><strong>₦${(data.summary?.total_debits || 0).toFixed(2)}</strong></td>
                <td class="credit"><strong>₦${(data.summary?.total_credits || 0).toFixed(2)}</strong></td>
                <td colspan="2"></td>
            </tr>
            <tr class="${data.summary?.is_balanced ? "balanced" : "unbalanced"}">
                <td colspan="7">
                    <strong>${data.summary?.is_balanced ? "✓ Trial Balance is Balanced" : "✗ Trial Balance is Unbalanced"}</strong>
                </td>
            </tr>
        `;
  }
}

async function loadBalanceSheet() {
  const asOfDate =
    document.getElementById("bsAsOfDate")?.value ||
    new Date().toISOString().split("T")[0];

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/ledger/balance-sheet?as_of_date=${asOfDate}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok) {
      const data = await response.json();
      renderBalanceSheet(data);
    } else {
      showNotification("Failed to load balance sheet", "error");
    }
  } catch (error) {
    console.error("Error loading balance sheet:", error);
    showNotification("Failed to load balance sheet", "error");
  }
}

function renderBalanceSheet(data) {
  const container = document.getElementById("balanceSheetContent");
  if (!container) return;

  if (!data) {
    container.innerHTML =
      '<div class="ledger-card"><p>No data available</p></div>';
    return;
  }

  container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="ledger-card">
                <h4>ASSETS</h4>
                <table class="ledger-table">
                    <thead>
                        <tr><th>Account</th><th class="debit">Amount</th></tr>
                    </thead>
                    <tbody>
                        ${(data.assets?.items || [])
                          .map(
                            (item) => `
                            <tr><td>${item.account_name || "-"}</td><td class="debit">₦${(item.balance || 0).toFixed(2)}</td></tr>
                        `,
                          )
                          .join("")}
                        <tr class="total-row"><td><strong>Total Assets</strong></td><td class="debit"><strong>₦${(data.assets?.total || 0).toFixed(2)}</strong></td></tr>
                    </tbody>
                </table>
            </div>
            <div>
                <div class="ledger-card">
                    <h4>LIABILITIES</h4>
                    <table class="ledger-table">
                        <thead><tr><th>Account</th><th class="credit">Amount</th></tr></thead>
                        <tbody>
                            ${(data.liabilities?.items || [])
                              .map(
                                (item) => `
                                <tr><td>${item.account_name || "-"}</td><td class="credit">₦${(item.balance || 0).toFixed(2)}</td></tr>
                            `,
                              )
                              .join("")}
                            <tr class="total-row"><td><strong>Total Liabilities</strong></td><td class="credit"><strong>₦${(data.liabilities?.total || 0).toFixed(2)}</strong></td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="ledger-card" style="margin-top: 20px;">
                    <h4>EQUITY</h4>
                    <table class="ledger-table">
                        <thead><tr><th>Account</th><th class="credit">Amount</th></tr></thead>
                        <tbody>
                            ${(data.equity?.items || [])
                              .map(
                                (item) => `
                                <tr><td>${item.account_name || "-"}</td><td class="credit">₦${(item.balance || 0).toFixed(2)}</td></tr>
                            `,
                              )
                              .join("")}
                            <tr class="total-row"><td><strong>Total Equity</strong></td><td class="credit"><strong>₦${(data.equity?.total || 0).toFixed(2)}</strong></td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="ledger-card" style="margin-top: 20px;">
                    <table>
                        <tr><td><strong>Total Liabilities & Equity:</strong></td><td class="credit"><strong>₦${(data.total_liabilities_equity || 0).toFixed(2)}</strong></td></tr>
                        <tr><td><strong>Difference:</strong></td><td class="${Math.abs(data.difference || 0) < 0.01 ? "credit" : "debit"}"><strong>₦${(data.difference || 0).toFixed(2)}</strong></td></tr>
                    </table>
                </div>
            </div>
        </div>
        <div class="ledger-card" style="margin-top: 20px;">
            <p class="${Math.abs(data.difference || 0) < 0.01 ? "balanced" : "unbalanced"}">
                <strong>${Math.abs(data.difference || 0) < 0.01 ? "✓ Balance Sheet is Balanced" : "✗ Balance Sheet is Unbalanced"}</strong>
            </p>
        </div>
    `;
}

async function loadProfitLoss() {
  const startDate = document.getElementById("plStartDate")?.value;
  const endDate = document.getElementById("plEndDate")?.value;

  if (!startDate || !endDate) {
    showNotification("Please select both start and end dates", "error");
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/ledger/income-statement?start_date=${startDate}&end_date=${endDate}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok) {
      const data = await response.json();
      renderProfitLoss(data);
    } else {
      showNotification("Failed to load P&L statement", "error");
    }
  } catch (error) {
    console.error("Error loading P&L:", error);
    showNotification("Failed to load P&L statement", "error");
  }
}

function renderProfitLoss(data) {
  const container = document.getElementById("plContent");
  if (!container) return;

  if (!data) {
    container.innerHTML =
      '<div class="ledger-card"><p>No data available</p></div>';
    return;
  }

  container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="ledger-card">
                <h4>REVENUE</h4>
                <table class="ledger-table">
                    <thead><tr><th>Account</th><th class="credit">Amount</th></tr></thead>
                    <tbody>
                        ${(data.revenues?.items || [])
                          .map(
                            (item) => `
                            <tr><td>${item.account_name || "-"}</td><td class="credit">₦${(item.amount || 0).toFixed(2)}</td></tr>
                        `,
                          )
                          .join("")}
                        <tr class="total-row"><td><strong>Total Revenue</strong></td><td class="credit"><strong>₦${(data.revenues?.total || 0).toFixed(2)}</strong></td></tr>
                    </tbody>
                </table>
            </div>
            <div class="ledger-card">
                <h4>EXPENSES</h4>
                <table class="ledger-table">
                    <thead><tr><th>Account</th><th class="debit">Amount</th></tr></thead>
                    <tbody>
                        ${(data.expenses?.items || [])
                          .map(
                            (item) => `
                            <tr><td>${item.account_name || "-"}</td><td class="debit">₦${(item.amount || 0).toFixed(2)}</td></tr>
                        `,
                          )
                          .join("")}
                        <tr class="total-row"><td><strong>Total Expenses</strong></td><td class="debit"><strong>₦${(data.expenses?.total || 0).toFixed(2)}</strong></td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="ledger-card" style="margin-top: 20px;">
            <h4>NET ${data.net_income_type || "Income"}</h4>
            <div class="${(data.net_income || 0) >= 0 ? "credit" : "debit"}" style="font-size: 24px; font-weight: 700;">
                ₦${Math.abs(data.net_income || 0).toFixed(2)}
            </div>
            <p>Period: ${data.period?.start_date || startDate} to ${data.period?.end_date || endDate}</p>
        </div>
    `;
}

async function loadDailyJournal() {
  const date =
    document.getElementById("djDate")?.value ||
    new Date().toISOString().split("T")[0];

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/ledger/daily-journal?date=${date}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok) {
      const data = await response.json();
      renderDailyJournal(data);
    } else {
      showNotification("Failed to load daily journal", "error");
    }
  } catch (error) {
    console.error("Error loading daily journal:", error);
    showNotification("Failed to load daily journal", "error");
  }
}

function renderDailyJournal(data) {
  const container = document.getElementById("dailyJournalContent");
  if (!container) return;

  if (!data) {
    container.innerHTML =
      '<div class="ledger-card"><p>No data available</p></div>';
    return;
  }

  container.innerHTML = `
        <div class="ledger-summary" style="margin-bottom: 20px;">
            <div class="summary-card">
                <div class="summary-label">Date</div>
                <div class="summary-value">${data.date || "-"}</div>
            </div>
            <div class="summary-card green">
                <div class="summary-label">Total Entries</div>
                <div class="summary-value">${data.summary?.total_entries || 0}</div>
            </div>
            <div class="summary-card blue">
                <div class="summary-label">Total Debits</div>
                <div class="summary-value">₦${(data.summary?.total_debit || 0).toFixed(2)}</div>
            </div>
            <div class="summary-card orange">
                <div class="summary-label">Total Credits</div>
                <div class="summary-value">₦${(data.summary?.total_credit || 0).toFixed(2)}</div>
            </div>
        </div>
        <div class="ledger-card">
            <h4>Journal Entries for ${data.date}</h4>
            <div class="ledger-table">
                <table>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Entry ID</th>
                            <th>Account</th>
                            <th>Description</th>
                            <th>Debit</th>
                            <th>Credit</th>
                            <th>User</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(data.entries || [])
                          .map(
                            (entry) => `
                            <tr>
                                <td>${entry.entry_date ? new Date(entry.entry_date).toLocaleTimeString() : "-"}</td>
                                <td>${entry.entry_id || "-"}</td>
                                <td>${entry.account_code || ""} - ${entry.account_name || ""}</td>
                                <td>${entry.description || "-"}</td>
                                <td class="debit">${entry.debit_amount > 0 ? `₦${entry.debit_amount.toFixed(2)}` : "-"}</td>
                                <td class="credit">${entry.credit_amount > 0 ? `₦${entry.credit_amount.toFixed(2)}` : "-"}</td>
                                <td>${entry.users?.first_name || ""} ${entry.users?.last_name || ""}</td>
                            </tr>
                        `,
                          )
                          .join("")}
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td colspan="4"><strong>Totals</strong></td>
                            <td class="debit"><strong>₦${(data.summary?.total_debit || 0).toFixed(2)}</strong></td>
                            <td class="credit"><strong>₦${(data.summary?.total_credit || 0).toFixed(2)}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    `;
}

async function loadUserSelects() {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/users?limit=500`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      const userSelect = document.getElementById("slUserFilter");
      if (userSelect) {
        userSelect.innerHTML = '<option value="">Select User</option>';
        if (data.users) {
          data.users.forEach((user) => {
            userSelect.innerHTML += `<option value="${user.id}">${user.first_name || ""} ${user.last_name || ""} (${user.email || ""})</option>`;
          });
        }
      }
    }
  } catch (error) {
    console.error("Error loading users:", error);
  }
}

async function reconcileEntry(entryId) {
  if (!confirm("Reconcile this ledger entry? This action cannot be undone."))
    return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/ledger/reconcile/${entryId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.ok) {
      showNotification("Entry reconciled successfully", "success");
      await loadGeneralLedger(currentPage);
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to reconcile", "error");
    }
  } catch (error) {
    console.error("Error reconciling entry:", error);
    showNotification("Failed to reconcile entry", "error");
  }
}

async function saveAccount() {
  const accountData = {
    account_code: document.getElementById("accountCode")?.value,
    account_name: document.getElementById("accountName")?.value,
    account_type: document.getElementById("accountType")?.value,
    normal_balance: document.getElementById("normalBalance")?.value,
    description: document.getElementById("accountDescription")?.value,
    is_active: true,
  };

  if (!accountData.account_code || !accountData.account_name) {
    showNotification("Account code and name are required", "error");
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/ledger/chart-of-accounts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(accountData),
      },
    );

    if (response.ok) {
      showNotification("Account added successfully", "success");
      closeModal("addAccountModal");
      await loadChartOfAccounts();
    } else {
      const data = await response.json();
      showNotification(data.error || "Failed to add account", "error");
    }
  } catch (error) {
    console.error("Error saving account:", error);
    showNotification("Failed to add account", "error");
  }
}

function initializeEventListeners() {
  // Refresh buttons
  const refreshGlBtn = document.getElementById("refreshGlBtn");
  if (refreshGlBtn)
    refreshGlBtn.addEventListener("click", () => loadGeneralLedger(1));

  const refreshSlBtn = document.getElementById("refreshSlBtn");
  if (refreshSlBtn)
    refreshSlBtn.addEventListener("click", () => loadSingleLedger(1));

  const refreshTbBtn = document.getElementById("refreshTbBtn");
  if (refreshTbBtn) refreshTbBtn.addEventListener("click", loadTrialBalance);

  const refreshBsBtn = document.getElementById("refreshBsBtn");
  if (refreshBsBtn) refreshBsBtn.addEventListener("click", loadBalanceSheet);

  const refreshPlBtn = document.getElementById("refreshPlBtn");
  if (refreshPlBtn) refreshPlBtn.addEventListener("click", loadProfitLoss);

  const refreshDjBtn = document.getElementById("refreshDjBtn");
  if (refreshDjBtn) refreshDjBtn.addEventListener("click", loadDailyJournal);

  const addAccountBtn = document.getElementById("addAccountBtn");
  if (addAccountBtn) {
    addAccountBtn.addEventListener("click", () => {
      const form = document.getElementById("addAccountForm");
      if (form) form.reset();
      const modal = document.getElementById("addAccountModal");
      if (modal) modal.classList.add("show");
    });
  }

  const saveAccountBtn = document.getElementById("saveAccountBtn");
  if (saveAccountBtn) saveAccountBtn.addEventListener("click", saveAccount);

  const exportGlBtn = document.getElementById("exportGlBtn");
  if (exportGlBtn) exportGlBtn.addEventListener("click", exportGeneralLedger);

  // Filter change listeners
  const glAccountFilter = document.getElementById("glAccountFilter");
  if (glAccountFilter)
    glAccountFilter.addEventListener("change", () => loadGeneralLedger(1));

  const glStartDate = document.getElementById("glStartDate");
  if (glStartDate)
    glStartDate.addEventListener("change", () => loadGeneralLedger(1));

  const glEndDate = document.getElementById("glEndDate");
  if (glEndDate)
    glEndDate.addEventListener("change", () => loadGeneralLedger(1));

  const slUserFilter = document.getElementById("slUserFilter");
  if (slUserFilter)
    slUserFilter.addEventListener("change", () => loadSingleLedger(1));

  const slAccountFilter = document.getElementById("slAccountFilter");
  if (slAccountFilter)
    slAccountFilter.addEventListener("change", () => loadSingleLedger(1));
}

function initializeTabs() {
  const tabs = document.querySelectorAll(".ledger-tab");
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab;
      if (!tabName) return;

      // Update active tab UI
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Hide all tab contents
      const tabContents = document.querySelectorAll(".ledger-tab-content");
      tabContents.forEach((content) => {
        if (content) content.style.display = "none";
      });

      // Show selected tab content
      const selectedContent = document.getElementById(`${tabName}LedgerTab`);
      if (selectedContent) selectedContent.style.display = "block";

      currentTab = tabName;

      // Load data for the selected tab
      switch (tabName) {
        case "general":
          loadGeneralLedger(1);
          break;
        case "single":
          loadSingleLedger(1);
          break;
        case "trial":
          loadTrialBalance();
          break;
        case "balancesheet":
          loadBalanceSheet();
          break;
        case "pl":
          loadProfitLoss();
          break;
        case "daily":
          loadDailyJournal();
          break;
        case "accounts":
          loadChartOfAccounts();
          break;
      }
    });
  });
}

async function exportGeneralLedger() {
  try {
    const startDate = document.getElementById("glStartDate")?.value;
    const endDate = document.getElementById("glEndDate")?.value;

    let url = `${API_BASE_URL}/admin/ledger/general/export`;
    const params = [];
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    if (params.length) url += `?${params.join("&")}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `general_ledger_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      showNotification("Export completed", "success");
    } else {
      showNotification("Export failed", "error");
    }
  } catch (error) {
    console.error("Export error:", error);
    showNotification("Export failed", "error");
  }
}

function updatePagination(elementId, pagination, callback) {
  const container = document.getElementById(elementId);
  if (!container) return;

  if (!pagination || pagination.pages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = `
        <button class="page-btn" ${pagination.page === 1 ? "disabled" : ""} 
            onclick="${pagination.page > 1 ? `${callback.name}(${pagination.page - 1})` : ""}">
            ← Prev
        </button>
    `;

  const startPage = Math.max(1, pagination.page - 2);
  const endPage = Math.min(pagination.pages, pagination.page + 2);

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === pagination.page ? "active" : ""}" 
                    onclick="${callback.name}(${i})">${i}</button>`;
  }

  html += `
        <button class="page-btn" ${pagination.page === pagination.pages ? "disabled" : ""}
            onclick="${pagination.page < pagination.pages ? `${callback.name}(${pagination.page + 1})` : ""}">
            Next →
        </button>
    `;

  container.innerHTML = html;
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("show");
}


// ==================== FIX LAYOUT ON RESIZE ====================

function fixAdminLayout() {
    const sidebar = document.getElementById('adminSidebar');
    const mainContent = document.getElementById('adminMain');
    
    if (!sidebar || !mainContent) return;
    
    const windowWidth = window.innerWidth;
    
    if (windowWidth >= 1024) {
        // Desktop - sidebar fixed, main content adjusts
        if (sidebar.classList.contains('show')) {
            sidebar.classList.remove('show');
        }
        mainContent.style.marginLeft = '';
        mainContent.style.width = '';
    } else {
        // Mobile/Tablet - sidebar hidden by default
        if (!sidebar.classList.contains('show')) {
            // Sidebar is hidden
            mainContent.style.marginLeft = '0';
            mainContent.style.width = '100%';
        } else {
            // Sidebar is showing
            mainContent.style.marginLeft = '0';
            mainContent.style.width = '100%';
        }
    }
    
    // Fix any overflowing elements
    const allContainers = document.querySelectorAll('.admin-page, .ledger-container, .table-responsive');
    allContainers.forEach(container => {
        if (container.scrollWidth > container.clientWidth) {
            container.style.overflowX = 'auto';
        } else {
            container.style.overflowX = 'visible';
        }
    });
}

// Call on resize
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(fixAdminLayout, 150);
});

// Call on load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(fixAdminLayout, 100);
});

// Call when sidebar toggles
document.addEventListener('click', (e) => {
    if (e.target.closest('#sidebarToggle') || e.target.closest('.mobile-menu-btn')) {
        setTimeout(fixAdminLayout, 50);
    }
});


function showNotification(message, type = "info") {
  // Remove existing notification
  const existing = document.querySelector(".notification");
  if (existing) existing.remove();

  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
        <i class="fas fa-${type === "success" ? "check-circle" : type === "error" ? "exclamation-circle" : "info-circle"}"></i>
        <span>${message}</span>
    `;
  notification.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: ${type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6"};
        color: white; padding: 12px 24px; border-radius: 8px;
        z-index: 9999; display: flex; align-items: center; gap: 10px;
        animation: slideIn 0.3s ease;
    `;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Edit account placeholder
window.editAccount = function (accountCode) {
  showNotification(`Edit account ${accountCode} - Feature coming soon`, "info");
};

// Logout
const adminLogout = document.getElementById("adminLogout");
if (adminLogout) {
  adminLogout.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "login.html";
  });
}

// Close modals on backdrop click
document.querySelectorAll(".modal").forEach((modal) => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("show");
  });
});

// Close modal on close button click
document.querySelectorAll(".close-modal").forEach((btn) => {
  btn.addEventListener("click", () => {
    const modal = btn.closest(".modal");
    if (modal) modal.classList.remove("show");
  });
});

