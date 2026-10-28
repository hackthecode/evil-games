# Evil Games — game portal

A portal of classic games in the browser – against the computer or online against real people:
**Backgammon, Tapa, Gulbara, Chess, Belot, Blato, Santase, Ludo, Solitaire** and the strategy game **Evil Empires**.
It has sign-up, statistics (games, wins, time per game), a ranking with an Elo rating, friends, invitations,
a shared lobby with chat and quick matchmaking, and an administrator dashboard.
It works on computers and phones and can be installed as an app (PWA).

The interface is bilingual – **English and Bulgarian** – switchable with the flags in the top right corner.

## Running locally

Only Python 3 is needed (built into macOS). No Node.js or build step.

- **macOS:** double-click `start.command`, or in the terminal:
  ```bash
  cd /path/to/the/folder
  python3 serve.py 8080
  ```
  (`serve.py` is a plain static server that disables caching – so you always see the latest version.)
  and open <http://localhost:8080>.

> `index.html` cannot be opened directly with a double click (`file://`), because browsers
> don't allow ES modules from there — always use a local server.

**From a phone on the same Wi‑Fi network:** start with `python3 -m http.server 8080 --bind 0.0.0.0`
and open `http://<computer-IP>:8080`. (Accounts in local mode are separate for each browser/device.)

During development on `localhost`, set `localStorage['eg.devLocal'] = '1'` to use the local mode even
when `config.js` points to Supabase – this way no test accounts are created in the real database.

## Structure

```
index.html              entry point
config.js               storage choice: 'local' or 'supabase'
sw.js, manifest.webmanifest   offline support and installing (PWA)
css/                    styles (app, cards, chess, tabla, solitaire, ludo, empires)
js/app.js               router and portal shell
js/i18n.js, js/i18n/    translations: txt() for UI text, tk() for server-side text, bg.js – the Bulgarian dictionary
js/pages/               home, log in, profile, ranking, friends, lobby, online lobby, admin, game page
js/store/               storage: local.js (localStorage), supabase.js (online), elo.js (rating)
js/net/                 online: channels, rooms (room.js), refereed table (table.js), friends (social.js), lobby chat, admin
js/net/referee/         the referee server: core.js (shared core), worker.js (local "server")
js/games/registry.js    the list of games — new games are added here
js/games/<game>/        engine.js (rules + AI), <game>.js (UI), referee.js (for the referee)
js/games/empires/       Evil Empires (engine, world, server, tactics, graphics, audio, chat)
supabase/*.sql          database for online mode
supabase/functions/     Edge Functions: referee (card games) and empires (generated with tools/build-*.py)
tests/                  automatic tests (node tests/run.mjs, or tests/index.html in the browser)
```

### Adding a new game
1. Create `js/games/<id>/<id>.js` that exports `mount(root, ctx)` and returns `{ destroy() }`.
2. In the game call `ctx.newMatch()` at the start and `ctx.report('win' | 'loss' | 'draw', { summary })` at the end.
   Time played is tracked automatically.
3. Add an entry to `js/games/registry.js` (and an illustration in `js/art.js`).
4. Write UI text in English with `txt('…')` and add the Bulgarian translation to `js/i18n/bg.js`.
   Text produced by code that also runs on the server uses `tk('…')` – the browser translates it when shown.

## Online play against real people

All games can be played online: from the game's card → **Online** → create a room and send the link
(or choose an open room / **Quick game** in the lobby). In belot free seats are taken by bots.

How it works:
- **Card games (belot, blato, santase) – referee server.** The deck and the hands are only on the server;
  every player receives only their own cards and the public moves. The server checks every move,
  plays for the bots and computes the declarations. Peeking at other players' cards is impossible.
- **Backgammon, chess, Ludo, solitaire – lockstep.** Every client runs the game itself; only the decisions
  (move, roll) are sent over the network and checked against the rules. The dice come from a shared seed
  agreed with commit-reveal – nobody can rig them.
- **Disconnects:** after a reload the game continues where it was. If a player disappears for 75 s,
  the opponent gets a forfeit win (in team games a bot takes over the seat). Leaving counts as a loss.
- **More:** rematch, draw by agreement (chess), quick reactions, forfeit win after long inactivity,
  in solitaire – a race on the same deal.

**Rating (Elo):** every online game has its own rating (starting at 1200). It changes only when all
players of the match confirm the same result – nobody can "write" themselves a win.

**Friends and invitations:** the "Friends" page – search by username, requests, who is online and what
they play, game invitations (the friend gets an "Accept" dialog and goes straight into the room).

**Local test (no server):** in local mode online play works between tabs of one browser.
Open two tabs, log in with different users (the session is separate for each tab) and play.
The referee server then runs in a SharedWorker – with the same code as the real server.

**Real online play:** requires Supabase (see below), including the "referee" Edge Function.

### Online for a new game
- **No hidden information (lockstep):** in the game use `ctx.online` (or `offlineNet()` from
  `js/net/room.js` for a game against the computer): `net.decide(seat, type, localFn, validate)` for every
  decision, `net.rng('label')` for dice/shuffling, `net.onEvent(fn)` for resign/draw/forfeit.
