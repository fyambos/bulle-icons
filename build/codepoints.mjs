import path from 'node:path'
import { dirs, font } from './config.mjs'
import { readJson, writeJson, log } from './lib.mjs'

// Assigns the next free codepoint to each new icon, existing codepoints are kept.
export async function assignCodepoints (icons, file = path.join(dirs.meta, 'codepoints.json')) {
  const map = await readJson(file, {})

  let next = Object.values(map).reduce((max, cp) => Math.max(max, cp), font.startCodepoint - 1) + 1
  let added = 0

  for (const icon of icons) {
    if (map[icon.name] == null) {
      map[icon.name] = next++
      added++
    }
  }

  if (added) {
    await writeJson(file, Object.fromEntries(Object.entries(map).sort((a, b) => a[1] - b[1])))
    log.warn(`codepoints: ${added} new, commit meta/codepoints.json`)
  }

  return icons.map((icon) => ({ ...icon, codepoint: map[icon.name] }))
}
