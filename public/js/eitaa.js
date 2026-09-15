/**
 * eitaa.js — Eitaa WebApp SDK wrapper
 *
 * Centralises all SDK access. Safe fallbacks for plain-browser development.
 * Never trusts client-side identity for authorization.
 */

/** @returns {typeof window.Eitaa.WebApp | null} */
function sdk() {
  return window.Eitaa?.WebApp ?? null;
}

// ── Detection ─────────────────────────────────────────────────────────────────
export const isInsideEitaa = () => !!sdk();

// ── Initialise ────────────────────────────────────────────────────────────────
/**
 * Call once the essential UI is ready.
 * Expands the miniapp to full height and applies the current theme.
 */
export function initEitaa() {
  const w = sdk();
  if (!w) {
    applyTheme('light');
    return;
  }

  w.ready();
  w.expand();

  applyTheme(w.colorScheme);
  applyThemeParams(w.themeParams);
  applySafeArea(w.safeAreaInset, w.contentSafeAreaInset);

  // Listen for dynamic changes
  w.onEvent('themeChanged',            () => {
    applyTheme(w.colorScheme);
    applyThemeParams(w.themeParams);
  });
  w.onEvent('viewportChanged',         () => applyViewportHeight(w.viewportStableHeight));
  w.onEvent('safeAreaChanged',         () => applySafeArea(w.safeAreaInset, w.contentSafeAreaInset));
  w.onEvent('contentSafeAreaChanged',  () => applySafeArea(w.safeAreaInset, w.contentSafeAreaInset));
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme(colorScheme) {
  const body = document.body;
  body.classList.remove('theme-dark', 'theme-light');
  body.classList.add(colorScheme === 'dark' ? 'theme-dark' : 'theme-light');
}

function applyThemeParams(params) {
  if (!params) return;
  const root = document.documentElement.style;
  const map = {
    bg_color:          '--tg-theme-bg-color',
    text_color:        '--tg-theme-text-color',
    button_color:      '--tg-theme-button-color',
    button_text_color: '--tg-theme-button-text-color',
    hint_color:        '--tg-theme-hint-color',
    link_color:        '--tg-theme-link-color',
    secondary_bg_color:'--tg-theme-secondary-bg-color',
    header_bg_color:   '--tg-theme-header-bg-color',
    accent_text_color: '--tg-theme-accent-text-color',
  };
  for (const [key, cssVar] of Object.entries(map)) {
    if (params[key]) root.setProperty(cssVar, params[key]);
  }
}

function applySafeArea(safeArea, contentSafeArea) {
  const r = document.documentElement.style;
  if (safeArea) {
    r.setProperty('--tg-safe-area-inset-top',    `${safeArea.top    ?? 0}px`);
    r.setProperty('--tg-safe-area-inset-bottom', `${safeArea.bottom ?? 0}px`);
    r.setProperty('--tg-safe-area-inset-left',   `${safeArea.left   ?? 0}px`);
    r.setProperty('--tg-safe-area-inset-right',  `${safeArea.right  ?? 0}px`);
  }
  if (contentSafeArea) {
    r.setProperty('--tg-content-safe-area-inset-top',    `${contentSafeArea.top    ?? 0}px`);
    r.setProperty('--tg-content-safe-area-inset-bottom', `${contentSafeArea.bottom ?? 0}px`);
    r.setProperty('--tg-content-safe-area-inset-left',   `${contentSafeArea.left   ?? 0}px`);
    r.setProperty('--tg-content-safe-area-inset-right',  `${contentSafeArea.right  ?? 0}px`);
  }
}

function applyViewportHeight(stableHeight) {
  if (stableHeight && stableHeight > 0) {
    document.documentElement.style.setProperty(
      '--tg-viewport-stable-height', `${stableHeight}px`
    );
  }
}

// ── Raw initData for server verification ──────────────────────────────────────
/**
 * Returns the raw initData string. Used ONLY for sending to the server.
 * Do NOT use for any client-side identity decisions.
 */
export function getInitData() {
  return sdk()?.initData ?? '';
}

/**
 * Unsafe parsed user — used only for display (name, etc.).
 * NEVER used for authorization.
 */
export function getDisplayUser() {
  const u = sdk()?.initDataUnsafe?.user;
  if (!u) return null;
  return {
    firstName: u.first_name ?? '',
    lastName:  u.last_name  ?? '',
    username:  u.username   ?? '',
  };
}

/** Returns start_param for deep-linking. Untrusted — validate on server. */
export function getStartParam() {
  return sdk()?.initDataUnsafe?.start_param ?? null;
}

// ── Navigation ────────────────────────────────────────────────────────────────
export function enableClosingConfirmation() { sdk()?.enableClosingConfirmation?.(); }
export function disableClosingConfirmation() { sdk()?.disableClosingConfirmation?.(); }

// ── MainButton ────────────────────────────────────────────────────────────────
let _mainButtonHandler = null;

export function showMainButton({ text, color } = {}) {
  const btn = sdk()?.MainButton;
  if (!btn) return;
  if (text)  btn.setText(text);
  if (color) btn.setParams({ color });
  btn.show();
  btn.enable();
}

export function hideMainButton() {
  sdk()?.MainButton?.hide();
}

export function setMainButtonHandler(fn) {
  const btn = sdk()?.MainButton;
  if (!btn) return;
  if (_mainButtonHandler) btn.offClick(_mainButtonHandler);
  _mainButtonHandler = fn;
  btn.onClick(fn);
}

export function mainButtonLoading(on) {
  const btn = sdk()?.MainButton;
  if (!btn) return;
  if (on) btn.showProgress(false);
  else    btn.hideProgress();
}

// ── BackButton ────────────────────────────────────────────────────────────────
let _backHandler = null;

export function showBackButton(fn) {
  const btn = sdk()?.BackButton;
  if (!btn) return;
  if (_backHandler) btn.offClick(_backHandler);
  _backHandler = fn;
  btn.onClick(fn);
  btn.show();
}

export function hideBackButton() {
  const btn = sdk()?.BackButton;
  if (!btn) return;
  if (_backHandler) btn.offClick(_backHandler);
  _backHandler = null;
  btn.hide();
}

// ── Haptics ───────────────────────────────────────────────────────────────────
export function hapticImpact(style = 'light') {
  sdk()?.HapticFeedback?.impactOccurred(style);
}

export function hapticNotification(type = 'success') {
  sdk()?.HapticFeedback?.notificationOccurred(type);
}

export function hapticSelection() {
  sdk()?.HapticFeedback?.selectionChanged();
}

// ── Native dialogs ────────────────────────────────────────────────────────────
/**
 * Show a native Eitaa confirm or fall back to window.confirm.
 * @param {string} message
 * @param {function(boolean):void} cb
 */
export function showConfirm(message, cb) {
  const w = sdk();
  if (w?.showConfirm) {
    w.showConfirm(message, cb);
  } else {
    cb(window.confirm(message));
  }
}

/**
 * Show native alert or fall back to window.alert.
 */
export function showAlert(message, cb) {
  const w = sdk();
  if (w?.showAlert) {
    w.showAlert(message, cb ?? (() => {}));
  } else {
    window.alert(message);
    cb?.();
  }
}
