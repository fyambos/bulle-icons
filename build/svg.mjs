import fs from 'node:fs/promises'
import path from 'node:path'
import { optimize } from 'svgo'
import { dirs, GRID, font } from './config.mjs'
import { ensureDir, innerSvg, log } from './lib.mjs'

const svgoConfig = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          cleanupNumericValues: { floatPrecision: 3 },
          convertPathData: { floatPrecision: 3 }
        }
      }
    }
  ]
}

const viewBox = `0 0 ${GRID} ${GRID}`

// Optimised markup of an outlined icon, without the svg element around it.
export function iconBody (icon) {
  const outlined = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path d="${icon.d}"/></svg>`
  return innerSvg(optimize(outlined, svgoConfig).data)
}

// Writes dist/svg/<name>.svg and dist/sprite.svg, returns the icons with their optimised markup.
export async function buildSvg (icons) {
  await ensureDir(dirs.svg)

  const symbols = []
  const out = []

  for (const icon of icons) {
    const body = iconBody(icon)

    await fs.writeFile(
      path.join(dirs.svg, `${icon.name}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="currentColor" width="1em" height="1em">${body}</svg>\n`
    )

    symbols.push(`<symbol id="${font.prefix}-${icon.name}" viewBox="${viewBox}">${body}</symbol>`)
    out.push({ ...icon, body })
  }

  await fs.writeFile(
    path.join(dirs.dist, 'sprite.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${symbols.join('')}</svg>\n`
  )

  log.done(`svg: ${icons.length} files and the sprite`)
  return out
}
