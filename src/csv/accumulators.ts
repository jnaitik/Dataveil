/**
 * Streaming Single-Pass Accumulators for High-Volume CSV Profiling (up to 500 MB).
 * 
 * Bounded memory design:
 * - Welford's Algorithm: Mean, variance, and standard deviation in O(1) space.
 * - P² Quantile Estimators: Single-pass median, Q1, Q3, and IQR in O(1) space (Jain & Chlamtac 1985).
 * - HyperLogLog: Streaming cardinality estimation with 1024 registers (~1 KB RAM, ~3.25% standard error).
 * - Space-Saving Algorithm: Bounded top-K frequent elements in O(K) space (Metwally et al.).
 * - Reservoir Sampling: Bounded uniform sample of 50 rows in O(1) space (Algorithm R).
 */

export const MISSING_VALUES = new Set(['', 'null', 'none', 'nan', 'na', 'n/a', '-', 'undefined', '?']);
export const DATE_REGEX = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$|^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/;
export const BOOLEAN_VALUES = new Set(['true', 'false', 'yes', 'no', 't', 'f']);

/**
 * 32-bit MurmurHash3 for fast streaming hashing of strings
 */
export function murmurHash3(key: string, seed = 0): number {
  let h1 = seed >>> 0;
  const remainder = key.length & 3;
  const bytes = key.length - remainder;

  for (let i = 0; i < bytes; i += 4) {
    let k1 =
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(i + 1) & 0xff) << 8) |
      ((key.charCodeAt(i + 2) & 0xff) << 16) |
      ((key.charCodeAt(i + 3) & 0xff) << 24);

    k1 = Math.imul(k1, 0xcc9e2d51);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, 0x1b873593);

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = (Math.imul(h1, 5) + 0xe6546b64) >>> 0;
  }

  let k1 = 0;
  if (remainder === 3) {
    k1 ^= (key.charCodeAt(bytes + 2) & 0xff) << 16;
  }
  if (remainder >= 2) {
    k1 ^= (key.charCodeAt(bytes + 1) & 0xff) << 8;
  }
  if (remainder >= 1) {
    k1 ^= key.charCodeAt(bytes) & 0xff;
    k1 = Math.imul(k1, 0xcc9e2d51);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, 0x1b873593);
    h1 ^= k1;
  }

  h1 ^= key.length;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

/**
 * Welford's algorithm for online variance and standard deviation
 */
export class WelfordAccumulator {
  count = 0;
  sum = 0;
  min = Infinity;
  max = -Infinity;
  mean = 0;
  private m2 = 0;

  update(x: number): void {
    this.count++;
    this.sum += x;
    if (x < this.min) this.min = x;
    if (x > this.max) this.max = x;

    const delta = x - this.mean;
    this.mean += delta / this.count;
    const delta2 = x - this.mean;
    this.m2 += delta * delta2;
  }

  get variance(): number {
    return this.count > 1 ? this.m2 / (this.count - 1) : 0;
  }

  get stdDev(): number {
    return Math.sqrt(this.variance);
  }
}

/**
 * P² Algorithm for Dynamic Quantile Estimation (Jain & Chlamtac 1985)
 * O(1) space, exact 5 markers per quantile.
 */
export class P2QuantileEstimator {
  private p: number;
  private q: number[] = [];
  private n: number[] = [1, 2, 3, 4, 5];
  private nPrime: number[];
  private dnPrime: number[];
  private count = 0;
  private initialBuffer: number[] = [];

  constructor(p: number) {
    if (p <= 0 || p >= 1) throw new Error('Quantile p must be between 0 and 1');
    this.p = p;
    this.nPrime = [1, 1 + 2 * p, 1 + 4 * p, 3 + 2 * p, 5];
    this.dnPrime = [0, p / 2, p, (1 + p) / 2, 1];
  }

