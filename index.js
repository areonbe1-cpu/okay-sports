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
  football: 'soccer_epl',
  basketball: 'basketball_nba',
  hockey: 'icehockey_nhl',
  tennis: 'tennis_atp_french_open',
  mma: 'mma_mixed_martial_arts'
};

async function fetchOdds(sportKey, markets = 'h2h') {
  try {
    const res = await axios.get(`${BASE}/sports/${sportKey}/odds`, {
      params: {
        apiKey: API_KEY,
        regions: 'eu',
        markets,
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

function extractMarket(bookmakers, marketKey) {
  for (const bm of bookmakers) {
    const market = bm.markets.find(m => m.key === marketKey);
    if (market) return market.outcomes;
  }
  return null;
}

function formatFixture(game, sport) {
  const bookmakers = game.bookmakers || [];
  
  // h2h odds
  const h2h = extractMarket(bookmakers, 'h2h');
  const homeOdd = h2h?.find(o => o.name === game.home_team)?.price || null;
  const awayOdd = h2h?.find(o => o.name === game.away_team)?.price || null;
  const drawOdd = h2h?.find(o => o.name === 'Draw')?.price || null;

  // totals (over/under)
  const totals = extractMarket(bookmakers, 'totals');
  const over25 = totals?.find(o => o.name === 'Over' && o.point === 2.5)?.price || null;
  const under25 = totals?.find(o => o.name === 'Under' && o.point === 2.5)?.price || null;
  const over15 = totals?.find(o => o.name === 'Over' && o.point === 1.5)?.price || null;
  const over35 = totals?.find(o => o.name === 'Over' && o.point === 3.5)?.price || null;

  // btts
  const btts = extractMarket(bookmakers, 'btts');
  const bttsYes = btts?.find(o => o.name === 'Yes')?.price || null;
  const bttsNo = btts?.find(o => o.name === 'No')?.price || null;

  // first half
  const h1h2h = extractMarket(bookmakers, 'h1_h2h');
  const firstHalfHome = h1h2h?.find(o => o.name === game.home_team)?.price || null;
  const firstHalfAway = h1h2h?.find(o => o.name === game.away_team)?.price || null;
  const firstHalfDraw = h1h2h?.find(o => o.name === 'Draw')?.price || null;

  return {
    id: game.id,
    sport,
    league: game.sport_title,
    date: game.commence_time,
    status: new Date(game.commence_time) > new Date() ? 'NS' : 'FT',
    home: { name: game.home_team, score: null },
    away: { name: game.away_team, score: null },
    markets: {
      h2h: { home: homeOdd, draw: drawOdd, away: awayOdd },
      totals: { over15, over25, over35, under25 },
      btts: { yes: bttsYes, no: bttsNo },
      firstHalf: { home: firstHalfHome, draw: firstHalfDraw, away: firstHalfAway }
    }
  };
}

app.get('/api/fixtures', async (req, res) => {
  const { sport = 'football' } = req.query;
  const sportKey = SPORT_KEYS[sport] || SPORT_KEYS.football;
  
  try {
    const games = await fetchOdds(sportKey, 'h2h,totals,btts,h1_h2h');
    const fixtures = games.map(g => formatFixture(g, sport));
    res.json({ success: true, count: fixtures.length, fixtures });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/live', async (req, res) => {
  try {
    const games = await fetchOdds(SPORT_KEYS.football, 'h2h');
    const now = new Date();
    const live = games
      .filter(g => {
        const start = new Date(g.commence_time);
        const diff = (now - start) / 60000;
        return diff > 0 && diff < 120;
      })
      .map(g => formatFixture(g, 'football'));
    res.json({ success: true, count: live.length, fixtures: live });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/sports', async (req, res) => {
  try {
    const res2 = await axios.get(`${BASE}/sports`, {
      params: { apiKey: API_KEY },
      timeout: 8000
    });
    res.json({ success: true, data: res2.data });
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
