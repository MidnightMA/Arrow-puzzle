// Supabase Edge Function: Arrow Puzzle API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { validateEitaaInitData } from "../_shared/eitaa-auth.ts";

Deno.serve(async (req: Request) => {
  // 1. Handle CORS preflight
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/functions\/v1\/api/, "").replace(/^\//, "");
  const actionParam = url.searchParams.get("action");
  const action = actionParam || path || "health";

  // Helper response functions
  const jsonResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });

  const errorResponse = (message: string, code = "BAD_REQUEST", status = 400) =>
    jsonResponse({ ok: false, error: message, code }, status);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const eitaaToken = Deno.env.get("EITAA_BOT_TOKEN") || "mock_secret_for_local_dev";
    const allowDevMode = Deno.env.get("ALLOW_DEV_LOGIN") === "true" || !Deno.env.get("EITAA_BOT_TOKEN");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ==========================================
    // ACTION: health
    // ==========================================
    if (action === "health" || action === "") {
      return jsonResponse({
        ok: true,
        data: {
          app: "Arrow Puzzle API",
          status: "healthy",
          timestamp: new Date().toISOString(),
        },
      });
    }

    // ==========================================
    // ACTION: leaderboard (GET)
    // ==========================================
    if (action === "leaderboard" && req.method === "GET") {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 50);

      const { data, error } = await supabase
        .from("players")
        .select("id, first_name, username, highest_level, total_score")
        .order("highest_level", { ascending: false })
        .order("total_score", { ascending: false })
        .limit(limit);

      if (error) {
        return errorResponse("خطا در دریافت جدول برترین‌ها", "DB_ERROR", 500);
      }

      // Anonymize/format usernames
      const formatted = (data || []).map((p, idx) => ({
        rank: idx + 1,
        name: p.first_name || p.username || `کاربر ${p.id.slice(0, 4)}`,
        level: p.highest_level,
        score: p.total_score,
      }));

      return jsonResponse({
        ok: true,
        data: {
          leaderboard: formatted,
        },
      });
    }

    // ==========================================
    // ACTION: auth / me (POST)
    // ==========================================
    if ((action === "auth" || action === "me") && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { initData } = body;

      const authResult = await validateEitaaInitData(initData, eitaaToken, allowDevMode);
      if (!authResult.valid || !authResult.user) {
        return errorResponse(authResult.error || "احراز هویت کاربر ناموفق بود", "AUTH_FAILED", 401);
      }

      const eitaaUser = authResult.user;

      // Upsert player in Postgres
      const { data: player, error: upsertError } = await supabase
        .from("players")
        .upsert(
          {
            eitaa_id: eitaaUser.id,
            first_name: eitaaUser.first_name || null,
            username: eitaaUser.username || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "eitaa_id" }
        )
        .select()
        .single();

      if (upsertError) {
        return errorResponse("خطا در ذخیره مشخصات کاربر", "DB_ERROR", 500);
      }

      return jsonResponse({
        ok: true,
        data: {
          player: {
            id: player.id,
            firstName: player.first_name,
            username: player.username,
            highestLevel: player.highest_level,
            totalScore: player.total_score,
          },
        },
      });
    }

    // ==========================================
    // ACTION: score (POST)
    // ==========================================
    if (action === "score" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { initData, level, score, moves, timeSeconds, stars } = body;

      // 1. Authenticate user
      const authResult = await validateEitaaInitData(initData, eitaaToken, allowDevMode);
      if (!authResult.valid || !authResult.user) {
        return errorResponse(authResult.error || "خطای احراز هویت", "AUTH_FAILED", 401);
      }

      // 2. Server-side validation of gameplay numbers
      const parsedLevel = parseInt(level, 10);
      const parsedScore = parseInt(score, 10);
      const parsedMoves = parseInt(moves, 10);
      const parsedTime = parseInt(timeSeconds, 10);
      const parsedStars = parseInt(stars, 10);

      if (
        isNaN(parsedLevel) || parsedLevel < 1 ||
        isNaN(parsedScore) || parsedScore < 0 ||
        isNaN(parsedMoves) || parsedMoves < 4 ||
        isNaN(parsedTime) || parsedTime < 1 ||
        isNaN(parsedStars) || parsedStars < 1 || parsedStars > 3
      ) {
        return errorResponse("اطلاعات امتیاز ارسالی نامعتبر است", "INVALID_INPUT", 400);
      }

      // Theoretical maximum score check (prevents cheat scripts submitting 1,000,000 pts)
      const maxPossibleScore = parsedLevel * 2000 + 3000;
      if (parsedScore > maxPossibleScore) {
        return errorResponse("امتیاز ثبت شده خارج از محدوده مجاز بازی است", "CHEAT_DETECTED", 400);
      }

      // 3. Find player
      const { data: player, error: fetchError } = await supabase
        .from("players")
        .select("id, highest_level, total_score")
        .eq("eitaa_id", authResult.user.id)
        .single();

      if (fetchError || !player) {
        return errorResponse("کاربر یافت نشد", "USER_NOT_FOUND", 404);
      }

      // 4. Record score in scores table
      await supabase.from("scores").insert({
        player_id: player.id,
        level: parsedLevel,
        score: parsedScore,
        moves: parsedMoves,
        time_seconds: parsedTime,
        stars: parsedStars,
      });

      // 5. Update player's aggregate stats
      const nextLevel = Math.max(player.highest_level, parsedLevel + 1);
      const newTotalScore = player.total_score + parsedScore;

      const { data: updatedPlayer, error: updateError } = await supabase
        .from("players")
        .update({
          highest_level: nextLevel,
          total_score: newTotalScore,
          updated_at: new Date().toISOString(),
        })
        .eq("id", player.id)
        .select()
        .single();

      if (updateError) {
        return errorResponse("خطا در به‌روزرسانی امتیازات کاربر", "DB_ERROR", 500);
      }

      return jsonResponse({
        ok: true,
        data: {
          level: parsedLevel,
          score: parsedScore,
          highestLevel: updatedPlayer.highest_level,
          totalScore: updatedPlayer.total_score,
        },
      });
    }

    return errorResponse(`اکشن '${action}' پشتیبانی نمی‌شود`, "NOT_FOUND", 404);
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: "خطای داخلی سرور",
        code: "INTERNAL_SERVER_ERROR",
        details: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
});
