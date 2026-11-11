let latestNcaab = new Array();
let latestNcaaf = new Array();
let fetchBasketballNext = true;

function createSlateCard(game) {
  const rightSideText = game.state === 'post'
    ? game.awayTeam.score + '-' + game.homeTeam.score + ' (F)'
    : game.status;

  return '<li class="Game ' + game.state + '">' +
    '<h2>' + game.awayTeam.name + ' V. ' + game.homeTeam.name + '</h2>' +
    '<h3>' + rightSideText + '</h3>' +
  '</li>';
}

function renderSportSlate(games, selector) {
  const ul = document.querySelector(selector);
  if (!ul) return;

  const upcoming = games.filter(g => g.state === 'pre');
  const finished = games.filter(g => g.state === 'post');
  const slateGames = upcoming.concat(finished);

  if (slateGames.length === 0) {
    ul.innerHTML = '<li class="Game"><h2>No upcoming or final games today</h2></li>';
    return;
  }

  ul.innerHTML = slateGames.map(createSlateCard).join('');
}

function renderEverything(ncaabGames, ncaafGames) {
  const liveList = document.getElementById('live-games') || document.getElementById('LIVE');
  const allGames = ncaabGames.concat(ncaafGames);
  const liveGames = allGames.filter(g => g.state === 'in');

  if (liveList) {
    if (liveGames.length === 0) {
      liveList.innerHTML = '<li class="Scoreboard"><h2>No live games right now</h2></li>';
    } else {
      liveList.innerHTML = liveGames.map(game => {
        const statusParts = game.status.split(' - ');
        const periodText = statusParts.at(0) || '';
        const clockText = statusParts.at(1) || '';

        let thirdColumn = game.possession ? '🏈 ' + game.possession : '';
        if (!thirdColumn) {
          const awayScore = Number(game.awayTeam.score);
          const homeScore = Number(game.homeTeam.score);
          if (awayScore > homeScore) thirdColumn = game.awayTeam.name;
          else if (homeScore > awayScore) thirdColumn = game.homeTeam.name;
          else thirdColumn = 'TIE';
        }

        return '<li class="Scoreboard ' + game.state + '">' +
          '<h2>' + game.awayTeam.name + ' V. ' + game.homeTeam.name + '</h2> <br> <h3>' + game.awayTeam.score + '-' + game.homeTeam.score + '</h3>' +
          '<p>' + periodText + '</p> <p>' + clockText + '</p> <p>' + thirdColumn + '</p>' +
        '</li>';
      }).join('');
    }
  }

  renderSportSlate(ncaabGames, '.Hoops ul');
  renderSportSlate(ncaafGames, '.Ball ul');
}

async function updateScoreboard() {
  try {
    const sport = fetchBasketballNext ? 'ncaab' : 'ncaaf';
    const res = await fetch('/api/scores/' + sport + '?t=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();

    if (fetchBasketballNext) {
      latestNcaab = data;
    } else {
      latestNcaaf = data;
    }

    console.log('Synced ' + sport.toUpperCase() + ' at ' + new Date().toLocaleTimeString());
    fetchBasketballNext = !fetchBasketballNext;
    renderEverything(latestNcaab, latestNcaaf);
  } catch (error) {
    console.error('Background scoreboard refresh failed:', error);
  }
}

async function initialLoad() {
  const liveList = document.getElementById('live-games') || document.getElementById('LIVE');
  try {
    const [bRes, fRes] = await Promise.all([
      fetch('/api/scores/ncaab?t=' + Date.now(), { cache: 'no-store' }),
      fetch('/api/scores/ncaaf?t=' + Date.now(), { cache: 'no-store' })
    ]);

    latestNcaab = await bRes.json();
    latestNcaaf = await fRes.json();
    console.log('Initial load complete at ' + new Date().toLocaleTimeString());
    renderEverything(latestNcaab, latestNcaaf);

    setInterval(updateScoreboard, 15000);
  } catch (error) {
    console.error('Initial load error:', error);
    if (liveList) {
      liveList.innerHTML = '<li class="Scoreboard"><h2>Could not load scores</h2></li>';
    }
  }
}

initialLoad();
