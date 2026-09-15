/**
 * functions/api/game/start.js  →  POST /api/game/start
 */
import { verifyInitData, errResponse, jsonResponse } from '../_shared/auth.js';

const TOTAL_LEVELS = 20;

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

  const level = parseInt(body.level, 10);
  const seed  = String(body.seed ?? '');

  if (!Number.isInteger(level) || level < 1 || level > TOTAL_LEVELS)
    return errResponse('invalid level', 400);

  // Verify player is allowed to play this level
  const progress = await env.DB.prepare(
    'SELECT max_level FROM player_progress WHERE eitaa_user_id = ?'
  ).bind(userId).first();

  const maxLevel = progress?.max_level ?? 1;
  if (level > maxLevel) return errResponse('level locked', 403);

  const now = Math.floor(Date.now() / 1000);

  const result = await env.DB.prepare(`
    INSERT INTO game_sessions (eitaa_user_id, level, seed, started_at)
    VALUES (?, ?, ?, ?)
  `).bind(userId, level, seed, now).run();

  return jsonResponse({ sessionId: result.meta?.last_row_id });
}
