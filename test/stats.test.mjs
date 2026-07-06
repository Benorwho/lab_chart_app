import { test } from 'node:test';
import assert from 'node:assert/strict';
import { num, mean, sd, sem, linregress, trapzArea, quantile, boxStats, kde, silverman } from '../src/core/stats.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} !≈ ${b}`);

test('num parses numbers and rejects junk', () => {
  assert.equal(num('3.5'), 3.5);
  assert.equal(num(' 2 '), 2);
  assert.equal(num('-1e3'), -1000);
  assert.equal(num('abc'), null);
  assert.equal(num(''), null);
});

test('mean / sd / sem match hand-checked values', () => {
  // R: mean(c(12,14,16)) = 14 ; sd(c(12,14,16)) = 2
  close(mean([12, 14, 16]), 14);
  close(sd([12, 14, 16]), 2);
  close(sem([12, 14, 16]), 2 / Math.sqrt(3));
  // R: sd(c(2,4,4,4,5,5,7,9)) = 2.13809
  close(sd([2, 4, 4, 4, 5, 5, 7, 9]), 2.1380899352993952, 1e-12);
  assert.equal(sd([5]), null);
  assert.equal(mean([]), null);
});

test('linregress matches scipy.stats.linregress', () => {
  // scipy: x=[1,2,3,4], y=[2,3,5,4] → slope=0.8, intercept=1.5, r=0.8
  const r = linregress([[1, 2], [2, 3], [3, 5], [4, 4]]);
  close(r.m, 0.8);
  close(r.b, 1.5);
  close(r.r2, 0.64);
  // perfect fit
  const p = linregress([[0, 1], [1, 3], [2, 5]]);
  close(p.m, 2); close(p.b, 1); close(p.r2, 1);
  // degenerate
  assert.equal(linregress([[1, 1]]), null);
  assert.equal(linregress([[1, 1], [1, 2]]), null); // vertical
});

test('trapzArea integrates y over x', () => {
  // unit triangle: ∫ from 0..1 of x dx = 0.5
  close(trapzArea([{ x: 0, y: 0 }, { x: 1, y: 1 }]), 0.5);
  close(trapzArea([{ x: 0, y: 1 }, { x: 2, y: 1 }, { x: 4, y: 1 }]), 4);
});

test('quantile matches numpy.percentile / R type-7', () => {
  const s = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  close(quantile(s, 0), 1);
  close(quantile(s, 1), 10);
  close(quantile(s, 0.5), 5.5);      // numpy median
  close(quantile(s, 0.25), 3.25);    // numpy.percentile(s,25)
  close(quantile(s, 0.75), 7.75);
  const t = [1, 2, 3, 4];
  close(quantile(t, 0.25), 1.75);    // np.percentile([1,2,3,4],25)
  close(quantile([7], 0.5), 7);
});

test('boxStats: five-number summary, Tukey whiskers, outliers', () => {
  const b = boxStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  close(b.median, 5.5); close(b.q1, 3.25); close(b.q3, 7.75);
  close(b.iqr, 4.5);
  assert.equal(b.whiskerLo, 1); assert.equal(b.whiskerHi, 10);
  assert.deepEqual(b.outliers, []);
  // a clear outlier past the upper fence (q3=... fence well below 100)
  const o = boxStats([10, 11, 12, 13, 14, 15, 100]);
  assert.ok(o.outliers.includes(100));
  assert.ok(o.whiskerHi <= o.q3 + 1.5 * o.iqr);
  assert.ok(o.whiskerHi < 100);
  assert.equal(boxStats([]), null);
});

test('kde integrates to ~1 and is peaked near the data', () => {
  const data = [0, 0, 0, 1, 1, 2, -1, -2, 0.5, -0.5];
  const pts = kde(data, { steps: 400 });
  const area = trapzArea(pts.map(p => ({ x: p.v, y: p.d })));
  assert.ok(Math.abs(area - 1) < 0.02, 'density area ≈ 1, got ' + area);
  assert.ok(pts.every(p => p.d >= 0));
  assert.ok(silverman(data) > 0);
  assert.deepEqual(kde([]), []);
});
