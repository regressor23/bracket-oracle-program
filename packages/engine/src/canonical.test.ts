import { describe, expect, it } from 'vitest';
import { canonicalJson, CanonicalJsonError } from './canonical.js';
import { hashCanonical, sha256Hex } from './hash.js';

describe('canonicalJson', () => {
  it('sorts keys at every depth and drops whitespace', () => {
    const a = canonicalJson({ b: 1, a: { d: [3, { z: true, y: null }], c: 'x' } });
    expect(a).toBe('{"a":{"c":"x","d":[3,{"y":null,"z":true}]},"b":1}');
  });

  it('produces the same string regardless of key order', () => {
    expect(canonicalJson({ round: 1, slot: 'ub-final' })).toBe(
      canonicalJson({ slot: 'ub-final', round: 1 }),
    );
  });

  it('normalizes negative zero', () => {
    expect(canonicalJson([-0])).toBe('[0]');
  });

  it('rejects values JSON.stringify would silently drop or mangle', () => {
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(CanonicalJsonError);
    expect(() => canonicalJson({ a: undefined } as never)).toThrow(/a: unsupported type undefined/);
    expect(() => canonicalJson({ when: new Date(0) } as never)).toThrow(/plain objects/);
  });
});

describe('hashing', () => {
  it('matches the SHA-256 test vector', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('hashes canonical JSON, so key order does not matter', () => {
    expect(hashCanonical({ a: 1, b: 2 })).toBe(hashCanonical({ b: 2, a: 1 }));
    expect(hashCanonical({ a: 1, b: 2 })).toBe(sha256Hex('{"a":1,"b":2}'));
  });
});
