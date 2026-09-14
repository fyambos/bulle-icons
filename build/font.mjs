import fs from 'node:fs/promises'
import { Readable } from 'node:stream'
import path from 'node:path'
import svg2ttf from 'svg2ttf'
import ttf2woff from 'ttf2woff'
import ttf2woff2 from 'ttf2woff2'
import { dirs, GRID, pkg, font as cfg } from './config.mjs'
import { ensureDir, log } from './lib.mjs'
import { rebuild, withoutName, plainMetrics } from './sfnt.mjs'

// Id of the name record that holds the address of the font's vendor.
const VENDOR_URL = 11

async function loadFontStream () {
  const mod = await import('svgicons2svgfont')
  return mod.SVGIcons2SVGFontStream ?? mod.default
}

// Compiles the outlines into ttf, woff and woff2, the same icons always give the same files.
export async function buildFont (icons, { fontsDir = dirs.fonts } = {}) {
  await ensureDir(fontsDir)

  const SVGIcons2SVGFontStream = await loadFontStream()

  // Glyphs are not centred horizontally, so an icon and its variants stay aligned.
  const stream = new SVGIcons2SVGFontStream({
    fontName: cfg.family,
    fontHeight: cfg.fontHeight,
    descent: cfg.descent,
    normalize: true,
    round: 1e3,
    log: () => {}
  })

  const svgFont = await new Promise((resolve, reject) => {
    let out = ''
    stream.on('data', (chunk) => { out += chunk })
    stream.on('end', () => resolve(out))
    stream.on('error', reject)

    for (const icon of icons) {
      const glyph = Readable.from([
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}"><path d="${icon.d}"/></svg>`
      ])
      glyph.metadata = { name: icon.name, unicode: [String.fromCodePoint(icon.codepoint)] }
      stream.write(glyph)
    }

    stream.end()
  })

  // A fixed date, the generator would write the time of the build.
  const generated = Buffer.from(svg2ttf(svgFont, {
    description: cfg.family,
    version: pkg.version.split('.').slice(0, 2).join('.'),
    url: pkg.homepage ?? 'none',
    ts: 0
  }).buffer)

  // The generator writes its own address and vendor id, and a line gap only some engines apply.
  const ttf = rebuild(generated, {
    name: (table) => pkg.homepage ? table : withoutName(table, VENDOR_URL),
    'OS/2': (table, tables) => plainMetrics(table, tables.get('hhea'))
  })

  const files = { ttf, woff: Buffer.from(ttf2woff(ttf).buffer), woff2: ttf2woff2(ttf) }

  for (const [ext, data] of Object.entries(files)) {
    await fs.writeFile(path.join(fontsDir, `${cfg.basename}.${ext}`), data)
  }

  const sizes = Object.entries(files).map(([ext, data]) => `${ext} ${(data.length / 1024).toFixed(1)}kb`)

  log.done(`font: ${icons.length} glyphs, ${sizes.join(', ')}`)
  return files
}
