const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  const { data: profile, error: profileError } = await supabase
    .schema('fifa2026')
    .from('users')
    .select('*')
    .eq('supabase_auth_id', user.id)
    .single();

  if (profileError || !profile) return res.status(403).json({ error: 'Profile not found' });

  req.user = profile;
  next();
}

module.exports = { authMiddleware };
