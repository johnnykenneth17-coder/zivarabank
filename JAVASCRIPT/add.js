// Update transactions display for recent transactions (overview page) - OPTIMIZED FOR MOBILE
function updateTransactionsDisplay() {
  const recentTransactions = document.getElementById("recentTransactions");
  if (!recentTransactions) return;

  if (!transactions || transactions.length === 0) {
    recentTransactions.innerHTML = '<div class="empty-state" style="text-align: center; padding: 40px;">No recent transactions</div>';
    return;
  }

  recentTransactions.innerHTML = transactions
    .slice(0, 5)
    .map((t) => {
      const isCredit = t.to_user_id === currentUser?.id;
      const isTransfer = t.transaction_type === "transfer";
      const transactionId = t.id || t.transaction_id;

      // Determine icon and simplified display text
      let icon = "exchange-alt";
      let displayName = "";
      let amountClass = isCredit ? "positive" : "negative";
      let sign = isCredit ? "+" : "-";

      if (isTransfer) {
        if (isCredit) {
          // Received money - show "From: Name"
          const senderName = t.from_user?.first_name
            ? `${t.from_user.first_name} ${(t.from_user.last_name || "").charAt(0)}.`
            : "Transfer";
          icon = "arrow-down";
          displayName = `From ${senderName}`;
        } else {
          // Sent money - show "To: Name"
          const receiverName = t.to_user?.first_name
            ? `${t.to_user.first_name} ${(t.to_user.last_name || "").charAt(0)}.`
            : "Transfer";
          icon = "arrow-up";
          displayName = `To ${receiverName}`;
        }
      } else if (t.transaction_type === "bill_payment") {
        icon = "file-invoice";
        // Shorten bill description
        let shortDesc = t.description || "Bill Payment";
        if (shortDesc.length > 20) shortDesc = shortDesc.substring(0, 18) + "...";
        displayName = shortDesc;
      } else if (t.transaction_type === "savings") {
        icon = "piggy-bank";
        displayName = "Savings";
      } else if (t.transaction_type === "savings_withdrawal") {
        icon = "money-bill-wave";
        displayName = "Withdrawal";
      } else if (t.transaction_type === "deposit") {
        icon = "plus-circle";
        displayName = "Deposit";
      } else {
        icon = "exchange-alt";
        let shortDesc = t.description || t.transaction_type || "Transaction";
        if (shortDesc.length > 20) shortDesc = shortDesc.substring(0, 18) + "...";
        displayName = shortDesc;
      }

      return `
        <div class="transaction-item" data-transaction-id="${transactionId}" onclick="viewTransactionReceiptFromHistory('${transactionId}')" style="cursor: pointer;">
          <div class="transaction-icon">
            <i class="fas fa-${icon}"></i>
          </div>
          <div class="transaction-details">
            <div class="transaction-name">${escapeHtml(displayName)}</div>
            <div class="transaction-date">${new Date(t.created_at).toLocaleDateString()}</div>
          </div>
          <div class="transaction-amount ${amountClass}">
            ${sign}${formatMoney(Math.abs(t.amount))}
          </div>
        </div>
      `;
    })
    .join("");
}