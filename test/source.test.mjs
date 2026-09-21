import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSource, rootAttributes } from '../build/source.mjs'
import { svg } from './helpers.mjs'

const problems = (source) => parseSource(source).problems

test('accepts strokes, fills and masked shapes', () => {
  const source = svg(
    '<path d="M5 12h14"/><circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none"/>' +
    '<rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" mask="url(#cut)"/>',
    '<path d="M8 12h8" stroke="#000"/>'
  )
  const parsed = parseSource(source)

  assert.deepEqual(parsed.problems, [])
  assert.equal(parsed.shapes.length, 3)
  assert.equal(parsed.cuts.length, 1)
  assert.equal(parsed.shapes[2].masked, true)
})

test('rejects a root with other attributes', () => {
  assert.notDeepEqual(problems(svg('<path d="M5 12h14"/>', null, { ...rootAttributes, 'stroke-width': '1.5' })), [])
  assert.notDeepEqual(problems(svg('<path d="M5 12h14"/>', null, { ...rootAttributes, width: '24' })), [])
  assert.notDeepEqual(problems(svg('<path d="M5 12h14"/>', null, { ...rootAttributes, viewBox: '0 0 20 20' })), [])
})

test('rejects unknown elements and attributes', () => {
  for (const shape of [
    '<g><path d="M5 12h14"/></g>',
    '<line x1="5" y1="12" x2="19" y2="12"/>',
    '<path d="M5 12h14" transform="rotate(45)"/>',
    '<path d="M5 12h14" style="stroke:red"/>',
    '<path d="M5 12h14" stroke-width="1"/>',
    '<path d="M5 12h14" fill="#f00"/>',
    '<path d="M5 12h14" stroke="none"/>',
    '<path/>',
    '<circle cx="12" cy="12"/>',
    '<path d="M5 12h14"></path>',
    'text<path d="M5 12h14"/>'
  ]) {
    assert.notDeepEqual(problems(svg(shape)), [], shape)
  }
})

test('rejects an incomplete mask', () => {
  const shape = '<rect x="4" y="4" width="16" height="16" fill="currentColor" mask="url(#cut)"/>'
  const cut = '<path d="M8 12h8" stroke="#000"/>'

  assert.deepEqual(problems(svg(shape, cut)), [])
  assert.notDeepEqual(problems(svg(shape, '<path d="M8 12h8"/>')), [])
  assert.notDeepEqual(problems(svg(shape, '<path d="M8 12h8" stroke="currentColor"/>')), [])
  assert.notDeepEqual(problems(svg('<path d="M5 12h14"/>', cut)), [])
  assert.notDeepEqual(problems(svg(shape)), [])
  assert.notDeepEqual(problems(svg(shape, cut).replace(' maskUnits="userSpaceOnUse"', '')), [])
  assert.notDeepEqual(problems(svg(shape, cut).replace('<rect width="24" height="24" fill="#fff" stroke="none"/>', '')), [])
})
