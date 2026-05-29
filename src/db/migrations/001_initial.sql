-- Création du schéma
CREATE SCHEMA IF NOT EXISTS fifa2026;

-- Table users
CREATE TABLE IF NOT EXISTS fifa2026.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_auth_id UUID UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'player')),
  timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
  dark_mode BOOLEAN NOT NULL DEFAULT true,
  push_subscription JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table matches
CREATE TABLE IF NOT EXISTS fifa2026.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id INTEGER UNIQUE NOT NULL,
  stage TEXT NOT NULL,
  group_name TEXT,
  match_day INTEGER,
  home_team_name TEXT NOT NULL,
  home_team_code TEXT NOT NULL,
  home_team_flag TEXT,
  away_team_name TEXT NOT NULL,
  away_team_code TEXT NOT NULL,
  away_team_flag TEXT,
  venue TEXT,
  city TEXT,
  kickoff_utc TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED')),
  home_score INTEGER,
  away_score INTEGER,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pronostics
CREATE TABLE IF NOT EXISTS fifa2026.pronostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES fifa2026.users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES fifa2026.matches(id) ON DELETE CASCADE,
  home_score_prediction INTEGER NOT NULL CHECK (home_score_prediction >= 0),
  away_score_prediction INTEGER NOT NULL CHECK (away_score_prediction >= 0),
  predicted_outcome TEXT GENERATED ALWAYS AS (
    CASE
      WHEN home_score_prediction > away_score_prediction THEN 'HOME_WIN'
      WHEN home_score_prediction < away_score_prediction THEN 'AWAY_WIN'
      ELSE 'DRAW'
    END
  ) STORED,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  earnings NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- Table special_rules
CREATE TABLE IF NOT EXISTS fifa2026.special_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES fifa2026.matches(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  reward_amount NUMERIC(5,2) NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('global_top_scorer', 'global_champion', 'match_specific')),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table special_rule_predictions
CREATE TABLE IF NOT EXISTS fifa2026.special_rule_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  special_rule_id UUID NOT NULL REFERENCES fifa2026.special_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES fifa2026.users(id) ON DELETE CASCADE,
  prediction TEXT NOT NULL,
  is_correct BOOLEAN,
  earnings NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(special_rule_id, user_id)
);

-- Table group_standings
CREATE TABLE IF NOT EXISTS fifa2026.group_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name TEXT NOT NULL,
  team_name TEXT NOT NULL,
  team_code TEXT NOT NULL,
  played INTEGER DEFAULT 0,
  won INTEGER DEFAULT 0,
  drawn INTEGER DEFAULT 0,
  lost INTEGER DEFAULT 0,
  goals_for INTEGER DEFAULT 0,
  goals_against INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_name, team_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON fifa2026.matches(kickoff_utc);
CREATE INDEX IF NOT EXISTS idx_matches_status ON fifa2026.matches(status);
CREATE INDEX IF NOT EXISTS idx_pronostics_user ON fifa2026.pronostics(user_id);
CREATE INDEX IF NOT EXISTS idx_pronostics_match ON fifa2026.pronostics(match_id);

-- Seed règles spéciales
INSERT INTO fifa2026.special_rules (title, description, reward_amount, rule_type, is_locked)
VALUES
  ('Meilleur buteur', 'Joueur qui marque le plus de buts dans la compétition', 10.00, 'global_top_scorer', false),
  ('Équipe championne', 'Équipe qui remporte la Coupe du Monde 2026', 10.00, 'global_champion', false)
ON CONFLICT DO NOTHING;
