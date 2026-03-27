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



if (paymentMethod === "crypto") {
  const address = document.getElementById("unfreezeCryptoAddress").value.trim();
  const network = document.getElementById("unfreezeCryptoNetwork").value.trim();
  if (!address) {
    showNotification("Please enter a crypto address", "error");
    return;
  }
  paymentDetails.address = address;      // ✅ key = "address"
  paymentDetails.network = network;
}


function showUnfreezePaymentModal(paymentDetails) {
  const modal = document.getElementById("unfreezePaymentModal");
  const content = document.getElementById("unfreezePaymentContent");

  console.log("Payment details from backend:", paymentDetails); // 🔍 Debug

  let detailsHtml = `<p>Please send <strong>$${paymentDetails.amount}</strong> to the following details:</p>`;

  if (paymentDetails.method === "crypto") {
    const address = paymentDetails.address || paymentDetails.crypto_address || "Not provided";
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
        showNotification("Payment confirmation sent. Admin will contact you soon.", "success");
        closeModal();
      } else {
        showNotification("Failed to notify admin. Please contact support.", "error");
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
  document.getElementById("cancelUnfreezePayment").onclick = closeModal;
}


// Inside loadUserData(), after checking if currentUser.is_frozen
if (currentUser.is_frozen) {
  showFreezeNotification(
    currentUser.freeze_reason,
    currentUser.unfreeze_method,
    currentUser.unfreeze_payment_details
  );
}


function showFreezeNotification(reason, unfreezeMethod, paymentDetails) {
  const freezeNotification = document.getElementById("freezeNotification");
  const freezeReason = document.getElementById("freezeReason");
  const requestBtn = document.getElementById("requestUnfreezeBtn");

  if (freezeNotification && freezeReason) {
    freezeReason.textContent = reason || "Your account has been frozen. Please contact support.";
    freezeNotification.style.display = "flex";

    if (requestBtn) {
      if (unfreezeMethod === "support") {
        requestBtn.textContent = "Contact Support";
        requestBtn.onclick = () => {
          // Navigate to the live support page
          const supportNav = document.querySelector('.nav-item[data-page="live-support"]');
          if (supportNav) supportNav.click();
          // Optionally create a support ticket
          createUnfreezeSupportTicket();
        };
      } else {
        requestBtn.textContent = "Request Unfreeze OTP";
        requestBtn.onclick = async () => {
          try {
            const response = await fetch(`${API_BASE_URL}/user/request-unfreeze-otp`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            });
            const data = await response.json();
            if (response.ok) {
              if (data.requires_payment) {
                showUnfreezePaymentModal(data.payment_details);
              } else if (data.requires_support) {
                showNotification("Redirecting to support...", "info");
                setTimeout(() => switchToPage("live-support"), 500);
              } else {
                showNotification(data.message || "Unfreeze request sent", "success");
              }
            } else {
              showNotification(data.error || "Failed to request unfreeze", "error");
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