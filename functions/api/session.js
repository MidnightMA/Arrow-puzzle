/**
 * functions/api/session.js  →  POST /api/session
 *
 * Verifies Eitaa initData and upserts the player in D1.
 * Returns verified player data + current max unlocked level.
 */

import { verifyInitData, errResponse, jsonResponse } from './_shared/auth.js';

export async function onRequestPost({ request, env }) {
  // --- Parse body ---
  let body;
  try {
    body = await request.json();
  } catch {
    return errResponse('invalid request body', 400);
  }

  const initData = body?.initData ?? request.headers.get('X-Init-Data') ?? '';

  // Allow dev mode: when EITAA_TOKEN is "DEV" we skip HMAC and use a mock user.
  // NEVER deploy with DEV token on production.
  let user, authDate;
  if (env.EITAA_TOKEN === 'DEV') {
    user     = { id: 1, first_name: 'توسعه', last_name: 'دهنده', username: 'dev' };
    authDate = Math.floor(Date.now() / 1000);
  } else {
    try {
      ({ user, authDate } = await verifyInitData(initData, env.EITAA_TOKEN));
    } catch (e) {
      return errResponse('authentication failed', 401);
    }
  }

  const eitaaUserId = String(user.id);
  const firstName   = user.first_name ?? null;
  const lastName    = user.last_name  ?? null;
  const username    = user.username   ?? null;
  const now         = Math.floor(Date.now() / 1000);

  // Upsert player
  await env.DB.prepare(`
    INSERT INTO players (eitaa_user_id, first_name, last_name, username, best_score, total_levels, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, 0, ?, ?)
    ON CONFLICT(eitaa_user_id) DO UPDATE SET
      first_name = excluded.first_name,
      last_name  = excluded.last_name,
      username   = excluded.username,
      updated_at = excluded.updated_at
  `).bind(eitaaUserId, firstName, lastName, username, now, now).run();

  // Upsert progress
  await env.DB.prepare(`
    INSERT INTO player_progress (eitaa_user_id, max_level, total_moves, updated_at)
    VALUES (?, 1, 0, ?)
    ON CONFLICT(eitaa_user_id) DO NOTHING
  `).bind(eitaaUserId, now).run();

  // Fetch player + progress
  const player = await env.DB.prepare(`
    SELECT p.eitaa_user_id, p.first_name, p.last_name, p.username,
           p.best_score, p.total_levels,
           pp.max_level
    FROM players p
    JOIN player_progress pp ON pp.eitaa_user_id = p.eitaa_user_id
    WHERE p.eitaa_user_id = ?
  `).bind(eitaaUserId).first();

  if (!player) return errResponse('player not found', 500);

  return jsonResponse({
    player:   {
      eitaa_user_id: player.eitaa_user_id,
      first_name:    player.first_name,
      last_name:     player.last_name,
      username:      player.username,
      best_score:    player.best_score,
      total_levels:  player.total_levels,
    },
    maxLevel: player.max_level,
  });
}
