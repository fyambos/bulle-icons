import fs from 'node:fs/promises'
import { dirs } from './config.mjs'
import { ensureDir, log } from './lib.mjs'
import { loadIcons } from './icons.mjs'
import { buildSvg } from './svg.mjs'
import { assignCodepoints } from './codepoints.mjs'
import { buildFont } from './font.mjs'
import { buildCss } from './css.mjs'
import { buildJs } from './js.mjs'
import { buildElement } from './element.mjs'
import { buildReactNative } from './rn.mjs'
import { buildDemo } from './demo.mjs'
import { buildPreview } from './preview.mjs'

const started = Date.now()

const { icons: outlined, problems } = await loadIcons()

if (!outlined.length) problems.push('icons/ has no icon')

if (problems.length) {
  for (const problem of problems) log.fail(problem)
  console.log(`\n${problems.length} problem(s), nothing was built`)
  process.exit(1)
}

await fs.rm(dirs.dist, { recursive: true, force: true })
await ensureDir(dirs.dist)

log.step(`building ${outlined.length} icons`)

const icons = await assignCodepoints(await buildSvg(outlined))
const fonts = await buildFont(icons)

await buildCss(icons)
await buildJs(icons)
await buildElement(icons, fonts.woff2)
await buildReactNative(icons, fonts.ttf)
await buildDemo(icons, fonts.woff2)
await buildPreview(icons)

log.done(`done in ${Date.now() - started}ms`)
