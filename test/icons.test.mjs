import test from 'node:test'
import assert from 'node:assert/strict'
import { loadIcons } from '../build/icons.mjs'
import { svg, iconSet } from './helpers.mjs'

const line = svg('<path d="M5 12h14"/>')
const entry = { category: 'interface', keywords: ['line'] }

async function load (sources, catalog) {
  const set = await iconSet(sources, catalog)

  try {
    return await loadIcons(set)
  } finally {
    await set.remove()
  }
}

const problemsOf = async (sources, catalog) => (await load(sources, catalog)).problems

test('repository icons have no problem', async () => {
  const { icons, problems } = await loadIcons()

  assert.deepEqual(problems, [])
  assert.ok(icons.length > 0)
})

test('filled icon uses the entry of its outline icon', async () => {
  const { icons, problems } = await load({ dash: line, 'dash-fill': line }, { dash: entry })
  const filled = icons.find((icon) => icon.name === 'dash-fill')

  assert.deepEqual(problems, [])
  assert.deepEqual([filled.base, filled.filled, filled.category, filled.keywords], ['dash', true, 'interface', ['line']])
})

test('derived icon and its filled variant', async () => {
  const up = svg('<path d="M12 20V4"/><path d="M5 11l7-7 7 7"/>')
  const { icons, problems } = await load(
    { up, 'up-fill': up },
    { up: entry, right: { ...entry, from: 'up', rotate: 90 } }
  )

  assert.deepEqual(problems, [])
  assert.deepEqual(icons.map((icon) => icon.name), ['right', 'right-fill', 'up', 'up-fill'])
  assert.notEqual(icons[0].d, icons[2].d)
})

test('catalog and files mismatch', async () => {
  const cases = {
    'a file without an entry': [{ dash: line }, {}],
    'an entry without a file': [{}, { dash: entry }],
    'a filled icon without its outline icon': [{ 'dash-fill': line }, {}],
    'an entry for a filled icon': [{ dash: line, 'dash-fill': line }, { dash: entry, 'dash-fill': entry }],
    'an unknown category': [{ dash: line }, { dash: { category: 'misc', keywords: ['line'] } }],
    'no keyword': [{ dash: line }, { dash: { category: 'interface', keywords: [] } }],
    'an uppercase keyword': [{ dash: line }, { dash: { category: 'interface', keywords: ['Line'] } }],
    'an unknown key': [{ dash: line }, { dash: { ...entry, alias: 'rule' } }],
    'a source that does not exist': [{}, { right: { ...entry, from: 'up', rotate: 90 } }],
    'a derived icon with its own file': [{ up: line, right: line }, { up: entry, right: { ...entry, from: 'up', rotate: 90 } }],
    'a derived icon with no transformation': [{ up: line }, { up: entry, right: { ...entry, from: 'up' } }],
    'a rotation that is not a quarter turn': [{ up: line }, { up: entry, right: { ...entry, from: 'up', rotate: 45 } }]
  }

  for (const [label, [sources, catalog]] of Object.entries(cases)) {
    assert.notDeepEqual(await problemsOf(sources, catalog), [], label)
  }
})

test('margin and empty drawing', async () => {
  assert.deepEqual(await problemsOf({ dash: line }, { dash: entry }), [])
  assert.match((await problemsOf({ dash: svg('<path d="M1.5 12h21"/>') }, { dash: entry }))[0], /must stay between/)
  assert.match((await problemsOf({ dash: svg('<path d="M5 12"/>') }, { dash: entry }))[0], /drawing is empty/)
})

test('file name not in kebab-case', async () => {
  assert.notDeepEqual(await problemsOf({ Dash: line }, { Dash: entry }), [])
})
