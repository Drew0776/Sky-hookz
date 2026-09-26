# SkyHook Yard Logistics

SkyHook tracks every rebar bundle in a fabrication yard from raw stock to the trailer, and checks every crane move before it happens. Crane operators, shear and bender crews, and supervisors each get their own screen. The server holds the yard state, enforces the safety rules, and pushes each change to open screens over Server-Sent Events.

This repository is the main build. [skyhooks](https://github.com/Drew0776/skyhooks) is a sibling build that adds a Gemini co-pilot and a supervisor shift-handoff wizard.

## Screens

| Route | Screen | What it's for |
| --- | --- | --- |
| `/` | Terminal | Shift overview: live activity stream, stage counts, shift messages |
| `/crane` | Crane cab | Pick up and drop bundles; every drop goes through the server checks |
| `/floor` | Floor trigger | Stage bundles at shears, send to benders, mark bends done, export a PDF floor report |
| `/yard-map` | Yard map | Floorplan with load heatmap, adjustable zone limits and a gantry route planner |
| `/jobs` | Jobs | Progress per order, down to the bundle |
| `/exceptions` | Exceptions | Misplaced bars, fabrication errors and coating QC audits |
| `/dashboard` | Dashboard | Shift throughput in tons, UV exposure and rejection alerts |

## Yard rules

All rules live in [`src/yardRules.ts`](src/yardRules.ts) and are shared by the server and the screens, so what an operator sees is what the server enforces.

- **Grade zoning.** Black (uncoated, ASTM A615) bar stays in the SW zone: Stock SW, Doors 7–8, racks J-19 to J-25 and L-6 to L-10. Only the SW crane may lift it. Epoxy is kept out of those racks and ships from Doors 1–3 or North-End. Shears, benders and the coat line take either grade.
- **Ships-first stacking.** A bundle can't be set on a spot that holds a bundle shipping sooner.
- **Gantry interlocks.** Routes run the runway, then the bridge ([`src/utils/yardMath.ts`](src/utils/yardMath.ts)). A parked crane on the path blocks the move. Each zone is rated at 75,000 lb unless a supervisor sets its own limit on the yard map. Crossing a zone at 60% forces slow mode, and 85% blocks the move. ASTM A934 prefab bundles skip slow mode.
- **Hard stops.** A bundle that fails coating QC (more than 2% damage in a 1-ft section) is locked in `REJECTED` status and can't move.
- **UV exposure.** Coated epoxy outdoors for 25 days raises a warning, ahead of the common 30-day covering guidance. ASTM D3963 requires opaque covering once total exposure is expected to exceed two months.
- **Shifts.** First shift runs 6:00 AM to 4:30 PM in each plant's local time.

## Getting started

Requires Node.js 22.

```bash
npm ci
npm run dev        # http://localhost:3000 (Express + Vite dev server)
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the server with the Vite dev middleware |
| `npm run lint` | Type-check with `tsc --noEmit` |
| `npm test` | Unit tests for the yard rules plus API tests against the real Express app |
| `npm run build` | Build the client into `dist/` and bundle the server into `dist/server.cjs` |
| `npm start` | Serve the production build from `dist/` |

The yard state is kept in memory and starts from [`src/seedData.ts`](src/seedData.ts), which is fictional sample data. Its one-shift history is shifted to end just before server start, so times are always recent. Restarting the server resets the yard.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/bundles`, `/api/jobs`, `/api/jobs/:jobId/bundles` | Yard inventory |
| POST | `/api/bundles/:id/pickup` | `craneId`; black bar only on `Crane-SW`, one load per hook |
| POST | `/api/bundles/:id/drop` | `location`; grade zoning and ships-first stacking |
| POST | `/api/bundles/:id/stage`, `/send-to-bender`, `/mark-bent` | Floor workflow |
| POST | `/api/bundles/:id/force-load` | `door`, `trailerSize`; admin load |
| POST | `/api/bundles/bulk-action` | `LOAD`, `STAGE` or `SEND_TO_FABRICATION` |
| POST | `/api/gantry/execute-route` | `originId`, `destinationId`, optional `bundleId`; interlocks, zoning, stacking |
| GET / PUT | `/api/zone-capacities`, `/api/zone-capacities/:zoneId` | Zone limits (`capacity` 5,000–150,000 lb, or `null` for the default) |
| GET / POST | `/api/exceptions`, `/api/exceptions/:id/resolve` | Floor exceptions and QC audits |
| GET / POST | `/api/shift-messages`, `/api/activity`, `/api/operators` | Shift log |
| GET | `/api/dashboard` | Stage counts, UV hazards, shift throughput |
| GET | `/api/mill-certs/:heatNumber` | Heat record behind a bundle's cert link |
| GET | `/api/updates` | Server-Sent Events stream of state changes |

Errors are returned as JSON: `{ "error": "..." }`.

## Project layout

```
server.ts              Express API, in-memory yard state, SSE
src/yardRules.ts       Shared yard rules (zoning, stacking, UV, shifts, capacities)
src/utils/yardMath.ts  Gantry route analysis and travel-time model
src/pages/             One file per screen (lazy-loaded)
src/components/        Nav, bundle detail modal, legends
tests/                 node:test suites (rules and API)
```

CI (`.github/workflows/ci.yml`) runs the type-check, tests and build on every pull request.
