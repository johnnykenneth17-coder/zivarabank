// Transfer form handler - COMPLETE VERSION WITH SELF-TRANSFER CHECK
const transferForm = document.getElementById("transferForm");
if (transferForm) {
  transferForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fromAccountId = document.getElementById("fromAccount").value;
    const toAccountNumberRaw = document.getElementById("toAccount").value;
    const amount = parseFloat(document.getElementById("amount").value);
    const description = document.getElementById("description").value;

    // Clean the account number (remove spaces)
    const toAccountNumber = toAccountNumberRaw.replace(/\s/g, "");

    // ========== FRONTEND SELF-TRANSFER PREVENTION ==========
    // Get the selected source account details
    const selectedSourceAccount = accounts.find(acc => acc.id === fromAccountId);
    
    // Check if trying to send to own account
    if (selectedSourceAccount && selectedSourceAccount.account_number === toAccountNumber) {
      showNotification("You cannot transfer money to your own account", "error");
      return;
    }
    
    // Also check using the stored primary account number
    const primaryAccountNumberEl = document.getElementById("primaryAccountNumber");
    if (primaryAccountNumberEl) {
      const primaryAccountNumber = primaryAccountNumberEl.textContent.match(/\d+/)?.[0];
      if (primaryAccountNumber === toAccountNumber) {
        showNotification("Cannot transfer money to yourself. Please enter a different account number.", "error");
        return;
      }
    }
    // ======================================================

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      showNotification("Please enter a valid amount", "error");
      return;
    }

    // Validate recipient was verified
    const recipientFeedback = document.getElementById("recipientFeedback");
    if (!recipientFeedback || recipientFeedback.classList.contains("error")) {
      showNotification("Please enter a valid recipient account number", "error");
      return;
    }

    const transferData = {
      from_account_id: fromAccountId,
      to_account_number: toAccountNumber,
      amount: amount,
      description: description,
    };

    const transferBtn = document.getElementById("transferBtn");
    transferBtn.disabled = true;
    transferBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

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
          // Clear recipient feedback
          if (recipientFeedback) {
            recipientFeedback.textContent = "";
            recipientFeedback.className = "input-feedback";
          }
          // Reset the toAccount input dataset
          const toAccountInput = document.getElementById("toAccount");
          if (toAccountInput) {
            delete toAccountInput.dataset.validRecipient;
            delete toAccountInput.dataset.recipientName;
            delete toAccountInput.dataset.accountId;
          }
          await loadAccounts();
          await loadTransactions();
          // Refresh the full transactions page if it's visible
          if (currentPage === "transactions") {
            await loadFullTransactions(1);
          }
        }
      } else {
        showNotification(data.error || "Transfer failed", "error");
      }
    } catch (error) {
      console.error("Transfer error:", error);
      showNotification("Transfer failed. Please try again.", "error");
    } finally {
      transferBtn.disabled = false;
      transferBtn.innerHTML = '<span>Continue Transfer</span><i class="fas fa-arrow-right"></i>';
    }
  });
}

// Add external transfers to navigation
// Add this to your sidebar-nav in dashboard.html:
// <a href="#" class="nav-item" data-page="external-transfers">
//     <i class="fas fa-globe"></i>
//     <span>External Transfers</span>
// </a>

// Add page switch case for external-transfers in initializeEventListeners
// In the switch statement, add:
// case "external-transfers":
//     loadExternalTransfers(1, "all");
//     break;













// Add external transfers to admin navigation
// Add this to your admin-nav in admin.html:
// <a href="#" class="nav-item" data-page="external-transfers">
//     <i class="fas fa-globe"></i>
//     <span>External Transfers</span>
//     <span class="badge pending-count" id="externalTransferBadge" style="display: none;">0</span>
// </a>

// Add page switch case for external-transfers in admin.js initializeEventListeners
// In the switch statement, add:
// case "external-transfers":
//     loadAdminExternalTransfers(1, "all", "all");
//     break;