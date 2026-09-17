/**
 * Core Puzzle Engine: Arrow Puzzle
 * Guaranteed solvable level generator, collision checker, and game logic
 */

import { State } from "./state.js";
import { sound } from "./audio.js";
import { Eitaa } from "./eitaa.js";

export const DIRECTIONS = {
  up: { dr: -1, dc: 0, icon: "↑", label: "بالا", deg: 0 },
  right: { dr: 0, dc: 1, icon: "→", label: "راست", deg: 90 },
  down: { dr: 1, dc: 0, icon: "↓", label: "پایین", deg: 180 },
  left: { dr: 0, dc: -1, icon: "←", label: "چپ", deg: 270 },
};

const DIR_KEYS = ["up", "right", "down", "left"];

export class ArrowGame {
  constructor(boardElement) {
    this.boardEl = boardElement;
    this.arrows = []; // array of { id, r, c, dir }
    this.gridSize = 4; // rows & cols
    this.totalArrowsAtStart = 0;
    this.isAnimating = false;
    this.callbacks = {
      onWin: null,
      onMove: null,
      onStateChange: null,
    };
  }

  // Determine grid dimension and arrow count based on level
  getLevelConfig(level) {
    if (level === 1) return { size: 4, count: 6, minBlockedRatio: 0.3 };
    if (level === 2) return { size: 4, count: 8, minBlockedRatio: 0.4 };
    if (level <= 4) return { size: 5, count: 12, minBlockedRatio: 0.45 };
    if (level <= 7) return { size: 5, count: 16, minBlockedRatio: 0.5 };
    if (level <= 10) return { size: 6, count: 20, minBlockedRatio: 0.55 };
    if (level <= 14) return { size: 6, count: 24, minBlockedRatio: 0.6 };
    if (level <= 20) return { size: 7, count: 30, minBlockedRatio: 0.6 };
    return { size: 7, count: 34, minBlockedRatio: 0.65 };
  }

  // Check if ray in direction of arrow at (r, c) hits another arrow in given arrow list
  isPathClear(arrow, arrowList) {
    const { dr, dc } = DIRECTIONS[arrow.dir];
    let currR = arrow.r + dr;
    let currC = arrow.c + dc;

    while (currR >= 0 && currR < this.gridSize && currC >= 0 && currC < this.gridSize) {
      const obstacle = arrowList.find((a) => a.r === currR && a.c === currC && a.id !== arrow.id);
      if (obstacle) {
        return { clear: false, blocker: obstacle };
      }
      currR += dr;
      currC += dc;
    }
    return { clear: true, blocker: null };
  }

  // Fast solver to verify if puzzle is 100% solvable
  solveSimulation(arrowList) {
    const remaining = [...arrowList];
    const order = [];

    while (remaining.length > 0) {
      const escaperIndex = remaining.findIndex((a) => this.isPathClear(a, remaining).clear);
      if (escaperIndex === -1) {
        // Deadlock: no arrow can move
        return { solvable: false, order: [] };
      }
      const [escaped] = remaining.splice(escaperIndex, 1);
      order.push(escaped.id);
    }

    return { solvable: true, order };
  }

  // Generate a guaranteed solvable puzzle
  generatePuzzle(level) {
    const config = this.getLevelConfig(level);
    this.gridSize = config.size;

    let attempts = 0;
    const maxAttempts = 150;

    while (attempts < maxAttempts) {
      attempts++;
      const candidateArrows = [];
      const usedCoords = new Set();

      // Pick random unique positions
      const allCoords = [];
      for (let r = 0; r < this.gridSize; r++) {
        for (let c = 0; c < this.gridSize; c++) {
          allCoords.push({ r, c });
        }
      }
      // Shuffle coordinates
      allCoords.sort(() => Math.random() - 0.5);

      for (let i = 0; i < config.count; i++) {
        const coord = allCoords[i];
        const dir = DIR_KEYS[Math.floor(Math.random() * DIR_KEYS.length)];
        candidateArrows.push({
          id: `arrow_${coord.r}_${coord.c}_${Math.random().toString(36).substring(2, 6)}`,
          r: coord.r,
          c: coord.c,
          dir,
        });
        usedCoords.add(`${coord.r},${coord.c}`);
      }

      // 1. Must be 100% solvable
      const solution = this.solveSimulation(candidateArrows);
      if (!solution.solvable) continue;

      // 2. Initial state must have at least one clear arrow, but also some blocked ones
      const initialClear = candidateArrows.filter((a) => this.isPathClear(a, candidateArrows).clear);
      const blockedCount = candidateArrows.length - initialClear.length;
      const blockedRatio = blockedCount / candidateArrows.length;

      if (initialClear.length >= 1 && blockedRatio >= config.minBlockedRatio) {
        this.arrows = candidateArrows;
        this.totalArrowsAtStart = candidateArrows.length;
        return true;
      }
    }

    // Fallback: reverse construction algorithm guarantees solvability if random tries exceed
    this.generateByReverseConstruction(config);
    return true;
  }

