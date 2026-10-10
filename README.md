# Cloud Storage Cost and Lifecycle Manager

A college subject project for **Information Storage and Management (ISM)**. It simulates a cloud
object storage system's information lifecycle management (ILM), modeled on **MinIO's ILM engine**
and S3-compatible bucket lifecycle policies — and it's backed by a **real MinIO instance**, not
just a database simulation. Objects move automatically across storage tiers — **Hot → Warm → Cold
→ Archive** — based on configurable rules, with real-time cost tracking, a rule engine, and an
admin dashboard.

![Dashboard](docs/screenshots/dashboard.jpg)
*Live dashboard: tier columns, the cost-optimization suggestion banner, and the actual-vs-all-Hot savings chart.*

<details>
<summary>More screenshots (Objects table, Rules editor)</summary>

![Objects table](docs/screenshots/objects-table.jpg)
*Objects table with file-type classification, access-frequency badges, and tier filters.*

![Rules editor](docs/screenshots/rules.jpg)
*Lifecycle rules, including the optional file-type filter per rule.*

</details>

## Tech stack

- **Frontend:** React (Vite) + Tailwind CSS, custom "ORIGYN" theme, Recharts for charts
- **Backend:** Node.js + Express REST API
- **Database:** SQLite via `better-sqlite3` (simulation state: objects, rules, cost history, audit log)
- **Object storage:** [MinIO](https://min.io) — one real bucket per tier (`cslm-hot`, `cslm-warm`,
  `cslm-cold`, `cslm-archive`); every transition/promotion/demotion/delete the engine performs is
  a real `copyObject`/`removeObject` call against MinIO's S3-compatible API, so an object's tier
  in the dashboard always reflects which real bucket it currently lives in

### What's real vs. simulated

- **Real:** bucket residency, every tier transition (copy + delete between buckets), manual
  promote/demote/delete — all go through the actual MinIO S3 API. The clock is also real: the
  lifecycle engine runs on a real background schedule (`EVALUATION_INTERVAL_MS`, default 5 minutes)
  and every rule's `condition_days` is measured against real wall-clock elapsed time, not a
  simulated day counter.
- **Simulated (optional):** the Objects tab has two modes. **"Upload a file"** stores the real
  bytes of whatever you pick (PDF, image, video, anything) in MinIO — `size_mb` is read from the
  actual file, and it can be downloaded back byte-for-byte identical, including after a real tier
  move. **"Add simulated object (custom size)"** is the original placeholder-blob mode — a
  typed-in size with no real file content — kept because it's still the easiest way to demo cost
  math for, say, a "5000 MB" object without needing an actual 5 GB file lying around. The "Generate
  N objects" seed action always uses this simulated mode, and also backdates objects'
  `created_at`/`last_accessed_at` by a random real amount, so a fresh demo instantly has objects at
  different real ages instead of everyone needing to wait days for something to transition.
- The backend runs fine **without** MinIO too — if it can't connect on startup it logs a warning
  and keeps serving from SQLite (useful if you just want the rule engine/dashboard without
  standing up object storage).

## How to run

### 1. Start MinIO (required for real bucket-backed storage)

The easiest way is via the included `docker-compose.yml`, which also defines the `server`/`client`
containers — but you can start just MinIO and run the app natively with `npm run dev`:

```bash
docker compose up -d minio
```

This starts MinIO on `localhost:9000` (S3 API) and `localhost:9001` (web console, login
`minioadmin` / `minioadmin`). Requires Docker; if you don't have it, run a native MinIO binary
instead (see min.io/download) with the same credentials, or just skip this step — see above.

### 2. Run the app

From the project root:

```bash
npm install        # installs root, server, and client dependencies (postinstall handles server/client)
npm run dev         # runs the Express API (port 4000) and Vite dev server (port 5173) together
```

Then open **http://localhost:5173** in your browser. The Vite dev server proxies `/api/*`
requests to the Express backend, so no CORS configuration is needed in development.

To install each workspace manually instead of relying on `postinstall`:

```bash
npm install --prefix server
npm install --prefix client
```

The SQLite database file is created automatically at `server/lifecycle.db` on first run, seeded
with the four default lifecycle rules described below. On startup, the server also connects to
MinIO and creates the four tier buckets if they don't exist yet.

### Fully containerized (server + client + MinIO)

```bash
docker compose up --build
```

Brings up MinIO, the API (`:4000`), and the built frontend served via nginx (`:8080`) together,
with the SQLite file and MinIO data persisted in named Docker volumes.

### Environment variables

Copy `server/.env.example` to `server/.env` and adjust as needed — the server loads it
automatically on startup via `dotenv`. All variables are optional; unset ones fall back to the
defaults below (which match the `docker-compose.yml` MinIO service).