  update(x: number): void {
    this.count++;

    // Initial 5 observations
    if (this.count <= 5) {
      this.initialBuffer.push(x);
      if (this.count === 5) {
        this.initialBuffer.sort((a, b) => a - b);
        this.q = [...this.initialBuffer];
      }
      return;
    }

    // Find cell k
    let k = -1;
    if (x < this.q[0]) {
      this.q[0] = x;
      k = 0;
    } else if (x >= this.q[4]) {
      this.q[4] = x;
      k = 3;
    } else {
      for (let i = 0; i < 4; i++) {
        if (x >= this.q[i] && x < this.q[i + 1]) {
          k = i;
          break;
        }
      }
    }

    // Increment positions
    for (let i = k + 1; i < 5; i++) {
      this.n[i]++;
    }

    // Update desired positions
    for (let i = 0; i < 5; i++) {
      this.nPrime[i] += this.dnPrime[i];
    }

    // Adjust heights
    for (let i = 1; i <= 3; i++) {
      const d = this.nPrime[i] - this.n[i];
      if ((d >= 1 && this.n[i + 1] - this.n[i] > 1) || (d <= -1 && this.n[i - 1] - this.n[i] < -1)) {
        const sign = d > 0 ? 1 : -1;
        // Parabolic formula
        const qNew = this.parabolic(i, sign);
        if (this.q[i - 1] < qNew && qNew < this.q[i + 1]) {
          this.q[i] = qNew;
        } else {
          // Linear formula fallback
          this.q[i] = this.linear(i, sign);
        }
        this.n[i] += sign;
      }
    }
  }

  private parabolic(i: number, sign: number): number {
    const qi = this.q[i];
    const qPrev = this.q[i - 1];
    const qNext = this.q[i + 1];
    const ni = this.n[i];
    const nPrev = this.n[i - 1];
    const nNext = this.n[i + 1];

    const term1 = ((ni - nPrev + sign) * (qNext - qi)) / (nNext - ni);
    const term2 = ((nNext - ni - sign) * (qi - qPrev)) / (ni - nPrev);
    return qi + (sign / (nNext - nPrev)) * (term1 + term2);
  }

  private linear(i: number, sign: number): number {
    return this.q[i] + sign * ((this.q[i + sign] - this.q[i]) / (this.n[i + sign] - this.n[i]));
  }

  get estimate(): number {
    if (this.count === 0) return 0;
    if (this.count <= 5) {
      const sorted = [...this.initialBuffer].sort((a, b) => a - b);
      const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * this.p)));
      return sorted[idx];
    }
    return this.q[2];
  }
}

/**
 * HyperLogLog Cardinality Estimator (Flajolet et al. 2007)
 * Uses 1024 registers (p=10), error ~ 3.25%, 1024 bytes memory.
 */
export class HyperLogLog {
  private p = 10;
  private m = 1024;
  private registers: Uint8Array = new Uint8Array(1024);
  private alphaMM = 0.7213 / (1 + 1.079 / 1024) * 1024 * 1024;

  add(val: string): void {
    const hash = murmurHash3(val);
    const j = hash >>> (32 - this.p);
    const w = (hash << this.p) >>> 0;
    const leadingZeros = w === 0 ? 32 - this.p : Math.clz32(w) + 1;
    if (leadingZeros > this.registers[j]) {
      this.registers[j] = leadingZeros;
    }
  }

  count(): number {
    let sum = 0;
    let zeros = 0;
    for (let i = 0; i < this.m; i++) {
      const r = this.registers[i];
      sum += Math.pow(2, -r);
      if (r === 0) zeros++;
    }

    const rawEstimate = this.alphaMM / sum;

    // Small range correction (Linear counting)
    if (rawEstimate <= 2.5 * this.m && zeros > 0) {
      return Math.round(this.m * Math.log(this.m / zeros));
    }

    // Large range correction (32-bit hash overflow)
    if (rawEstimate > (1 / 30) * 4294967296) {
      return Math.round(-4294967296 * Math.log(1 - rawEstimate / 4294967296));
    }

    return Math.round(rawEstimate);
  }
}

/**
 * Space-Saving Algorithm for bounded top-K frequent elements (Metwally et al. 2005)
 * O(K) space bounded memory.
 */
export class SpaceSaving {
  private capacity: number;
  private items = new Map<string, { count: number; error: number }>();

  constructor(capacity = 50) {
    this.capacity = capacity;
  }

  add(val: string): void {
    const trimmed = val.trim();
    if (!trimmed || MISSING_VALUES.has(trimmed.toLowerCase())) return;

    const existing = this.items.get(trimmed);
    if (existing) {
      existing.count++;
      return;
    }

    if (this.items.size < this.capacity) {
      this.items.set(trimmed, { count: 1, error: 0 });
      return;
    }

    // Find min count
    let minKey = '';
    let minCount = Infinity;
    for (const [key, entry] of this.items.entries()) {
      if (entry.count < minCount) {
        minCount = entry.count;
        minKey = key;
      }
    }

    this.items.delete(minKey);
    this.items.set(trimmed, { count: minCount + 1, error: minCount });
  }

