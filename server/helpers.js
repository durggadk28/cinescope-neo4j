import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const fail = (status, message) => { throw new AppError(status, message); };
export const uid = prefix => `CS-${prefix}-${randomBytes(9).toString('hex')}`;
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function passwordMatches(password, hash) {
  if (typeof hash !== 'string' || !hash.includes(':')) return false;
  const [salt, key] = hash.split(':');
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function textField(value, name, min = 1, max = 100) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(400, `${name} must contain ${min}–${max} characters.`);
  return value.trim();
}
export function idField(value) {
  if (typeof value !== 'string' || !/^CS-[A-Za-z0-9-]{1,80}$/.test(value)) fail(400, 'Invalid record identifier.');
  return value;
}
export function emailField(value) {
  const email = textField(value, 'Email', 5, 150).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.');
  return email;
}
export function validateSeats(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 6) fail(400, 'Choose between one and six seats.');
  values.forEach(idField);
  if (new Set(values).size !== values.length) fail(400, 'A seat can only be selected once.');
  return values;
}
export function plain(value) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value.toNumber === 'function') return value.toNumber();
  if (Array.isArray(value)) return value.map(plain);
  if (value.constructor && /^(Date|DateTime|LocalDateTime|Time|LocalTime|Duration)$/.test(value.constructor.name)) return value.toString();
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, plain(v)]));
  return value;
}
export function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
