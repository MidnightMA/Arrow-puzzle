/**
 * api.js — HTTP client for all backend endpoints
 *
 * All calls include the raw initData header for server-side authentication.
 * The server verifies it; this module never trusts client identity.
 */

import { getInitData } from './eitaa.js';

const BASE = '';  // same-origin; Pages Functions serve under /api/

/** Build common headers for every request. */
function headers(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'X-Init-Data': getInitData(),
    ...extra,
  };
}

/** Low-level fetch wrapper — throws ApiError on non-2xx. */
async function request(method, path, body) {
  const opts = { method, headers: headers() };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(BASE + path, opts);
  } catch (networkErr) {
    throw new ApiError('شبکه در دسترس نیست. اتصال اینترنت را بررسی کنید.', 0);
  }

  if (!res.ok) {
    let message = 'خطای سرور';
    try {
      const json = await res.json();
      message = json.error ?? json.message ?? message;
    } catch { /* ignore */ }
    throw new ApiError(message, res.status);
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name   = 'ApiError';
    this.status = status;
  }
}

// ── Session ───────────────────────────────────────────────────────────────────
/**
 * Authenticate with the server using Eitaa initData.
 * Server verifies the HMAC and returns the verified player record.
 * @returns {{ player: { eitaa_user_id, first_name, last_name, username, best_score, total_levels }, maxLevel: number }}
 */
export async function createSession() {
  return request('POST', '/api/session', { initData: getInitData() });
}

// ── Game lifecycle ────────────────────────────────────────────────────────────
/**
 * Notify server a level has started; server creates a session row and returns
 * a session token used when finishing.
 * @param {number} level 1-indexed
 * @param {string} seed  level seed string
 * @returns {{ sessionId: number }}
 */
export async function startGame(level, seed) {
  return request('POST', '/api/game/start', { level, seed });
}


/**
 * Report a finished level. Server validates the score, stores result.
 * @param {number} sessionId
 * @param {number} level 1-indexed
 * @param {number} moves
 * @param {number} score client-computed score (server recomputes independently)
 * @param {number} elapsedSeconds
 * @returns {{ score: number, bestScore: number, newBest: boolean, maxLevel: number }}
 */
export async function finishGame(sessionId, level, moves, score, elapsedSeconds) {
  return request('POST', '/api/game/finish', {
    sessionId, level, moves, score, elapsedSeconds,
  });
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
/**
 * Fetch top players.
 * @param {number} limit default 30
 * @returns {{ entries: Array<{ rank, display_name, best_score, levels_done }>, myEntry: object|null }}
 */
export async function fetchLeaderboard(limit = 30) {
  return request('GET', `/api/leaderboard?limit=${limit}`, undefined);
}
