import { describe, expect, it } from 'vitest';
import { rankEntries } from './rank.js';

const places = (ranked: ReturnType<typeof rankEntries>) =>
  ranked.map(
    (r) => `${r.id} ${r.place.from}${r.place.to === r.place.from ? '' : `-${r.place.to}`}`,
  );

describe('rankEntries', () => {
  it('ranks by points first', () => {
    const ranked = rankEntries(
      [
        { id: 'low', points: 100, tiebreak: 39 },
        { id: 'high', points: 300, tiebreak: 10 },
      ],
      39,
    );
    expect(places(ranked)).toEqual(['high 1', 'low 2']);
  });

  it('breaks equal points by the distance to the actual number of maps', () => {
    const ranked = rankEntries(
      [
        { id: 'far', points: 100, tiebreak: 30 },
        { id: 'close', points: 100, tiebreak: 40 },
        { id: 'over', points: 100, tiebreak: 37 },
      ],
      39,
    );
    expect(places(ranked)).toEqual(['close 1', 'over 2', 'far 3']);
    expect(ranked.map((r) => r.distance)).toEqual([1, 2, 9]);
  });

  it('puts an empty tie-break last among equal points, not below lower points', () => {
    const ranked = rankEntries(
      [
        { id: 'empty', points: 100, tiebreak: null },
        { id: 'answered', points: 100, tiebreak: 80 },
        { id: 'lower', points: 90, tiebreak: 39 },
      ],
      39,
    );
    expect(places(ranked)).toEqual(['answered 1', 'empty 2', 'lower 3']);
  });

  it('shares places when points and distance are equal', () => {
    const ranked = rankEntries(
      [
        { id: 'top', points: 200, tiebreak: 39 },
        { id: 'b', points: 100, tiebreak: 37 },
        { id: 'a', points: 100, tiebreak: 41 },
        { id: 'c', points: 100, tiebreak: null },
        { id: 'd', points: 100, tiebreak: null },
        { id: 'last', points: 0, tiebreak: 39 },
      ],
      39,
    );
    expect(places(ranked)).toEqual(['top 1', 'a 2-3', 'b 2-3', 'c 4-5', 'd 4-5', 'last 6']);
  });

  it('shares places on equal points until the actual number of maps is known', () => {
    const ranked = rankEntries([
      { id: 'b', points: 100, tiebreak: 30 },
      { id: 'a', points: 100, tiebreak: null },
    ]);
    expect(places(ranked)).toEqual(['a 1-2', 'b 1-2']);
    expect(ranked.every((r) => r.distance === null)).toBe(true);
  });
});
