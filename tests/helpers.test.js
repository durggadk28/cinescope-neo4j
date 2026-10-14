import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordHash,passwordMatches,validateSeats,emailField,csvCell } from '../server/helpers.js';
import { asDate } from '../public/time.js';
test('Passwords are salted and verified without plaintext storage',()=>{const a=passwordHash('a secure password');const b=passwordHash('a secure password');assert.notEqual(a,b);assert.equal(passwordMatches('a secure password',a),true);assert.equal(passwordMatches('wrong password',a),false);});
test('Seat selection rejects duplicates and excessive requests',()=>{assert.throws(()=>validateSeats(['CS-S1','CS-S1']));assert.throws(()=>validateSeats([]));assert.throws(()=>validateSeats(Array.from({length:7},(_,i)=>`CS-S${i}`)));assert.deepEqual(validateSeats(['CS-SC301-A1']),['CS-SC301-A1']);});
test('Emails are normalized and invalid input is rejected',()=>{assert.equal(emailField(' Test@Example.com '),'test@example.com');assert.throws(()=>emailField('not-an-email'));});
test('CSV escapes quotes and guards spreadsheet formulas',()=>{assert.equal(csvCell('=1+1'),'"\'=1+1"');assert.equal(csvCell('a"b'),'"a""b"');});
test('Neo4j show timestamps retain their UTC offset when displayed',()=>{assert.equal(asDate('2026-10-20T18:30:00+05:30[Asia/Kolkata]').toISOString(),'2026-10-20T13:00:00.000Z');});
