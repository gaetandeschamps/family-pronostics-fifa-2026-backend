const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');
const { authMiddleware } = require('../middleware/auth');

router.post('/verify', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  const { data: profile } = await supabase
    .schema('fifa2026').from('users').select('*')
    .eq('supabase_auth_id', user.id).single();
  res.json({ user: profile });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

router.put('/preferences', authMiddleware, async (req, res) => {
  const { dark_mode, push_subscription } = req.body;
  const updates = {};
  if (dark_mode !== undefined) updates.dark_mode = dark_mode;
  if (push_subscription !== undefined) updates.push_subscription = push_subscription;
  const { data, error } = await supabase
    .schema('fifa2026').from('users').update(updates)
    .eq('id', req.user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

module.exports = router;
