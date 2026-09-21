import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import opentype from 'opentype.js'
import { GRID, pkg, font as cfg } from '../build/config.mjs'
import { assignCodepoints } from '../build/codepoints.mjs'
import { buildFont } from '../build/font.mjs'
import { bounds } from '../build/contours.mjs'
import { checksum, FILE_CHECKSUM, NO_VENDOR } from '../build/sfnt.mjs'
import { repositoryBuild } from './helpers.mjs'

const built = repositoryBuild()
after(async () => (await built).remove())

const parse = (ttf) => opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength))

test('codepoints are stable', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bulle-'))
  const file = path.join(dir, 'codepoints.json')
  const start = cfg.startCodepoint

  const first = await assignCodepoints([{ name: 'bell' }, { name: 'heart' }], file)
  const second = await assignCodepoints([{ name: 'arrow' }, { name: 'bell' }, { name: 'heart' }], file)

  assert.deepEqual(first.map((icon) => icon.codepoint), [start, start + 1])
  assert.deepEqual(second.map((icon) => icon.codepoint), [start + 2, start, start + 1])

  await fs.rm(dir, { recursive: true, force: true })
})

test('glyph positions match the drawings', async () => {
  const { icons, fonts } = await built
  const font = parse(fonts.ttf)

  const unit = cfg.fontHeight / GRID
  const top = cfg.fontHeight - cfg.descent

  for (const icon of icons) {
    const glyph = font.charToGlyph(String.fromCodePoint(icon.codepoint))
    const box = glyph.getBoundingBox()
    const drawn = bounds(icon.d)
    const expected = [drawn.left * unit, top - drawn.bottom * unit, drawn.right * unit, top - drawn.top * unit]

    assert.equal(glyph.advanceWidth, cfg.fontHeight, icon.name)

    for (const [index, value] of [box.x1, box.y1, box.x2, box.y2].entries()) {
      assert.ok(Math.abs(value - expected[index]) <= 2, `${icon.name}: glyph box ${[box.x1, box.y1, box.x2, box.y2]}, drawn ${expected.map(Math.round)}`)
    }
  }
})

test('line is one em high in every engine', async () => {
  const { fonts } = await built
  const { hhea, os2 } = parse(fonts.ttf).tables
  const top = cfg.fontHeight - cfg.descent

  assert.equal(parse(fonts.ttf).unitsPerEm, cfg.fontHeight)
  assert.deepEqual([hhea.ascender, hhea.descender, hhea.lineGap], [top, -cfg.descent, 0])
  assert.deepEqual([os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap], [top, -cfg.descent, 0])
  assert.deepEqual([os2.usWinAscent, os2.usWinDescent], [top, cfg.descent])
})

test('font names only this package', async () => {
  const { icons, fonts } = await built
  const text = fonts.ttf.toString('latin1').replaceAll('\0', '').replaceAll(pkg.homepage ?? '', '')
  const font = parse(fonts.ttf)

  assert.doesNotMatch(text, /https?:|www\./)
  assert.ok(text.includes(cfg.family))
  assert.equal(font.tables.os2.achVendID, NO_VENDOR)
  assert.equal(checksum(fonts.ttf), FILE_CHECKSUM)
  assert.equal(font.glyphs.length, icons.length + 1)
})

test('same icons give the same font files', async () => {
  const { dir, icons, fonts } = await built
  const again = await buildFont(icons, { fontsDir: path.join(dir, 'again') })

  for (const [format, data] of Object.entries(fonts)) assert.ok(data.equals(again[format]), format)
})
