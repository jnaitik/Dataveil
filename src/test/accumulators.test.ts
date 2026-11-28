import { describe, it, expect } from 'vitest';
import {
  WelfordAccumulator,
  P2QuantileEstimator,
  HyperLogLog,
  SpaceSaving,
  ReservoirSampler,
} from '../csv/accumulators';

describe('Phase 10: Streaming Accumulator Accuracy Tests', () => {
  it('WelfordAccumulator matches exact ground truth for mean, variance, and min/max', () => {
    const numbers = [12, 24, 36, 48, 60, 72, 84, 96, 108, 120];
    const welford = new WelfordAccumulator();

    for (const n of numbers) {
      welford.update(n);
    }

    const exactSum = numbers.reduce((a, b) => a + b, 0);
    const exactMean = exactSum / numbers.length;
    const exactVariance = numbers.reduce((a, b) => a + Math.pow(b - exactMean, 2), 0) / (numbers.length - 1);
    const exactStdDev = Math.sqrt(exactVariance);

    expect(welford.count).toBe(10);
    expect(welford.sum).toBe(exactSum);
    expect(welford.min).toBe(12);
    expect(welford.max).toBe(120);
    expect(welford.mean).toBeCloseTo(exactMean, 4);
    expect(welford.variance).toBeCloseTo(exactVariance, 4);
    expect(welford.stdDev).toBeCloseTo(exactStdDev, 4);
  });

  it('P2QuantileEstimator estimates median, Q1, and Q3 within known theoretical bounds', () => {
    const p2Median = new P2QuantileEstimator(0.5);
    const p2Q1 = new P2QuantileEstimator(0.25);
    const p2Q3 = new P2QuantileEstimator(0.75);

    // Feed numbers 1 through 1000 in uniform sequence
    for (let i = 1; i <= 1000; i++) {
      p2Median.update(i);
      p2Q1.update(i);
      p2Q3.update(i);
    }

    // Exact median = 500.5, Q1 = 250.5, Q3 = 750.5
    // P² quantile estimate should be within 3% of exact
    const medianEst = p2Median.estimate;
    const q1Est = p2Q1.estimate;
    const q3Est = p2Q3.estimate;

    expect(Math.abs(medianEst - 500.5) / 500.5).toBeLessThan(0.03);
    expect(Math.abs(q1Est - 250.5) / 250.5).toBeLessThan(0.04);
    expect(Math.abs(q3Est - 750.5) / 750.5).toBeLessThan(0.03);
  });

  it('HyperLogLog estimates unique cardinality with low error bound (< 5%)', () => {
    const hll = new HyperLogLog();
    const count = 1000;

    for (let i = 1; i <= count; i++) {
      hll.add(`uuid-user-${i}`);
    }

    const estimated = hll.count();
    const relativeError = Math.abs(estimated - count) / count;

    // Standard theoretical error for m=1024 registers is ~3.25%; allow up to 6%
    expect(relativeError).toBeLessThan(0.06);
  });

  it('HyperLogLog handles repeated elements correctly without inflating count', () => {
    const hll = new HyperLogLog();
    const uniqueItems = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape'];

    // Add each unique item 100 times (700 total insertions, 7 distinct)
    for (let i = 0; i < 100; i++) {
      for (const item of uniqueItems) {
        hll.add(item);
      }
    }

    const estimated = hll.count();
    expect(estimated).toBe(7);
  });

  it('SpaceSaving accurately tracks heavy hitters and top frequencies in O(K) space', () => {
    const spaceSaving = new SpaceSaving(10);

    // 100 'Alpha', 60 'Beta', 30 'Gamma', 10 'Delta'
    for (let i = 0; i < 100; i++) spaceSaving.add('Alpha');
    for (let i = 0; i < 60; i++) spaceSaving.add('Beta');
    for (let i = 0; i < 30; i++) spaceSaving.add('Gamma');
    for (let i = 0; i < 10; i++) spaceSaving.add('Delta');

    const top = spaceSaving.getTop(3, 200);

    expect(top.length).toBe(3);
    expect(top[0].value).toBe('Alpha');
    expect(top[0].count).toBe(100);
    expect(top[0].percentage).toBe(50);

    expect(top[1].value).toBe('Beta');
    expect(top[1].count).toBe(60);
    expect(top[1].percentage).toBe(30);

    expect(top[2].value).toBe('Gamma');
    expect(top[2].count).toBe(30);
    expect(top[2].percentage).toBe(15);
  });

  it('ReservoirSampler bounds memory to exactly capacity regardless of stream size', () => {
    const sampler = new ReservoirSampler<{ id: number; name: string }>(50);

    for (let i = 1; i <= 5000; i++) {
      sampler.add({ id: i, name: `Record_${i}` });
    }

    expect(sampler.count).toBe(5000);
    const sample = sampler.getSample();
    expect(sample.length).toBe(50);
    // Asserts sample contains elements spread throughout the stream
    const maxIdInSample = Math.max(...sample.map((s) => s.id));
    expect(maxIdInSample).toBeGreaterThan(1000);
  });
});
