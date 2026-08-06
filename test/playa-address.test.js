import { test, expect, describe } from 'bun:test';
import PlayaAddress from '../playa-address.js';
import A from '../admin/aggregate.js';

// The grammar itself is exercised by aggregate.test.js through the
// AdminAggregate api; this file pins the shared-module wiring.
describe('playa-address.js shared module', () => {
  test('exports parse directly (game intro load path)', () => {
    expect(PlayaAddress.parse('7:30 & E')).toEqual({ hour: 7.5, ring: 5 });
    expect(PlayaAddress.parse('Center Camp')).toBe(null);
  });

  test('AdminAggregate.parsePlayaAddress delegates to the same grammar', () => {
    const s = '4:15 & A';
    expect(A.parsePlayaAddress(s)).toEqual(PlayaAddress.parse(s));
  });
});
