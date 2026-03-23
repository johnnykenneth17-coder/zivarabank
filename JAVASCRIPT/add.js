// Reset to list view when entering Live Chat section
function resetToUserListView() {
  const listPanel = document.getElementById('chatListPanel');
  const chatPanel = document.getElementById('chatViewPanel');

  if (!listPanel || !chatPanel) return;

  // Always start with list visible
  listPanel.style.display = 'block';

  // Hide chat panel
  chatPanel.style.display = 'none';
  chatPanel.classList.remove('open');

  // Optional: clear chat content & selected user
  document.getElementById('adminChatMessages').innerHTML = '';
  document.getElementById('currentChatUserName').textContent = 'Select a conversation';
  document.getElementById('currentChatUserId').textContent = '';

  // Reload user list (if needed)
  loadLiveChatUsers();   // your function that populates #liveChatUserList
}

// Call this when Live Chat tab is opened
// Example 1: if you have tab click handler
document.querySelector('[data-page="live-chat"]')?.addEventListener('click', () => {
  resetToUserListView();
});

// Example 2: or call it directly on page load if live-chat is default
document.addEventListener('DOMContentLoaded', () => {
  // If live chat is the initial view or you detect it
  if (document.getElementById('page-live-chat')?.classList.contains('active')) {
    resetToUserListView();
  }
});