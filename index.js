const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
const cache = new NodeCache({ stdTTL: 300 });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const API_KEY = process.env.API_SPORTS_KEY || '4d3e6e1c7f76585199c58dfcab7e51e9';

async function apiCall(base, endpoint, params = {}) {
  const cacheKey = `${base}-${endpoint}-${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  try {
    const res = await axios.get(`${base}${endpoint}`, {
      headers: { 'x-apisports-key': API_KEY },
      params,
      timeout: 10000
    });
    cache.set(cacheKey, res.data);
    return res.data;
  } catch (err) {
    return { response: [] };
  }
}

function getDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

app.get('/api/fixtures', async (req, res) => {
  const { day = 'today', sport = 'football' } = req.query;
  const offset = day === 'tomorrow' ? 1 : 0;
  const date = getDate(offset);

  const bases = {
    football: 'https://v3.football.api-sports.io',
    basketball: 'https://v1.basketball.api-sports.io',
    hockey: 'https://v1.hockey.api-sports.io',
    tennis: 'https://v1.tennis.api-sports.io'
  };

  const endpoints = {
    football: '/fixtures',
    basketball: '/games',
    hockey: '/games',
    tennis: '/games'
  };

  try {
    const base = bases[sport] || bases.football;
    const endpoint = endpoints[sport] || '/fixtures';
    const data = await apiCall(base, endpoint, { date, timezone: 'Africa/Lagos' });

    const fixtures = (data.response || []).map(f => {
      if (sport === 'football') {
        return {
          id: f.fixture.id,
          sport,
          league: f.league.name,
          country: f.league.country,
          leagueLogo: f.league.logo,
          date: f.fixture.date,
          status: f.fixture.status?.short,
          elapsed: f.fixture.status?.elapsed,
          home: { name: f.teams.home.name, logo: f.teams.home.logo, score: f.goals.home },
          away: { name: f.teams.away.name, logo: f.teams.away.logo, score: f.goals.away }
        };
      } else {
        return {
          id: f.id,
          sport,
          league: f.league?.name || f.tournament?.name || sport,
          country: f.country?.name || '',
          date: f.date,
          status: f.status?.short,
          home: { name: f.teams?.home?.name || f.players?.home?.name || 'Home', logo: f.teams?.home?.logo, score: f.scores?.home?.total ?? f.scores?.home },
          away: { name: f.teams?.away?.name || f.players?.away?.name || 'Away', logo: f.teams?.away?.logo, score: f.scores?.away?.total ?? f.scores?.away }
        };
      }
    });

    res.json({ success: true, count: fixtures.length, date, fixtures });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/live', async (req, res) => {
  try {
    const data = await apiCall('https://v3.football.api-sports.io', '/fixtures', { live: 'all' });
    const fixtures = (data.response || []).map(f => ({
      id: f.fixture.id,
      sport: 'football',
      league: f.league.name,
      leagueLogo: f.league.logo,
      date: f.fixture.date,
      status: f.fixture.status?.short,
      elapsed: f.fixture.status?.elapsed,
      home: { name: f.teams.home.name, logo: f.teams.home.logo, score: f.goals.home },
      away: { name: f.teams.away.name, logo: f.teams.away.logo, score: f.goals.away }
    }));
    res.json({ success: true, count: fixtures.length, fixtures });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'OKAY is live', time: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OKAY running on port ${PORT}`));

module.exports = app;
