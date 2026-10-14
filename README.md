# CineScope

A **movie recommendation and ticket booking system using Neo4j**.

**Live project:** [Open CineScope](https://cinescope-movies-dk28.netlify.app). Choose a sample profile on the sign-in screen or create a sample account.

**Source repository:** [durggadk28/cinescope-neo4j](https://github.com/durggadk28/cinescope-neo4j).

Netlify serves the frontend and serverless API; Neo4j Aura stores the hosted data. The site works independently of this laptop. See [deployment configuration](docs/NETLIFY_DEPLOYMENT.md). The desktop launcher remains available, using its separate local database.

## Run on this computer

1. Start **MovieRecommendationDB** in Neo4j Desktop.
2. Double-click **Start-CineScope.cmd** in this folder. Keep the terminal open.
3. Open **http://localhost:3000**.
4. On first run, enter your local Neo4j password on the connection screen. The database name is usually `neo4j`, even if the Desktop instance is called MovieRecommendationDB.
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

## Project Documentation

| File | Purpose |
| --- | --- |
| `output/pdf/CineScope_DA3_Project_Report.pdf` | Project report with implementation screenshots |
| `reports/CineScope_DA3_Project_Report.md` | Editable project documentation |
| `docs/DEMO_GUIDE.md` | Application walkthrough and technical Q&A |
| `docs/GRAPH_MODEL.md` | Graph model, cardinality, and database schema design |
| `cypher/01-schema.cypher` | Constraints and index creation |
| `cypher/02-sample-model.cypher` | Sanitized standalone graph snapshot without password hashes |
| `cypher/03-demonstration-queries.cypher` | Ten Cypher query demonstrations |
| `data/movies.csv` | Sample movie data |
| `reports/database-evidence.json` | Database version, graph counts, and recommendation output |
| `reports/verification.json` | Database integration test results |
| `reports/netlify-production-verification.json` | Verification results for the public site and Neo4j Aura |
| `reports/netlify-deployment.json` | Hosted URL and deployment metadata |

Run Cypher statements individually in Neo4j Query. The model snapshot is a supplemental database demonstration and does not create usable login credentials. For the complete application, use the connection/import screen or the `server/seed.js` importer. Query Studio supplies `$userId` and `$showId` automatically; in Neo4j Query, set them to `CS-U101` and `CS-SH401`.

## Sample Data and Showtimes

CineScope includes sample users, movies, screenings, seats, and bookings for exploring the application's features.

Sample screening dates are configurable. To prepare the sample schedule, run:

```powershell
node scripts/prepare-demo.js
```

This helper adjusts the synthetic sample screenings according to its configured scheduling rules. Existing sample bookings may display the updated screening times. It does not clear ratings, watchlists, or bookings. Importing the dataset again is idempotent and does not reset completed sample data.

## Verification

```powershell
npm test
npm run test:integration
```

The local application and Neo4j must be running for local integration verification. The test suite creates uniquely identified disposable users, screens, seats, shows, and bookings, then removes only those test records.

The recorded results are **10 unit checks and 19 live checks passed**. The same 19 checks also passed against the public Netlify site and Neo4j Aura, covering concurrent seat booking, ownership, cancellation, private graph projections, workspace reads, CSV export, and all ten queries.

Browser verification also covered desktop/mobile layouts, ratings, screenings, seat selection, tickets, graph controls, and committed query playback.

## Architecture and Boundaries

The browser uses plain HTML/CSS/JavaScript and a same-origin REST API. A Node.js HTTP server validates requests and uses the official Neo4j JavaScript driver with parameterized Cypher and managed transactions. This keeps the project runnable without a frontend build step. `pnpm-lock.yaml` pins the installed packages. Neo4j credentials never appear in frontend source or graph responses.

The desktop server binds to `127.0.0.1`. Netlify runs the same business API through a Fetch handler and disables local password setup and import routes. Session cookies are HttpOnly and SameSite Strict, with Secure enabled online. Passwords use salted scrypt hashes. Show locks serialize booking and cancellation across serverless instances, while user locks serialize rating, saving, and recommendation snapshots. The application enforces cardinality and required fields in addition to uniqueness constraints. Direct manual database edits can bypass application rules.

There is no real payment gateway, live cinema feed, email verification, password recovery, or trained machine-learning model. The recommendation score is a deterministic rule, not a probability. The application has not been load-tested or benchmarked against SQL.

## Troubleshooting

- **Neo4j unavailable:** Start the Desktop instance. Verify its Bolt port is 7687. Use the correct local URI if your instance uses another port.
- **Wrong password:** Use the password for the DBMS instance, not your Windows password.
- **Connection already configured:** After a restart, the saved connection is reused. To change it, stop the app, edit `.env` locally, and start again.
- **Port already in use:** Close the earlier CineScope terminal before starting a second copy.
- **Showtimes have passed:** Run the sample schedule helper described above.
- **Sample account sign-in:** Sample-account buttons handle sign-in. Manual sign-in uses `arun@example.com` (or another sample email) with `CinemaDemo2026!`. Use sample accounts for demonstration purposes.

Do not delete your Neo4j instance or reset its password to fix an application error.
