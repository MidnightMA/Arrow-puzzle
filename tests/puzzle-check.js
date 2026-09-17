// Self-check test suite for Arrow Puzzle logic (Run with `node tests/puzzle-check.js`)
import assert from "node:assert";

const DIRECTIONS = {
  up: { dr: -1, dc: 0 },
  right: { dr: 0, dc: 1 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
};
const DIR_KEYS = ["up", "right", "down", "left"];

function isPathClear(arrow, arrowList, gridSize) {
  const { dr, dc } = DIRECTIONS[arrow.dir];
  let currR = arrow.r + dr;
  let currC = arrow.c + dc;

  while (currR >= 0 && currR < gridSize && currC >= 0 && currC < gridSize) {
    const obstacle = arrowList.find((a) => a.r === currR && a.c === currC && a.id !== arrow.id);
    if (obstacle) {
      return { clear: false, blocker: obstacle };
    }
    currR += dr;
    currC += dc;
  }
  return { clear: true, blocker: null };
}

function solveSimulation(arrowList, gridSize) {
  const remaining = [...arrowList];
  const order = [];

  while (remaining.length > 0) {
    const escaperIndex = remaining.findIndex((a) => isPathClear(a, remaining, gridSize).clear);
    if (escaperIndex === -1) {
      return { solvable: false, order: [] };
    }
    const [escaped] = remaining.splice(escaperIndex, 1);
    order.push(escaped.id);
  }

  return { solvable: true, order };
}

function getLevelConfig(level) {
  if (level === 1) return { size: 4, count: 6, minBlockedRatio: 0.3 };
  if (level === 2) return { size: 4, count: 8, minBlockedRatio: 0.4 };
  if (level <= 4) return { size: 5, count: 12, minBlockedRatio: 0.45 };
  if (level <= 7) return { size: 5, count: 16, minBlockedRatio: 0.5 };
  if (level <= 10) return { size: 6, count: 20, minBlockedRatio: 0.55 };
  return { size: 6, count: 24, minBlockedRatio: 0.6 };
}

function generatePuzzle(level) {
  const config = getLevelConfig(level);
  const gridSize = config.size;

  for (let attempt = 0; attempt < 100; attempt++) {
    const candidateArrows = [];
    const allCoords = [];
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        allCoords.push({ r, c });
      }
    }
    allCoords.sort(() => Math.random() - 0.5);

    for (let i = 0; i < config.count; i++) {
      const coord = allCoords[i];
      const dir = DIR_KEYS[Math.floor(Math.random() * DIR_KEYS.length)];
      candidateArrows.push({
        id: `arrow_${coord.r}_${coord.c}_${i}`,
        r: coord.r,
        c: coord.c,
        dir,
      });
    }

    const solution = solveSimulation(candidateArrows, gridSize);
    if (!solution.solvable) continue;

    const initialClear = candidateArrows.filter((a) => isPathClear(a, candidateArrows, gridSize).clear);
    const blockedRatio = (candidateArrows.length - initialClear.length) / candidateArrows.length;

    if (initialClear.length >= 1 && blockedRatio >= config.minBlockedRatio) {
      return { arrows: candidateArrows, gridSize, solution };
    }
  }

  throw new Error(`Failed to generate solvable puzzle for level ${level}`);
}

// ----------------- RUN TESTS -----------------
console.log("Running Arrow Puzzle logic tests...");

// Test 1: Direct collision check
{
  const arrows = [
    { id: "a1", r: 1, c: 1, dir: "right" },
    { id: "a2", r: 1, c: 3, dir: "up" },
  ];
  const res = isPathClear(arrows[0], arrows, 4);
  assert.strictEqual(res.clear, false, "a1 should be blocked by a2");
  assert.strictEqual(res.blocker.id, "a2", "blocker should be a2");

  const res2 = isPathClear(arrows[1], arrows, 4);
  assert.strictEqual(res2.clear, true, "a2 should be clear upward");
  console.log("✓ Collision raycheck test passed");
}

// Test 2: Level generation & solvability across 10 levels
for (let lvl = 1; lvl <= 10; lvl++) {
  const puzzle = generatePuzzle(lvl);
  assert.strictEqual(puzzle.solution.solvable, true, `Level ${lvl} must be solvable`);
  assert.strictEqual(puzzle.solution.order.length, puzzle.arrows.length, `Level ${lvl} all arrows must escape`);
  console.log(`✓ Level ${lvl} generated successfully: ${puzzle.arrows.length} arrows on ${puzzle.gridSize}x${puzzle.gridSize} grid (solvable in ${puzzle.solution.order.length} moves)`);
}

console.log("All puzzle self-check tests passed successfully!");
