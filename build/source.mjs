import { GRID, stroke } from './config.mjs'

// Root attributes of every source file, they make the file render like its glyph.
export const rootAttributes = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: `0 0 ${GRID} ${GRID}`,
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': String(stroke.width),
  'stroke-linecap': stroke.linecap,
  'stroke-linejoin': stroke.linejoin
}

const GEOMETRY = {
  path: ['d'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  rect: ['x', 'y', 'width', 'height']
}

const OPTIONAL = { path: ['fill-rule'], rect: ['rx'] }
const PAINT = ['fill', 'stroke', 'mask']
const MASK_ID = 'cut'

// The mask covers the whole grid, SVG would otherwise clip it to the box of its shape.
export const maskAttributes = {
  id: MASK_ID,
  maskUnits: 'userSpaceOnUse',
  x: '0',
  y: '0',
  width: String(GRID),
  height: String(GRID)
}

// First child of the mask, white keeps the shapes and the black shapes after it cut them.
export const backdropTag = `<rect width="${GRID}" height="${GRID}" fill="#fff" stroke="none"/>`

const TAG = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g
const ATTRIBUTE = /([\w:-]+)\s*=\s*"([^"]*)"/g

function attributes (text) {
  return Object.fromEntries([...text.matchAll(ATTRIBUTE)].map((m) => [m[1], m[2]]))
}

function readShape (tag, attrs, inMask, problems) {
  const allowed = [...GEOMETRY[tag], ...(OPTIONAL[tag] ?? []), ...PAINT]

  for (const name of Object.keys(attrs)) {
    if (!allowed.includes(name)) problems.push(`<${tag} ${name}> is not allowed`)
  }

  const shape = { tag }

  for (const name of [...GEOMETRY[tag], ...(OPTIONAL[tag] ?? [])]) {
    if (name === 'd' || name === 'fill-rule') continue
    if (attrs[name] == null) {
      if (GEOMETRY[tag].includes(name)) problems.push(`<${tag}> needs ${name}`)
      continue
    }

    const value = Number(attrs[name])
    if (Number.isNaN(value)) problems.push(`<${tag} ${name}> must be a number`)
    shape[name] = value
  }

  if (tag === 'path') {
    if (!attrs.d) problems.push('<path> needs d')
    shape.d = attrs.d ?? ''
  }

  const ink = inMask ? '#000' : 'currentColor'

  if (attrs.fill != null && attrs.fill !== ink) problems.push(`fill must be ${ink} here, found ${attrs.fill}`)
  shape.fill = attrs.fill === ink

  if (inMask) {
    if (attrs.stroke !== '#000' && attrs.stroke !== 'none') problems.push('inside the mask, stroke must be #000 or none')
    shape.stroke = attrs.stroke === '#000'
    if (attrs.mask != null) problems.push('mask is not allowed inside the mask')
  } else {
    if (attrs.stroke != null && attrs.stroke !== 'none') problems.push(`stroke must be none or absent, found ${attrs.stroke}`)
    shape.stroke = attrs.stroke == null
    if (attrs.mask != null && attrs.mask !== `url(#${MASK_ID})`) problems.push(`mask must be url(#${MASK_ID})`)
    shape.masked = attrs.mask != null
  }

  if (!shape.fill && !shape.stroke) problems.push(`<${tag}> has neither fill nor stroke`)

  if (attrs['fill-rule'] != null) {
    if (attrs['fill-rule'] !== 'evenodd') problems.push('fill-rule must be evenodd or absent')
    if (!shape.fill) problems.push('fill-rule needs a fill')
  }
  shape.evenodd = attrs['fill-rule'] === 'evenodd'

  return shape
}

// Reads a source icon, anything outside the accepted shapes and attributes is a problem.
export function parseSource (source) {
  const problems = []
  const shapes = []
  const cuts = []
  let depth = 0
  let inMask = false
  let hasMask = false
  let rootSeen = false
  let backdropSeen = false
  let last = 0

  for (const match of source.matchAll(TAG)) {
    const [whole, closing, tag, attributeText, selfClosing] = match

    if (source.slice(last, match.index).trim()) problems.push('text outside of tags is not allowed')
    last = match.index + whole.length

    const attrs = attributes(attributeText)

    if (tag === 'svg') {
      if (closing) { depth--; continue }
      if (rootSeen) { problems.push('nested <svg> is not allowed'); continue }
      rootSeen = true
      depth++

      for (const [name, value] of Object.entries(rootAttributes)) {
        if (attrs[name] !== value) problems.push(`<svg ${name}> must be "${value}"`)
      }
      for (const name of Object.keys(attrs)) {
        if (!(name in rootAttributes)) problems.push(`<svg ${name}> is not allowed`)
      }
      continue
    }

    if (!rootSeen || depth < 1) { problems.push(`<${tag}> is outside of <svg>`); continue }

    if (tag === 'mask') {
      if (closing) { inMask = false; continue }
      if (hasMask) problems.push('only one <mask> is allowed')
      if (shapes.length) problems.push('<mask> must come before the shapes')
      for (const [name, value] of Object.entries(maskAttributes)) {
        if (attrs[name] !== value) problems.push(`<mask ${name}> must be "${value}"`)
      }
      for (const name of Object.keys(attrs)) {
        if (!(name in maskAttributes)) problems.push(`<mask ${name}> is not allowed`)
      }
      hasMask = true
      inMask = true
      continue
    }

    if (!(tag in GEOMETRY)) { problems.push(`<${tag}> is not allowed`); continue }
    if (closing || !selfClosing) { problems.push(`<${tag}> must be self-closing`); continue }

    if (inMask && !backdropSeen) {
      const backdrop = tag === 'rect' &&
        Object.keys(attrs).length === 4 &&
        attrs.width === String(GRID) && attrs.height === String(GRID) &&
        attrs.fill === '#fff' && attrs.stroke === 'none'

      if (!backdrop) problems.push(`the mask must start with ${backdropTag}`)
      backdropSeen = true
      if (backdrop) continue
    }

    const shape = readShape(tag, attrs, inMask, problems)
    if (inMask) cuts.push(shape)
    else shapes.push(shape)
  }

  if (source.slice(last).trim()) problems.push('text outside of tags is not allowed')
  if (!rootSeen) problems.push('no <svg> root')
  if (depth !== 0) problems.push('<svg> is not closed')
  if (inMask) problems.push('<mask> is not closed')
  if (!shapes.length) problems.push('no shape')
  if (hasMask && !cuts.length) problems.push('the mask is empty')
  if (hasMask && !shapes.some((shape) => shape.masked)) problems.push('the mask is not used by any shape')
  if (!hasMask && shapes.some((shape) => shape.masked)) problems.push(`mask="url(#${MASK_ID})" is used but <mask id="${MASK_ID}"> is missing`)

  return { shapes, cuts, problems }
}

// Path data of a shape, in grid units.
export function shapeData (shape) {
  if (shape.tag === 'path') return shape.d

  if (shape.tag === 'circle' || shape.tag === 'ellipse') {
    const rx = shape.tag === 'circle' ? shape.r : shape.rx
    const ry = shape.tag === 'circle' ? shape.r : shape.ry
    return `M${shape.cx - rx} ${shape.cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`
  }

  const { x, y, width, height } = shape
  const r = Math.min(shape.rx ?? 0, width / 2, height / 2)

  if (!r) return `M${x} ${y}h${width}v${height}h${-width}z`

  return `M${x + r} ${y}h${width - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${height - 2 * r}` +
    `a${r} ${r} 0 0 1 ${-r} ${r}h${-(width - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}` +
    `v${-(height - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`
}
