# CineScope — Movie Recommendation & Booking Platform

CineScope is a movie recommendation and booking platform designed to help users discover movies, explore personalized recommendations, manage watchlists, and book movie seats through an interactive web interface.

**Live Demo:** [CineScope](https://cinescope-movies-dk28.netlify.app)

**Tech Stack**
- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Netlify Functions
- **Database:** Neo4j Aura
- **Deployment:** Netlify

## Features

- **User Authentication:** Registration, sign-in, and session management.
- **Movie Recommendations:** Personalized recommendations with explanations.
- **Watchlists:** Create and manage private movie watchlists.
- **Seat Booking:** Claim seats and manage bookings.
- **Booking Cancellation:** Cancel existing bookings.
- **Interactive Movie Discovery:** Explore movies and curated queries.
- **Data Export:** Export supported data in CSV format.
- **Cloud Deployment:** Hosted frontend and serverless API connected to Neo4j Aura.

## Architecture

CineScope uses a serverless architecture. The frontend is delivered through Netlify's CDN, while API requests are handled by Netlify Functions running on Node.js. Neo4j Aura stores the application's graph data and supports recommendation queries and booking operations.

Database credentials are configured through server-side environment variables rather than exposed in the frontend.

## Local Setup

The project also supports local development with a desktop Neo4j database. Local and cloud databases operate independently, so their data may differ.

To run the application locally, use the provided `Start-CineScope.cmd` launcher and follow the project's local configuration instructions.

## Deployment

The application is deployed on Netlify and uses Neo4j Aura for cloud database operations.

For deployment configuration, environment variables, and Netlify Functions, refer to the official documentation:

- [Netlify Functions](https://docs.netlify.com/build/functions/get-started/)
- [Netlify Environment Variables](https://docs.netlify.com/build/functions/environment-variables/)
- [Neo4j Aura](https://neo4j.com/docs/aura/getting-started/connect-instance/)

## Future Improvements

- Enhanced recommendation algorithms
- More advanced movie discovery and filtering
- Improved booking and user experience
- Additional analytics and personalized features
