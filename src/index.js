require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const matchRoutes = require('./routes/matches');
const pronosticRoutes = require('./routes/pronostics');
const rankingRoutes = require('./routes/rankings');
const specialRuleRoutes = require('./routes/specialRules');
const adminRoutes = require('./routes/admin');

const { startCrons } = require('./cron/matchSync');
const { startEmailCron } = require('./cron/emailReminder');

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

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startCrons();
  startEmailCron();
});
