const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  const { data: rules } = await supabase.schema('app_pronostics').from('special_rules').select('*');
  const { data: predictions } = await supabase
    .schema('app_pronostics').from('special_rule_predictions').select('*').eq('user_id', req.user.id);
  const predMap = {};
  predictions?.forEach(p => { predMap[p.special_rule_id] = p; });
  res.json(rules?.map(r => ({ ...r, my_prediction: predMap[r.id] ?? null })));
});

router.post('/:id/predict', authMiddleware, async (req, res) => {
  const { prediction } = req.body;
  if (!prediction) return res.status(400).json({ error: 'Missing prediction' });
  const { data: rule } = await supabase
    .schema('app_pronostics').from('special_rules').select('*').eq('id', req.params.id).single();
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  if (rule.is_locked) return res.status(403).json({ error: 'Rule is locked' });
  const { data, error } = await supabase
    .schema('app_pronostics').from('special_rule_predictions').upsert({
      special_rule_id: req.params.id, user_id: req.user.id, prediction,
    }, { onConflict: 'special_rule_id,user_id' }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

module.exports = router;
