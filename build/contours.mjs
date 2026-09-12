import svgpath from 'svgpath'

const CURVE_STEPS = 8

const format = (n) => String(Math.round(n * 1000) / 1000)

// Splits path data into closed contours, each a start point and absolute L, Q or C segments.
export function toContours (d) {
  const contours = []
  let current = null

  svgpath(d).abs().unarc().unshort().iterate((seg, index, x, y) => {
    const [command, ...values] = seg

    if (command === 'M') {
      current = { start: [values[0], values[1]], segments: [] }
      contours.push(current)
    } else if (command === 'L') {
      current.segments.push({ type: 'L', points: [[values[0], values[1]]] })
    } else if (command === 'H') {
      current.segments.push({ type: 'L', points: [[values[0], y]] })
    } else if (command === 'V') {
      current.segments.push({ type: 'L', points: [[x, values[0]]] })
    } else if (command === 'Q') {
      current.segments.push({ type: 'Q', points: [[values[0], values[1]], [values[2], values[3]]] })
    } else if (command === 'C') {
      current.segments.push({
        type: 'C',
        points: [[values[0], values[1]], [values[2], values[3]], [values[4], values[5]]]
      })
    }
  })

  return contours.filter((contour) => contour.segments.length)
}

// Polygon approximation of a contour, curves sampled at regular steps.
export function flatten (contour) {
  const polygon = [contour.start]
  let from = contour.start

  for (const { type, points } of contour.segments) {
    const to = points[points.length - 1]

    if (type === 'L') {
      polygon.push(to)
    } else {
      for (let step = 1; step <= CURVE_STEPS; step++) {
        const t = step / CURVE_STEPS
        const u = 1 - t

        if (type === 'Q') {
          const [c] = points
          polygon.push([
            u * u * from[0] + 2 * u * t * c[0] + t * t * to[0],
            u * u * from[1] + 2 * u * t * c[1] + t * t * to[1]
          ])
        } else {
          const [c1, c2] = points
          polygon.push([
            u * u * u * from[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * to[0],
            u * u * u * from[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * to[1]
          ])
        }
      }
    }

    from = to
  }

  return polygon
}

// Positive for a contour drawn clockwise on screen, where y grows downwards.
export function signedArea (polygon) {
  let sum = 0

  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i]
    const [x2, y2] = polygon[(i + 1) % polygon.length]
    sum += x1 * y2 - x2 * y1
  }

  return sum / 2
}

export function contains (polygon, [px, py]) {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]

    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }

  return inside
}

function reverse (contour) {
  const ends = [contour.start, ...contour.segments.map((s) => s.points[s.points.length - 1])]
  const segments = []

  for (let i = contour.segments.length - 1; i >= 0; i--) {
    const { type, points } = contour.segments[i]
    const controls = points.slice(0, -1).reverse()
    segments.push({ type, points: [...controls, ends[i]] })
  }

  return { start: ends[ends.length - 1], segments }
}

function serialize (contours) {
  return contours
    .map((contour) =>
      `M${contour.start.map(format).join(' ')}` +
      contour.segments.map((s) => s.type + s.points.map((p) => p.map(format).join(' ')).join(' ')).join('') +
      'Z'
    )
    .join('')
}

// Outer contours clockwise, holes counter-clockwise, the direction a TrueType glyph expects.
export function normalizeWinding (d) {
  const contours = toContours(d)
  const polygons = contours.map(flatten)

  const oriented = contours.map((contour, index) => {
    const probe = polygons[index][0]
    const depth = polygons.filter((polygon, other) => other !== index && contains(polygon, probe)).length
    const clockwise = signedArea(polygons[index]) > 0

    return clockwise === (depth % 2 === 0) ? contour : reverse(contour)
  })

  return serialize(oriented)
}

// Surface covered by normalized path data, holes subtracted.
export function inkArea (d) {
  return toContours(d).reduce((sum, contour) => sum + signedArea(flatten(contour)), 0)
}

export function bounds (d) {
  const points = toContours(d).flatMap(flatten)

  if (!points.length) return null

  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])

  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }
}
