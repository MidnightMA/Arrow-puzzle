/**
 * functions/api/leaderboard.js  →  GET /api/leaderboard
 *
 * Returns top N players by best_score DESC.
 * Also returns the requesting player's own entry if they're outside the top N.
 */
import { verifyInitData, errResponse, jsonResponse } from './_shared/auth.js';

const MAX_LIMIT     = 100;
const DEFAULT_LIMIT = 30;

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

export async function onRequestGet({ request, env }) {
  const userId = await getVerifiedUserId(request, env);
  if (!userId) return errResponse('authentication failed', 401);

  const url   = new URL(request.url);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') ?? DEFAULT_LIMIT, 10)));

  // Fetch top N entries
  const { results: entries } = await env.DB.prepare(`
    SELECT eitaa_user_id, display_name, best_score, levels_done
    FROM leaderboard
    ORDER BY best_score DESC, levels_done DESC
    LIMIT ?
  `).bind(limit).all();

  // Fetch my entry (may or may not be in top N)
  const myEntry = await env.DB.prepare(`
    SELECT eitaa_user_id, display_name, best_score, levels_done
    FROM leaderboard
    WHERE eitaa_user_id = ?
  `).bind(userId).first();

  return jsonResponse({ entries: entries ?? [], myEntry: myEntry ?? null });
}
