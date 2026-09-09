import fs from 'node:fs/promises'
import path from 'node:path'
import { dirs, categories } from './config.mjs'
import { NAME_RE, readJson } from './lib.mjs'

export const FILL_SUFFIX = '-fill'

const CATALOG_FILE = path.join(dirs.meta, 'catalog.json')
const KEYWORD_RE = /^[a-z0-9]+( [a-z0-9]+)*$/
const ROTATIONS = [90, 180, 270]
const FLIPS = ['x', 'y']
const ENTRY_KEYS = ['category', 'keywords', 'from', 'rotate', 'flip']

export function readCatalog (file = CATALOG_FILE) {
  return readJson(file, {})
}

// One entry per line, sorted by name, so adding an icon changes one line of the file.
export async function writeCatalog (catalog, file = CATALOG_FILE) {
  const lines = Object.keys(catalog).sort().map((name) => {
    const entry = JSON.stringify(catalog[name])
      .replace(/":/g, '": ')
      .replace(/,"/g, ', "')
      .replace(/^\{/, '{ ')
      .replace(/\}$/, ' }')

    return `  ${JSON.stringify(name)}: ${entry}`
  })

  await fs.writeFile(file, `{\n${lines.join(',\n')}\n}\n`)
}

// Checks the catalog against the names of the source files, returns the problems found.
export function checkCatalog (catalog, sourceNames) {
  const problems = []
  const sources = new Set(sourceNames)
  const fail = (name, message) => problems.push(`${name}: ${message}`)

  for (const name of sources) {
    if (name.endsWith(FILL_SUFFIX)) {
      if (!sources.has(name.slice(0, -FILL_SUFFIX.length))) fail(name, `icons/${name.slice(0, -FILL_SUFFIX.length)}.svg is missing`)
    } else if (!catalog[name]) {
      fail(name, 'missing from meta/catalog.json')
    }
  }

  for (const [name, entry] of Object.entries(catalog)) {
    if (!NAME_RE.test(name)) fail(name, 'catalog names are kebab-case')
    if (name.endsWith(FILL_SUFFIX)) fail(name, 'filled icons have no catalog entry')

    for (const key of Object.keys(entry)) {
      if (!ENTRY_KEYS.includes(key)) fail(name, `unknown catalog key "${key}"`)
    }

    if (!(entry.category in categories)) fail(name, `unknown category "${entry.category}"`)

    if (!Array.isArray(entry.keywords) || !entry.keywords.length) {
      fail(name, 'no keywords')
    } else {
      for (const keyword of entry.keywords) {
        if (typeof keyword !== 'string' || !KEYWORD_RE.test(keyword)) fail(name, `keyword "${keyword}" must be lowercase words`)
      }
      if (new Set(entry.keywords).size !== entry.keywords.length) fail(name, 'duplicate keyword')
    }

    if (entry.from == null) {
      if (entry.rotate != null || entry.flip != null) fail(name, 'rotate and flip require "from"')
      if (!sources.has(name)) fail(name, `icons/${name}.svg does not exist`)
      continue
    }

    if (sources.has(name)) fail(name, 'has both "from" and a file in icons/')
    if (!sources.has(entry.from)) fail(name, `"from" is "${entry.from}", which has no file in icons/`)
    if (entry.rotate == null && entry.flip == null) fail(name, '"from" needs rotate or flip')
    if (entry.rotate != null && !ROTATIONS.includes(entry.rotate)) fail(name, 'rotate is 90, 180 or 270')
    if (entry.flip != null && !FLIPS.includes(entry.flip)) fail(name, 'flip is "x" or "y"')
  }

  return problems
}
