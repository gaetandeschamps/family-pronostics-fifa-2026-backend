const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');
const { authMiddleware } = require('../middleware/auth');
const { canSubmitPronostic } = require('../utils/pronosticRules');

router.post('/', authMiddleware, async (req, res) => {
  const { match_id, home_score_prediction, away_score_prediction } = req.body;
  if (home_score_prediction === undefined || away_score_prediction === undefined || !match_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const { data: match } = await supabase
    .schema('app_pronostics').from('matches').select('*').eq('id', match_id).single();
  if (!match) return res.status(404).json({ error: 'Match not found' });
  if (!canSubmitPronostic(match)) return res.status(403).json({ error: 'Pronostic is locked' });
  const { data, error } = await supabase
    .schema('app_pronostics').from('pronostics').upsert({
      user_id: req.user.id, match_id,
      home_score_prediction, away_score_prediction,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,match_id' }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Mes pronostics avec détails du match
router.get('/my', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .schema('app_pronostics').from('pronostics')
    .select('*, match:match_id(*)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Statuts de tous les joueurs pour tous les matchs (pour la vue Programme)
router.get('/all-statuses', authMiddleware, async (req, res) => {
  const { data: players } = await supabase
    .schema('app_pronostics').from('users')
    .select('id, name').eq('role', 'player');

  const { data: pronostics } = await supabase
    .schema('app_pronostics').from('pronostics')
    .select('user_id, match_id, home_score_prediction, away_score_prediction');

  const { data: matches } = await supabase
    .schema('app_pronostics').from('matches')
    .select('id, status');

  if (!pronostics || !matches || !players) return res.status(500).json({ error: 'DB error' });

  const matchStatusMap = {};
  matches.forEach(m => { matchStatusMap[m.id] = m.status; });

  // Grouper par match_id
  const byMatch = {};
  for (const player of players) {
    const playerPronos = pronostics.filter(p => p.user_id === player.id);
    for (const p of playerPronos) {
      if (!byMatch[p.match_id]) byMatch[p.match_id] = [];
      const matchStatus = matchStatusMap[p.match_id];
      const matchStarted = ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(matchStatus);
      const isOwn = player.id === req.user.id;
      const showScores = matchStarted || isOwn || req.user.role === 'admin';

      byMatch[p.match_id].push({
        player_id: player.id,
        name: player.name,
        has_predicted: true,
        home_score_prediction: showScores ? p.home_score_prediction : null,
        away_score_prediction: showScores ? p.away_score_prediction : null,
      });
    }
    // Ajouter les joueurs qui n'ont pas pronostiqué pour ce match
  }

  // Ajouter les joueurs sans pronostic pour chaque match connu
  for (const match of matches) {
    if (!byMatch[match.id]) byMatch[match.id] = [];
    for (const player of players) {
      if (!byMatch[match.id].find(s => s.player_id === player.id)) {
        byMatch[match.id].push({
          player_id: player.id,
          name: player.name,
          has_predicted: false,
          home_score_prediction: null,
          away_score_prediction: null,
        });
      }
    }
  }

  res.json(byMatch);
});

module.exports = router;
