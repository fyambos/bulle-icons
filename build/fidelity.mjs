import { Resvg } from '@resvg/resvg-js'
import { GRID } from './config.mjs'

// Pixels per grid unit of the two renders that are compared.
const ZOOM = 8

// Opacity gap, out of 255, from which a pixel counts as different.
const DIFFERENCE = 64

// Opacity of each pixel, 0 to 255.
function opacity (svg) {
  const image = new Resvg(svg, { fitTo: { mode: 'zoom', value: ZOOM }, font: { loadSystemFonts: false } }).render()
  // The pixels getter copies the whole image at every access, so it is read once.
  const pixels = image.pixels
  const alpha = new Uint8Array(image.width * image.height)

  for (let i = 0; i < alpha.length; i++) alpha[i] = pixels[i * 4 + 3]

  return alpha
}

// Share of the drawing that the outline renders differently, 0 when they match.
export function mismatch (source, d) {
  const size = `width="${GRID}" height="${GRID}"`
  const drawn = opacity(source.replace('<svg ', `<svg color="#000" ${size} `))
  const built = opacity(`<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="0 0 ${GRID} ${GRID}"><path d="${d}"/></svg>`)

  let ink = 0
  let different = 0

  for (let i = 0; i < drawn.length; i++) {
    if (drawn[i] > 127) ink++
    // A shifted edge changes the opacity slightly, a missing shape changes it fully.
    if (Math.abs(drawn[i] - built[i]) > DIFFERENCE) different++
  }

  return ink ? different / ink : 1
}
