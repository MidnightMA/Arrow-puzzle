/**
 * game.js — Arrow Puzzle engine
 *
 * Arrow Puzzle rules:
 *  - An N×N grid has one "target" cell (★) at a fixed position.
 *  - Every other cell contains an arrow in one of 8 directions (N, NE, E, SE, S, SW, W, NW).
 *  - A cell is "solved" when its arrow points TOWARD the target cell's row/column direction.
 *    Specifically: the arrow must point to the general cardinal/diagonal direction
 *    of the target from that cell's position on the grid.
 *  - Tapping a cell rotates its arrow 45° clockwise.
 *  - The puzzle is complete when ALL non-target cells are solved.
 *  - Score = max(0, BASE_SCORE - moves * MOVE_PENALTY), bonus for par or under.
 */

// ── Direction system ──────────────────────────────────────────────────────────
// 8 directions, 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW
// Stored as index 0-7. Rotated CW by incrementing mod 8.

const DIR_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
const DIR_DEGREES = [0, 45, 90, 135, 180, 225, 270, 315];

// Direction deltas: [rowDelta, colDelta] for each direction index
const DIR_DELTAS = [
  [-1,  0],  // 0: N
  [-1,  1],  // 1: NE
  [ 0,  1],  // 2: E
  [ 1,  1],  // 3: SE
  [ 1,  0],  // 4: S
  [ 1, -1],  // 5: SW
  [ 0, -1],  // 6: W
  [-1, -1],  // 7: NW
];

/**
 * Compute the "correct" direction index a cell at (r,c) should point
 * toward the target at (tr, tc).
 */
function correctDirIndex(r, c, tr, tc) {
  const dr = Math.sign(tr - r);  // -1, 0, +1
  const dc = Math.sign(tc - c);
  for (let i = 0; i < 8; i++) {
    if (DIR_DELTAS[i][0] === dr && DIR_DELTAS[i][1] === dc) return i;
  }
  return 0; // fallback (shouldn't happen for non-target cell)
}

// ── Level definitions ─────────────────────────────────────────────────────────
/**
 * Levels define:
 *  - size: grid dimension (N×N)
 *  - targetPos: [row, col] of the star cell (0-indexed)
 *  - par: move count considered perfect (score multiplier)
 *  - baseScore: maximum score achievable
 *
 * The board arrows are generated deterministically from a seed so the
 * server can verify a finishing state without storing full board state.
 * For a puzzle game the seed is the level number — every player sees the
 * same scramble for the same level.
 */
export const LEVEL_DEFS = [
  // Level 1 — 3×3, easy
  { size: 3, targetPos: [1, 1], par: 6,  baseScore: 100  },
  // Level 2
  { size: 3, targetPos: [0, 0], par: 8,  baseScore: 150  },
  // Level 3
  { size: 3, targetPos: [2, 2], par: 9,  baseScore: 200  },
  // Level 4 — 4×4
  { size: 4, targetPos: [1, 1], par: 12, baseScore: 300  },
  // Level 5
  { size: 4, targetPos: [0, 3], par: 14, baseScore: 350  },
  // Level 6
  { size: 4, targetPos: [3, 0], par: 14, baseScore: 400  },
  // Level 7
  { size: 4, targetPos: [1, 2], par: 16, baseScore: 450  },
  // Level 8 — 5×5
  { size: 5, targetPos: [2, 2], par: 18, baseScore: 550  },
  // Level 9
  { size: 5, targetPos: [0, 4], par: 20, baseScore: 600  },
  // Level 10
  { size: 5, targetPos: [4, 0], par: 20, baseScore: 650  },
  // Level 11
  { size: 5, targetPos: [1, 3], par: 22, baseScore: 700  },
  // Level 12 — 6×6
  { size: 6, targetPos: [2, 3], par: 26, baseScore: 850  },
  // Level 13
  { size: 6, targetPos: [0, 5], par: 28, baseScore: 900  },
  // Level 14
  { size: 6, targetPos: [5, 0], par: 28, baseScore: 950  },
  // Level 15
  { size: 6, targetPos: [3, 3], par: 30, baseScore: 1000 },
  // Level 16 — 7×7
  { size: 7, targetPos: [3, 3], par: 36, baseScore: 1200 },
  // Level 17
  { size: 7, targetPos: [0, 6], par: 38, baseScore: 1300 },
  // Level 18
  { size: 7, targetPos: [6, 0], par: 38, baseScore: 1400 },
  // Level 19
  { size: 7, targetPos: [2, 4], par: 40, baseScore: 1500 },
  // Level 20 — 8×8 boss
  { size: 8, targetPos: [3, 4], par: 50, baseScore: 2000 },
];

export const TOTAL_LEVELS = LEVEL_DEFS.length;

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Board generation ──────────────────────────────────────────────────────────
/**
 * Generate the initial board state for a level.
 * Returns a flat array of cell objects:
 *   { row, col, isTarget, dirIndex, correctDirIndex }
 *
 * The "scramble" is deterministic from (levelIndex).
 * We first place every cell's correct direction, then randomly rotate each
 * non-target cell by 1–7 extra steps (never leave it already solved).
 */
