const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendReminderEmail(player, matches) {
  if (!resend) return;
  const matchList = matches.map(m => {
    const kickoff = new Date(m.kickoff_utc);
    const paris = kickoff.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
    const montreal = kickoff.toLocaleTimeString('fr-FR', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit' });
    return `<li><strong>${m.home_team_name} vs ${m.away_team_name}</strong> — ${paris} (Paris) / ${montreal} (Montréal)</li>`;
  }).join('\n');

  await resend.emails.send({
    from: 'Pronostics FIFA 2026 <noreply@pronostics.family>',
    to: player.email,
    subject: `🏆 Tu as ${matches.length} pronostic(s) à faire pour demain !`,
    html: `
      <h2>Bonjour ${player.name} ! 👋</h2>
      <p>Tu n'as pas encore pronostiqué ces matchs de demain :</p>
      <ul>${matchList}</ul>
      <p><a href="${process.env.FRONTEND_URL}" style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px;">Faire mes pronostics →</a></p>
      <p style="color:#666;font-size:12px;">Pronostics famille FIFA 2026.</p>
    `,
  });
}

module.exports = { sendReminderEmail };
