/**
 * app.js — application bootstrap and screen orchestration
 *
 * Responsibilities:
 *  1. Boot: initialise Eitaa SDK, authenticate with server.
 *  2. Screen routing: loading → home / error.
 *  3. Home: display player stats, handle play/leaderboard/how-to.
 *  4. Level select: render locked/unlocked levels.
 *  5. Game: render board, handle taps, show win overlay, persist result.
 *  6. Leaderboard: fetch and render.
 *  7. All user-facing strings in Persian.
 */

import {
  initEitaa,
  getDisplayUser,
  showBackButton,
  hideBackButton,
  enableClosingConfirmation,
  disableClosingConfirmation,
  hapticImpact,
  hapticNotification,
  hapticSelection,
  showConfirm,
  showAlert,
} from './eitaa.js';

import { createSession, startGame, finishGame, fetchLeaderboard, ApiError } from './api.js';

import {
  LEVEL_DEFS,
  TOTAL_LEVELS,
  GameState,
  dirGlyph,
  dirDegrees,
  isCellSolved,
  countSolved,
  totalPuzzleCells,
} from './game.js';

// ── Persian number helpers ─────────────────────────────────────────────────────
const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
function toPersian(n) {
  return String(Math.abs(Math.round(n)))
    .split('')
    .map(d => FA_DIGITS[+d] ?? d)
    .join('');
}

// ── App state ─────────────────────────────────────────────────────────────────
const state = {
  player:      null,   // verified from server
  maxLevel:    1,      // 1-indexed, highest playable
  currentLevel:1,      // 1-indexed, which level is active
  gs:          null,   // GameState instance
  sessionId:   null,   // server session row id
  hintCooldown:false,
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const screens = {
  loading:     document.getElementById('screen-loading'),
  error:       document.getElementById('screen-error'),
  home:        document.getElementById('screen-home'),
  howto:       document.getElementById('screen-howto'),
  levels:      document.getElementById('screen-levels'),
  game:        document.getElementById('screen-game'),
  leaderboard: document.getElementById('screen-leaderboard'),
};

const els = {
  errorMessage:   document.getElementById('error-message'),
  btnRetry:       document.getElementById('btn-retry'),
  homeBestScore:  document.getElementById('home-best-score'),
  homeLevel:      document.getElementById('home-level'),
  homeUsername:   document.getElementById('home-username'),
  btnPlay:        document.getElementById('btn-play'),
  btnLeaderboard: document.getElementById('btn-leaderboard'),
  btnHowTo:       document.getElementById('btn-how-to-play'),
  btnHowtoBack:   document.getElementById('btn-howto-back'),
  levelsGrid:     document.getElementById('levels-grid'),
  hudLevel:       document.getElementById('hud-level'),
  hudMoves:       document.getElementById('hud-moves'),
  hudScore:       document.getElementById('hud-score'),
  gameBoard:      document.getElementById('game-board'),
  btnRestart:     document.getElementById('btn-restart'),
  btnHint:        document.getElementById('btn-hint'),
  gameProgress:   document.getElementById('game-progress'),
  overlayWin:     document.getElementById('overlay-win'),
  winLevel:       document.getElementById('win-level'),
  winMoves:       document.getElementById('win-moves'),
  winScore:       document.getElementById('win-score'),
  winBest:        document.getElementById('win-best'),
  btnNextLevel:   document.getElementById('btn-next-level'),
  btnWinMenu:     document.getElementById('btn-win-menu'),
  lbList:         document.getElementById('lb-list'),
  lbLoading:      document.getElementById('lb-loading'),
  lbEmpty:        document.getElementById('lb-empty'),
};

// ── Screen transitions ────────────────────────────────────────────────────────
let currentScreen = 'loading';

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    if (key === name) {
      el.classList.add('screen--active');
    } else {
      el.classList.remove('screen--active');
    }
  }
  currentScreen = name;
}

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  initEitaa();

  // Display user hint even before server auth (display only, not trusted)
  const displayUser = getDisplayUser();
  if (displayUser) {
    const name = [displayUser.firstName, displayUser.lastName].filter(Boolean).join(' ');
    els.homeUsername.textContent = name ? `سلام، ${name}` : '';
  }

  try {
    const data = await createSession();
    state.player   = data.player;
    state.maxLevel = data.maxLevel ?? 1;

    updateHomeStats();
    showScreen('home');
  } catch (err) {
    showError(err instanceof ApiError ? err.message : 'خطا در اتصال به سرور');
  }
}

function showError(msg, retryFn) {
  els.errorMessage.textContent = msg ?? 'خطای ناشناخته';
  showScreen('error');
  els.btnRetry.onclick = retryFn ?? (() => boot());
}

