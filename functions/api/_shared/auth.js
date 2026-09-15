/**
 * functions/api/_shared/auth.js
 *
 * Shared initData HMAC-SHA256 verification using Web Crypto (Workers runtime).
 * NEVER expose EITAA_TOKEN to the client.
 */

const MAX_AGE_SECONDS = 3600; // reject initData older than 1 hour

/**
 * Verify Eitaa initData HMAC and return parsed user data.
 *
 * @param {string} initData  raw initData query string from client
 * @param {string} token     Eitaa app token (from env.EITAA_TOKEN)
 * @returns {Promise<{ user: object, authDate: number }>}
 * @throws {Error} on any verification failure
 */
export async function verifyInitData(initData, token) {
  if (!initData || typeof initData !== 'string' || initData.trim() === '') {
    throw new Error('initData missing');
  }
  if (!token) {
    throw new Error('server misconfiguration');
  }

  // Parse the query string
  let params;
  try {
    params = new URLSearchParams(initData);
  } catch {
    throw new Error('malformed initData');
  }

  const hash = params.get('hash');
  if (!hash) throw new Error('hash missing');

  // Build data-check string: key=value pairs sorted alphabetically, excluding hash
  const entries = [];
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue;
    entries.push(`${key}=${value}`);
  }
  entries.sort();
  const dataCheckString = entries.join('\n');

  // auth_date freshness check
  const authDateRaw = params.get('auth_date');
  if (!authDateRaw) throw new Error('auth_date missing');
  const authDate = parseInt(authDateRaw, 10);
  if (isNaN(authDate)) throw new Error('auth_date invalid');
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age > MAX_AGE_SECONDS) throw new Error('initData expired');
  if (age < -60) throw new Error('auth_date in future');

  // Derive secret key: HMAC-SHA256("WebAppData", token)
  const enc = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const secretKeyBytes = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode(token));

  // HMAC-SHA256(secretKey, dataCheckString)
  const hmacKey = await crypto.subtle.importKey(
    'raw', secretKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sigBytes = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(dataCheckString));

  // Convert to lowercase hex
  const computedHash = Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison (compare every byte before short-circuiting)
  if (!safeEqual(computedHash, hash)) {
    throw new Error('hash mismatch');
  }

  // Parse user object from the "user" field
  const userRaw = params.get('user');
  let user = null;
  if (userRaw) {
    try { user = JSON.parse(userRaw); } catch { throw new Error('user field invalid'); }
  }
  if (!user || !user.id) throw new Error('user data missing');

  return { user, authDate };
}

/** Compare two strings without early-exit (mitigates timing side-channels). */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Standard JSON error response. */
export function errResponse(message, status = 400) {
  return Response.json({ error: 'خطای احراز هویت' }, { status });
}

/** Standard JSON response with CORS headers safe for Eitaa iframe. */
export function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
