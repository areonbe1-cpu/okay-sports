const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const BASE = 'https://www.thesportsdb.com/api/v1/json/3';

function getDateStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function formatEvent(e, sport) {
  const homeScore = e.intHomeScore;
  const awayScore = e.intAwayScore;
  const status = e.strStatus || 'NS';
  return {
    id: e.idEvent,
    sport: sport || e.strSport?.toLowerCase() || 'football',
    league: e.strLeague,
    country: e.strCountry || '',
    date: e.dateEventLocal || e.dateEvent,
    time: e.strTimeLocal || e.strTime,
    status,
    home: {
      name: e.strHomeTeam,
      logo: e.strHomeTeamBadge || null,
      score: homeScore !== null && homeScore !== '' ? homeScore : null
    },
    away: {
      name: e.strAwayTeam,
      logo: e.strAwayTeamBadge || null,
      score: awayScore !== null && awayScore !== '' ? awayScore : null
    },
    markets: {
      h2h: { home: null, draw: null, away: null }
    }
  };
}

app.get('/api/fixtures', async (req, res) => {
  const { day = 'today' } = req.query;
  const offset = day === 'tomorrow' ? 1 : day === 'yesterday' ? -1 : 0;
  const date = getDateStr(offset);

  try {
    const response = await axios.get(`${BASE}/eventsday.php`, {
      params: { d: date, s: 'Soccer' },
      timeout: 10000
    });

    const events = response.data?.events || [];
    const fixtures = events.map(e => formatEvent(e, 'football'));

    res.json({ success: true, count: fixtures.length, date, fixtures });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/fixtures/sport', async (req, res) => {
  const { sport = 'Basketball', day = 'today' } = req.query;
  const offset = day === 'tomorrow' ? 1 : 0;
  const date = getDateStr(offset);

  try {
    const response = await axios.get(`${BASE}/eventsday.php`, {
      params: { d: date, s: sport },
      timeout: 10000
    });

    const events = response.data?.events || [];
    const fixtures = events.map(e => formatEvent(e, sport.toLowerCase()));

    res.json({ success: true, count: fixtures.length, fixtures });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/live', async (req, res) => {
  try {
    const response = await axios.get(`${BASE}/eventslive.php`, {
      timeout: 10000
    });

    const events = response.data?.events || [];
    const fixtures = events.map(e => formatEvent(e, 'football'));

    res.json({ success: true, count: fixtures.length, fixtures });
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
