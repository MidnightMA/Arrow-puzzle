/**
 * Eitaa WebApp SDK Wrapper
 * Official SDK: https://developer.eitaa.com/eitaa-web-app.js
 */

export const Eitaa = {
  isAvailable: false,
  webApp: null,

  init() {
    this.webApp = window.Eitaa?.WebApp || null;
    this.isAvailable = Boolean(this.webApp && typeof this.webApp.ready === "function");

    if (this.isAvailable) {
      try {
        this.webApp.ready();
        if (typeof this.webApp.expand === "function") {
          this.webApp.expand();
        }

        // Apply theme colors from Eitaa if available
        this.applyTheme();
        this.webApp.onEvent?.("themeChanged", () => this.applyTheme());

        // Handle safe areas
        this.applySafeAreas();
        this.webApp.onEvent?.("safeAreaChanged", () => this.applySafeAreas());
        this.webApp.onEvent?.("contentSafeAreaChanged", () => this.applySafeAreas());
      } catch (err) {
        console.warn("Eitaa SDK init warning:", err);
      }
    } else {
      console.log("Running in standard browser mode (Eitaa SDK fallback active)");
    }
  },

  getRawInitData() {
    if (this.isAvailable && this.webApp?.initData) {
      return this.webApp.initData;
    }
    // Development fallback for browser testing
    const savedDevId = localStorage.getItem("arrow_puzzle_dev_user") || `dev_${Math.floor(Math.random() * 10000)}`;
    localStorage.setItem("arrow_puzzle_dev_user", savedDevId);
    return `dev_user_${savedDevId}`;
  },

  getUser() {
    if (this.isAvailable && this.webApp?.initDataUnsafe?.user) {
      return this.webApp.initDataUnsafe.user;
    }
    return {
      id: localStorage.getItem("arrow_puzzle_dev_user") || "guest",
      first_name: "بازیکن مهمان",
      username: "guest_player",
    };
  },

  // Haptic feedback
  haptic: {
    impact(style = "light") {
      try {
        if (window.Eitaa?.WebApp?.HapticFeedback?.impactOccurred) {
          window.Eitaa.WebApp.HapticFeedback.impactOccurred(style);
        } else if (navigator.vibrate) {
          navigator.vibrate(style === "heavy" ? 40 : 20);
        }
      } catch (_) {}
    },

    error() {
      try {
        if (window.Eitaa?.WebApp?.HapticFeedback?.notificationOccurred) {
          window.Eitaa.WebApp.HapticFeedback.notificationOccurred("error");
        } else if (navigator.vibrate) {
          navigator.vibrate([30, 40, 30]);
        }
      } catch (_) {}
    },

    success() {
      try {
        if (window.Eitaa?.WebApp?.HapticFeedback?.notificationOccurred) {
          window.Eitaa.WebApp.HapticFeedback.notificationOccurred("success");
        } else if (navigator.vibrate) {
          navigator.vibrate([40, 60, 80]);
        }
      } catch (_) {}
    },
  },

  // Back Button integration
  setupBackButton(onBack) {
    if (!this.isAvailable || !this.webApp?.BackButton) return;
    try {
      this.webApp.BackButton.show();
      this.webApp.BackButton.onClick(onBack);
    } catch (_) {}
  },

  hideBackButton() {
    if (!this.isAvailable || !this.webApp?.BackButton) return;
    try {
      this.webApp.BackButton.hide();
    } catch (_) {}
  },

  // Theme synchronization
  applyTheme() {
    if (!this.webApp?.themeParams) return;
    const params = this.webApp.themeParams;
    const root = document.documentElement;

    if (params.bg_color) root.style.setProperty("--eitaa-bg-color", params.bg_color);
    if (params.text_color) root.style.setProperty("--eitaa-text-color", params.text_color);
    if (params.button_color) root.style.setProperty("--eitaa-button-color", params.button_color);
    if (params.button_text_color) root.style.setProperty("--eitaa-button-text-color", params.button_text_color);
  },

  // Safe area handling
  applySafeAreas() {
    const root = document.documentElement;
    const safeInset = this.webApp?.safeAreaInset || this.webApp?.contentSafeAreaInset;
    if (safeInset) {
      if (safeInset.top != null) root.style.setProperty("--safe-area-top", `${safeInset.top}px`);
      if (safeInset.bottom != null) root.style.setProperty("--safe-area-bottom", `${safeInset.bottom}px`);
      if (safeInset.left != null) root.style.setProperty("--safe-area-left", `${safeInset.left}px`);
      if (safeInset.right != null) root.style.setProperty("--safe-area-right", `${safeInset.right}px`);
    }
  },
};
