---
name: run-sky-hookz
description: Build, start, stop and drive the Sky-hookz rebar yard app (Express + React). Use when asked to run or launch Sky-hookz, smoke-test its API, take a screenshot of a screen, do a crane pickup/drop in the UI, or run its tests.
---

Sky-hookz is one Express server (API, SSE and the built React client) on port 3000. Drive it with
`.claude/skills/run-sky-hookz/driver.mjs`: it starts and stops the production build, runs API
smoke checks, and uses Playwright to take screenshots and do a real crane move. All paths are
relative to the repo root.

## Prerequisites

Node 22. Playwright is **not** a project dependency: the driver loads the container's global
install (`npm root -g`) with browsers in `/opt/pw-browsers`. Don't run `playwright install`.

## Setup and build

```bash
npm ci
npm run build          # client -> dist/, server -> dist/server.cjs
```

## Run (agent path)

```bash
D=.claude/skills/run-sky-hookz/driver.mjs
node $D start                          # kills anything on :3000, starts dist/server.cjs, waits for /api/health
node $D smoke                          # 6 API checks, PASS/FAIL, non-zero exit on failure
node $D shot /                         # screenshot of a route at 1440px
node $D shot /yard-map --width 390 --full
node $D crane --tag TG-104 --to "Rack K-2"                  # hoist + set down through the crane cab UI
node $D crane --tag TG-202 --crane Crane-SW --to "Rack J-20" # black bar needs the SW crane
node $D stop
```

Screenshots go to `/tmp/shots/sky-hookz/` (override with `SHOTS_DIR`). The server log is `/tmp/sky-hookz.log`.

| command | what it does |
|---|---|
| `start` / `stop` | Start the production server detached, or kill the port's listener |
| `smoke` | Health, bundle list, JSON 404, grade-zoning refusal, SW-crane rule, dashboard |
| `shot [/route] [--width N] [--full]` | Screenshot, and report horizontal overflow and console errors |
| `crane [--tag T] [--to Z] [--crane C]` | Pick up bundle `T` with crane `C`, drop at `Z`, and confirm the new location from the API. Exit code 2 = the app refused the pickup, or the drop menu marks `Z` as refused (for example "TG-205 ships sooner"); the reason is printed. The bundle then stays on the hook until `start` resets the yard |

Every browser command prints `console errors: none` or lists them, and exits 1 if there were any.

**Direct invocation** (no server, for PRs that touch rules or routes):

```bash
node --import tsx -e "import('./src/yardRules.ts').then(r => console.log(r.gradeZoneViolation('Epoxy', 'Door-8', 'RACKED')))"
SKYHOOK_NO_LISTEN=1 node --import tsx -e "import('./server.ts').then(async ({ app }) => { const s = app.listen(0); await new Promise(r => s.once('listening', r)); console.log(await (await fetch('http://127.0.0.1:' + s.address().port + '/api/health')).text()); s.close(); })"
```

## Run (human path)

```bash
npm run dev    # tsx server.ts with Vite middleware on :3000, serves src/ directly (no build), up in ~2s
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill   # stop it
```

## Test

```bash
npm run lint   # tsc --noEmit
npm test       # 39 tests: yard rules, sample data, and API tests against the real Express app
```

## Gotchas

- **The API checks request bodies.** Text fields must be strings within their length caps (for example `operatorName` 80 and `description` 1,000 characters), numeric fields must be real numbers, and a body over 100 KB gets 413. A `curl` call that sends numbers as strings (`"windSpeed": "30"`) gets a 400 naming the field.
- **An outage banner checks `/api/health`.** Within about 10 s of the server stopping, a "Can't reach the yard server" alert (`#connection-banner`) appears under the nav bar, and screens reload once it's back. Stopping the server mid-script is therefore visible in screenshots; restart with `start` and wait a few seconds for it to clear.
- **Drops come off a crane hook.** `/api/bundles/:id/drop` refuses a bundle that isn't on a crane, so pick it up first (`crane` does both). Each hook takes one load, and a bundle in a bender can't be lifted until it's marked bent. Smoke checks use a refused `force-load` so they leave the yard untouched.
- **Port 3000 is hardcoded** (`server.ts`). The sibling skyhooks repo uses it too, so run one app at a time. The driver's `start` frees the port first.
- **Don't stop it with `pkill -f "node dist/server.cjs"`.** The pattern matches the shell running the command and kills it (exit 144). Kill the port's listener instead, as `stop` does.
- **Never wait for `networkidle`.** `/api/updates` is a Server-Sent Events stream that stays open, so Playwright's `waitForLoadState('networkidle')` times out after 30s. Wait for an element, as the driver does with `#main-navigation-bar`.
- **Google Fonts fail in this container** with `net::ERR_CERT_AUTHORITY_INVALID`. Chromium doesn't trust the egress proxy's CA, and routing Chromium through `HTTPS_PROXY` makes the requests hang. Pages then fall back to system fonts, and the font errors show in the console. `curl` does trust the proxy, so the driver serves `fonts.googleapis.com` and `fonts.gstatic.com` requests by fetching them with `curl` (`fontsViaCurl`). Don't disable TLS checks instead.
- **Refused moves log a console error.** Chromium prints `Failed to load resource: ... status of 400` for every API refusal the app handles. The driver counts these as "API refusals shown to the user", not as errors.
- **The crane cab opens on Crane-NW.** Black bar can only be hoisted by Crane-SW, so pass `--crane Crane-SW` for TG-2xx bundles. Otherwise the pickup is refused (exit 2).
- **The drop menu only lists legal zones** for the bundle's grade. `crane` fails fast and prints the choices when `--to` isn't one of them.
- **State is in memory.** Every move sticks until `start` restarts the server and resets the yard, so later runs and screenshots see earlier moves. Racked bundles stay in the pickup list, so the same `--tag` can be moved again.
- **Screenshots use plant time** (`America/Chicago`), so shift labels and times match what operators see.
- **Colour transitions.** Buttons fade between states, so the driver waits 600ms before each screenshot. Without it, a disabled button can still look enabled.

## Troubleshooting

- **`error: dist/server.cjs is missing`**: run `npm run build`.
- **`server did not answer /api/health within 30s`**: read `/tmp/sky-hookz.log`. Something else may hold :3000; check with `lsof -i:3000`.
- **`page.waitForLoadState: Timeout 30000ms exceeded`** in your own script: see the `networkidle` gotcha.
- **`[npm run dev] <defunct>` in `ps` after stopping the dev server**: that's the npm wrapper, left as a harmless zombie process. The port is free.
