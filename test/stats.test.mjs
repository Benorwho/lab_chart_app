import { test } from 'node:test';
import assert from 'node:assert/strict';
import { num, mean, sd, sem, linregress, trapzArea } from '../src/core/stats.js';

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