- **Hidden cards (referee):** write a reducer `js/games/<game>/referee.js` (`init`, `next`, `validate`,
  `apply`, `view`, `ai`, `result` – see `js/net/referee/core.js`), add it to `js/net/referee/games.js`
  and `tools/build-referee.py`, and let the UI use `createTable` from `js/net/table.js`.
- Add `online: { seats, minHumans, bots, seatNames, options }` (and `referee: true` for refereed games)
  to the game's entry in `registry.js`.

## Publishing for free

The site is fully static, so it works unchanged on:

- **GitHub Pages:** push the folder to a repository → Settings → Pages → Deploy from branch → `main` / root.
- **Netlify / Cloudflare Pages / Vercel:** connect the repository; build command — none, output directory — `/`.

In local mode (the default) every visitor keeps their profile only in their own browser
and the ranking shows only the profiles from the same device.

## Online accounts with Supabase (free)

For a ranking shared by all players:

1. Create a free project at <https://supabase.com>.
2. **SQL Editor** → paste the contents of `supabase/schema.sql` → **Run**.
3. **Authentication → Sign In / Providers → Email:** turn off **Confirm email**
   (sign-up is with a username and password, no email).
4. **Project Settings → API:** copy the *Project URL* and the *anon public* key into `config.js`:
   ```js
   backend: 'supabase',
   supabase: { url: 'https://xxxx.supabase.co', anonKey: 'eyJ...' },
   ```
   The public `anon` key is meant to be in the browser — the data is protected by Row Level Security.
5. **The referee server** (for online belot, blato and santase) – the "referee" Edge Function:
   - with the [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase functions deploy referee --project-ref <ref>`
     (from the project folder), **or**
   - from the dashboard: **Edge Functions → Deploy a new function → Via Editor**, name `referee`, paste
     the contents of `supabase/functions/referee/index.ts` and press **Deploy**.
   If Supabase gives the function a different name, put it into `config.js` → `supabase.refereeFunction`.
   The function uses the automatic variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` – there is nothing to enter.
   After changing the rules of these games run `python3 tools/build-referee.py` and deploy again.
6. **Lobby chat:** run `supabase/lobby.sql`.
7. **Administrator dashboard** (`#/admin`): run `supabase/admin.sql`, then make yourself an administrator:
   ```sql
   insert into public.admins(user_id) select id from public.profiles where lower(username) = lower('YOUR_USERNAME') on conflict do nothing;
   ```
8. Push the changes. Done.

The workflow `.github/workflows/keep-supabase-awake.yml` makes a light request every 2 days so the free
project is not paused, and `.github/workflows/tests.yml` runs the tests on every push.

## Evil Empires – online server

The strategy game works in two modes: **local** (the world is in the browser – for tests) and **online**
(Supabase – a shared world, the server checks every action, push notifications).

1. **SQL:** run `supabase/empires.sql` in the SQL Editor (tables `ee_world`, `ee_saves`, `ee_push` and the function `ee_commit`).
2. **Function:** `python3 tools/build-empires.py` → create the Edge Function **empires** and paste the contents of `supabase/functions/empires/index.ts`. If the name differs, change `empiresFunction` in `config.js`.
3. **Secrets** (Edge Functions → Secrets): `VAPID_PUBLIC`, `VAPID_PRIVATE`, `CRON_SECRET` – from the local file `supabase/empires-secrets.local.txt` (not committed to git). The public VAPID key is also in `config.js` (`empiresPush`).
4. **Background process:** run `supabase/empires-cron.local.sql` (pg_cron every 2 minutes: moves the empires forward and sends notifications).

The logic is the same in the browser and on the server (`js/games/empires/engine.js`); `tools/empires-sim.js` is a balance simulation.

## Technologies

- Plain JavaScript (ES modules) without a build step, View Transitions API, CSS container queries, `color-mix()`, `<dialog>`.
- A Web Worker for the chess AI (negamax with alpha-beta, iterative deepening and quiescence search).
- SharedWorker / Supabase Edge Function (Deno) for the referee server; Supabase Realtime for rooms, presence, invitations and the lobby chat.
- Web Crypto (PBKDF2) for password hashing in local mode; Web Audio for sounds.
- Three.js and cannon-es for the 3D dice; a Service Worker for offline support and installing as an app.

## Credits

- Chess pieces: the *cburnett* set (Colin M.L. Burnett, GPLv2+/BSD) from the lichess project; additional sets from lichess (`assets/chess/`): *celtic* and *fantasy* (MIT), *rhosgfx* (CC0), *merida* (GPLv2+).
- Face cards (jack, queen, king): *English pattern* by Dmitry Fomin (Wikimedia Commons, CC0), recoloured in the portal's palette (`assets/cards/`).
- Dice sounds: Kenney "Casino Audio" (CC0).
- Evil Empires buildings: **feudalwars** (OpenGameArt.org, CC0); **rubberduck** (OpenGameArt.org, CC0) – medieval buildings, props, tents and ruins; the mill, buildings 01 and 03 and the well: **Bleed** – http://remusprites.carbonmade.com/ (OpenGameArt.org, CC-BY 3.0). The files are in `assets/empires/`; the rest is drawn with SVG in `js/games/empires/art.js`.
- Evil Empires music and sounds: see `assets/sounds/CREDITS.txt` (all CC0).