// ── Home ──────────────────────────────────────────────────────────────────────
function updateHomeStats() {
  if (!state.player) return;
  els.homeBestScore.textContent = toPersian(state.player.best_score ?? 0);
  els.homeLevel.textContent     = toPersian(state.maxLevel);
}

els.btnPlay.addEventListener('click', () => {
  hapticImpact('light');
  openLevelSelect();
});

els.btnLeaderboard.addEventListener('click', () => {
  hapticImpact('light');
  openLeaderboard();
});

els.btnHowTo.addEventListener('click', () => {
  hapticImpact('light');
  showScreen('howto');
  showBackButton(() => {
    hideBackButton();
    showScreen('home');
  });
});

els.btnHowtoBack.addEventListener('click', () => {
  hideBackButton();
  showScreen('home');
});

// ── Level select ──────────────────────────────────────────────────────────────
function openLevelSelect() {
  renderLevelGrid();
  showScreen('levels');
  showBackButton(() => {
    hideBackButton();
    showScreen('home');
  });
}

function renderLevelGrid() {
  const grid = els.levelsGrid;
  grid.innerHTML = '';

  for (let i = 0; i < TOTAL_LEVELS; i++) {
    const levelNum    = i + 1;
    const def         = LEVEL_DEFS[i];
    const isUnlocked  = levelNum <= state.maxLevel;
    const isCompleted = levelNum < state.maxLevel;
    const isCurrent   = levelNum === state.maxLevel;

    const btn = document.createElement('button');
    btn.className = [
      'level-btn',
      isUnlocked ? (isCompleted ? 'level-btn--completed' : 'level-btn--unlocked') : 'level-btn--locked',
      isCurrent ? 'level-btn--current' : '',
    ].filter(Boolean).join(' ');

    btn.setAttribute('role', 'listitem');
    btn.setAttribute('aria-label', isUnlocked
      ? `مرحله ${levelNum}${isCompleted ? '، تمام شده' : ''}`
      : `مرحله ${levelNum}، قفل شده`
    );
    btn.disabled = !isUnlocked;

    const numSpan = document.createElement('span');
    numSpan.className = 'level-num';
    numSpan.textContent = toPersian(levelNum);

    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'level-badge';
    if (isCompleted)    badgeSpan.textContent = '✓';
    else if (!isUnlocked) badgeSpan.textContent = '🔒';
    else                badgeSpan.textContent = `${def.size}×${def.size}`;

    btn.appendChild(numSpan);
    btn.appendChild(badgeSpan);

    if (isUnlocked) {
      btn.addEventListener('click', () => {
        hapticImpact('light');
        beginLevel(i);
      });
    }

    grid.appendChild(btn);
  }
}

// ── Game ──────────────────────────────────────────────────────────────────────
async function beginLevel(levelIndex) {
  const def = LEVEL_DEFS[levelIndex];
  state.currentLevel = levelIndex + 1;
  state.gs = new GameState(levelIndex);

  // Notify server of game start
  try {
    const res = await startGame(state.currentLevel, String(levelIndex * 31337 + 1));
    state.sessionId = res.sessionId;
  } catch {
    // Non-fatal: continue without a session id; finish will fail gracefully
    state.sessionId = null;
  }

  renderBoard();
  updateHud();
  closeWinOverlay();
  showScreen('game');

  enableClosingConfirmation();

  showBackButton(() => {
    showConfirm('از مرحله خارج شوی؟ پیشرفت ذخیره نمی‌شود.', (confirmed) => {
      if (confirmed) {
        disableClosingConfirmation();
        hideBackButton();
        openLevelSelect();
      }
    });
  });
}

// ── Board rendering ───────────────────────────────────────────────────────────
function renderBoard() {
  const gs      = state.gs;
  const def     = LEVEL_DEFS[gs.levelIndex];
  const board   = els.gameBoard;
  board.innerHTML = '';
  board.style.setProperty('--cols', def.size);

  for (let i = 0; i < gs.cells.length; i++) {
    const cell    = gs.cells[i];
    const div     = document.createElement('div');
    const glyph   = dirGlyph(cell.dirIndex);
    const degrees = dirDegrees(cell.dirIndex);

    div.className = 'cell' +
      (cell.isTarget        ? ' cell--target' : '') +
      (isCellSolved(cell)   ? ' cell--solved'  : '');
    div.setAttribute('role', 'gridcell');
    div.setAttribute('tabindex', cell.isTarget ? '-1' : '0');
    div.setAttribute('aria-label', cell.isTarget
      ? 'خانه هدف'
      : `فلش ${glyph}، ردیف ${toPersian(cell.row + 1)}، ستون ${toPersian(cell.col + 1)}`
    );

    const arrow = document.createElement('span');
    arrow.className = 'cell-arrow';
    arrow.style.setProperty('--deg', `${degrees}deg`);
    arrow.textContent = glyph;

    div.appendChild(arrow);

    if (!cell.isTarget) {
      div.addEventListener('click', () => onCellTap(i, div));
      div.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCellTap(i, div);
        }
      });
    }

    board.appendChild(div);
  }
}

