College Scoreboard — Live NCAA Basketball & Football Tracker

A compact and interactive digital display of current Division I Men's Basketball and FBS College Football scores, game clocks, possession of the ball, and each day's schedule.

Live Demo: [Add your Render URL here after Step 3]

Tech Stack

Frontend: Semantic HTML5, CSS3 (Grid & Flexbox), Vanilla JavaScript (ES6+)

Backend: Node.js, Express

Data Source: Public NCAA Scoreboard JSON Feeds

Key Engineering Highlights

Server Side In-Memory Caching: Created a Node.js/Express proxy endpoint at /api/scores/:sport, that uses a 15-second Time To Live (TTL) cache to provide fast access to data for multiple simultaneous requests, while being mindful of the rate limit imposed by the upstream API.

Staggered Polling (Request Interleaving): Allowed alternating frontend fetch cycles of basketball/football feeds to alleviate network bursts and maintain responsiveness in the live game states.

Dynamic State Routing: shifts games between the daily schedule (SLATE), Live (LIVE), and final results (FINAL) according to the ET time zone boundary lines.

Run Locally

``bash
git clone https://github.com
cd college-scoreboard
npm install
npm start
`
Open http://localhost:3000` in your browser.