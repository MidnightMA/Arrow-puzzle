/**
 * Main Application Orchestrator
 * RTL, Persian UI, Eitaa Mini App Integration
 */

import { Eitaa } from "./eitaa.js";
import { State } from "./state.js";
import { sound } from "./audio.js";
import { Api } from "./api.js";
import { ArrowGame } from "./game.js";

// Helper to convert numbers to Persian digits
export function toPersianDigits(num) {
  if (num == null) return "";
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(num).replace(/[0-9]/g, (w) => persianDigits[+w]);
}

// Format seconds into MM:SS in Persian digits
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const strM = String(m).padStart(2, "0");
  const strS = String(s).padStart(2, "0");
  return `${toPersianDigits(strM)}:${toPersianDigits(strS)}`;
}

document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Eitaa SDK
  Eitaa.init();

  // 2. Initialize Game State
  State.init();

  // 3. UI Element references
  const boardEl = document.getElementById("game-board");
  const levelDisplay = document.getElementById("stat-level");
  const movesDisplay = document.getElementById("stat-moves");
  const timerDisplay = document.getElementById("stat-timer");
  const totalScoreDisplay = document.getElementById("stat-score");

  const btnSound = document.getElementById("btn-sound");
  const btnHint = document.getElementById("btn-hint");
  const btnUndo = document.getElementById("btn-undo");
  const btnRestart = document.getElementById("btn-restart");
  const btnLeaderboard = document.getElementById("btn-leaderboard");
  const btnHelp = document.getElementById("btn-help");

  // Modals
  const winModal = document.getElementById("modal-win");
  const btnNextLevel = document.getElementById("btn-next-level");
  const btnReplayLevel = document.getElementById("btn-replay-level");
  const winStarsEl = document.getElementById("win-stars");
  const winScoreEl = document.getElementById("win-score");
  const winMovesEl = document.getElementById("win-moves");
  const winTimeEl = document.getElementById("win-time");

  const leaderboardModal = document.getElementById("modal-leaderboard");
  const leaderboardList = document.getElementById("leaderboard-list");
  const btnCloseLeaderboard = document.getElementById("btn-close-leaderboard");

  const helpModal = document.getElementById("modal-help");
  const btnCloseHelp = document.getElementById("btn-close-help");

  // 4. Instantiate game engine
  const game = new ArrowGame(boardEl);

  // Update UI stats
  function updateHeaderStats() {
    levelDisplay.textContent = toPersianDigits(State.currentLevel);
    movesDisplay.textContent = toPersianDigits(State.moves);
    totalScoreDisplay.textContent = toPersianDigits(State.totalScore);
    btnUndo.disabled = !State.canUndo();
  }

  // Timer tick callback
  State.onTimerTick = (seconds) => {
    timerDisplay.textContent = formatTime(seconds);
  };

  // Move callback
  game.callbacks.onMove = () => {
    updateHeaderStats();
  };

  game.callbacks.onStateChange = () => {
    updateHeaderStats();
  };

  // Level Win Callback
  game.callbacks.onWin = async (result) => {
    updateHeaderStats();

    // Fill win modal
    winScoreEl.textContent = toPersianDigits(result.score);
    winMovesEl.textContent = toPersianDigits(result.moves);
    winTimeEl.textContent = formatTime(result.time);

    // Render stars
    winStarsEl.innerHTML = "";
    for (let i = 1; i <= 3; i++) {
      const star = document.createElement("span");
      star.className = `star-icon ${i <= result.stars ? "earned" : "empty"}`;
      star.textContent = "★";
      winStarsEl.appendChild(star);
    }

    winModal.classList.add("active");

    // Submit score to Supabase Edge Function in background
    try {
      await Api.submitScore({
        level: result.level,
        score: result.score,
        moves: result.moves,
        timeSeconds: result.time,
        stars: result.stars,
      });
    } catch (err) {
      console.warn("Could not submit score to server:", err);
    }
  };

  // Start new level
  function startLevel(lvl) {
    winModal.classList.remove("active");
    State.startLevel(lvl);
    game.loadLevel(lvl);
    timerDisplay.textContent = formatTime(0);
    updateHeaderStats();
  }

  // Next level handler
  btnNextLevel.addEventListener("click", () => {
    sound.playClick();
    startLevel(State.currentLevel + 1);
  });

  // Replay level handler
  btnReplayLevel.addEventListener("click", () => {
    sound.playClick();
    startLevel(State.currentLevel);
  });

  // Hint button
  btnHint.addEventListener("click", () => {
    game.showHint();
  });

  // Undo button
  btnUndo.addEventListener("click", () => {
    game.undo();
    updateHeaderStats();
  });

  // Restart button
  btnRestart.addEventListener("click", () => {
    if (confirm("آیا می‌خواهید این مرحله را دوباره از اول شروع کنید؟")) {
      startLevel(State.currentLevel);
    }
  });

  // Sound toggle button
  function updateSoundIcon() {
    const isMuted = sound.isMuted();
    btnSound.innerHTML = isMuted
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
    btnSound.setAttribute("aria-label", isMuted ? "فعال‌سازی صدا" : "قطع صدا");
  }

  btnSound.addEventListener("click", () => {
    sound.toggleMute();
    sound.playClick();
    updateSoundIcon();
  });
  updateSoundIcon();

  // Leaderboard Modal
  async function openLeaderboard() {
    sound.playClick();
    leaderboardModal.classList.add("active");
    leaderboardList.innerHTML = `<div class="loading-spinner">در حال دریافت رتبه‌بندی...</div>`;

    try {
      const data = await Api.getLeaderboard(20);
      const list = data?.leaderboard || [];

      if (list.length === 0) {
        leaderboardList.innerHTML = `<div class="empty-state">هنوز رتبه‌ای ثبت نشده است. اولین نفر باشید!</div>`;
        return;
      }

      leaderboardList.innerHTML = list
        .map(
          (item) => `
          <div class="leaderboard-item ${item.rank <= 3 ? `top-${item.rank}` : ""}">
            <div class="lb-rank">${toPersianDigits(item.rank)}</div>
            <div class="lb-info">
              <div class="lb-name">${item.name}</div>
              <div class="lb-level">مرحله ${toPersianDigits(item.level)}</div>
            </div>
            <div class="lb-score">${toPersianDigits(item.score.toLocaleString())} امتیاز</div>
          </div>
        `
        )
        .join("");
    } catch (_) {
      leaderboardList.innerHTML = `<div class="error-state">خطا در دریافت اطلاعات جدول برترین‌ها</div>`;
    }
  }

  btnLeaderboard.addEventListener("click", openLeaderboard);
  btnCloseLeaderboard.addEventListener("click", () => {
    sound.playClick();
    leaderboardModal.classList.remove("active");
  });

  // Help Modal
  btnHelp.addEventListener("click", () => {
    sound.playClick();
    helpModal.classList.add("active");
  });
  btnCloseHelp.addEventListener("click", () => {
    sound.playClick();
    helpModal.classList.remove("active");
  });

  // Close modals on overlay click
  [winModal, leaderboardModal, helpModal].forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal && modal !== winModal) {
        modal.classList.remove("active");
      }
    });
  });

  // Eitaa BackButton integration
  Eitaa.setupBackButton(() => {
    if (leaderboardModal.classList.contains("active")) {
      leaderboardModal.classList.remove("active");
    } else if (helpModal.classList.contains("active")) {
      helpModal.classList.remove("active");
    }
  });

  // Server Authentication sync (non-blocking)
  Api.authenticate()
    .then((res) => {
      if (res?.player) {
        State.highestLevel = Math.max(State.highestLevel, res.player.highestLevel || 1);
        State.totalScore = Math.max(State.totalScore, res.player.totalScore || 0);
        updateHeaderStats();
      }
    })
    .catch((err) => console.log("Guest mode active:", err));

  // 5. Start initial level
  startLevel(State.currentLevel);
});