export function generateBoard(levelIndex) {
  const def = LEVEL_DEFS[levelIndex];
  const { size, targetPos } = def;
  const [tr, tc] = targetPos;
  const rng = seededRng(levelIndex * 31337 + 1);

  const cells = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const isTarget = (r === tr && c === tc);
      if (isTarget) {
        cells.push({ row: r, col: c, isTarget: true, dirIndex: -1, correctDir: -1 });
        continue;
      }
      const correctDir = correctDirIndex(r, c, tr, tc);
      // Random offset 1–7 so no cell starts solved
      const offset = Math.floor(rng() * 7) + 1;
      const startDir = (correctDir + offset) % 8;
      cells.push({
        row: r,
        col: c,
        isTarget: false,
        dirIndex: startDir,
        correctDir,
      });
    }
  }
  return cells;
}

// ── Cell operations ───────────────────────────────────────────────────────────
/** Rotate a cell's arrow 45° clockwise. Returns new dirIndex. */
export function rotateCell(cell) {
  if (cell.isTarget) return cell.dirIndex;
  return (cell.dirIndex + 1) % 8;
}

/** Is this cell currently pointing in the correct direction? */
export function isCellSolved(cell) {
  if (cell.isTarget) return true;
  return cell.dirIndex === cell.correctDir;
}

// ── Board queries ─────────────────────────────────────────────────────────────
/** Count how many non-target cells are currently solved. */
export function countSolved(cells) {
  return cells.filter(c => !c.isTarget && isCellSolved(c)).length;
}

/** Total non-target cells. */
export function totalPuzzleCells(cells) {
  return cells.filter(c => !c.isTarget).length;
}

/** Is the entire puzzle solved? */
export function isPuzzleSolved(cells) {
  return cells.every(c => isCellSolved(c));
}

// ── Score calculation ─────────────────────────────────────────────────────────
const MOVE_PENALTY = 5;
const PAR_BONUS    = 200;

/**
 * Calculate score for a finished level.
 * @param {number} levelIndex
 * @param {number} moves
 * @returns {number} integer score ≥ 0
 */
export function calcScore(levelIndex, moves) {
  const def = LEVEL_DEFS[levelIndex];
  let score = def.baseScore - Math.max(0, moves - def.par) * MOVE_PENALTY;
  if (moves <= def.par) score += PAR_BONUS;
  return Math.max(0, score);
}

// ── Hint logic ────────────────────────────────────────────────────────────────
/**
 * Return the index (into cells array) of a cell that needs the most rotations
 * to reach its correct direction, giving a meaningful hint.
 * If everything is solved returns -1.
 */
export function getHintCellIndex(cells) {
  let best = -1;
  let bestRotations = 0;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c.isTarget || isCellSolved(c)) continue;
    // How many clockwise steps to reach correct?
    const steps = (c.correctDir - c.dirIndex + 8) % 8;
    if (best === -1 || steps > bestRotations) {
      best = i;
      bestRotations = steps;
    }
  }
  return best;
}

// ── Display helpers ───────────────────────────────────────────────────────────
export function dirGlyph(dirIndex) {
  if (dirIndex < 0) return '★';
  return DIR_ARROWS[dirIndex];
}

export function dirDegrees(dirIndex) {
  if (dirIndex < 0) return 0;
  return DIR_DEGREES[dirIndex];
}

// ── Game state machine ─────────────────────────────────────────────────────────
/**
 * A GameState object tracks a running game session.
 * Caller is responsible for rendering; this module is pure logic.
 */
export class GameState {
  constructor(levelIndex) {
    this.levelIndex  = levelIndex;
    this.cells       = generateBoard(levelIndex);
    this.moves       = 0;
    this.startTime   = Date.now();
    this.finishTime  = null;
    this.score       = 0;
    this.solved      = false;
    this.hintsUsed   = 0;
  }

  /** Rotate the cell at array index i. Returns { newDirIndex, wasSolved, puzzleDone }. */
  tap(cellIndex) {
    const cell = this.cells[cellIndex];
    if (!cell || cell.isTarget || this.solved) {
      return { newDirIndex: cell?.dirIndex, wasSolved: false, puzzleDone: false };
    }
    const wasSolved = isCellSolved(cell);
    cell.dirIndex = rotateCell(cell);
    this.moves++;

    const nowSolved = isCellSolved(cell);
    const puzzleDone = isPuzzleSolved(this.cells);
    if (puzzleDone) {
      this.solved     = true;
      this.finishTime = Date.now();
      this.score      = calcScore(this.levelIndex, this.moves);
    }
    return {
      newDirIndex: cell.dirIndex,
      wasSolved: nowSolved,    // true if this tap completed this cell
      puzzleDone,
    };
  }

  /** Apply a hint: one step toward solving the most-off cell. */
  applyHint() {
    if (this.solved) return -1;
    const idx = getHintCellIndex(this.cells);
    if (idx === -1) return -1;
    this.cells[idx].dirIndex = rotateCell(this.cells[idx]);
    this.moves++;
    this.hintsUsed++;
    return idx;
  }

  /** Reset current level to its initial state. */
  reset() {
    this.cells     = generateBoard(this.levelIndex);
    this.moves     = 0;
    this.startTime = Date.now();
    this.finishTime = null;
    this.score     = 0;
    this.solved    = false;
  }

  progress() {
    const total   = totalPuzzleCells(this.cells);
    const solved  = countSolved(this.cells);
    return total > 0 ? solved / total : 0;
  }

  elapsedSeconds() {
    const end = this.finishTime ?? Date.now();
    return Math.round((end - this.startTime) / 1000);
  }
}
