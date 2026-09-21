import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { rootAttributes, maskAttributes, backdropTag } from '../build/source.mjs'
import { loadIcons } from '../build/icons.mjs'
import { assignCodepoints } from '../build/codepoints.mjs'
import { iconBody } from '../build/svg.mjs'
import { buildFont } from '../build/font.mjs'

const attributes = (map) => Object.entries(map).map(([name, value]) => `${name}="${value}"`).join(' ')

// A source icon made of the given shapes, with a mask when cuts are given.
export function svg (shapes, cuts = null, root = rootAttributes) {
  const mask = cuts ? `<mask ${attributes(maskAttributes)}>${backdropTag}${cuts}</mask>` : ''
  return `<svg ${attributes(root)}>${mask}${shapes}</svg>`
}

// A temporary icon set, source files by name and a catalog, removed by the returned function.
export async function iconSet (sources, catalog) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bulle-'))
  const iconsDir = path.join(dir, 'icons')
  const catalogFile = path.join(dir, 'catalog.json')

  await fs.mkdir(iconsDir)
  for (const [name, source] of Object.entries(sources)) await fs.writeFile(path.join(iconsDir, `${name}.svg`), source)
  await fs.writeFile(catalogFile, JSON.stringify(catalog))

  return { dir, iconsDir, catalogFile, remove: () => fs.rm(dir, { recursive: true, force: true }) }
}

// The repository icons with codepoints, markup and fonts, in a temporary folder of ES modules.
export async function repositoryBuild () {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bulle-'))
  await fs.writeFile(path.join(dir, 'package.json'), '{ "type": "module" }\n')

  const { icons: outlined } = await loadIcons()
  const coded = await assignCodepoints(outlined, path.join(dir, 'codepoints.json'))
  const icons = coded.map((icon) => ({ ...icon, body: iconBody(icon) }))
  const fonts = await buildFont(icons, { fontsDir: dir })

  return { dir, icons, fonts, remove: () => fs.rm(dir, { recursive: true, force: true }) }
}
