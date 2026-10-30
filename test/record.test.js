// Copyright 2026 Quantova Inc
// SPDX-License-Identifier: Apache-2.0 OR MIT

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Q = require('..');

function freshKey() {
  return Q.generateKey();
}

function openCase(key, subject) {
  return Q.open({ key, programme: 'individual', caseNo: 'KYC 2026 0001', subject: Q.keyId(subject), officerLabel: 'Onboarding Desk' });
}

test('an open case is a well formed signed record of the officer', () => {
  const officer = freshKey();
  const customer = freshKey();
  const c = openCase(officer, customer);
  assert.strictEqual(c.format, 'qkyc/1');
  assert.strictEqual(c.type, 'open');
  assert.strictEqual(c.algorithm, 'ML-DSA-65');
  assert.strictEqual(c.signer.id, Q.keyId(officer));
  assert.strictEqual(c.statement.officerKeyId, Q.keyId(officer));
  assert.strictEqual(c.statement.subjectKeyId, Q.keyId(customer));
  assert.match(c.statement.kycId, /^[0-9a-f]{32}$/);
  assert.strictEqual(Buffer.from(c.signature, 'base64').length, Q.SIGNATURE_BYTES);
});

test('the assess, screen and refresh records chain to the same case', () => {
  const officer = freshKey();
  const customer = freshKey();
  const c = openCase(officer, customer);
  const a = Q.assess({ key: officer, kyc: c, level: 'standard', result: 'pass' });
  const s = Q.screen({ key: officer, record: c, outcome: 'clear' });
  const r = Q.refresh({ key: officer, record: s });
  assert.strictEqual(a.statement.kycId, c.statement.kycId);
  assert.strictEqual(a.statement.openRef, Q.recordRef(c));
  assert.strictEqual(s.statement.priorRef, Q.recordRef(c));
  assert.strictEqual(r.statement.priorRef, Q.recordRef(s));
  assert.strictEqual(a.statement.result, 'pass');
});

test('invalid inputs are refused before anything is signed', () => {
  const key = freshKey();
  const customer = freshKey();
  const base = { key, programme: 'individual', caseNo: 'C1', subject: Q.keyId(customer) };
  assert.throws(() => Q.open(Object.assign({}, base, { programme: 'vip' })), /programme must be one of/);
  assert.throws(() => Q.open(Object.assign({}, base, { caseNo: '' })), /caseNo is 1 to/);
  assert.throws(() => Q.open(Object.assign({}, base, { subject: 'nothex' })), /subject is a/);
  assert.throws(() => Q.open(Object.assign({}, base, { unknownField: 1 })), /is not an option of open/);
  const c = openCase(key, customer);
  assert.throws(() => Q.assess({ key, kyc: c, level: 'ultra', result: 'pass' }), /level must be one of/);
  assert.throws(() => Q.screen({ key, record: c, outcome: 'maybe' }), /outcome must be one of/);
});

test('a signing key must be a well formed 32 byte seed', () => {
  const customer = freshKey();
  assert.throws(() => openCase(new Uint8Array(16), customer), /32 byte Uint8Array seed/);
  assert.throws(() => openCase(new Uint8Array(32), customer), /too few different byte values/);
});

test('a well formed record verifies and a type mismatch is invalid', async () => {
  const officer = freshKey();
  const customer = freshKey();
  const c = openCase(officer, customer);
  const ok = await Q.verify(c, { type: 'open', network: 'testnet', requireAnchor: false, strict: false });
  assert.strictEqual(ok.status, 'valid');
  assert.strictEqual(ok.type, 'open');
  assert.strictEqual(ok.kycId, c.statement.kycId);
  const wrongType = await Q.verify(c, { type: 'assess', network: 'testnet', requireAnchor: false, strict: false });
  assert.strictEqual(wrongType.status, 'invalid');
  const wrongSigner = await Q.verify(c, { type: 'open', network: 'testnet', requireAnchor: false, strict: false, signerKeyId: Q.keyId(freshKey()) });
  assert.strictEqual(wrongSigner.status, 'invalid');
});

test('a tampered statement no longer verifies', async () => {
  const officer = freshKey();
  const customer = freshKey();
  const c = openCase(officer, customer);
  const forged = JSON.parse(JSON.stringify(c));
  forged.statement.programme = 'enhanced';
  const r = await Q.verify(forged, { type: 'open', network: 'testnet', requireAnchor: false, strict: false });
  assert.strictEqual(r.status, 'invalid');
  assert.ok(r.checks.some((ch) => ch.name === 'signature' && !ch.ok));
});

test('the prior link binds an assessment to the open case it refers to', async () => {
  const officer = freshKey();
  const customer = freshKey();
  const c = openCase(officer, customer);
  const a = Q.assess({ key: officer, kyc: c, level: 'standard', result: 'pass' });
  const good = await Q.verify(a, { type: 'assess', network: 'testnet', requireAnchor: false, strict: false, prior: c });
  assert.ok(good.checks.some((ch) => ch.name === 'prior' && ch.ok));
  const otherCase = openCase(officer, customer);
  const bad = await Q.verify(a, { type: 'assess', network: 'testnet', requireAnchor: false, strict: false, prior: otherCase });
  assert.strictEqual(bad.status, 'invalid');
  assert.ok(bad.checks.some((ch) => ch.name === 'prior' && !ch.ok));
});

test('subjectRef is deterministic for the same secret and reference and differs otherwise', () => {
  const secret = new Uint8Array(32);
  globalThis.crypto.getRandomValues(secret);
  const a = Q.subjectRef(secret, 'KYC 2026 0001');
  const b = Q.subjectRef(secret, 'KYC 2026 0001');
  const c = Q.subjectRef(secret, 'KYC 2026 0002');
  assert.strictEqual(a, b);
  assert.notStrictEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('the kind and constants are the ones pinned for the kyc line', () => {
  assert.strictEqual(Q.KIND, 1506);
  assert.strictEqual(Q.FORMAT, 'qkyc/1');
  assert.deepStrictEqual([...Q.TYPES], ['open', 'assess', 'screen', 'refresh', 'close']);
  assert.deepStrictEqual([...Q.PROGRAMMES], ['individual', 'business', 'enhanced']);
  assert.deepStrictEqual([...Q.OUTCOMES], ['clear', 'hit', 'review']);
});
