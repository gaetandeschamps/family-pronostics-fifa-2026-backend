function canSubmitPronostic(match) {
  const now = new Date();
  const kickoff = new Date(match.kickoff_utc);
  const minutesUntilKickoff = (kickoff - now) / 1000 / 60;
  return match.status === 'SCHEDULED' && minutesUntilKickoff > 15;
}

function getVisiblePronostics(requestingUser, match, pronostics) {
  if (requestingUser.role === 'admin') return pronostics;

  const matchStarted = ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(match.status);

  return pronostics.map(p => {
    const isOwn = p.user_id === requestingUser.id;
    if (isOwn || matchStarted) return p;
    return {
      user_id: p.user_id,
      user_name: p.user_name,
      has_predicted: true,
      home_score_prediction: null,
      away_score_prediction: null,
    };
  });
}

module.exports = { canSubmitPronostic, getVisiblePronostics };
