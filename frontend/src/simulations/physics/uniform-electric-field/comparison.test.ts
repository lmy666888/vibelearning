import { describe, expect, it } from 'vitest';
import { calculateDifference, compareExperiments } from './comparison';
import { getPreset } from './presets';

describe('comparison differences', () => {
  it('reports a doubled positive component as +100 percent', () => {
    const d = calculateDifference(0.2, 0.4);
    expect(d.delta).toBeCloseTo(0.2); expect(d.percent).toBeCloseTo(100);
  });
  it('uses absolute baseline for negative components', () => {
    expect(calculateDifference(-0.2, 0.2).percent).toBeCloseTo(200);
    expect(calculateDifference(-0.2, -0.4).percent).toBeCloseTo(-100);
  });
  it('distinguishes reversal from unchanged magnitude', () => {
    const rows = compareExperiments(getPreset('positive-charge').parameters, getPreset('negative-charge').parameters);
    expect(rows.find(r => r.id === 'ay')?.percent).toBeCloseTo(-200);
    expect(rows.find(r => r.id === 'ay')?.kind).toBe('component');
    expect(rows.find(r => r.id === 'acceleration-magnitude')?.percent).toBe(0);
  });
  it.each([0, 1, -1])('handles zero baseline to %s without NaN or Infinity', value => {
    const d = calculateDifference(0, value);
    expect(d).toEqual({ delta: value, percent: null, reason: 'zero-baseline' });
  });
  it('preserves precision for nearby large finite values', () => {
    expect(calculateDifference(1e16, 1e16 + 2).percent).toBeCloseTo(2e-14, 25);
  });
  it('handles zero current', () => expect(calculateDifference(2, 0).percent).toBe(-100));
  it('handles overflow explicitly', () => {
    expect(calculateDifference(-1e308, 1e308)).toMatchObject({ delta: null, reason: 'numeric-range' });
    expect(calculateDifference(Number.MIN_VALUE, 1e308).percent).toBeNull();
  });
  it('rejects nonfinite input', () => expect(() => calculateDifference(NaN, 1)).toThrow());
  it('reports all eleven quantities using SI-derived force and acceleration', () => {
    const rows = compareExperiments(getPreset('positive-charge').parameters, getPreset('stronger-field').parameters);
    expect(rows).toHaveLength(11);
    expect(rows.find(r => r.id === 'charge')?.current).toBeCloseTo(2);
    expect(rows.find(r => r.id === 'mass')?.current).toBeCloseTo(1);
    expect(rows.find(r => r.id === 'fy')?.current).toBeCloseTo(4e-7, 12);
    expect(rows.find(r => r.id === 'acceleration-magnitude')?.current).toBeCloseTo(0.4);
  });
});
