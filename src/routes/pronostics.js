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
    .schema('fifa2026').from('matches').select('*').eq('id', match_id).single();
  if (!match) return res.status(404).json({ error: 'Match not found' });
  if (!canSubmitPronostic(match)) return res.status(403).json({ error: 'Pronostic is locked' });
  const { data, error } = await supabase
    .schema('fifa2026').from('pronostics').upsert({
      user_id: req.user.id, match_id,
      home_score_prediction, away_score_prediction,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,match_id' }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/my', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .schema('fifa2026').from('pronostics').select('*')
    .eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
