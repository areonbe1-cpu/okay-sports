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

async function fetchFixtures(apiUrl, sport, date) {
  try {
    const res = await axios.get(apiUrl, {
      params: { met: 'Fixtures', APIkey: KEY, from: date, to: date },
      timeout: 10000
    });
    const events = res.data?.result || [];
    return events.map(e => ({
      id: String(e.event_key || e.event_id),
      sport,
      league: e.league_name || e.event_league || '',
      country: e.country_name || '',
      date: e.event_date || e.event_date_start || date,
      time: e.event_time || '',
      status: e.event_status || e.event_live === '1' ? (e.event_live === '1' ? 'LIVE' : e.event_status) : 'NS',
      home: {
        name: e.event_home_team || e.event_first_player || 'Home',
        logo: e.home_team_logo || null,
        score: e.event_final_result ? e.event_final_result.split(' - ')[0] : null
      },
      away: {
        name: e.event_away_team || e.event_second_player || 'Away',
        logo: e.away_team_logo || null,
        score: e.event_final_result ? e.event_final_result.split(' - ')[1] : null
      },
      markets: { h2h: { home: null, draw: null, away: null } }
    }));
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
    return events.map(e => ({
      id: String(e.event_key || e.event_id),
      sport,
      league: e.league_name || '',
      country: e.country_name || '',
      date: e.event_date || '',
      time: e.event_time || '',
      status: 'LIVE',
      elapsed: e.event_status || '',
      home: {
        name: e.event_home_team || e.event_first_player || 'Home',
        logo: e.home_team_logo || null,
        score: e.event_home_final_result || null
      },
      away: {
        name: e.event_away_team || e.event_second_player || 'Away',
        logo: e.away_team_logo || null,
        score: e.event_away_final_result || null
      },
      markets: { h2h: { home: null, draw: null, away: null } }
    }));
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
