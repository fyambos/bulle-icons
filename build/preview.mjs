import fs from 'node:fs/promises'
import path from 'node:path'
import { root, GRID, categories, colors } from './config.mjs'
import { log } from './lib.mjs'

const COLUMNS = 20
const CELL = 40
const EDGE = 20

// One image of every icon at its drawing size, in the order of the categories.
export function previewSource (icons) {
  const ordered = Object.keys(categories).flatMap((id) => icons.filter((icon) => icon.category === id))
  const width = COLUMNS * CELL + 2 * EDGE
  const height = Math.ceil(ordered.length / COLUMNS) * CELL + 2 * EDGE
  const first = EDGE + (CELL - GRID) / 2

  const paths = ordered.map((icon, index) => {
    const x = first + (index % COLUMNS) * CELL
    const y = first + Math.floor(index / COLUMNS) * CELL
    return `<g transform="translate(${x} ${y})">${icon.body}</g>`
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<style>
  .paper { fill: ${colors.light.paper}; }
  .ink { fill: ${colors.light.ink}; }
  @media (prefers-color-scheme: dark) {
    .paper { fill: ${colors.dark.paper}; }
    .ink { fill: ${colors.dark.ink}; }
  }
</style>
<rect class="paper" width="${width}" height="${height}" rx="12"/>
<g class="ink">
${paths.join('\n')}
</g>
</svg>
`
}

// Writes preview.svg at the root, the README shows it and the file is committed.
export async function buildPreview (icons, { file = path.join(root, 'preview.svg') } = {}) {
  const source = previewSource(icons)
  const current = await fs.readFile(file, 'utf8').catch(() => null)

  if (source === current) {
    log.done('preview: preview.svg')
    return
  }

  await fs.writeFile(file, source)
  log.warn('preview: preview.svg changed, commit it')
}