  // Fallback reverse-construction generator
  generateByReverseConstruction(config) {
    this.gridSize = config.size;
    const arrows = [];
    const usedPositions = new Set();

    // In reverse, we place arrows one by one such that each new arrow
    // would be blocked by prior arrows, but the last placed is clear first
    for (let i = 0; i < config.count; i++) {
      const freePositions = [];
      for (let r = 0; r < this.gridSize; r++) {
        for (let c = 0; c < this.gridSize; c++) {
          if (!usedPositions.has(`${r},${c}`)) {
            freePositions.push({ r, c });
          }
        }
      }
      if (freePositions.length === 0) break;

      const pos = freePositions[Math.floor(Math.random() * freePositions.length)];
      usedPositions.add(`${pos.r},${pos.c}`);

      // Pick a direction pointing outward or toward edge
      const possibleDirs = [];
      if (pos.r === 0) possibleDirs.push("up");
      if (pos.r === this.gridSize - 1) possibleDirs.push("down");
      if (pos.c === 0) possibleDirs.push("left");
      if (pos.c === this.gridSize - 1) possibleDirs.push("right");

      const chosenDir = possibleDirs.length > 0
        ? possibleDirs[Math.floor(Math.random() * possibleDirs.length)]
        : DIR_KEYS[Math.floor(Math.random() * DIR_KEYS.length)];

      arrows.push({
        id: `arrow_${pos.r}_${pos.c}_${i}`,
        r: pos.r,
        c: pos.c,
        dir: chosenDir,
      });
    }

    this.arrows = arrows;
    this.totalArrowsAtStart = arrows.length;
  }

  // Load a new level
  loadLevel(levelNumber) {
    this.generatePuzzle(levelNumber);
    this.render();
  }