```bash
cp server/.env.example server/.env
```

| Variable | Default | Purpose |
|---|---|---|
| `MINIO_ENDPOINT` | `localhost` | MinIO host |
| `MINIO_PORT` | `9000` | MinIO S3 API port |
| `MINIO_USE_SSL` | `false` | Set `true` for an HTTPS MinIO endpoint |
| `MINIO_ACCESS_KEY` | `minioadmin` | Access key |
| `MINIO_SECRET_KEY` | `minioadmin` | Secret key |
| `MINIO_BUCKET_PREFIX` | `cslm` | Prefix for the four tier buckets |
| `EVALUATION_INTERVAL_MS` | `300000` (5 min) | How often the background scheduler re-evaluates all objects |
| `NODE_ENV` | `development` | Set to `production` to switch HTTP request logging to combined (Apache-style) format |
| `ADMIN_USERNAME` | `admin` | Dashboard login username |
| `ADMIN_PASSWORD` | `admin` | Dashboard login password — **change this before any real deployment** |
| `JWT_SECRET` | *(random per restart)* | Signs login session tokens — set explicitly so sessions survive a server restart |

## Authentication

The dashboard and every `/api/*` route (except `/api/health` and `/api/auth/login`) require a
login — this closes what was previously a real gap (anyone who could reach the API could create,
modify, or delete everything). It's a single-admin-user setup, not multi-user accounts:

1. The server hashes `ADMIN_PASSWORD` with `bcrypt` at startup.
2. `POST /api/auth/login` checks the submitted credentials and, on success, returns a signed JWT
   (`server/auth.js`), valid for 12 hours.
3. The client stores the token in `localStorage` and sends it as `Authorization: Bearer <token>`
   on every request (`client/src/api.js`).
4. `server/authMiddleware.js` rejects any request to a protected route with a missing, invalid, or
   expired token (`401`); the client treats a `401` as "session expired" and bounces back to the
   login screen automatically rather than showing a generic error.

**Change `ADMIN_USERNAME`/`ADMIN_PASSWORD` and set an explicit `JWT_SECRET`** in `server/.env`
before deploying this anywhere beyond local dev.

## The lifecycle rule engine

`server/engine/lifecycleEngine.js` is the core of the project. Each **rule** has:

- `from_tier` — the source tier the rule applies to (or `Any`)
- `condition_days` — how many real days an object must sit *unaccessed* before the rule fires
- `action` — either `transition` (move to `to_tier`) or `delete` (permanently purge)

A background scheduler (`server/scheduler.js`) runs a real-time evaluation pass on an interval
(`EVALUATION_INTERVAL_MS`, default 5 minutes) — no manual clock-advancing required. There's also a
**"Run evaluation now"** button in the dashboard, and `POST /api/simulation/evaluate`, for
triggering an evaluation on demand (useful for demos, without waiting for the interval).

On every evaluation pass, the engine:

