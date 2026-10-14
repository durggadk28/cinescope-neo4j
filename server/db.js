import neo4j from 'neo4j-driver';
import { plain, fail } from './helpers.js';
import { validateDatabaseUri } from './connection-settings.js';

let driver;
let config;
export function readConfig({hosted=false}={}) {
  const env = Object.fromEntries(['NEO4J_URI','NEO4J_USER','NEO4J_PASSWORD','NEO4J_DATABASE'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  return env;
}
export async function connect(input, save = false, {hosted=false}={}) {
  const uri = input.NEO4J_URI || 'bolt://127.0.0.1:7687';
  validateDatabaseUri(uri,{hosted,save});
  const user = input.NEO4J_USER || 'neo4j';
  const database = input.NEO4J_DATABASE || 'neo4j';
  const password = input.NEO4J_PASSWORD;
  if (!password || /[\r\n]/.test(password + user + database)) fail(400, 'Enter a valid database password.');
  const next = neo4j.driver(uri, neo4j.auth.basic(user, password), { connectionTimeout: 8000, maxTransactionRetryTime: 10000, maxConnectionPoolSize: hosted?3:20, connectionAcquisitionTimeout:10000 });
  try {
    await next.verifyConnectivity();
    const session = next.session({database});
    try { await session.run('RETURN 1 AS connected'); } finally { await session.close(); }
  } catch (e) { await next.close(); throw e; }
  if (driver) await driver.close();
  driver = next;
  config = {NEO4J_URI:uri, NEO4J_USER:user, NEO4J_PASSWORD:password, NEO4J_DATABASE:database};
}
export async function initialize({hosted=false,local={}}={}) {
  if(driver)return;
  const input = {...(!hosted?local:{}),...readConfig()};
  if (input.NEO4J_PASSWORD) { try { await connect(input,false,{hosted}); } catch { console.log('Neo4j connection needs attention. Check server configuration.'); } }
}
export function configured() { return !!driver; }
export function databaseName() { return config?.NEO4J_DATABASE || 'neo4j'; }
export async function transaction(write, fn) {
  if (!driver) fail(503, 'Connect Neo4j on the setup screen first.');
  const session = driver.session({database: config.NEO4J_DATABASE});
  try { return await session[write ? 'executeWrite' : 'executeRead'](fn); } finally { await session.close(); }
}
export async function query(cypher, params = {}, write = false) {
  return transaction(write, async tx => (await tx.run(cypher,params)).records.map(r => plain(r.toObject())));
}
export const rows = result => result.records.map(r => plain(r.toObject()));
export async function health() {
  if (!driver) return {connected:false, database:databaseName()};
  try {
    const [row] = await query('MATCH (n:CineScope) RETURN count(n) AS nodes');
    return {connected:true, database:databaseName(), nodes:row.nodes};
  } catch { return {connected:false,database:databaseName()}; }
}
export async function schema() {
  for (const cypher of [
    'CREATE CONSTRAINT cinescope_id IF NOT EXISTS FOR (n:CineScope) REQUIRE n.id IS UNIQUE',
    'CREATE CONSTRAINT cinescope_email IF NOT EXISTS FOR (n:CineAccount) REQUIRE n.email IS UNIQUE',
    'CREATE CONSTRAINT cinescope_session IF NOT EXISTS FOR (n:CineSession) REQUIRE n.tokenHash IS UNIQUE',
    'CREATE INDEX cinescope_movie_title IF NOT EXISTS FOR (n:CineScope) ON (n.title)'
  ]) await query(cypher,{},true);
}
export async function close() { if(driver) await driver.close(); }
