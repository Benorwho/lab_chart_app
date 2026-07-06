import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGrid, rawToRows, splitBlocks, analyzeTable,
  seriesFromLong, seriesFromWide, aggregateGroupReps, isErrHeader,
} from '../src/core/csv.js';

const rows = s => rawToRows(s.trim());

test('parseGrid handles tabs, commas and whitespace', () => {
  assert.deepEqual(parseGrid('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseGrid('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseGrid('a b\n1 2'), [['a', 'b'], ['1', '2']]);
});

test('splitBlocks splits on blank rows', () => {
  const b = splitBlocks(rows('a,1\n\n\nb,2\nc,3'));
  assert.equal(b.length, 2);
  assert.equal(b[1].length, 2);
});

test('isErrHeader recognizes error-ish column names', () => {
  for (const h of ['SD', 'sd', 'S.D.', 'StDev', 'stdv', 'SEM', 'std dev', 'Error', '± SD', 'Protein SD'])
    assert.ok(isErrHeader(h), h + ' should be error-ish');
  for (const h of ['Treated', 'Speed', 'Dose', 'Side', 'Standard'])
    assert.ok(!isErrHeader(h), h + ' should NOT be error-ish');
});

test('detects raw curves: numeric X, all-numeric columns', () => {
  const t = analyzeTable(rows(
    'Strain,W175,W251\n0,0,0\n0.5,1.2,1.1\n1,2.5,2.2\n1.5,3.6,3.4\n2,4.9,4.4\n2.5,6.0,5.6'));
  assert.equal(t.kind, 'curves');
  assert.equal(t.data.length, 6);
});

test('detects the lab summary layout with spanned group header', () => {
  const t = analyzeTable(rows(
    ',W251A,,,W251B,,\nUTS / MPa,42.1,1.2,5,38.9,0.9,5\nModulus / MPa,812,25,5,790,31,5'));
  assert.equal(t.kind, 'summary');
  assert.deepEqual(t.groups.names, ['W251A', 'W251B']);
  assert.equal(t.propRows.length, 2);
});

test('detects long format: X, group, value, error', () => {
  const t = analyzeTable(rows(
    'Day,Group,Response,SD\nDay 1,Control,12.4,1.1\nDay 1,Treated,18.9,1.5\nDay 2,Control,14.1,0.9\nDay 2,Treated,21.3,1.2'));
  assert.equal(t.kind, 'long');
  assert.deepEqual(t.map, { xi: 0, gi: 1, yi: 2, ei: 3 });
  const r = seriesFromLong(t.body, t.map, t.header);
  assert.equal(r.series.length, 2);
  assert.deepEqual(r.series.map(s => s.name).sort(), ['Control', 'Treated']);
  assert.deepEqual(r.order, ['Day 1', 'Day 2']);
  assert.equal(r.series[0].pts.length, 2);
  assert.ok(r.series[0].showErr);
  assert.equal(r.xlab, 'Day');
  assert.equal(r.ylab, 'Response');
});

test('long format: blank X cells inherit the row above (merged-cell exports)', () => {
  const body = rows('t=5,3.5,0.7\n,3.7,0.6\nt=10,3.5,0.9');
  const r = seriesFromLong(body, { xi: 0, gi: 1, yi: 2, ei: null }, null);
  assert.deepEqual(r.order, ['t=5', 't=10']);
  const g37 = r.series.find(s => s.name === '3.7');
  assert.equal(g37.pts.find(p => p.x === 't=5').y, '0.6');
});

test('detects replicate rows: group + value with repeated groups', () => {
  const t = analyzeTable(rows(
    'Group,Response\nControl,12\nControl,14\nControl,13\nTreated,19\nTreated,21\nTreated,20'));
  assert.equal(t.kind, 'groupReps');
  const agg = aggregateGroupReps(t.body, t.map);
  assert.equal(agg.pts.length, 2);
  const c = agg.pts.find(p => p.x === 'Control');
  assert.equal(c.y, 13);
  assert.equal(c.n, 3);
  assert.ok(Math.abs(c.e - 1) < 1e-9); // sd(12,14,13) = 1
});

test('detects wide format and attaches SD columns to the series before them', () => {
  // the reviewer's failing case: groups as rows, mean + SD columns
  const t = analyzeTable(rows('Group,Mean,SD\nControl,12.4,1.1\nTreated,18.9,1.5'));
  assert.equal(t.kind, 'wide');
  assert.equal(t.cols.length, 1);
  assert.equal(t.cols[0].e, 2);
  const ser = seriesFromWide(t.body, t.cols, t.xi, t.header);
  assert.equal(ser.length, 1);
  assert.deepEqual(ser[0].pts.map(p => p.x), ['Control', 'Treated']);
  assert.equal(ser[0].pts[1].e, '1.5');
});

test('detects wide format with several series columns', () => {
  const t = analyzeTable(rows('Condition,Control,Treated\nDay 1,12.4,18.9\nDay 2,14.1,21.3\nDay 3,13.7,20.1'));
  assert.equal(t.kind, 'wide');
  const ser = seriesFromWide(t.body, t.cols, t.xi, t.header);
  assert.equal(ser.length, 2);
  assert.deepEqual(ser.map(s => s.name), ['Control', 'Treated']);
  assert.equal(ser[0].pts.length, 3);
});

test('falls back to table when the layout is unclear', () => {
  assert.equal(analyzeTable(rows('only,one')).kind, 'table');
  assert.equal(analyzeTable([['x']]).kind, 'table');
});
