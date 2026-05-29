require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const matchRoutes = require('./routes/matches');
const pronosticRoutes = require('./routes/pronostics');
const rankingRoutes = require('./routes/rankings');
const specialRuleRoutes = require('./routes/specialRules');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/auth', authRoutes);
app.use('/matches', matchRoutes);
app.use('/pronostics', pronosticRoutes);
app.use('/rankings', rankingRoutes);
app.use('/special-rules', specialRuleRoutes);
app.use('/admin', adminRoutes);

// Vercel Cron endpoints — appelés par Vercel selon le planning dans vercel.json
function verifyCron(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/cron/sync-full', verifyCron, async (req, res) => {
  const { syncFullCalendar } = require('./services/footballData');
  await syncFullCalendar().catch(console.error);
  res.json({ ok: true });
});

app.get('/cron/sync-today', verifyCron, async (req, res) => {
  const { syncTodayMatches } = require('./services/footballData');
  await syncTodayMatches().catch(console.error);
  res.json({ ok: true });
});

app.get('/cron/sync-live', verifyCron, async (req, res) => {
  const { syncLiveMatches } = require('./services/footballData');
  await syncLiveMatches().catch(console.error);
  res.json({ ok: true });
});

app.get('/cron/email-reminder', verifyCron, async (req, res) => {
  const { sendDailyReminders } = require('./cron/emailReminder');
  await sendDailyReminders().catch(console.error);
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
