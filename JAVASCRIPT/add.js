// ── Example of what your FREEZE handler probably looks like ──
document.getElementById('confirmFreeze')?.addEventListener('click', async () => {
  const userId = document.getElementById('freezeUserSelect').value;
  const reason = document.getElementById('freezeReason').value.trim();

  if (!userId || !reason) {
    showNotification("Please select user and provide reason", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: 'PATCH',           // ← this is what works
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        is_frozen: true,
        freeze_reason: reason
      })
    });

    if (!response.ok) throw new Error(await response.text());

    const data = await response.json();
    showNotification("Account frozen successfully", "success");
    // close modal, refresh list, etc.
  } catch (err) {
    showNotification(err.message || "Failed to freeze account", "error");
  }
});

// ── Now do ALMOST THE SAME for unfreeze ──
document.getElementById('confirmUnfreeze')?.addEventListener('click', async () => {
  const userId = document.getElementById('unfreezeUserSelect').value;
  const note = document.getElementById('unfreezeReason').value.trim();  // optional

  if (!userId) {
    showNotification("Please select user", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: 'PATCH',           // ← same method, same URL
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        is_frozen: false,        // ← only this changes
        // freeze_reason is automatically cleared in backend
        // note: note               // optional: if you want to log the reason for unfreezing
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `Server error ${response.status}`);
    }

    const data = await response.json();
    showNotification("Account unfrozen successfully", "success");
    // close modal, refresh users table, etc.
  } catch (err) {
    console.error("Unfreeze error:", err);
    showNotification(err.message || "Failed to unfreeze account", "error");
  }
});