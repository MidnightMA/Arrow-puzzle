/**
 * functions/api/game/finish.js  →  POST /api/game/finish
 *
 * Server re-computes the score independently. Client score is ignored;
 * we use our own deterministic calcScore so the client can't inflate points.
 */
import { verifyInitData, errResponse, jsonResponse } from '../_shared/auth.js';

// Must stay in sync with public/js/game.js LEVEL_DEFS
const LEVEL_DEFS = [
  { size: 3, targetPos: [1, 1], par: 6,  baseScore: 100  },
  { size: 3, targetPos: [0, 0], par: 8,  baseScore: 150  },
  { size: 3, targetPos: [2, 2], par: 9,  baseScore: 200  },
  { size: 4, targetPos: [1, 1], par: 12, baseScore: 300  },
  { size: 4, targetPos: [0, 3], par: 14, baseScore: 350  },
  { size: 4, targetPos: [3, 0], par: 14, baseScore: 400  },
  { size: 4, targetPos: [1, 2], par: 16, baseScore: 450  },
  { size: 5, targetPos: [2, 2], par: 18, baseScore: 550  },
  { size: 5, targetPos: [0, 4], par: 20, baseScore: 600  },
  { size: 5, targetPos: [4, 0], par: 20, baseScore: 650  },
  { size: 5, targetPos: [1, 3], par: 22, baseScore: 700  },
  { size: 6, targetPos: [2, 3], par: 26, baseScore: 850  },
  { size: 6, targetPos: [0, 5], par: 28, baseScore: 900  },
  { size: 6, targetPos: [5, 0], par: 28, baseScore: 950  },
  { size: 6, targetPos: [3, 3], par: 30, baseScore: 1000 },
  { size: 7, targetPos: [3, 3], par: 36, baseScore: 1200 },
  { size: 7, targetPos: [0, 6], par: 38, baseScore: 1300 },
  { size: 7, targetPos: [6, 0], par: 38, baseScore: 1400 },
  { size: 7, targetPos: [2, 4], par: 40, baseScore: 1500 },
  { size: 8, targetPos: [3, 4], par: 50, baseScore: 2000 },
];
const TOTAL_LEVELS = LEVEL_DEFS.length;
const MOVE_PENALTY = 5;
const PAR_BONUS    = 200;

function calcScore(levelIndex, moves) {
  const def = LEVEL_DEFS[levelIndex];
  if (!def) return 0;
  let score = def.baseScore - Math.max(0, moves - def.par) * MOVE_PENALTY;
  if (moves <= def.par) score += PAR_BONUS;
  return Math.max(0, score);
}

async function getVerifiedUserId(request, env) {
  const initData = request.headers.get('X-Init-Data') ?? '';
  if (env.EITAA_TOKEN === 'DEV') return '1';
  try {
    const { user } = await verifyInitData(initData, env.EITAA_TOKEN);
    return String(user.id);
  } catch {
    return null;
  }
}

export async function onRequestPost({ request, env }) {
  const userId = await getVerifiedUserId(request, env);
  if (!userId) return errResponse('authentication failed', 401);

  let body;
  try { body = await request.json(); } catch { return errResponse('bad request', 400); }

  const sessionId      = parseInt(body.sessionId, 10);
  const level          = parseInt(body.level, 10);
  const moves          = parseInt(body.moves, 10);
  const elapsedSeconds = parseInt(body.elapsedSeconds, 10);

  if (!Number.isInteger(level) || level < 1 || level > TOTAL_LEVELS) return errResponse('invalid level', 400);
  if (!Number.isInteger(moves) || moves < 1)                          return errResponse('invalid moves', 400);
  if (!Number.isInteger(sessionId) || sessionId < 1)                  return errResponse('invalid session', 400);

  const levelIndex = level - 1;
  const def        = LEVEL_DEFS[levelIndex];
  const minMoves   = def.size * def.size - 1;

  if (moves < minMoves) return errResponse('moves too low', 422);

  // Validate session ownership
  const session = await env.DB.prepare(`
    SELECT id, started_at, finished_at FROM game_sessions
    WHERE id = ? AND eitaa_user_id = ? AND level = ?
  `).bind(sessionId, userId, level).first();

  if (!session)            return errResponse('session not found', 404);
  if (session.finished_at) return errResponse('already finished', 409);

  // Timing sanity
  const now           = Math.floor(Date.now() / 1000);
  const actualElapsed = now - session.started_at;
  const minSeconds    = Math.max(5, def.size * 2);
  if (actualElapsed < minSeconds) return errResponse('elapsed too short', 422);

  // Server-authoritative score
  const serverScore = calcScore(levelIndex, moves);

  // Mark session done
  await env.DB.prepare(
    'UPDATE game_sessions SET finished_at = ?, moves = ?, score = ? WHERE id = ?'
  ).bind(now, moves, serverScore, sessionId).run();

  // Update player stats
  const player = await env.DB.prepare(
    'SELECT best_score, total_levels, first_name, last_name, username FROM players WHERE eitaa_user_id = ?'
  ).bind(userId).first();

  const prevBest   = player?.best_score ?? 0;
  const newBest    = serverScore > prevBest;
  const newBestScore = newBest ? serverScore : prevBest;

  await env.DB.prepare(`
    UPDATE players
    SET best_score = MAX(best_score, ?), total_levels = total_levels + 1, updated_at = ?
    WHERE eitaa_user_id = ?
  `).bind(serverScore, now, userId).run();

  // Advance max level
  const progress  = await env.DB.prepare(
    'SELECT max_level FROM player_progress WHERE eitaa_user_id = ?'
  ).bind(userId).first();

  const currentMax  = progress?.max_level ?? 1;
  const newMaxLevel = Math.min(TOTAL_LEVELS, Math.max(currentMax, level + 1));

  await env.DB.prepare(`
    UPDATE player_progress SET max_level = ?, total_moves = total_moves + ?, updated_at = ?
    WHERE eitaa_user_id = ?
  `).bind(newMaxLevel, moves, now, userId).run();

  // Update leaderboard
  const displayName = [player?.first_name, player?.last_name].filter(Boolean).join(' ')
    || player?.username
    || `کاربر ${userId}`;

  const newTotalLevels = (player?.total_levels ?? 0) + 1;

  await env.DB.prepare(`
    INSERT INTO leaderboard (eitaa_user_id, display_name, best_score, levels_done, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(eitaa_user_id) DO UPDATE SET
      display_name = excluded.display_name,
      best_score   = MAX(best_score, excluded.best_score),
      levels_done  = excluded.levels_done,
      updated_at   = excluded.updated_at
  `).bind(userId, displayName, newBestScore, newTotalLevels, now).run();

  return jsonResponse({ score: serverScore, bestScore: newBestScore, newBest, maxLevel: newMaxLevel });
}
