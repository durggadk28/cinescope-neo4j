// Neo4j includes an IANA zone suffix; JavaScript Date accepts the numeric offset.
export const asDate = value => new Date(String(value).replace(/\[[^\]]+\]$/, ''));
