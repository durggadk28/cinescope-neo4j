// Parameters for Neo4j Browser / Query: userId = CS-U101, showId = CS-SH401.
// Use the in-app Query Studio to run these with parameters automatically.

// Graph overview
// Count nodes by label and relationships by type.
MATCH (n:CineScope) UNWIND [l IN labels(n) WHERE l <> 'CineScope' AND l <> 'CineAccount'] AS label RETURN label, count(*) AS nodes ORDER BY nodes DESC;

// Movies and genres
// Traverse the many-to-many genre connections.
MATCH (m:Movie:CineScope)-[:IN_GENRE]->(g:Genre) RETURN m.title AS movie, collect(g.name) AS genres ORDER BY movie;

// Movie → show → theatre
// Replace the relational movie, show, screen, and theatre joins with a graph pattern.
MATCH (m:Movie:CineScope)<-[:SCREENING_OF]-(s:Show)-[:USES_SCREEN]->(sc:Screen)<-[:HAS_SCREEN]-(t:Theatre) RETURN m.title AS movie, toString(s.startTime) AS showTime, t.name AS theatre, sc.name AS screen, s.ticketPrice AS price ORDER BY showTime;

// Explain a recommendation
// Combine liked genres, similar viewers, and sample catalogue ratings.

MATCH (u:User:CineScope {id:$userId})
MATCH (m:Movie:CineScope)
WHERE NOT EXISTS { MATCH (u)-[:RATED]->(m) }
CALL { WITH u, m
  OPTIONAL MATCH (u)-[r:RATED]->(liked:Movie)-[:IN_GENRE]->(g:Genre)<-[:IN_GENRE]-(m)
  WHERE r.stars >= 4
  RETURN count(DISTINCT liked) AS relatedFilms, collect(DISTINCT g.name) AS matchingGenres,
         count(r) AS genreWeight
}
CALL { WITH u, m
  OPTIONAL MATCH (u)-[a:RATED]->(common:Movie)<-[b:RATED]-(peer:User:CineScope)-[c:RATED]->(m)
  WHERE a.stars >= 4 AND b.stars >= 4 AND c.stars >= 4 AND peer <> u
  RETURN count(DISTINCT peer) AS similarViewers
}
WITH m, matchingGenres, relatedFilms, similarViewers,
     CASE WHEN genreWeight * 12 > 60 THEN 60 ELSE genreWeight * 12 END AS genrePoints,
     CASE WHEN similarViewers * 10 > 30 THEN 30 ELSE similarViewers * 10 END AS peerPoints
RETURN m {.*, genres: [(m)-[:IN_GENRE]->(g:Genre) | g.name], language: head([(m)-[:IN_LANGUAGE]->(l:Language) | l.name])} AS movie, matchingGenres, relatedFilms, similarViewers,
       genrePoints, peerPoints, m.rating AS qualityPoints,
       round(genrePoints + peerPoints + m.rating, 1) AS score
ORDER BY score DESC, m.rating DESC, m.title ASC LIMIT 12;

// Seat availability
// Cancelled bookings do not block a seat; active bookings do.
MATCH (s:Show:CineScope {id:$showId})-[:USES_SCREEN]->(:Screen)-[:HAS_SEAT]->(seat:Seat) WHERE NOT EXISTS { MATCH (b:Booking:CineScope {status:'CONFIRMED'})-[:FOR_SHOW]->(s) MATCH (b)-[:BOOKED_SEAT]->(seat) } RETURN seat.number AS seat, seat.type AS type ORDER BY seat;

// Booking journey
// Traverse one user’s bookings, screenings, and booked seats.
MATCH (u:User:CineScope {id:$userId})-[:BOOKED]->(b:Booking)-[:FOR_SHOW]->(s:Show)-[:SCREENING_OF]->(m:Movie) OPTIONAL MATCH (b)-[:BOOKED_SEAT]->(seat:Seat) RETURN u.name AS user, b.id AS booking, m.title AS movie, b.status AS status, b.amount AS amount, collect(seat.number) AS seats ORDER BY booking;

// Confirmed booking totals
// Aggregate actual confirmed sample bookings; payments are simulated.
MATCH (b:Booking:CineScope {status:'CONFIRMED'})-[:FOR_SHOW]->(:Show)-[:SCREENING_OF]->(m:Movie) RETURN m.title AS movie, count(b) AS bookings, sum(b.tickets) AS tickets, sum(b.amount) AS simulatedAmount ORDER BY simulatedAmount DESC;

// Sample users without bookings
// The graph equivalent of the DA2 NOT EXISTS subquery, restricted to synthetic profiles.
MATCH (u:User:CineScope) WHERE u.demo=true AND NOT EXISTS { MATCH (u)-[:BOOKED]->(:Booking) } RETURN u.name AS user ORDER BY user;

// Movies related to Interstellar
// Find shared genres without a stored recommendation table.
MATCH (source:Movie:CineScope {id:'CS-M101'})-[:IN_GENRE]->(g:Genre)<-[:IN_GENRE]-(candidate:Movie:CineScope) WHERE source <> candidate RETURN candidate.title AS movie, collect(g.name) AS sharedGenres ORDER BY movie;

// Show price aggregation
// Equivalent to DA2 AVG and MAX operations.
MATCH (s:Show:CineScope) RETURN round(avg(s.ticketPrice),2) AS averagePrice, max(s.ticketPrice) AS highestPrice, min(s.ticketPrice) AS lowestPrice;
