#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { dirs, categories } from '../build/config.mjs'
import { NAME_RE, ensureDir, log } from '../build/lib.mjs'
import { rootAttributes } from '../build/source.mjs'
import { FILL_SUFFIX, readCatalog, writeCatalog } from '../build/catalog.mjs'

const [name, category, ...keywords] = process.argv.slice(2)
const filled = name?.endsWith(FILL_SUFFIX)

if (!name || (!filled && (!category || !keywords.length))) {
  console.log('usage: npm run new -- <name> <category> <keyword> [<keyword> ...]')
  console.log('       npm run new -- <name>-fill')
  console.log(`categories: ${Object.keys(categories).join(', ')}`)
  process.exit(1)
}

if (!NAME_RE.test(name)) {
  log.fail(`"${name}" must be kebab-case (a-z, 0-9, single dashes)`)
  process.exit(1)
}

if (!filled && !(category in categories)) {
  log.fail(`unknown category "${category}", use one of: ${Object.keys(categories).join(', ')}`)
  process.exit(1)
}

const file = path.join(dirs.icons, `${name}.svg`)

try {
  await fs.access(file)
  log.fail(`icons/${name}.svg already exists`)
  process.exit(1)
} catch {}

const root = Object.entries(rootAttributes).map(([key, value]) => `${key}="${value}"`).join(' ')

await ensureDir(dirs.icons)
await fs.writeFile(file, `<svg ${root}>\n  <path d=""/>\n</svg>\n`)

if (!filled) {
  const catalog = await readCatalog()
  catalog[name] = { category, keywords }
  await writeCatalog(catalog)
}

log.done(`created icons/${name}.svg`)
