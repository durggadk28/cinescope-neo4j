// Run each statement separately in Neo4j Query. Compatible with Neo4j 5 and later.
CREATE CONSTRAINT cinescope_id IF NOT EXISTS FOR (n:CineScope) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT cinescope_email IF NOT EXISTS FOR (n:CineAccount) REQUIRE n.email IS UNIQUE;
CREATE CONSTRAINT cinescope_session IF NOT EXISTS FOR (n:CineSession) REQUIRE n.tokenHash IS UNIQUE;
CREATE INDEX cinescope_movie_title IF NOT EXISTS FOR (n:CineScope) ON (n.title);
