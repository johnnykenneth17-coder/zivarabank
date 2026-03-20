// Admin navigation with auto-close sidebar on mobile after selection
document.querySelectorAll(".admin-nav .nav-item").forEach((item) => {
    item.addEventListener("click", async (e) => {
        e.preventDefault();

        const page = item.getAttribute("data-page");
        if (!page) return;

        // ── 1. Update active states and show selected page ───────────────
        document.querySelectorAll(".admin-nav .nav-item")
            .forEach(nav => nav.classList.remove("active"));
        item.classList.add("active");

        document.querySelectorAll(".admin-page")
            .forEach(p => p.classList.remove("active"));

        const targetPage = document.getElementById(`page-${page}`);
        if (targetPage) {
            targetPage.classList.add("active");
        }

        document.getElementById("adminPageTitle").textContent =
            item.querySelector("span")?.textContent || "Dashboard";

        // ── 2. Auto-close admin sidebar on mobile / tablet ───────────────
        const sidebar = document.getElementById("adminSidebar");
        if (sidebar && window.innerWidth <= 1024) {
            sidebar.classList.remove("show");
        }

        // ── 3. Load / refresh content when tab becomes active ────────────
        try {
            switch (page) {
                case "dashboard":
                    await loadAdminStats();
                    break;
                case "users":
                    await loadUsers(1);
                    break;
                case "transactions":
                    // await loadTransactions(1);   // if you have this function
                    break;
                case "accounts":
                    // await loadAccounts(1);
                    break;
                case "otp":
                    // await loadOTPUsers();     // or whatever function fills OTP users
                    break;
                case "support":
                    await loadTickets();
                    break;
                case "settings":
                    // await loadSettings();
                    break;
                // add others as needed
                default:
                    console.log(`No loader for admin page: ${page}`);
            }
        } catch (err) {
            console.error(`Error loading admin page ${page}:`, err);
            showNotification(`Failed to load ${page} content`, "error");
        }
    });
});