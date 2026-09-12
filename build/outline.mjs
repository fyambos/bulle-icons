import fs from 'node:fs'
import { createRequire } from 'node:module'
import svgpath from 'svgpath'
import { GRID, stroke } from './config.mjs'
import { shapeData } from './source.mjs'
import { normalizeWinding } from './contours.mjs'

const require = createRequire(import.meta.url)

// Path units per grid unit while outlining, the library flattens curves to a quarter of a unit.
const SCALE = 32

let kit

async function pathKit () {
  if (!kit) {
    const init = require('pathkit-wasm/bin/pathkit.js')
    // The loader fetches the wasm by URL, which fails on a file path, so it is given the bytes.
    kit = await init({ wasmBinary: fs.readFileSync(require.resolve('pathkit-wasm/bin/pathkit.wasm')) })
  }
  return kit
}

const CAPS = { round: 'ROUND', butt: 'BUTT', square: 'SQUARE' }
const JOINS = { round: 'ROUND', miter: 'MITER', bevel: 'BEVEL' }

function must (path, what) {
  if (!path) throw new Error(`the path library could not ${what}`)
  return path
}

// The fill and the outlined stroke of a shape, as separate paths.
function shapePieces (kit, shape) {
  const base = must(kit.FromSVGString(shapeData(shape)), 'read the path data')
  base.transform(SCALE, 0, 0, 0, SCALE, 0, 0, 0, 1)

  const pieces = []

  if (shape.fill) {
    const fill = base.copy()
    fill.setFillType(shape.evenodd ? kit.FillType.EVENODD : kit.FillType.WINDING)
    pieces.push(fill)
  }

  if (shape.stroke) {
    const outlined = base.copy()
    must(outlined.stroke({
      width: stroke.width * SCALE,
      miter_limit: 4,
      cap: kit.StrokeCap[CAPS[stroke.linecap]],
      join: kit.StrokeJoin[JOINS[stroke.linejoin]]
    }), 'outline the stroke')
    pieces.push(outlined)
  }

  base.delete()
  return pieces
}

// Pieces are joined raw and one by one, the union builder and a per-piece simplify drop shapes.
function union (kit, shapes) {
  const pieces = shapes.flatMap((shape) => shapePieces(kit, shape))

  if (!pieces.length) return null

  const [total, ...rest] = pieces

  for (const piece of rest) {
    must(total.op(piece, kit.PathOp.UNION), 'join the shapes')
    piece.delete()
  }

  // A lone piece still overlaps itself, where a stroke crosses its own path.
  if (!rest.length) must(total.simplify(), 'resolve the shape')

  return total
}

// Turns the shapes of a source icon into the path data of one filled outline.
export async function outline ({ shapes, cuts }) {
  const kit = await pathKit()

  const plain = union(kit, shapes.filter((shape) => !shape.masked))
  const masked = union(kit, shapes.filter((shape) => shape.masked))
  const cut = union(kit, cuts)

  if (masked && cut) must(masked.op(cut, kit.PathOp.DIFFERENCE), 'cut the shapes')
  if (plain && masked) must(plain.op(masked, kit.PathOp.UNION), 'join the shapes')

  const ink = plain ?? masked

  const d = ink ? pathData(ink.toCmds()) : ''

  for (const path of [plain, masked, cut]) path?.delete()

  return d ? normalizeWinding(d) : ''
}

const VERB = { move: 0, line: 1, quad: 2, conic: 3, cubic: 4, close: 5 }

// SVG cannot write a conic, cubic pieces follow it within a thousandth of a unit.
function conicToCubics (p0, p1, p2, w) {
  const at = (t) => {
    const u = 1 - t
    const k = 2 * t * u * w
    const weight = u * u + k + t * t
    const dk = 2 * w * (1 - 2 * t)
    const dWeight = -2 * u + dk + 2 * t

    return [0, 1].map((axis) => {
      const value = u * u * p0[axis] + k * p1[axis] + t * t * p2[axis]
      const slope = -2 * u * p0[axis] + dk * p1[axis] + 2 * t * p2[axis]
      return { value: value / weight, slope: (slope * weight - value * dWeight) / (weight * weight) }
    })
  }

  const pieces = w > 0.95 ? 1 : w > 0.6 ? 2 : 4
  const cubics = []

  for (let piece = 0; piece < pieces; piece++) {
    const a = at(piece / pieces)
    const b = at((piece + 1) / pieces)
    const third = 1 / pieces / 3

    cubics.push([
      a.map((axis) => axis.value + axis.slope * third),
      b.map((axis) => axis.value - axis.slope * third),
      b.map((axis) => axis.value)
    ])
  }

  return cubics
}

// Writes the commands of the path library as SVG path data in grid units.
function pathData (commands) {
  const point = (x, y) => `${Math.round((x / SCALE) * 1000) / 1000} ${Math.round((y / SCALE) * 1000) / 1000}`
  let d = ''
  let from = [0, 0]

  for (const [verb, ...values] of commands) {
    if (verb === VERB.close) {
      d += 'Z'
      continue
    }

    const end = values.slice(verb === VERB.conic ? -3 : -2).slice(0, 2)

    if (verb === VERB.move) d += `M${point(...end)}`
    else if (verb === VERB.line) d += `L${point(...end)}`
    else if (verb === VERB.quad) d += `Q${point(values[0], values[1])} ${point(...end)}`
    else if (verb === VERB.cubic) d += `C${point(values[0], values[1])} ${point(values[2], values[3])} ${point(...end)}`
    else if (verb === VERB.conic) {
      for (const cubic of conicToCubics(from, [values[0], values[1]], end, values[4])) {
        d += `C${cubic.map((p) => point(...p)).join(' ')}`
      }
    }

    from = end
  }

  return d
}

// Rotates an outline clockwise around the centre of the grid, or mirrors it, or both.
export function transform (d, { rotate = 0, flip = null }) {
  const centre = GRID / 2
  let path = svgpath(d).translate(-centre, -centre)

  if (flip === 'x') path = path.scale(-1, 1)
  if (flip === 'y') path = path.scale(1, -1)
  if (rotate) path = path.rotate(rotate)

  return normalizeWinding(path.translate(centre, centre).round(3).toString())
}