function getCellEl(index) {
  return els.gameBoard.children[index];
}

function updateCellEl(index) {
  const cell  = state.gs.cells[index];
  const el    = getCellEl(index);
  if (!el) return;

  const arrow = el.querySelector('.cell-arrow');
  const deg   = dirDegrees(cell.dirIndex);
  arrow.style.setProperty('--deg', `${deg}deg`);
  arrow.textContent = dirGlyph(cell.dirIndex);

  el.classList.toggle('cell--solved', isCellSolved(cell));
  el.setAttribute('aria-label',
    `فلش ${dirGlyph(cell.dirIndex)}، ردیف ${toPersian(cell.row + 1)}، ستون ${toPersian(cell.col + 1)}`
  );
}

// ── Cell tap handler ──────────────────────────────────────────────────────────
function onCellTap(index, el) {
  const gs = state.gs;
  if (!gs || gs.solved) return;

  const { newDirIndex, wasSolved, puzzleDone } = gs.tap(index);

  // Tap animation
  el.classList.remove('tapped');
  void el.offsetWidth; // reflow to restart animation
  el.classList.add('tapped');
  setTimeout(() => el.classList.remove('tapped'), 200);

  hapticImpact('light');

  // Update this cell's visual
  updateCellEl(index);

  // Flash if newly solved
  if (wasSolved) {
    el.classList.add('cell--flash');
    setTimeout(() => el.classList.remove('cell--flash'), 400);
    hapticImpact('medium');
  }

  updateHud();
  updateProgress();

  if (puzzleDone) {
    onPuzzleSolved();
  }
}

// ── HUD updates ───────────────────────────────────────────────────────────────
function updateHud() {
  const gs = state.gs;
  els.hudLevel.textContent = toPersian(gs.levelIndex + 1);
  els.hudMoves.textContent = toPersian(gs.moves);

  const prevScore = els.hudScore.textContent;
  els.hudScore.textContent = toPersian(gs.score);
  if (gs.score > 0 && gs.score !== prevScore) {
    els.hudScore.classList.remove('score-pop');
    void els.hudScore.offsetWidth;
    els.hudScore.classList.add('score-pop');
  }
}

function updateProgress() {
  const pct = Math.round(state.gs.progress() * 100);
  els.gameProgress.style.width = `${pct}%`;
  els.gameProgress.setAttribute('aria-valuenow', pct);
  if (pct === 100) els.gameProgress.classList.add('game-progress-bar--done');
  else             els.gameProgress.classList.remove('game-progress-bar--done');
}

// ── Restart ───────────────────────────────────────────────────────────────────
els.btnRestart.addEventListener('click', () => {
  showConfirm('مرحله را از ابتدا شروع کنی؟', (ok) => {
    if (!ok) return;
    hapticImpact('medium');
    state.gs.reset();
    renderBoard();
    updateHud();
    updateProgress();
    closeWinOverlay();
  });
});

// ── Hint ──────────────────────────────────────────────────────────────────────
els.btnHint.addEventListener('click', () => {
  if (state.hintCooldown) return;
  const gs = state.gs;
  if (!gs || gs.solved) return;

  const idx = gs.applyHint();
  if (idx === -1) return;

  hapticImpact('soft');

  const el = getCellEl(idx);
  if (el) {
    updateCellEl(idx);
    el.classList.add('cell--hint');
    setTimeout(() => el.classList.remove('cell--hint'), 1600);
  }

  updateHud();
  updateProgress();

  if (state.gs.solved) onPuzzleSolved();

  // Cooldown to prevent spam
  state.hintCooldown = true;
  els.btnHint.disabled = true;
  setTimeout(() => {
    state.hintCooldown = false;
    els.btnHint.disabled = false;
  }, 2000);
});