  getTop(k = 5, totalNonMissing = 0): Array<{ value: string; count: number; percentage: number }> {
    const sorted = Array.from(this.items.entries()).sort((a, b) => b[1].count - a[1].count);
    const top = sorted.slice(0, k);
    const base = totalNonMissing > 0 ? totalNonMissing : top.reduce((acc, curr) => acc + curr[1].count, 0) || 1;

    return top.map(([value, entry]) => ({
      value,
      count: entry.count,
      percentage: Math.round((entry.count / base) * 1000) / 10,
    }));
  }
}

/**
 * Reservoir Sampler (Algorithm R)
 * Uniformly samples up to maxRows rows with bounded memory.
 */
export class ReservoirSampler<T> {
  private capacity: number;
  private reservoir: T[] = [];
  private totalSeen = 0;

  constructor(capacity = 50) {
    this.capacity = capacity;
  }

  add(item: T): void {
    this.totalSeen++;
    if (this.reservoir.length < this.capacity) {
      this.reservoir.push(item);
    } else {
      const j = Math.floor(Math.random() * this.totalSeen);
      if (j < this.capacity) {
        this.reservoir[j] = item;
      }
    }
  }

  getSample(): T[] {
    return [...this.reservoir];
  }

  get count(): number {
    return this.totalSeen;
  }
}

export type InferredType = 'number' | 'text' | 'date' | 'boolean' | 'mixed';

/**
 * Comprehensive Streaming Column Accumulator
 */
export class ColumnAccumulator {
  name: string;
  totalCount = 0;
  missingCount = 0;
  votes = { number: 0, boolean: 0, date: 0, text: 0 };
  welford = new WelfordAccumulator();
  medianEst = new P2QuantileEstimator(0.5);
  q1Est = new P2QuantileEstimator(0.25);
  q3Est = new P2QuantileEstimator(0.75);
  hll = new HyperLogLog();
  spaceSaving = new SpaceSaving(50);
  sampleValuesSet = new Set<string>();
  sampleValues: string[] = [];
  outliersCount = 0;

  constructor(name: string) {
    this.name = name;
  }

  update(rawValue: string | undefined): void {
    this.totalCount++;
    const val = rawValue !== undefined ? String(rawValue).trim() : '';
    const lower = val.toLowerCase();

    if (MISSING_VALUES.has(lower)) {
      this.missingCount++;
      return;
    }

    // Collect first 5 sample values
    if (this.sampleValues.length < 5 && !this.sampleValuesSet.has(val)) {
      this.sampleValuesSet.add(val);
      this.sampleValues.push(val);
    }

    // HyperLogLog for distinct count
    this.hll.add(val);

    // Space-Saving for top frequencies
    this.spaceSaving.add(val);

    // Vote classification
    if (BOOLEAN_VALUES.has(lower)) {
      this.votes.boolean++;
    } else if (!isNaN(Number(val)) && val !== '') {
      this.votes.number++;
      const num = Number(val);
      this.welford.update(num);
      this.medianEst.update(num);
      this.q1Est.update(num);
      this.q3Est.update(num);
    } else if (DATE_REGEX.test(val) && !isNaN(Date.parse(val))) {
      this.votes.date++;
    } else {
      this.votes.text++;
    }
  }

  inferFinalType(): InferredType {
    const nonMissing = this.totalCount - this.missingCount;
    if (nonMissing === 0) return 'text';

    const threshold = nonMissing * 0.85;
    if (this.votes.boolean >= threshold) return 'boolean';
    if (this.votes.number >= threshold) return 'number';
    if (this.votes.date >= threshold) return 'date';

    if (this.votes.number > 0 && this.votes.number < threshold && nonMissing > 5) {
      return 'mixed';
    }

    return 'text';
  }

  computeOutliersCount(): number {
    if (this.welford.count === 0) return 0;
    const q1 = this.q1Est.estimate;
    const q3 = this.q3Est.estimate;
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    // Approximate outlier proportion based on min/max span vs IQR
    if (iqr === 0) return 0;
    let estimatedOutliers = 0;
    if (this.welford.min < lowerBound) estimatedOutliers++;
    if (this.welford.max > upperBound) estimatedOutliers++;
    return estimatedOutliers;
  }
}
