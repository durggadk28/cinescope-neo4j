# CineScope on Netlify

The frontend is served by Netlify's CDN and the complete `/api/*` backend runs in a Node.js Netlify Function. Business data stays in Neo4j Aura. Your desktop Neo4j database continues to support the local app independently.

**Live site:** [CineScope](https://cinescope-movies-dk28.netlify.app)

**Owner dashboard:** [Netlify project](https://app.netlify.com/projects/cinescope-movies-dk28)

Deployed and verified on 14 October 2026 using a Netlify Free project and the Neo4j Aura Free instance named **CineScope Movies**. The production page is public; CineScope still requires app sign-in. Sample-account buttons make the synthetic classroom profiles available for demonstration. Local and cloud data are separate copies.

## Deployment configuration

- Publish directory: `public`
- Functions directory: `netlify/functions`
- Function entry: `api.mjs`, routed to `/api/*`
- Runtime: Node.js 24
- Database: Neo4j Aura over `neo4j+s://` with certificate validation
- Required server environment variables: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `NEO4J_DATABASE`

Set the variables through Netlify's environment-variable UI or API, with Functions/runtime scope. Do not place database credentials in `netlify.toml`, the public directory, or frontend code. The cloud password should be marked as a secret. Redeploy after changing runtime variables.

The public deployment disables the desktop password setup and seed routes. The owner initializes the cloud sample graph using the downloaded Aura credentials and `scripts/configure-cloud.js`. Hosted sessions use Secure, HttpOnly, SameSite Strict cookies. Booking and cancellation locks still operate in Neo4j, so they apply across function instances.

## Local operation

`Start-CineScope.cmd` still starts the original desktop server. `server/local-config.js` is loaded only by desktop startup and local management scripts. It is absent from the hosted function bundle. Browser preferences remain local to each browser; business data and sessions persist in the selected Neo4j database.

## Verification

The full 19-check live suite can exercise the Netlify function adapter:

```powershell
$env:TEST_NETLIFY_ADAPTER='1'
node scripts/verify-live.js
```

Run that command locally with a test-capable Neo4j connection. Its fixtures are isolated and cleaned up. The result is saved separately in `reports/netlify-adapter-verification.json`. Hosting-specific unit checks verify secure database connection schemes, private configuration separation, blocked setup/import routes, and origin checking.

Before publishing, inspect the built function archive to ensure it contains no `.env`, `.local`, report, or credential files. A real hosted URL is recorded only after deployment and cloud-backed sign-in, reads, and writes succeed.

The public deployment passed all **19 live checks**, including registration, private watchlists, explainable recommendations, concurrent seat claims, cancellation, CSV export, curated queries, origin checking, and session revocation. Results are saved in `reports/netlify-production-verification.json`; deployment metadata is in `reports/netlify-deployment.json`. Ten unit checks passed. The built archive was checked for private files and credential literals before upload.

For an owner-run production verification, load the cloud connection into the current process without printing credentials, set `TEST_BASE_URL` to the live URL and `TEST_EVIDENCE_PATH` to a separate result file, then run `scripts/verify-live.js`. It uses the connection for isolated fixtures and the public URL for all application requests. Keep cloud credentials in ignored `.local` files or server environment variables.

## Before the October 20 demonstration

Aura Free automatically pauses after 72 hours of inactivity. Before the lab, open the live site and check the connection. If the database is paused, open [Aura Console](https://console.neo4j.io/), find **CineScope Movies**, click its Play/Resume control, wait for Running, and reload CineScope. Data is retained while paused. This behavior is documented in [Aura instance actions](https://neo4j.com/docs/aura/managing-instances/instance-actions/).

## References

- [Netlify Functions setup](https://docs.netlify.com/build/functions/get-started/)
- [Function configuration and routing](https://docs.netlify.com/build/functions/configuration/)
- [Runtime environment variables](https://docs.netlify.com/build/functions/environment-variables/)
- [Neo4j Aura connection settings](https://neo4j.com/docs/aura/getting-started/connect-instance/)