// ── Puzzle solved ─────────────────────────────────────────────────────────────
async function onPuzzleSolved() {
  const gs = state.gs;
  hapticNotification('success');
  disableClosingConfirmation();

  // Compute score on server too; use server's authoritative value
  let finalScore     = gs.score;
  let newBestScore   = state.player?.best_score ?? 0;
  let newBest        = false;
  let newMaxLevel    = state.maxLevel;

  if (state.sessionId) {
    try {
      const res = await finishGame(
        state.sessionId,
        gs.levelIndex + 1,
        gs.moves,
        gs.score,
        gs.elapsedSeconds()
      );
      finalScore     = res.score       ?? finalScore;
      newBestScore   = res.bestScore   ?? newBestScore;
      newBest        = res.newBest     ?? false;
      newMaxLevel    = res.maxLevel    ?? newMaxLevel;
    } catch {
      // Non-fatal: keep local score
    }
  }

  // Update app state
  if (state.player) state.player.best_score = newBestScore;
  state.maxLevel = newMaxLevel;
  updateHomeStats();

  // Show win overlay
  els.winLevel.textContent = toPersian(gs.levelIndex + 1);
  els.winMoves.textContent = toPersian(gs.moves);
  els.winScore.textContent = toPersian(finalScore);
  els.winBest.textContent  = toPersian(newBestScore);

  // Disable next-level if at the last level
  const isLastLevel = gs.levelIndex + 1 >= TOTAL_LEVELS;
  els.btnNextLevel.disabled = isLastLevel;
  els.btnNextLevel.textContent = isLastLevel ? 'پایان بازی!' : 'مرحله بعد';

  openWinOverlay();
  hideBackButton();
}

function openWinOverlay() {
  els.overlayWin.classList.remove('overlay--hidden');
}

function closeWinOverlay() {
  els.overlayWin.classList.add('overlay--hidden');
}

els.btnNextLevel.addEventListener('click', () => {
  hapticImpact('medium');
  const nextIndex = state.gs.levelIndex + 1;
  if (nextIndex >= TOTAL_LEVELS) {
    showAlert('شما تمام مراحل را به پایان رساندید! تبریک!', () => {
      closeWinOverlay();
      hideBackButton();
      showScreen('home');
    });
    return;
  }
  closeWinOverlay();
  beginLevel(nextIndex);
});

els.btnWinMenu.addEventListener('click', () => {
  hapticImpact('light');
  closeWinOverlay();
  hideBackButton();
  showScreen('home');
});

// ── Leaderboard ───────────────────────────────────────────────────────────────
async function openLeaderboard() {
  showScreen('leaderboard');
  showBackButton(() => {
    hideBackButton();
    showScreen('home');
  });

  els.lbList.innerHTML   = '';
  els.lbLoading.classList.remove('hidden');
  els.lbEmpty.classList.add('hidden');

  try {
    const { entries, myEntry } = await fetchLeaderboard(30);
    els.lbLoading.classList.add('hidden');

    if (!entries || entries.length === 0) {
      els.lbEmpty.classList.remove('hidden');
      return;
    }

    const myId = state.player?.eitaa_user_id;

    entries.forEach((entry, i) => {
      const rank     = i + 1;
      const rankEl   = document.createElement('div');
      rankEl.className = 'lb-entry' + (entry.eitaa_user_id === myId ? ' lb-entry--me' : '');
      rankEl.setAttribute('role', 'listitem');

      const rankClass = rank === 1 ? 'lb-rank--gold' : rank === 2 ? 'lb-rank--silver' : rank === 3 ? 'lb-rank--bronze' : '';
      const rankGlyph = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : toPersian(rank);

      rankEl.innerHTML = `
        <span class="lb-rank ${rankClass}" aria-label="رتبه ${toPersian(rank)}">${rankGlyph}</span>
        <span class="lb-name">${escHtml(entry.display_name ?? 'بازیکن')}</span>
        <span class="lb-score" aria-label="امتیاز ${toPersian(entry.best_score)}">${toPersian(entry.best_score)}</span>
      `;
      els.lbList.appendChild(rankEl);
    });

    // If I'm not in the top list but have a score, append my row
    if (myEntry && !entries.find(e => e.eitaa_user_id === myId)) {
      const sep = document.createElement('div');
      sep.style.cssText = 'text-align:center;padding:var(--sp-2);color:var(--c-text-muted);font-size:var(--fs-xs)';
      sep.textContent = '⋮';
      els.lbList.appendChild(sep);

      const meEl = document.createElement('div');
      meEl.className = 'lb-entry lb-entry--me';
      meEl.setAttribute('role', 'listitem');
      meEl.innerHTML = `
        <span class="lb-rank" aria-label="رتبه من">#</span>
        <span class="lb-name">${escHtml(myEntry.display_name ?? 'شما')}</span>
        <span class="lb-score">${toPersian(myEntry.best_score)}</span>
      `;
      els.lbList.appendChild(meEl);
    }

  } catch (err) {
    els.lbLoading.classList.add('hidden');
    const errEl = document.createElement('p');
    errEl.className = 'lb-empty';
    errEl.textContent = 'خطا در بارگذاری جدول. دوباره تلاش کنید.';
    els.lbList.appendChild(errEl);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Entry point ───────────────────────────────────────────────────────────────
boot();
