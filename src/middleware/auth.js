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

  // 1. Cherche par supabase_auth_id
  let { data: profile } = await supabase
    .schema('app_pronostics').from('users').select('*')
    .eq('supabase_auth_id', user.id).single();

  // 2. Cherche par email (pré-seed sans auth_id)
  if (!profile) {
    const { data: byEmail } = await supabase
      .schema('app_pronostics').from('users').select('*')
      .eq('email', user.email).single();

    if (byEmail) {
      // Lie le compte Supabase Auth au profil existant
      await supabase.schema('app_pronostics').from('users')
        .update({ supabase_auth_id: user.id }).eq('id', byEmail.id);
      profile = { ...byEmail, supabase_auth_id: user.id };
    }
  }

  // 3. Crée automatiquement un profil si aucun n'existe
  if (!profile) {
    const name = user.email.split('@')[0];
    const { data: created } = await supabase
      .schema('app_pronostics').from('users').insert({
        supabase_auth_id: user.id,
        email: user.email,
        name,
        role: 'player',
        timezone: 'Europe/Paris',
        dark_mode: true,
      }).select().single();
    profile = created;
  }

  if (!profile) return res.status(403).json({ error: 'Could not create profile' });

  req.user = profile;
  next();
}

module.exports = { authMiddleware };
