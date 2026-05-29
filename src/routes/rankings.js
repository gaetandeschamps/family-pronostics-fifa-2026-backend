const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  const { data: players } = await supabase
    .schema('fifa2026').from('users').select('id, name, email').eq('role', 'player');
  const rankings = await Promise.all((players ?? []).map(async player => {
    const { data: pronostics } = await supabase
      .schema('fifa2026').from('pronostics').select('*').eq('user_id', player.id);
    const total_earnings = pronostics?.reduce((sum, p) => sum + (Number(p.earnings) || 0), 0) ?? 0;
    const correct_scores = pronostics?.filter(p => Number(p.earnings) >= 3).length ?? 0;
    const correct_outcomes = pronostics?.filter(p => Number(p.earnings) >= 1).length ?? 0;
    return { ...player, total_earnings, correct_scores, correct_outcomes,
      total_points: correct_scores * 3 + (correct_outcomes - correct_scores) };
  }));
  rankings.sort((a, b) => b.total_earnings - a.total_earnings);
  const { data: special_rules } = await supabase.schema('fifa2026').from('special_rules').select('*');
  res.json({ players: rankings, special_rules });
});

router.get('/standings', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .schema('fifa2026').from('group_standings').select('*')
    .order('group_name').order('points', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
