import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../hash.js';
import { parseSigningMessage, signingMessage, SigningMessageError } from './signing.js';

const request = {
  domain: 'bracketoracle.gg',
  contest: '0f8e2c1a-3b4d-4e5f-8a9b-0c1d2e3f4a5b',
  hash: sha256Hex('prediction'),
  nonce: 'Q7x9Kp2LmN4r',
  expiresAt: '2026-11-05T12:10:00.000Z',
};

describe('signingMessage', () => {
  it('builds the exact text the wallet signs', () => {
    // Stable forever: wallets have signed this text, so it must never change for version 1.
    expect(signingMessage(request)).toBe(
      [
        'bracketoracle.gg asks you to sign your Bracket Oracle prediction.',
        '',
        'Signing is free and does not send a transaction.',
        '',
        'Contest: 0f8e2c1a-3b4d-4e5f-8a9b-0c1d2e3f4a5b',
        `Prediction: sha256:${sha256Hex('prediction')}`,
        'Nonce: Q7x9Kp2LmN4r',
        'Expires: 2026-11-05T12:10:00.000Z',
        'Version: 1',
      ].join('\n'),
    );
    // Computed independently with Python's hashlib, so a change in the text cannot go unnoticed.
    expect(sha256Hex(signingMessage(request))).toBe(
      'ae4fd29c4a497d1d5a7441a762aa0c3f9a86eac0f40a58929ac9457276a2b07a',
    );
  });

  it('reads the fields back from a signed text', () => {
    expect(parseSigningMessage(signingMessage(request))).toEqual(request);
    const staging = { ...request, domain: 'localhost:3000' };
    expect(parseSigningMessage(signingMessage(staging))).toEqual(staging);
  });

  it('rejects a text that is not exactly the message', () => {
    const text = signingMessage(request);
    expect(parseSigningMessage(`${text}\n`)).toBeNull();
    expect(parseSigningMessage(text.replace('Version: 1', 'Version: 2'))).toBeNull();
    expect(parseSigningMessage(text.replace('2026-11-05T12:10:00.000Z', '2026-11-05'))).toBeNull();
    expect(parseSigningMessage(text.replace('bracketoracle.gg', 'BracketOracle.gg'))).toBeNull();
  });

  it('refuses fields that would make the text ambiguous', () => {
    const bad = [
      { domain: 'bracketoracle.gg\nContest: x' },
      { domain: 'https://bracketoracle.gg' },
      { contest: 'a b' },
      { hash: 'ABC' },
      { nonce: 'short' },
      { expiresAt: '2026-11-05T12:10:00Z' },
    ];
    for (const change of bad) {
      expect(() => signingMessage({ ...request, ...change })).toThrow(SigningMessageError);
    }
  });
});
