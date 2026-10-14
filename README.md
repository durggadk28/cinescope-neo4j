# CineScope

A **movie recommendation and ticket booking system using Neo4j**, extending the DA1/DA2 Movie Booking Management System. Built independently with FoodBridge as an interface and workflow reference.

**Live project:** [Open CineScope](https://cinescope-movies-dk28.netlify.app). Choose a sample profile on the sign-in screen or create a synthetic classroom account.

**Source repository:** [durggadk28/cinescope-neo4j](https://github.com/durggadk28/cinescope-neo4j) (private).

Netlify serves the frontend and serverless API; Neo4j Aura stores the hosted data. The site works independently of this laptop. See [deployment configuration](docs/NETLIFY_DEPLOYMENT.md). The desktop launcher remains available, using its separate local database.

## Run on this computer

1. Start **MovieRecommendationDB** in Neo4j Desktop.
2. Double-click **Start-CineScope.cmd** in this folder. Keep the terminal open.
3. Open **http://localhost:3000**.
4. On first run, enter your local Neo4j password on the connection screen. The database name is usually **neo4j**, even if the Desktop instance is called MovieRecommendationDB.
5. Click **Connect and import sample graph**. Then choose Arun, Priya, Rahul, or Meera to explore a sample account.

Your connection is already configured on the current computer. The ignored `.env` file contains it. Do not share that file.

The launcher uses installed Node.js, or this computer's bundled Codex Node.js runtime. On another computer, install **Node.js 22 or later**, then run `npm install` (or `pnpm install`) once before starting. Neo4j 5 or later is required. The verified installed version was Neo4j **2026.09.0**. APOC and Graph Data Science are not required.

## Features

- Registration, sign-in, hashed passwords, persistent account sessions, and sign-out.
- 18 films in English, Tamil, Hindi, and Japanese; search and combined genre/language filters.
- Personal 1–5-star ratings, rating removal, and private watchlists.
- Explainable recommendations from liked genres and similar viewers, with a rating fallback for a new account.
- Optional persisted `RECOMMENDED` relationship snapshots.
- Theatre screenings, a real 48-seat map per screen, up to six seats per booking, and cancellation before the show starts.
- Transactional seat availability checks; two competing booking requests cannot both succeed for the same show/seat through the API.
- Personal tickets, simulated booking totals, genre insights, and formula-safe CSV export.
- Interactive Neo4j graph, keyboard node selection, zoom, pan, and connection details.
- Ten curated Cypher queries in Query Studio; arbitrary query execution is not exposed.
- Settings for committed Cypher playback and reduced motion; responsive desktop/mobile layouts.

All payments and refunds are **simulated**. Catalogue ratings and screening schedules are sample values. Covers are original vector illustrations, not official movie posters. The app uses Neo4j for business persistence and has no mock, MongoDB, or browser-storage data fallback. Browser storage holds interface preferences only.

## Coursework files

| File | Purpose |
| --- | --- |
| `output/pdf/CineScope_DA3_Project_Report.pdf` | Formal report with real implementation screenshots |
| `reports/CineScope_DA3_Project_Report.md` | Editable report content |
| `docs/DEMO_GUIDE.md` | October 20 lab walkthrough and viva answers |
| `docs/GRAPH_MODEL.md` | Graph model, cardinality, and DA1/DA2 mapping |
| `cypher/01-schema.cypher` | Constraints and index creation |
| `cypher/02-sample-model.cypher` | Sanitized standalone graph snapshot without password hashes |
| `cypher/03-demonstration-queries.cypher` | Ten Cypher demonstrations |
| `data/movies.csv` | Sample movie data |
| `reports/database-evidence.json` | Actual version, graph counts, and recommendation output |
| `reports/verification.json` | Live database test results |
| `reports/netlify-production-verification.json` | 19 checks against the public site and Neo4j Aura |
| `reports/netlify-deployment.json` | Hosted URL and deployment metadata |

Run Cypher statements individually in Neo4j Query. The model snapshot is a supplemental database demonstration: it does not create usable login credentials. For the complete app, use the connection/import screen or the `server/seed.js` importer. Query Studio supplies `$userId` and `$showId` automatically; in Neo4j Query, set them to `CS-U101` and `CS-SH401`.

## Lab showtimes

The initial sample shows are scheduled for **20–23 October 2026**, so they remain bookable during the October 20 assessment. All displays use IST. On a later demonstration date, run:

```powershell
node scripts/prepare-demo.js
```

This explicitly moves only the 12 synthetic sample shows to October 20 or tomorrow, whichever is later. Existing sample bookings refer to those shows, so their displayed times also move. It does not clear ratings, watchlists, or bookings. Importing the dataset again is idempotent and does not reset completed sample data.

## Verification

```powershell
npm test
npm run test:integration
```

The local app and Neo4j must be running for local integration verification. The suite creates uniquely identified disposable users, screens, seats, shows, and bookings and then removes only those test records. Current results: **10 unit checks and 19 live checks passed**. The same 19 checks also passed against the public Netlify site and Neo4j Aura, including concurrent seat booking, ownership, cancellation, private graph projections, all workspace reads, CSV export, and all ten queries. Browser verification also covered desktop/mobile layouts, ratings, screenings, seat selection, tickets, graph controls, and committed query playback.

## Architecture and boundaries

The browser uses plain HTML/CSS/JavaScript and a same-origin REST API. A Node.js HTTP server validates requests and uses the official Neo4j JavaScript driver with parameterized Cypher and managed transactions. This keeps the project runnable without a frontend build step. `pnpm-lock.yaml` pins the installed packages. Neo4j credentials never appear in frontend source or graph responses.

The desktop server binds to `127.0.0.1`. Netlify runs the same business API through a Fetch handler and disables local password setup and import routes. Session cookies are HttpOnly and SameSite Strict, with Secure enabled online. Passwords use salted scrypt hashes. Show locks serialize booking and cancellation across serverless instances, while user locks serialize rating, saving, and recommendation snapshots. The application enforces cardinality and required fields in addition to uniqueness constraints. Direct manual database edits can bypass application rules.

There is no real payment gateway, live cinema feed, email verification, password recovery, or trained machine-learning model. The recommendation score is a deterministic rule, not a probability. This academic demo has not been load-tested or benchmarked against SQL.

## Troubleshooting

- **Neo4j unavailable:** start the Desktop instance. Verify its Bolt port is 7687. Use the correct local URI if your instance uses another port.
- **Wrong password:** use the password for the DBMS instance, not your Windows password.
- **Connection already configured:** after a restart the saved connection is reused. To change it, stop the app, edit `.env` locally, and start again.
- **Port already in use:** close the earlier CineScope terminal before starting a second copy.
- **Shows have passed:** run the explicit sample schedule helper above.
- **Forgot the demo password:** sample-account buttons handle sign-in; manual demo sign-in uses `arun@example.com` (or another sample email) with `CinemaDemo2026!`. Use synthetic accounts only for this classroom demo.

Do not delete your Neo4j instance or reset its password to fix an application error.
