const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  const { data: players } = await supabase
    .schema('app_pronostics').from('users').select('id, name, email').in('role', ['player', 'admin']);
  const rankings = await Promise.all((players ?? []).map(async player => {
    const { data: pronostics } = await supabase
      .schema('app_pronostics').from('pronostics').select('*').eq('user_id', player.id);
    const { count: finished_matches } = await supabase
      .schema('app_pronostics').from('matches').select('*', { count: 'exact', head: true }).eq('status', 'FINISHED');
    const total_earnings = pronostics?.reduce((sum, p) => sum + (Number(p.earnings) || 0), 0) ?? 0;
    const correct_scores = pronostics?.filter(p => Number(p.earnings) >= 3).length ?? 0;
    const correct_outcomes = pronostics?.filter(p => Number(p.earnings) >= 1).length ?? 0;
    const predicted_count = pronostics?.length ?? 0;
    const missed = Math.max(0, (finished_matches ?? 0) - predicted_count);
    return { ...player, total_earnings, correct_scores, correct_outcomes, missed, predicted_count,
      total_points: correct_scores * 3 + (correct_outcomes - correct_scores) };
  }));
  rankings.sort((a, b) => b.total_earnings - a.total_earnings);
  const { data: special_rules } = await supabase.schema('app_pronostics').from('special_rules').select('*');
  res.json({ players: rankings, special_rules });
});

// Pronostics terminés d'un joueur spécifique (visibles seulement après que le match a commencé)
router.get('/player/:playerId/history', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .schema('app_pronostics').from('pronostics')
    .select('*, match:match_id(*)')
    .eq('user_id', req.params.playerId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  // Ne retourner que les matchs qui ont commencé (visibilité respectée)
  const visible = (data ?? []).filter(p =>
    ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(p.match?.status)
  );
  res.json(visible);
});

router.get('/standings', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .schema('app_pronostics').from('group_standings').select('*')
    .order('group_name').order('points', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
