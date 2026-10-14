# October 20 lab demonstration

The teacher requires a formal report in Teams and an in-person demonstration on **20 October 2026 during the lab session**. Upload the PDF yourself after checking the student details. No Teams submission has been made.

**Hosted demonstration:** open [CineScope](https://cinescope-movies-dk28.netlify.app) and choose Arun's sample profile. This uses the Neo4j Aura database named CineScope Movies and does not require the laptop database or local terminal. The same walkthrough below applies. Open the report alongside it and use Aura's Query tool for direct database demonstrations. Local and hosted accounts and bookings are separate data copies.

Check the hosted connection before the lab. Aura Free pauses after 72 hours without activity; if needed, resume **CineScope Movies** in [Aura Console](https://console.neo4j.io/) and reload the site. See the [deployment guide](NETLIFY_DEPLOYMENT.md) for the verified provider instructions.

## Before the lab

1. Start MovieRecommendationDB in Neo4j Desktop.
2. Double-click Start-CineScope.cmd and open http://localhost:3000.
3. Select Arun's sample account. The saved database connection is reused.
4. Check that Interstellar shows October 20 and has available seats. If demonstrating after that date, explicitly run `node scripts/prepare-demo.js`.
5. Open the PDF report and Neo4j Query next to the app. Keep the Neo4j instance and app terminal running.

## A seven-minute walkthrough

1. **Explain the problem:** recommendations and ticket booking have connected users, movies, genres, shows, screens, and seats.
2. **Show Discover:** search for a film and combine language/genre filters. Mention that catalogue ratings are sample values.
3. **Show For you:** explain why Arun receives The Martian. He likes Interstellar and Inception; The Martian shares genres and is liked by Priya, who also likes Interstellar.
4. **Open Settings:** enable Cypher playback. Rate a film or save it, then show the committed query and parameters.
5. **Show the graph:** select Arun and a genre. Explain RATED, SAVED, IN_GENRE, and IN_LANGUAGE. Zoom and pan.
6. **Book:** open Interstellar, choose A3 or another free seat, and confirm a sample booking. A1/A2 are already booked; A3 was linked to a cancelled booking and is available. No real payment occurs.
7. **Cancel:** open My tickets, cancel the new booking, and return to the seat map. The seat becomes available and the cancelled record remains in history.
8. **Run Query Studio:** show Movies and genres, Movie → show → theatre, Seat availability, and Show price aggregation. Results come from Neo4j.
9. **Finish with the report:** show the graph schema, sample counts, SQL comparison, screenshots, and passed checks.

Counts change when you add bookings, ratings, watchlists, or snapshots. The report's baseline counts are a dated verified sample, not permanent totals.

## Useful viva answers

**Why Neo4j?** The recommendation follows User → liked Movie → Genre → candidate Movie and User → shared Movie → similar User → candidate Movie. Explicit relationships and Cypher patterns make these traversals easy to model and explain.

**Why not say Neo4j is always faster?** SQL can implement the same application. Performance depends on data size, indexes, query plans, and workload. This project has not measured a SQL benchmark.

**Is this machine learning?** No. It is explainable rule-based graph matching using genres and shared likes.

**Where is the recommendation table?** Recommendations are calculated dynamically. Save snapshot stores RECOMMENDED edges with score, reason, and generation time. Refresh removes the old snapshot edges and replaces them inside a transaction.

**Where is payment?** DA2 combined payment details with booking. The graph Booking retains those properties. All payment and refund values are simulated.

**How do you avoid double booking?** The API acquires a write lock on the Show before checking future time, screen membership, and active bookings. It creates the booking in the same managed transaction. Cancellation takes the same show lock. The live test sends two requests for one seat and verifies exactly one succeeds.

**Does a uniqueness constraint validate seat availability?** No. The constraint makes identifiers unique. Availability and the other business rules need transactional backend checks.

**What happens when a booking is cancelled?** Its status changes; it is retained for history. The availability query ignores cancelled bookings.

**What is stored in a relationship?** RATED stores the user's stars, SAVED stores a timestamp, and RECOMMENDED snapshots store the match score and explanation.

**Why is a screen-seat identifier combined?** DA2's seat key was `(screen_id, seat_no)`. `CS-SC301-A1` expresses both parts as a stable unique graph identifier.

**What is the new-account fallback?** Without liked films or matching viewers, unrated movies are ordered by their sample catalogue rating.

**How is it hosted?** Netlify serves the interface and a serverless Node.js API. The API connects to Neo4j Aura through encrypted connections. Database credentials stay in server environment variables. The public site passed the same 19 live checks as the local app.

**What is not implemented?** Real payments, live cinema feeds, password recovery, and a trained recommendation model. This academic demo does not claim production load capacity.
