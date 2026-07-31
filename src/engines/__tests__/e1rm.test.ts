import { describe, expect, it } from 'vitest';
import { epley1RM } from '../e1rm';

describe('canonical Epley e1RM', () => {
  it('uses the Epley 30-rep constant', () => {
    expect(epley1RM(100, 1)).toBe(103);
    expect(epley1RM(100, 10)).toBe(133);
    expect(epley1RM(100, 30)).toBe(200);
  });
  it('guards invalid inputs', () => {
    expect(epley1RM(0, 10)).toBe(0);
    expect(epley1RM(100, 0)).toBe(0);
    expect(epley1RM(-10, 5)).toBe(0);
  });
});
