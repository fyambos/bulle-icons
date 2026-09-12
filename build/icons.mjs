import fs from 'node:fs/promises'
import path from 'node:path'
import { dirs, GRID, INK_MARGIN } from './config.mjs'
import { NAME_RE } from './lib.mjs'
import { parseSource } from './source.mjs'
import { outline, transform } from './outline.mjs'
import { bounds } from './contours.mjs'
import { mismatch } from './fidelity.mjs'
import { readCatalog, checkCatalog, FILL_SUFFIX } from './catalog.mjs'

const EPSILON = 0.01

// Share of the drawing that may differ from the built outline, edges move by part of a pixel.
const FIDELITY = 0.005

async function readSources (iconsDir) {
  let files

  try {
    files = await fs.readdir(iconsDir)
  } catch {
    return []
  }

  const sources = []

  for (const file of files.sort()) {
    if (!file.endsWith('.svg')) continue
    sources.push({ name: file.slice(0, -4), source: await fs.readFile(path.join(iconsDir, file), 'utf8') })
  }

  return sources
}

function checkInk (name, d, problems) {
  const box = d ? bounds(d) : null

  if (!box) {
    problems.push(`${name}: the drawing is empty`)
    return
  }

  const min = INK_MARGIN - EPSILON
  const max = GRID - INK_MARGIN + EPSILON

  if (box.left < min || box.top < min || box.right > max || box.bottom > max) {
    const span = [box.left, box.top, box.right, box.bottom].map((n) => n.toFixed(2)).join(' ')
    problems.push(`${name}: the drawing must stay between ${INK_MARGIN} and ${GRID - INK_MARGIN}, found ${span}`)
  }
}

// Returns every icon as an outline with its catalog data, and the problems that stop the build.
export async function loadIcons ({ iconsDir = dirs.icons, catalogFile } = {}) {
  const sources = await readSources(iconsDir)
  const catalog = await readCatalog(catalogFile)
  const problems = checkCatalog(catalog, sources.map((s) => s.name))
  const outlines = new Map()

  for (const { name, source } of sources) {
    if (!NAME_RE.test(name)) problems.push(`${name}: file names are kebab-case`)

    const parsed = parseSource(source)
    problems.push(...parsed.problems.map((problem) => `${name}: ${problem}`))
    if (parsed.problems.length) continue

    let d = ''

    try {
      d = await outline(parsed)
    } catch (error) {
      problems.push(`${name}: ${error.message}`)
      continue
    }

    checkInk(name, d, problems)

    const share = d ? mismatch(source, d) : 0
    if (share > FIDELITY) problems.push(`${name}: the built outline does not match the drawing, ${(share * 100).toFixed(1)}% differs`)

    outlines.set(name, d)
  }

  // If the source has a filled variant, the derived icon gets one too.
  for (const [name, entry] of Object.entries(catalog)) {
    if (entry.from == null) continue

    for (const suffix of ['', FILL_SUFFIX]) {
      const from = outlines.get(entry.from + suffix)
      if (from) outlines.set(name + suffix, transform(from, entry))
    }
  }

  const icons = [...outlines.keys()].sort().map((name) => {
    const filled = name.endsWith(FILL_SUFFIX) && !catalog[name]
    const base = filled ? name.slice(0, -FILL_SUFFIX.length) : name
    const entry = catalog[base] ?? {}

    return { name, base, filled, d: outlines.get(name), category: entry.category, keywords: entry.keywords ?? [] }
  })

  return { icons, problems }
}
