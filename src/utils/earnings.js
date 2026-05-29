function calculateEarnings(pronostic, match) {
  if (!pronostic || match.status !== 'FINISHED') return 0;
  if (match.home_score === null || match.away_score === null) return 0;

  const realOutcome = match.home_score > match.away_score ? 'HOME_WIN'
    : match.home_score < match.away_score ? 'AWAY_WIN'
    : 'DRAW';

  const correctScore =
    pronostic.home_score_prediction === match.home_score &&
    pronostic.away_score_prediction === match.away_score;

  if (correctScore) return 3;
  if (pronostic.predicted_outcome === realOutcome) return 1;
  return 0;
}

module.exports = { calculateEarnings };
