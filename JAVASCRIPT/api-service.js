// api-service.js - Centralized API with caching and request deduplication

class APIService {
  constructor() {
    this.baseURL = API_BASE_URL;  // Use existing constant
    this.token = localStorage.getItem("token");
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.cacheTTL = 60000;
  }

  // Generate cache key
  getCacheKey(endpoint, params = {}) {
    return `${endpoint}|${JSON.stringify(params)}`;
  }

  // Debounced fetch with cache
  async fetch(endpoint, options = {}, cacheTime = this.cacheTTL) {
    const cacheKey = this.getCacheKey(endpoint, options.body);

    // Check cache
    if (this.cache.has(cacheKey)) {
      const { data, timestamp } = this.cache.get(cacheKey);
      if (Date.now() - timestamp < cacheTime) {
        return data;
      }
      this.cache.delete(cacheKey);
    }

    // Deduplicate pending requests
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    const promise = fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    }).then((res) => res.json());

    this.pendingRequests.set(cacheKey, promise);

    try {
      const data = await promise;
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  // Clear cache for specific endpoint
  invalidate(endpoint) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(endpoint)) {
        this.cache.delete(key);
      }
    }
  }

  // Clear all cache
  clearCache() {
    this.cache.clear();
  }
}

// Create singleton instance
const api = new APIService(API_BASE_URL, localStorage.getItem("token"));

// Debounce utility
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

// Throttle utility for rate limiting
function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
