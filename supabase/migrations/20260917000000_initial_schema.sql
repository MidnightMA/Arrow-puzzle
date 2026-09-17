-- Schema for Arrow Puzzle (پازل جهت‌ها) - Eitaa Mini App

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Players table
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eitaa_id TEXT UNIQUE NOT NULL,
    first_name TEXT,
    username TEXT,
    highest_level INT NOT NULL DEFAULT 1,
    total_score INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scores table for completed levels
CREATE TABLE IF NOT EXISTS public.scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    level INT NOT NULL,
    score INT NOT NULL,
    moves INT NOT NULL,
    time_seconds INT NOT NULL,
    stars INT NOT NULL DEFAULT 1 CHECK (stars BETWEEN 1 AND 3),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indexes for leaderboard and profile queries
CREATE INDEX IF NOT EXISTS idx_players_eitaa_id ON public.players(eitaa_id);
CREATE INDEX IF NOT EXISTS idx_players_ranking ON public.players(highest_level DESC, total_score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_player_id ON public.scores(player_id);
CREATE INDEX IF NOT EXISTS idx_scores_level_leaderboard ON public.scores(level, score DESC, submitted_at ASC);

-- Row Level Security
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Service role has full permissions for Edge Functions
CREATE POLICY "Service role full access on players"
    ON public.players
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on scores"
    ON public.scores
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Public access is read-only for leaderboard through Data API if needed,
-- but Edge Functions are the primary API boundary.
CREATE POLICY "Public read players leaderboard"
    ON public.players
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Public read scores"
    ON public.scores
    FOR SELECT
    TO anon, authenticated
    USING (true);
