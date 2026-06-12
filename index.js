const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const API_KEY = '5ffc4335dd60e45b473ee4dffaa92a0c';



function getDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

async function fetchSport(base, endpoint, params) {
  try {
    const res = await axios.get(`${base}${endpoint}`, {
      headers: { 'x-apisports-key': API_KEY },
      params,
      timeout: 8000
    });
    return res.data.response || [];
  } catch (e) {
    return [];
  }
}

app.get('/api/fixtures', async (req, res) => {
  const { day = 'today', sport = 'football' } = req.query;
  const offset = day === 'tomorrow' ? 1 : 0;
  const date = getDate(offset);

  const config = {
    football:   { base: 'https://v3.football.api-sports.io',   endpoint: '/fixtures' },
    basketball: { base: 'https://v1.basketball.api-sports.io', endpoint: '/games' },
    hockey:     { base: 'https://v1.hockey.api-sports.io',     endpoint: '/games' },
    tennis:     { base: 'https://v1.tennis.api-sports.io',     endpoint: '/games' },
  };

  const { base, endpoint } = config[sport] || config.football;
  const raw = await fetchSport(base, endpoint, { date, timezone: 'Africa/Lagos' });

  const fixtures = raw.map(f => {
    if (sport === 'football') {
      return {
        id: String(f.fixture.id),
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
    }
    return {
      id: String(f.id),
      sport,
      league: f.league?.name || f.tournament?.name || sport,
      country: f.country?.name || '',
      date: f.date,
      status: f.status?.short,
      home: { name: f.teams?.home?.name || f.players?.home?.name || 'Home', logo: f.teams?.home?.logo, score: f.scores?.home?.total ?? f.scores?.home ?? null },
      away: { name: f.teams?.away?.name || f.players?.away?.name || 'Away', logo: f.teams?.away?.logo, score: f.scores?.away?.total ?? f.scores?.away ?? null }
    };
  });

  res.json({ success: true, count: fixtures.length, fixtures });
});

app.get('/api/live', async (req, res) => {
  const raw = await fetchSport('https://v3.football.api-sports.io', '/fixtures', { live: 'all' });
  const fixtures = raw.map(f => ({
    id: String(f.fixture.id),
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
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'OKAY is live', time: new Date().toISOString() });
});

module.exports = app;

if (require.main === module) {
  app.listen(3000, () => console.log('OKAY running on port 3000'));
}
