// Supabase Edge Functions CORS helper

const ALLOWED_ORIGINS = [
  // Local development
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:8080",
];

export function getCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("Origin") || "";
  const configuredOrigin = Deno.env.get("ALLOWED_ORIGIN");

  let isAllowed = false;

  if (configuredOrigin && (origin === configuredOrigin || configuredOrigin === "*")) {
    isAllowed = true;
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    isAllowed = true;
  } else if (origin.endsWith(".github.io")) {
    // Allows user's GitHub Pages domain
    isAllowed = true;
  } else if (origin.includes("eitaa.com")) {
    // Eitaa web iframe
    isAllowed = true;
  }

  const allowOrigin = isAllowed ? origin : (ALLOWED_ORIGINS[0] || "*");

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

export function handleCorsPreflight(request: Request): Response | null {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }
  return null;
}
