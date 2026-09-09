import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

export const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

export const dirs = {
  icons: path.join(root, 'icons'),
  meta: path.join(root, 'meta'),
  dist: path.join(root, 'dist'),
  svg: path.join(root, 'dist/svg'),
  fonts: path.join(root, 'dist/fonts'),
  demo: path.join(root, 'dist/demo')
}

// Side of the square grid every icon is drawn on.
export const GRID = 24

// Stroke of every source icon, written in each file and outlined by the build.
export const stroke = { width: 2, linecap: 'round', linejoin: 'round' }

// Minimum distance between a drawing and the edge of the grid.
export const INK_MARGIN = 1

// Catalog categories, in the order the demo lists them.
export const categories = {
  arrows: 'Arrows',
  interface: 'Interface',
  communication: 'Communication',
  people: 'People',
  media: 'Media',
  files: 'Files and data',
  text: 'Text and code',
  time: 'Time',
  security: 'Security',
  commerce: 'Commerce',
  places: 'Places',
  nature: 'Nature',
  objects: 'Objects'
}

// Ink and paper of the demo page and of the preview, in the light and the dark scheme.
export const colors = {
  light: { ink: '#111', paper: '#fff' },
  dark: { ink: '#ededed', paper: '#0b0b0c' }
}

export const font = {
  family: 'Bulle Icons',
  basename: 'bulle-icons',
  // CSS class prefix, .bi and .bi-heart.
  prefix: 'bi',
  fontHeight: 1000,
  // Centres the glyph box 350 units above the baseline, the centre of capital letters.
  descent: 150,
  // First codepoint of the Private Use Area range, the assigned ones are in meta/codepoints.json.
  startCodepoint: 0xe900
}
