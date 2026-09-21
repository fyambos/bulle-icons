import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire, register } from 'node:module'
import { pathToFileURL } from 'node:url'
import opentype from 'opentype.js'
import { root, font as cfg } from '../build/config.mjs'
import { buildDemo } from '../build/demo.mjs'
import { buildElement } from '../build/element.mjs'
import { buildJs, exportName } from '../build/js.mjs'
import { buildReactNative } from '../build/rn.mjs'
import { previewSource } from '../build/preview.mjs'
import { repositoryBuild } from './helpers.mjs'

const built = repositoryBuild()
after(async () => (await built).remove())

const load = (file) => import(pathToFileURL(file).href)

// Stand-ins for the two modules the React Native component imports.
const platform = { OS: 'ios' }
globalThis.bullePlatform = platform
globalThis.__DEV__ = false

const stubs = {
  react: 'export default { createElement: (type, props, ...children) => ({ type, props, children }) }',
  'react-native': 'export const Text = "Text"\nexport const Platform = globalThis.bullePlatform'
}

register(`data:text/javascript,${encodeURIComponent(`
  const stubs = ${JSON.stringify(stubs)}
  export function resolve (specifier, context, next) {
    if (!Object.hasOwn(stubs, specifier)) return next(specifier, context)
    return { url: 'data:text/javascript,' + encodeURIComponent(stubs[specifier]), shortCircuit: true }
  }
`)}`)

// The parts of a page the custom element uses, with the fonts and elements it registers.
function page () {
  const faces = []
  const elements = new Map()

  class HTMLElement {
    #attributes = new Map()
    isConnected = true

    attachShadow () {
      this.shadowRoot = { children: [], append: (node) => this.shadowRoot.children.push(node) }
      return this.shadowRoot
    }

    getAttribute (name) {
      return this.#attributes.get(name) ?? null
    }

    setAttribute (name, value) {
      this.#attributes.set(name, String(value))
      if (this.constructor.observedAttributes.includes(name)) this.attributeChangedCallback()
    }

    removeAttribute (name) {
      this.#attributes.delete(name)
    }
  }

  Object.assign(globalThis, {
    HTMLElement,
    document: { fonts: { add: (face) => faces.push(face) }, createElement: () => ({ textContent: '' }) },
    FontFace: class { constructor (family, data) { Object.assign(this, { family, data }) } },
    CSSStyleSheet: class { replaceSync () {} },
    customElements: { get: (name) => elements.get(name), define: (name, element) => elements.set(name, element) }
  })

  return { faces, elements }
}

test('demo page is self-contained', async () => {
  const { dir, icons, fonts } = await built

  await buildDemo(icons, fonts.woff2, { demoDir: dir })

  const html = await fs.readFile(path.join(dir, 'index.html'), 'utf8')

  assert.doesNotMatch(html, /<link\b|\ssrc=|\shref=|@import/)
  assert.ok(html.includes(`.${cfg.prefix}-${icons[0].name}::before`))

  for (const [, target] of html.matchAll(/url\(\s*["']?([^"')]{0,5})/g)) {
    assert.equal(target, 'data:')
  }
})

test('element shows the glyph of the font and holds no drawing', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {})
  const { dir, icons, fonts } = await built
  const { faces, elements } = page()
  const [first] = icons

  await buildElement(icons, fonts.woff2, { distDir: dir })

  const source = await fs.readFile(path.join(dir, 'bulle-icon.js'), 'utf8')
  const { BulleIcon } = await load(path.join(dir, 'bulle-icon.js'))
  const icon = new BulleIcon()
  const glyph = icon.shadowRoot.children[0]

  assert.doesNotMatch(source, /<path|<svg/)
  assert.equal(elements.get('bulle-icon'), BulleIcon)
  assert.equal(faces[0].family, cfg.family)
  assert.ok(fonts.woff2.equals(faces[0].data))

  icon.setAttribute('name', first.name)
  assert.equal(glyph.textContent, String.fromCodePoint(first.codepoint))
  assert.deepEqual([icon.getAttribute('aria-hidden'), icon.getAttribute('role')], ['true', null])

  icon.setAttribute('label', 'Like')
  assert.deepEqual([icon.getAttribute('aria-hidden'), icon.getAttribute('role'), icon.getAttribute('aria-label')], [null, 'img', 'Like'])

  icon.setAttribute('name', 'constructor')
  assert.equal(glyph.textContent, '')
  assert.equal(warn.mock.callCount(), 1)
})

test('both module formats have the same exports', async () => {
  const { dir, icons } = await built
  const [first] = icons

  await buildJs(icons, { distDir: dir })

  const esm = await load(path.join(dir, 'index.js'))
  const cjs = createRequire(import.meta.url)(path.join(dir, 'index.cjs'))

  assert.deepEqual(Object.keys(cjs).sort(), Object.keys(esm).sort())
  assert.deepEqual(esm[exportName(first.name)], { name: first.name, body: first.body, viewBox: esm.viewBox })
  assert.deepEqual(cjs[exportName(first.name)], esm[exportName(first.name)])
  assert.equal(cjs.toSvg(first.name, { label: 'Like' }), esm.toSvg(first.name, { label: 'Like' }))
  assert.deepEqual([esm.getIcon(first.name), esm.getIcon('constructor')], [first.body, null])
  assert.deepEqual(['delete', '3d-cube', 'view-box'].map(exportName), ['deleteIcon', 'icon3dCube', 'viewBoxIcon'])
})

test('react native icon follows the text around it unless it is given a size', async () => {
  const { dir, icons, fonts } = await built
  const [first] = icons

  await buildReactNative(icons, fonts.ttf, { distDir: dir })

  const { BulleIcon, FONT_FAMILY } = await load(path.join(dir, 'react-native/index.js'))
  const inText = BulleIcon({ name: first.name })
  const alone = BulleIcon({ name: first.name, size: 24, color: 'red' })

  assert.deepEqual(inText.children, [String.fromCodePoint(first.codepoint)])
  assert.deepEqual(inText.props.style[0], { fontFamily: FONT_FAMILY })
  assert.deepEqual(alone.props.style[0], { fontFamily: FONT_FAMILY, fontSize: 24, color: 'red' })
  assert.equal(BulleIcon({ name: 'constructor' }), null)

  platform.OS = 'android'
  assert.equal(BulleIcon({ name: first.name }).props.style[0].includeFontPadding, false)
  platform.OS = 'ios'

  // iOS reads the name inside the file and Android the name of the file.
  const ttf = await fs.readFile(path.join(dir, 'react-native/fonts', `${FONT_FAMILY}.ttf`))
  const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength))

  assert.equal(font.getEnglishName('postScriptName'), FONT_FAMILY)
  assert.ok(ttf.equals(fonts.ttf))
})

test('preview shows the repository icons', async () => {
  const { icons } = await built
  const committed = await fs.readFile(path.join(root, 'preview.svg'), 'utf8')

  assert.ok(previewSource(icons) === committed, 'preview.svg is not the one of these icons, run npm run build')
})