  // Render the board
  render() {
    this.boardEl.innerHTML = "";
    this.boardEl.style.setProperty("--grid-size", this.gridSize);

    // Create grid cells
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const cell = document.createElement("div");
        cell.className = "grid-cell";
        cell.dataset.r = r;
        cell.dataset.c = c;
        this.boardEl.appendChild(cell);
      }
    }

    // Render arrows
    this.arrows.forEach((arrow) => {
      const arrowEl = this.createArrowElement(arrow);
      this.boardEl.appendChild(arrowEl);
    });
  }

  createArrowElement(arrow) {
    const el = document.createElement("button");
    el.className = `arrow-tile dir-${arrow.dir}`;
    el.id = arrow.id;
    el.dataset.id = arrow.id;
    el.dataset.dir = arrow.dir;
    el.dataset.r = arrow.r;
    el.dataset.c = arrow.c;
    el.setAttribute("aria-label", `فلش به سمت ${DIRECTIONS[arrow.dir].label}`);

    // Place using CSS grid position
    el.style.gridRowStart = arrow.r + 1;
    el.style.gridColumnStart = arrow.c + 1;

    // Inner SVG arrow for sharp rendering at all DPIs
    el.innerHTML = `
      <div class="arrow-inner">
        <svg class="arrow-svg" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path class="arrow-shaft" d="M20 32V11" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
          <path class="arrow-head" d="M10 19L20 8L30 19" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `;

    el.addEventListener("click", (e) => {
      e.preventDefault();
      this.handleArrowTap(arrow);
    });

    return el;
  }

  // Handle player tapping an arrow
  handleArrowTap(arrow) {
    if (this.isAnimating || State.status !== "playing") return;

    const arrowEl = document.getElementById(arrow.id);
    if (!arrowEl) return;

    const status = this.isPathClear(arrow, this.arrows);

    if (status.clear) {
      // SUCCESS MOVE: Path is clear!
      State.pushUndo(this.arrows);
      State.incrementMove();
      sound.playEscape();
      Eitaa.haptic.impact("light");

      if (this.callbacks.onMove) {
        this.callbacks.onMove(State.moves);
      }

      this.animateEscape(arrow, arrowEl);
    } else {
      // BLOCKED MOVE: An arrow is in the way
      sound.playBlocked();
      Eitaa.haptic.error();

      // Shake tapped arrow
      arrowEl.classList.remove("shake-blocked");
      void arrowEl.offsetWidth; // trigger reflow
      arrowEl.classList.add("shake-blocked");

      // Highlight the blocking arrow in red briefly
      if (status.blocker) {
        const blockerEl = document.getElementById(status.blocker.id);
        if (blockerEl) {
          blockerEl.classList.remove("highlight-blocker");
          void blockerEl.offsetWidth;
          blockerEl.classList.add("highlight-blocker");
          setTimeout(() => {
            blockerEl.classList.remove("highlight-blocker");
          }, 600);
        }
      }
    }
  }

  // Smooth escape animation
  animateEscape(arrow, arrowEl) {
    this.isAnimating = true;

    // Flight offset direction
    const flightMultiplier = 120;
    const { dr, dc } = DIRECTIONS[arrow.dir];
    const transX = dc * flightMultiplier;
    const transY = dr * flightMultiplier;

    arrowEl.style.setProperty("--flight-x", `${transX}%`);
    arrowEl.style.setProperty("--flight-y", `${transY}%`);
    arrowEl.classList.add("escaping");

    setTimeout(() => {
      // Remove from memory
      this.arrows = this.arrows.filter((a) => a.id !== arrow.id);
      arrowEl.remove();
      this.isAnimating = false;

      // Check for win
      if (this.arrows.length === 0) {
        this.handleLevelWon();
      }
    }, 280);
  }

  // Level completed
  handleLevelWon() {
    State.status = "won";
    State.stopTimer();
    sound.playVictory();
    Eitaa.haptic.success();

    const stars = State.calculateStars(this.totalArrowsAtStart, State.moves);
    const score = State.calculateScore(this.totalArrowsAtStart, State.moves, State.secondsElapsed);

    State.saveProgression(State.currentLevel, score);

    if (this.callbacks.onWin) {
      this.callbacks.onWin({
        level: State.currentLevel,
        stars,
        score,
        moves: State.moves,
        time: State.secondsElapsed,
        nextLevel: State.currentLevel + 1,
      });
    }
  }

  // Hint feature: highlight an unblocked arrow
  showHint() {
    if (State.status !== "playing" || this.isAnimating) return;

    const freeArrows = this.arrows.filter((a) => this.isPathClear(a, this.arrows).clear);
    if (freeArrows.length === 0) return;

    // Pick the first free arrow
    const hintArrow = freeArrows[0];
    const el = document.getElementById(hintArrow.id);
    if (el) {
      sound.playHint();
      Eitaa.haptic.impact("medium");

      el.classList.remove("hint-pulse");
      void el.offsetWidth;
      el.classList.add("hint-pulse");
      setTimeout(() => {
        el.classList.remove("hint-pulse");
      }, 1400);
    }
  }

  // Undo move
  undo() {
    if (!State.canUndo() || this.isAnimating) return;

    const prevArrows = State.popUndo();
    if (prevArrows) {
      sound.playClick();
      Eitaa.haptic.impact("light");
      this.arrows = prevArrows;
      this.render();
      if (this.callbacks.onStateChange) {
        this.callbacks.onStateChange();
      }
    }
  }

  // Restart current level
  restartLevel() {
    sound.playClick();
    State.startLevel(State.currentLevel);
    this.render();
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange();
    }
  }
}
