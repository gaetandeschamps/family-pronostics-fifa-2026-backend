// Point d'entrée pour le développement local uniquement
// En production Vercel, c'est api/index.js qui est utilisé
const app = require('./app');
const { startCrons } = require('./cron/matchSync');
const { startEmailCron } = require('./cron/emailReminder');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startCrons();
  startEmailCron();
});
