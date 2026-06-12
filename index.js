const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const API_KEY = '46d72b004a13cdf6fb4ab3a747178297';
const BASE = 'https://api.the-odds-api.com/v4';

const SPORT_KEYS = {
  football: 'soccer_fifa_world_cup',
  basketball: 'basketball_nba',
  hockey: 'icehockey_nhl',
  tennis: 'tennis_wta_queens_club_champ',
  mma: 'mma_mixed_martial_arts',
  baseball: 'baseball_mlb'
};

async function fetchOdds(sportKey) {
  try {
    const res = await axios.get(`${BASE}/sports/${sportKey}/odds`, {
      params: {
        apiKey: API_KEY,
        regions: 'eu',
        markets: 'h2h',
        oddsFormat: 'decimal',
        dateFormat: 'iso'
      },
      timeout: 8000
    });
    return res.data || [];
  } catch (e) {
    console.error('Odds API error:', e.message);
    return [];
  }
}

function formatFixture(game, sport) {
  const bookmakers = game.bookmakers || [];
  let homeOdd = null, awayOdd = null, drawOdd = null;

  for (const bm of bookmakers) {
    const h2h = bm.markets.find(m => m.key === 'h2h');
    if (h2h) {
      homeOdd = h2h.outcomes.find(o => o.name === game.home_team)?.price || null;
      awayOdd = h2h.outcomes.find(o => o.name === game.away_team)?.price || null;
      drawOdd = h2h.outcomes.find(o => o.name === 'Draw')?.price || null;
      break;
    }
  }

  return {
    id: game.id,
    sport,
    league: game.sport_title,
    date: game.commence_time,
    status: new Date(game.commence_time) > new Date() ? 'NS' : 'LIVE',
    home: { name: game.home_team, score: null },
    away: { name: game.away_team, score: null },
    markets: {
      h2h: { home: homeOdd, draw: drawOdd, away: awayOdd }
    }
  };
}

app.get('/api/fixtures', async (req, res) => {
  const { sport = 'football' } = req.query;
  const sportKey = SPORT_KEYS[sport] || SPORT_KEYS.football;
  try {
    const games = await fetchOdds(sportKey);
    const fixtures = games.map(g => formatFixture(g, sport));
    res.json({ success: true, count: fixtures.length, fixtures });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/live', async (req, res) => {
  try {
    const games = await fetchOdds(SPORT_KEYS.football);
    const now = new Date();
    const live = games.filter(g => {
      const start = new Date(g.commence_time);
      const diff = (now - start) / 60000;
      return diff > 0 && diff < 120;
    }).map(g => formatFixture(g, 'football'));
    res.json({ success: true, count: live.length, fixtures: live });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/sports', async (req, res) => {
  try {
    const result = await axios.get(`${BASE}/sports`, {
      params: { apiKey: API_KEY },
      timeout: 8000
    });
    res.json({ success: true, data: result.data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'OKAY is live', time: new Date().toISOString() });
});

module.exports = app;
if (require.main === module) {
  app.listen(3000, () => console.log('OKAY running on port 3000'));
}
