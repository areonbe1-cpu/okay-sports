const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const KEY = '0f4f1975223258d800849e9ccb0d6aa4f19192d34ac13796c118d684c5162bdf';

const APIS = [
  { url: 'https://apiv2.allsportsapi.com/football', sport: 'football' },
  { url: 'https://apiv2.allsportsapi.com/basketball', sport: 'basketball' },
  { url: 'https://apiv2.allsportsapi.com/tennis', sport: 'tennis' },
  { url: 'https://apiv2.allsportsapi.com/cricket', sport: 'cricket' },
  { url: 'https://apiv2.allsportsapi.com/hockey', sport: 'hockey' },
];

function getDateStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function parseScore(result, side) {
  if (!result || result.trim() === '' || result.trim() === '-') return null;
  const parts = result.split(' - ');
  if (side === 'home' && parts[0] !== undefined && parts[0].trim() !== '') return parts[0].trim();
  if (side === 'away' && parts[1] !== undefined && parts[1].trim() !== '') return parts[1].trim();
  return null;
}

// Generate realistic seeded odds from team names
function generateOdds(homeName, awayName, sport) {
  const seed = (homeName + awayName).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = (seed % 100) / 100;

  if (sport === 'tennis' || sport === 'basketball' || sport === 'mma') {
    const home = parseFloat((1.30 + r * 1.40).toFixed(2));
    const away = parseFloat((1.30 + (1 - r) * 1.40).toFixed(2));
    return { home, draw: null, away };
  }

  if (sport === 'cricket') {
    const home = parseFloat((1.50 + r * 1.80).toFixed(2));
    const away = parseFloat((1.50 + (1 - r) * 1.80).toFixed(2));
    return { home, draw: null, away };
  }

  // football and hockey
  const home = parseFloat((1.45 + r * 1.80).toFixed(2));
  const draw = parseFloat((2.80 + r * 0.70).toFixed(2));
  const away = parseFloat((1.60 + (1 - r) * 2.20).toFixed(2));
  return { home, draw, away };
}

function formatEvent(e, sport) {
  const homeScore = parseScore(e.event_final_result, 'home');
  const awayScore = parseScore(e.event_final_result, 'away');
  const isLive = e.event_live === '1';
  const status = isLive ? 'LIVE' : (e.event_status || 'NS');
  const homeName = e.event_home_team || e.event_first_player || 'Home';
  const awayName = e.event_away_team || e.event_second_player || 'Away';
  const odds = generateOdds(homeName, awayName, sport);

  return {
    id: String(e.event_key || e.event_id || Math.random()),
    sport,
    league: e.league_name || e.event_league || '',
    country: e.country_name || e.event_country || '',
    date: e.event_date || e.event_date_start || '',
    time: e.event_time || '',
    status,
    elapsed: isLive ? (e.event_status || '') : null,
    home: {
      name: homeName,
      logo: e.home_team_logo || null,
      score: homeScore
    },
    away: {
      name: awayName,
      logo: e.away_team_logo || null,
      score: awayScore
    },
    markets: {
      h2h: odds
    }
  };
}

async function fetchFixtures(apiUrl, sport, date) {
  try {
    const res = await axios.get(apiUrl, {
      params: { met: 'Fixtures', APIkey: KEY, from: date, to: date },
      timeout: 10000
    });
    const events = res.data?.result || [];
    if (!Array.isArray(events)) return [];
    return events.map(e => formatEvent(e, sport));
  } catch (e) {
    return [];
  }
}

async function fetchLive(apiUrl, sport) {
  try {
    const res = await axios.get(apiUrl, {
      params: { met: 'Livescore', APIkey: KEY },
      timeout: 10000
    });
    const events = res.data?.result || [];
    if (!Array.isArray(events)) return [];
    return events.map(e => ({ ...formatEvent(e, sport), status: 'LIVE' }));
  } catch (e) {
    return [];
  }
}

app.get('/api/fixtures', async (req, res) => {
  const { day = 'today', sport = 'all' } = req.query;
  const offset = day === 'tomorrow' ? 1 : 0;
  const date = getDateStr(offset);

  try {
    const apisToFetch = sport === 'all' ? APIS : APIS.filter(a => a.sport === sport);
    const results = await Promise.allSettled(
      apisToFetch.map(a => fetchFixtures(a.url, a.sport, date))
    );
    const fixtures = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    res.json({ success: true, count: fixtures.length, date, fixtures });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/live', async (req, res) => {
  try {
    const results = await Promise.allSettled(
      APIS.map(a => fetchLive(a.url, a.sport))
    );
    const fixtures = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
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
