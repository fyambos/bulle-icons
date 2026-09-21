import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSource } from '../build/source.mjs'
import { outline, transform } from '../build/outline.mjs'
import { toContours, flatten, signedArea, inkArea, bounds, normalizeWinding } from '../build/contours.mjs'
import { mismatch } from '../build/fidelity.mjs'
import { svg } from './helpers.mjs'

const outlined = (shapes, cuts) => outline(parseSource(svg(shapes, cuts)))
const close = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label ?? 'value'}: ${actual}, expected ${expected}`)

test('stroke outline has the stroke width and round ends', async () => {
  const d = await outlined('<path d="M6 12h12"/>')

  close(inkArea(d), 12 * 2 + Math.PI, 0.05, 'area')
  assert.deepEqual(Object.values(bounds(d)).map((n) => Math.round(n * 100) / 100), [5, 11, 19, 13])
})

test('ring has a clockwise outer contour and a counter-clockwise hole', async () => {
  const d = await outlined('<circle cx="12" cy="12" r="9"/>')
  const areas = toContours(d).map((contour) => signedArea(flatten(contour)))

  assert.equal(areas.length, 2)
  close(areas[0], Math.PI * 100, 0.5, 'outer')
  close(areas[1], -Math.PI * 64, 0.5, 'hole')
})

test('winding does not depend on the drawing direction', () => {
  const ring = 'M2 2H22V22H2ZM6 6H18V18H6Z'
  const reversed = 'M2 2V22H22V2ZM6 6V18H18V6Z'

  for (const d of [ring, reversed]) {
    const areas = toContours(normalizeWinding(d)).map((contour) => signedArea(flatten(contour)))
    assert.deepEqual(areas, [400, -144])
  }
})

test('cut applies to masked shapes only', async () => {
  const square = '<rect x="4" y="4" width="16" height="16" fill="currentColor" stroke="none" mask="url(#cut)"/>'
  const dot = '<circle cx="12" cy="12" r="2" fill="#000" stroke="none"/>'
  const cut = await outlined(square, dot)

  close(inkArea(cut), 256 - Math.PI * 4, 0.15, 'cut square')

  const kept = await outlined(square + '<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>', dot)
  close(inkArea(kept), 256 - Math.PI * 4 + Math.PI, 0.15, 'cut square with an unmasked dot')
})

test('touching shapes are all kept', async () => {
  const globe = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><ellipse cx="12" cy="12" rx="4" ry="9"/>'
  const d = await outlined(globe)

  assert.ok(mismatch(svg(globe), d) < 0.005)
  assert.ok(inkArea(d) > 190, `area ${inkArea(d)}`)
})

test('fidelity check rejects a wrong outline', async () => {
  const drawing = svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>')
  const right = await outline(parseSource(drawing))
  const wrong = await outlined('<circle cx="12" cy="12" r="9"/>')

  assert.ok(mismatch(drawing, right) < 0.005)
  assert.ok(mismatch(drawing, wrong) > 0.05)
})

test('derived icon is rotated or mirrored', async () => {
  const up = await outlined('<path d="M12 20V4"/><path d="M5 11l7-7 7 7"/>')
  const box = (d) => Object.values(bounds(d)).map((n) => Math.round(n * 10) / 10)

  assert.deepEqual(box(up), [4, 3, 20, 21])
  assert.deepEqual(box(transform(up, { rotate: 90 })), [3, 4, 21, 20])
  assert.deepEqual(box(transform(up, { rotate: 180 })), [4, 3, 20, 21])
  close(inkArea(transform(up, { flip: 'x' })), inkArea(up), 0.01, 'mirrored area')

  const right = toContours(transform(up, { rotate: 90 })).flatMap(flatten)
  assert.ok(right.some(([x, y]) => x > 20.5 && Math.abs(y - 12) < 1), 'the tip points right')
})
