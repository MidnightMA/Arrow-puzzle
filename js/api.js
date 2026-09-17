/**
 * Supabase Edge Functions API Client
 * Only communicates via Edge Functions, never directly with PostgreSQL.
 */

import { Eitaa } from "./eitaa.js";

// Configurable API base URL: defaults to placeholder or runtime config
const DEFAULT_CONFIG = {
  // Replace with your real Supabase project Edge Function URL:
  // e.g. "https://<your-project-ref>.supabase.co/functions/v1/api"
  apiBaseUrl: window.ARROW_PUZZLE_CONFIG?.apiBaseUrl || "",
};

export const Api = {
  baseUrl: DEFAULT_CONFIG.apiBaseUrl,

  setBaseUrl(url) {
    this.baseUrl = (url || "").replace(/\/$/, "");
  },

  isConfigured() {
    return Boolean(this.baseUrl && this.baseUrl.startsWith("http"));
  },

  async request(action, options = {}) {
    if (!this.isConfigured()) {
      // Offline / Local mode fallback
      return this.handleOfflineFallback(action, options);
    }

    const method = options.method || (options.body ? "POST" : "GET");
    const url = new URL(this.baseUrl);
    url.searchParams.set("action", action);

    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        url.searchParams.set(key, String(value));
      }
    }

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        throw new Error(body.error || `خطا در ارتباط با سرور (${response.status})`);
      }

      return body.data;
    } catch (err) {
      console.warn(`API request to '${action}' failed:`, err);
      // Fallback to local data so gameplay continues uninterrupted
      return this.handleOfflineFallback(action, options);
    }
  },

  // Authenticate user with server
  async authenticate() {
    const initData = Eitaa.getRawInitData();
    return this.request("auth", {
      method: "POST",
      body: { initData },
    });
  },

  // Submit level score
  async submitScore({ level, score, moves, timeSeconds, stars }) {
    const initData = Eitaa.getRawInitData();
    return this.request("score", {
      method: "POST",
      body: {
        initData,
        level,
        score,
        moves,
        timeSeconds,
        stars,
      },
    });
  },

  // Fetch top leaderboard
  async getLeaderboard(limit = 20) {
    return this.request("leaderboard", {
      method: "GET",
      params: { limit },
    });
  },

  // Graceful offline fallback when Edge Function is not yet deployed or network is unreachable
  handleOfflineFallback(action, options) {
    if (action === "auth") {
      const user = Eitaa.getUser();
      return {
        player: {
          id: user.id || "local_player",
          firstName: user.first_name || "بازیکن",
          username: user.username || "player",
          highestLevel: parseInt(localStorage.getItem("arrow_puzzle_highest_level") || "1", 10),
          totalScore: parseInt(localStorage.getItem("arrow_puzzle_total_score") || "0", 10),
        },
      };
    }

    if (action === "score") {
      const { level, score } = options.body || {};
      const currentHighest = parseInt(localStorage.getItem("arrow_puzzle_highest_level") || "1", 10);
      const currentTotal = parseInt(localStorage.getItem("arrow_puzzle_total_score") || "0", 10);

      const nextLevel = Math.max(currentHighest, (level || 1) + 1);
      const newTotal = currentTotal + (score || 0);

      localStorage.setItem("arrow_puzzle_highest_level", String(nextLevel));
      localStorage.setItem("arrow_puzzle_total_score", String(newTotal));

      return {
        level,
        score,
        highestLevel: nextLevel,
        totalScore: newTotal,
      };
    }

    if (action === "leaderboard") {
      const localLevel = parseInt(localStorage.getItem("arrow_puzzle_highest_level") || "1", 10);
      const localScore = parseInt(localStorage.getItem("arrow_puzzle_total_score") || "0", 10);
      const user = Eitaa.getUser();

      return {
        leaderboard: [
          { rank: 1, name: "علی رادین", level: 14, score: 18200 },
          { rank: 2, name: "مریم احمدی", level: 12, score: 15400 },
          { rank: 3, name: "رضا پازل", level: 10, score: 12100 },
          { rank: 4, name: "سارا کاویانی", level: 9, score: 9800 },
          { rank: 5, name: user.first_name || "شما", level: localLevel, score: localScore },
        ],
      };
    }

    return null;
  },
};
