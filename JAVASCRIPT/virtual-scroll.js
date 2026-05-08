// virtual-scroll.js - Efficient rendering of large lists

class VirtualScroll {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 60;
    this.bufferSize = options.bufferSize || 5;
    this.items = [];
    this.renderCallback = options.renderCallback;
    this.onScrollEnd = options.onScrollEnd;

    this.scrollTop = 0;
    this.startIndex = 0;
    this.endIndex = 0;

    this.init();
  }

  init() {
    // Create inner container
    this.innerContainer = document.createElement("div");
    this.innerContainer.style.position = "relative";
    this.container.innerHTML = "";
    this.container.appendChild(this.innerContainer);

    // Add scroll listener with throttle
    let ticking = false;
    this.container.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  setItems(items) {
    this.items = items;
    this.updateTotalHeight();
    this.handleScroll();
  }

  updateTotalHeight() {
    const totalHeight = this.items.length * this.itemHeight;
    this.innerContainer.style.height = `${totalHeight}px`;
  }

  handleScroll() {
    this.scrollTop = this.container.scrollTop;

    const newStartIndex = Math.max(
      0,
      Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize,
    );
    const newEndIndex = Math.min(
      this.items.length,
      Math.ceil(
        (this.scrollTop + this.container.clientHeight) / this.itemHeight,
      ) + this.bufferSize,
    );

    if (newStartIndex !== this.startIndex || newEndIndex !== this.endIndex) {
      this.startIndex = newStartIndex;
      this.endIndex = newEndIndex;
      this.render();
    }

    // Check if near bottom for infinite scroll
    if (
      this.onScrollEnd &&
      this.scrollTop + this.container.clientHeight >=
        this.innerContainer.clientHeight - 200
    ) {
      this.onScrollEnd();
    }
  }

  render() {
    const visibleItems = this.items.slice(this.startIndex, this.endIndex);
    const offsetY = this.startIndex * this.itemHeight;

    const fragment = document.createDocumentFragment();
    const itemsContainer = document.createElement("div");
    itemsContainer.style.position = "absolute";
    itemsContainer.style.top = `${offsetY}px`;
    itemsContainer.style.left = "0";
    itemsContainer.style.right = "0";

    visibleItems.forEach((item, idx) => {
      const element = this.renderCallback(item, this.startIndex + idx);
      if (element) {
        itemsContainer.appendChild(element);
      }
    });

    this.innerContainer.innerHTML = "";
    this.innerContainer.appendChild(itemsContainer);
  }
}

// Usage example for transactions table
function initVirtualTransactionTable(container, fetchData) {
  let currentPage = 1;
  let isLoading = false;
  let allItems = [];

  const virtualScroll = new VirtualScroll(container, {
    itemHeight: 65,
    bufferSize: 10,
    renderCallback: (transaction, index) => {
      const div = document.createElement("div");
      div.className = "transaction-row";
      div.style.padding = "12px";
      div.style.borderBottom = "1px solid #e2e8f0";
      div.style.display = "flex";
      div.style.alignItems = "center";
      div.style.gap = "15px";
      div.style.cursor = "pointer";
      div.onclick = () => viewTransactionReceiptFromHistory(transaction.id);

      const isCredit = transaction.to_user_id === currentUser?.id;
      div.innerHTML = `
        <div class="transaction-icon">
          <i class="fas fa-${isCredit ? "arrow-down" : "arrow-up"}"></i>
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 500;">${escapeHtml(transaction.description || transaction.transaction_type)}</div>
          <div style="font-size: 11px; color: #64748b;">${new Date(transaction.created_at).toLocaleDateString()}</div>
        </div>
        <div style="font-weight: 600; color: ${isCredit ? "#10b981" : "#ef4444"}">
          ${isCredit ? "+" : "-"}${formatMoney(Math.abs(transaction.amount))}
        </div>
      `;

      return div;
    },
    onScrollEnd: async () => {
      if (!isLoading) {
        isLoading = true;
        currentPage++;
        const newItems = await fetchData(currentPage);
        if (newItems && newItems.length > 0) {
          allItems.push(...newItems);
          virtualScroll.setItems(allItems);
        }
        isLoading = false;
      }
    },
  });

  return virtualScroll;
}
