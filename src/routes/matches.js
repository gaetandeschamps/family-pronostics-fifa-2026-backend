const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');
const { authMiddleware } = require('../middleware/auth');
const { getVisiblePronostics } = require('../utils/pronosticRules');

router.get('/today', authMiddleware, async (req, res) => {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(now); endOfDay.setUTCHours(23, 59, 59, 999);
  const { data: matches, error } = await supabase
    .schema('fifa2026').from('matches').select('*')
    .gte('kickoff_utc', startOfDay.toISOString())
    .lte('kickoff_utc', endOfDay.toISOString())
    .order('kickoff_utc');
  if (error) return res.status(500).json({ error: error.message });
  const results = await Promise.all(matches.map(async match => {
    const { data: pronostic } = await supabase
      .schema('fifa2026').from('pronostics').select('*')
      .eq('match_id', match.id).eq('user_id', req.user.id).single();
    return { match, my_pronostic: pronostic };
  }));
  res.json(results);
});

router.get('/all', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .schema('fifa2026').from('matches').select('*').order('kickoff_utc');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/:id', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .schema('fifa2026').from('matches').select('*')
    .eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Match not found' });
  res.json(data);
});

router.get('/:id/pronostics', authMiddleware, async (req, res) => {
  const { data: match } = await supabase
    .schema('fifa2026').from('matches').select('*').eq('id', req.params.id).single();
  if (!match) return res.status(404).json({ error: 'Match not found' });
  const { data: pronostics } = await supabase
    .schema('fifa2026').from('pronostics')
    .select('*, user:user_id(name)').eq('match_id', req.params.id);
  const visible = getVisiblePronostics(
    req.user, match,
    (pronostics ?? []).map(p => ({ ...p, user_name: p.user?.name }))
  );
  res.json(visible);
});

module.exports = router;
