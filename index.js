const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const API_KEY = '46d72b004a13cdf6fb4ab3a747178297';
const BASE = 'https://api.the-odds-api.com/v4';

const ALL_SPORTS = [
  { key: 'soccer_fifa_world_cup', sport: 'football' },
  { key: 'soccer_brazil_serie_b', sport: 'football' },
  { key: 'soccer_chile_campeonato', sport: 'football' },
  { key: 'soccer_china_superleague', sport: 'football' },
  { key: 'soccer_conmebol_copa_libertadores', sport: 'football' },
  { key: 'soccer_norway_eliteserien', sport: 'football' },
  { key: 'soccer_sweden_allsvenskan', sport: 'football' },
  { key: 'soccer_league_of_ireland', sport: 'football' },
  { key: 'basketball_nba', sport: 'basketball' },
  { key: 'basketball_wnba', sport: 'basketball' },
  { key: 'icehockey_nhl', sport: 'hockey' },
  { key: 'tennis_wta_queens_club_champ', sport: 'tennis' },
  { key: 'mma_mixed_martial_arts', sport: 'mma' },
  { key: 'baseball_mlb', sport: 'baseball' },
  { key: 'americanfootball_ufl', sport: 'nfl' },
];

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

function isToday(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function isTomorrow(dateStr) {
  const d = new Date(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();
}

app.get('/api/fixtures', async (req, res) => {
  const { day = 'today', sport = 'all' } = req.query;

  try {
    const sportsToFetch = sport === 'all'
      ? ALL_SPORTS
      : ALL_SPORTS.filter(s => s.sport === sport);

    const results = await Promise.allSettled(
      sportsToFetch.map(s => fetchOdds(s.key).then(games =>
        games.map(g => formatFixture(g, s.sport))
      ))
    );

    let fixtures = results.flatMap(r =>
      r.status === 'fulfilled' ? r.value : []
    );

    if (day === 'today') {
      fixtures = fixtures.filter(f => isToday(f.date) || f.status === 'LIVE');
    } else if (day === 'tomorrow') {
      fixtures = fixtures.filter(f => isTomorrow(f.date));
    }

    res.json({ success: true, count: fixtures.length, fixtures });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/live', async (req, res) => {
  try {
    const results = await Promise.allSettled(
      ALL_SPORTS.map(s => fetchOdds(s.key).then(games =>
        games.map(g => formatFixture(g, s.sport))
      ))
    );
    const now = new Date();
    const live = results
      .flatMap(r => r.status === 'fulfilled' ? r.value : [])
      .filter(f => {
        const start = new Date(f.date);
        const diff = (now - start) / 60000;
        return diff > 0 && diff < 120;
      });
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