1. Loads all rules ordered top-to-bottom (their `sort_order`).
2. For every active object, computes real elapsed days since `last_accessed_at` and walks the rule
   list, applying the **first rule whose conditions match** (mirroring MinIO/S3's "first matching
   lifecycle rule wins" semantics) — at most one rule fires per object per evaluation.
3. Applies the transition or deletion, and writes an entry to the `audit_log` table.
4. Recomputes and snapshots the current cost per tier into `cost_history`, plus a "cost if this
   object had stayed in Hot" baseline used for the savings comparison chart.

Because the scheduler runs repeatedly over real time (rather than one simulated jump), an object
idling past multiple thresholds still passes through each intermediate tier correctly across
successive runs — exactly as a real ILM cron would.

### Default seeded rules

| Rule | From | Condition | Action |
|---|---|---|---|
| Hot to Warm | Hot | 7 days unaccessed | Move to Warm |
| Warm to Cold | Warm | 30 days unaccessed | Move to Cold |
| Cold to Archive | Cold | 90 days unaccessed | Move to Archive |
| Archive Expiry Delete | Archive | 365 days unaccessed | Delete |

Rules are fully editable, reorderable, and deletable from the **Rules** tab in the UI — this maps
to editing a bucket's lifecycle configuration in MinIO/S3, where each rule is an XML/JSON policy
block evaluated in order against every object in the bucket.

## Classification and cost optimization

Beyond the fixed-threshold rule engine, three lightweight (non-ML, deterministic) classification
layers sit on top of it:

- **File-type classification** (`server/engine/classification.js`) — pattern-matches each object's
  name into a category (Logs, Backup, Media, Document, ML/Dataset, Archive, User Upload, Other).
  Rules can optionally be scoped to a file type (e.g. "delete Logs after 30 days, but keep Backups
  for a year") via the rule's `file_type` field — left unset, a rule applies to every type, same as
  today.
- **Access-frequency classification** (`server/engine/enrichment.js`) — counts each object's real
  `'access'` audit events in a rolling 30-day window and labels it Frequent (≥3), Occasional (1–2),
  or Rare (0). This is observed behavior, not a fixed admin-set timer.
- **Cost optimizer** (`server/engine/optimizer.js`, `GET /api/simulation/optimize` /
  `POST /api/simulation/optimize/apply`) — combines the two: recommends the cheapest tier that
  still fits an object's *observed* access frequency (Frequent → Hot, Occasional → Warm, Rare →
  Archive), and only ever suggests moving to a *colder*, cheaper tier. This can catch savings the
  fixed-threshold rules haven't caught yet — an object with zero real accesses doesn't have to wait
  out a 90-day idle threshold to be flagged. The dashboard surfaces this as a "💡 N objects could
  save ₹X/day" banner with a one-click **Apply optimization** action; applying it moves the
  affected objects for real (actual MinIO bucket moves) and logs each one to the audit trail with
  reason "Cost optimization (low access frequency)".

None of this is AI/ML — it's the same category of deterministic, rule-based logic as the core
engine, just with an additional observed-behavior input instead of only a fixed idle-time timer.

## Production-readiness notes

- **Structured logging** — `server/logger.js` timestamps and levels every server log; HTTP
  requests are logged via `morgan` (dev-format locally, combined/Apache-format when
  `NODE_ENV=production`).
- **Centralized error handling** — every async route is wrapped (`server/asyncHandler.js`) so a
  thrown error reaches Express's global error-handling middleware in `index.js` and returns a
  clean `500` instead of silently hanging the request (a real gap in naive Express 4 async route
  handlers). Unhandled promise rejections are also logged rather than crashing the process.
- **Tests** — `npm test` (inside `server/`) runs a `vitest` suite (41 tests). Pure engine logic
  (cost math, rule-matching with file-type filtering, classification/optimizer heuristics) is unit
  tested directly; the auth, file upload/download, and optimizer *routes* are tested end-to-end
  with `supertest` against the real Express app (`server/app.js`, split out from `index.js`
  specifically so it can be imported without starting a server or needing a live MinIO connection
  — storage calls are mocked in those tests).
- **Background scheduler, not a manual loop** — the lifecycle engine runs on its own interval
  server-side (see above), independent of whether anyone has the dashboard open.

## Cost model

Rates are hardcoded in `server/engine/costEngine.js` (₹ per GB per simulated day) and mirrored on
the client in `client/src/tierConfig.js` for display purposes:

| Tier | ₹/GB/day | Retrieval delay |
|---|---|---|
| Hot | 4.00 | instant |
| Warm | 1.50 | seconds |
| Cold | 0.40 | minutes |
| Archive | 0.05 | hours |

## Mapping to real-world storage systems

- **MinIO ILM / S3 Lifecycle Policies** — the rule engine's "from tier, N days idle, then
  transition or expire" model mirrors MinIO's bucket lifecycle rules and AWS S3's
  `Transition`/`Expiration` lifecycle actions. Unlike MinIO's own ILM (which transitions objects
  to a configured remote tier, e.g. Glacier), this project models Hot/Warm/Cold/Archive as four
  *local* MinIO buckets and does the "transition" itself via `copyObject` + `removeObject` — a
  simplification that keeps the whole tiering story runnable on one local MinIO instance.
- **Storage tiering** — Hot/Warm/Cold/Archive corresponds to S3 Standard / Infrequent Access /
  Glacier / Glacier Deep Archive-style tiers, each trading retrieval latency for lower storage
  cost.
- **Cost optimization** — the "cost if everything stayed in Hot" comparison line demonstrates the
  core business case for ILM: automatically moving cold data to cheaper tiers without manual
  intervention.
- **Storage backend module** — `server/storage.js` wraps the official `minio` npm SDK: bucket
  creation on startup, `putObject` on object creation, `copyObject`+`removeObject` for both
  rule-driven and manual tier moves, and `removeObject` for expiry/manual deletes.

## Project structure

```
cloud-storage-lifecycle-manager/
├── server/            Express API + SQLite + lifecycle/cost engines + storage.js (MinIO client)
├── client/             React (Vite) + Tailwind dashboard
├── docker-compose.yml  MinIO + server + client, for a fully containerized run
└── package.json        root scripts (concurrently runs server + client for local dev)
```

See the API route files under `server/routes/` for the full REST surface (`/api/objects`,
`/api/rules`, `/api/simulation`, `/api/audit`).
