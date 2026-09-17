// Eitaa WebApp initData validation using Web Crypto API

export interface EitaaUser {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface ValidationResult {
  valid: boolean;
  user?: EitaaUser;
  authDate?: number;
  error?: string;
}

// Convert ArrayBuffer to Hex string
function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

// Timing-safe comparison of two hex strings
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function validateEitaaInitData(
  initData: string,
  botToken: string,
  allowDevMode = false
): Promise<ValidationResult> {
  if (!initData || typeof initData !== "string") {
    return { valid: false, error: "داده‌های احراز هویت ایتا موجود نیست" };
  }

  // Support development bypass if explicitly enabled and in non-production
  if (allowDevMode && initData.startsWith("dev_user_")) {
    const devId = initData.replace("dev_user_", "");
    return {
      valid: true,
      user: {
        id: devId,
        first_name: "کاربر آزمایشی",
        username: `dev_${devId}`,
      },
      authDate: Math.floor(Date.now() / 1000),
    };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");

    if (!hash) {
      return { valid: false, error: "امضای امنیتی (hash) یافت نشد" };
    }

    params.delete("hash");

    // Sort parameters alphabetically by key
    const pairs: string[] = [];
    for (const [key, value] of params.entries()) {
      pairs.push(`${key}=${value}`);
    }
    pairs.sort();
    const dataCheckString = pairs.join("\n");

    const encoder = new TextEncoder();

    // Step 1: HMAC-SHA256("WebAppData", botToken) -> secret_key
    const secretKeyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode("WebAppData"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const secretKeyBytes = await crypto.subtle.sign(
      "HMAC",
      secretKeyMaterial,
      encoder.encode(botToken)
    );

    // Step 2: HMAC-SHA256(secret_key, dataCheckString) -> final_hash
    const finalKey = await crypto.subtle.importKey(
      "raw",
      secretKeyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const finalHashBuffer = await crypto.subtle.sign(
      "HMAC",
      finalKey,
      encoder.encode(dataCheckString)
    );
    const calculatedHash = bufToHex(finalHashBuffer);

    if (!safeCompare(calculatedHash, hash)) {
      return { valid: false, error: "امضای امنیتی داده‌ها نامعتبر است" };
    }

    // Validate auth_date freshness (allow up to 24 hours = 86400 seconds)
    const authDateStr = params.get("auth_date");
    const authDate = authDateStr ? parseInt(authDateStr, 10) : 0;
    const now = Math.floor(Date.now() / 1000);

    if (now - authDate > 86400) {
      return { valid: false, error: "نشست کاربری منقضی شده است. لطفاً برنامه را مجدداً باز کنید" };
    }

    // Parse user info
    const userRaw = params.get("user");
    let user: EitaaUser | undefined;
    if (userRaw) {
      const parsed = JSON.parse(userRaw);
      user = {
        id: String(parsed.id),
        first_name: parsed.first_name || "",
        last_name: parsed.last_name || "",
        username: parsed.username || "",
        language_code: parsed.language_code || "fa",
      };
    } else {
      user = {
        id: params.get("query_id") || `anonymous_${Date.now()}`,
        first_name: "کاربر ایتا",
      };
    }

    return {
      valid: true,
      user,
      authDate,
    };
  } catch (err) {
    return {
      valid: false,
      error: `خطا در بررسی داده‌های امنیتی: ${err instanceof Error ? err.message : "خطای ناشناخته"}`,
    };
  }
}
