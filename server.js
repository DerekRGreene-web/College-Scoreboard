const express = require('express');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend files (index.html, style.css, app.js) from /public
app.use(express.static('public'));

// In-memory cache to prevent redundant upstream API requests and respect rate limits
const cache = {
  ncaaf: { data: null, lastFetched: 0 },
  ncaab: { data: null, lastFetched: 0 }
};
const CACHE_DURATION = 15 * 1000; // 15 seconds

// Returns today's exact calendar date in US Eastern Time (YYYY, MM, DD)
function getTodayEastern() {
  const estString = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const estDate = new Date(estString);

  return {
    yyyy: String(estDate.getFullYear()),
    mm: String(estDate.getMonth() + 1).padStart(2, '0'),
    dd: String(estDate.getDate()).padStart(2, '0')
  };
}

// Builds the NCAA API scoreboard endpoints for today's slate
function getEndpoints() {
  const { yyyy, mm, dd } = getTodayEastern();
  const slash = String.fromCharCode(47);
  const base = 'https:' + slash + slash + 'ncaa-api.henrygd.me';

  return {
    ncaab: [base, 'scoreboard', 'basketball-men', 'd1', yyyy, mm, dd].join(slash),
    ncaaf: [base, 'scoreboard', 'football', 'fbs', yyyy, mm, dd].join(slash)
  };
}

// Helper to perform an HTTPS GET request and parse the JSON response
 // Helper to perform an HTTPS GET request with a 6-second timeout

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 6000 }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk.toString('utf8'); });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error('Invalid JSON (HTTP ' + res.statusCode + ')'));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Upstream API timed out after 6s'));
    });

    req.on('error', reject);
  });
}

// GET /api/scores/:sport -> Returns normalized, today-only game objects for ncaab or ncaaf
app.get('/api/scores/:sport', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const sport = req.params.sport;
  const endpoints = getEndpoints();

  if (!endpoints[sport]) {
    return res.status(400).json({ error: 'Unsupported sport requested' });
  }

  // Return cached data if it is still fresh
  const now = Date.now();
  if (cache[sport].data && now - cache[sport].lastFetched < CACHE_DURATION) {
    return res.json(cache[sport].data);
  }

  try {
    const { yyyy, mm, dd } = getTodayEastern();
    const todaySlash = [mm, dd, yyyy].join(String.fromCharCode(47));
    const todayDash = [yyyy, mm, dd].join('-');

    const rawData = await fetchJson(endpoints[sport]);

    // Normalize upstream NCAA game objects into a clean frontend schema
    const games = (rawData.games || new Array())
      .map(item => item.game || item)
      .filter(g => {
        if (!g.startDate) return true;
        return g.startDate.includes(todaySlash) || g.startDate.includes(todayDash);
      })
      .map(g => {
        const home = g.home || {};
        const away = g.away || {};

        // Map NCAA game states ("live", "final", "pre") to frontend CSS states ("in", "post", "pre")
        let state = 'pre';
        if (g.gameState === 'live') state = 'in';
        else if (g.gameState === 'final') state = 'post';

        const period = g.currentPeriod || '';
        const clock = g.contestClock || '';
        const statusText = state === 'in'
          ? (period + ' - ' + clock).replace(/^ - | - $/g, '')
          : (g.finalMessage || g.startTime || 'Scheduled');

        const homeName = home.names?.short || home.names?.full || 'Home';
        const awayName = away.names?.short || away.names?.full || 'Away';

        // Extract live ball possession when provided by the feed (primarily College Football)
        let possession = null;
        if (home.possession === true || home.possession === 'true') possession = homeName;
        else if (away.possession === true || away.possession === 'true') possession = awayName;

        return {
          id: g.gameID || (awayName + '-' + homeName),
          sport: sport,
          status: statusText,
          state: state,
          possession: possession,
          homeTeam: {
            name: homeName,
            score: home.score || '0',
            rank: home.rank || null
          },
          awayTeam: {
            name: awayName,
            score: away.score || '0',
            rank: away.rank || null
          }
        };
      });

    cache[sport] = { data: games, lastFetched: now };
    res.json(games);
  } catch (error) {
    console.error('Error fetching ' + sport + ':', error.message);
    res.status(500).json({ error: 'Unable to retrieve scoreboard data' });
  }
});

app.listen(PORT, () => {
  console.log('Scoreboard server listening on port ' + PORT);
});
