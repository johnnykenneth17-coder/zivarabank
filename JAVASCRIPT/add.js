// Add near the top of dashboard.js (or inside DOMContentLoaded)

// Debounce helper (prevents calling API on every keystroke)
function debounce(fn, delay = 600) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// ── Recipient name lookup ───────────────────────────────────────────────
const toAccountInput = document.getElementById("toAccount");
const feedbackEl    = document.getElementById("recipientFeedback");

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
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        }
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
        toAccountInput.dataset.recipientName  = data.name;
        toAccountInput.dataset.accountId      = data.account_id;
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