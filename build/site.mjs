import fs from 'node:fs/promises'
import path from 'node:path'
import { dirs, categories, colors, pkg, font as cfg } from './config.mjs'
import { ensureDir, log } from './lib.mjs'
import { stylesheet } from './css.mjs'

const repo = 'https://github.com/fyambos/bulle-icons'
const npm = `https://www.npmjs.com/package/${pkg.name}`

const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const glyph = (name) => `<i class="${cfg.prefix} ${cfg.prefix}-${name}" aria-hidden="true"></i>`

// Usage examples, the same code as the README.
const usage = {
  web: `<link rel="stylesheet" href="node_modules/${pkg.name}/dist/bulle-icons.css">

<p>Tap <i class="bi bi-heart"></i> to like.</p>`,
  native: `import { BulleIcon } from '${pkg.name}/react-native'

<Text style={{ fontSize: 16 }}>
  Tap <BulleIcon name="heart" /> to like.
</Text>`,
  element: `<script type="module" src="node_modules/${pkg.name}/dist/bulle-icon.js"></script>

<bulle-icon name="heart" label="Like"></bulle-icon>`
}

// Writes the public site, the searchable icon list with a sheet per icon, the font and the SVGs.
export async function buildSite (icons, woff2, { siteDir = dirs.site } = {}) {
  await ensureDir(siteDir)
  await fs.writeFile(path.join(siteDir, 'bulle-icons.woff2'), woff2)
  await fs.cp(dirs.svg, path.join(siteDir, 'svg'), { recursive: true })

  const sections = Object.entries(categories)
    .map(([id, label]) => {
      const cells = icons
        .filter((icon) => icon.category === id)
        .map((icon) => `<button class="cell" data-name="${icon.name}" data-category="${label}" data-keywords="${icon.keywords.join(', ')}" data-search="${[icon.name, ...icon.keywords].join(' ')}">${glyph(icon.name)}<span>${icon.name}</span></button>`)

      if (!cells.length) return ''

      return `<section>
      <h2>${label}</h2>
      <div class="grid">
        ${cells.join('\n        ')}
      </div>
    </section>`
    })
    .join('\n    ')

  const css = stylesheet(icons, ['url("bulle-icons.woff2") format("woff2")'])
  const count = icons.length

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bulle Icons</title>
<meta name="description" content="${pkg.description}">
<link rel="preload" href="bulle-icons.woff2" as="font" type="font/woff2" crossorigin>
<style>
${css}</style>
<style>
  :root {
    color-scheme: light dark;
    --bg: ${colors.light.paper};
    --fg: ${colors.light.ink};
    --muted: #6b7280;
    --line: #e5e7eb;
    --soft: #f4f4f5;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: ${colors.dark.paper}; --fg: ${colors.dark.ink}; --muted: #8b8b93; --line: #26262b; --soft: #161619; }
  }
  * { box-sizing: border-box; }
  html { scroll-padding-top: 96px; }
  body {
    margin: 0; background: var(--bg); color: var(--fg);
    font: 15px/1.6 system-ui, "Segoe UI", sans-serif;
  }
  a { color: inherit; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 16px; }
  @media (min-width: 640px) { .wrap { padding: 0 24px; } }
  header nav { display: flex; align-items: center; gap: 20px; padding: 20px 0; }
  header nav .brand { display: flex; align-items: center; gap: 8px; font-weight: 600; text-decoration: none; margin-right: auto; }
  header nav .brand i { font-size: 22px; }
  header nav a:not(.brand) { color: var(--muted); text-decoration: none; }
  header nav a:not(.brand):hover { color: var(--fg); }
  .hero { padding: 48px 0 32px; }
  .hero h1 { font-size: clamp(32px, 6vw, 48px); line-height: 1.1; letter-spacing: -0.03em; margin: 0 0 12px; }
  .hero p { font-size: 18px; color: var(--muted); margin: 0 0 24px; max-width: 34em; }
  .install {
    display: inline-flex; align-items: center; gap: 12px; max-width: 100%;
    padding: 8px 8px 8px 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--soft);
  }
  .install code { font: 14px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-x: auto; white-space: nowrap; }
  .facts { color: var(--muted); font-size: 13px; margin-top: 16px; }
  button { font: inherit; color: inherit; }
  .btn {
    display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; cursor: pointer;
    border: 1px solid var(--line); border-radius: 8px; background: var(--bg); font-size: 13px; white-space: nowrap;
  }
  .btn:hover { border-color: var(--fg); }
  .bar {
    position: sticky; top: 0; z-index: 2; background: var(--bg);
    padding: 12px 0; border-bottom: 1px solid var(--line);
  }
  .bar .wrap { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .search { position: relative; flex: 1 1 260px; }
  .search i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); }
  input[type=search] {
    width: 100%; padding: 10px 16px 10px 40px; font: inherit; color: inherit;
    background: var(--soft); border: 1px solid var(--line); border-radius: 10px;
  }
  input[type=search]:focus { outline: 2px solid var(--fg); outline-offset: -1px; }
  .styles { display: flex; padding: 3px; border: 1px solid var(--line); border-radius: 10px; background: var(--soft); }
  .styles button { padding: 6px 12px; border: 0; border-radius: 7px; background: transparent; cursor: pointer; color: var(--muted); }
  .styles button[aria-pressed=true] { background: var(--bg); color: var(--fg); box-shadow: 0 0 0 1px var(--line); }
  main { padding-bottom: 32px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin: 32px 0 12px; font-weight: 600; }
  .grid { display: grid; gap: 4px; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); }
  @media (max-width: 480px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  .cell {
    display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0;
    padding: 8px 4px 10px; border: 0; border-radius: 0;
    background: transparent; cursor: pointer;
  }
  .cell[hidden], section[hidden] { display: none; }
  .cell:focus-visible { outline: none; }
  .cell:hover i, .cell:focus-visible i { background: var(--soft); }
  .cell:hover span, .cell:focus-visible span { color: var(--fg); }
  .cell i { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 14px; font-size: 24px; }
  .cell span {
    max-width: 100%; font-size: 11px; line-height: 1.3; color: var(--muted);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .none { color: var(--muted); padding: 48px 0; text-align: center; }
  .usage { padding: 32px 0 16px; border-top: 1px solid var(--line); }
  .usage h2 { margin-top: 0; }
  .tabs { display: flex; gap: 4px; margin-bottom: 12px; flex-wrap: wrap; }
  .tabs button { padding: 6px 12px; border: 1px solid transparent; border-radius: 8px; background: transparent; cursor: pointer; color: var(--muted); }
  .tabs button[aria-selected=true] { border-color: var(--line); color: var(--fg); background: var(--soft); }
  pre {
    margin: 0; padding: 16px; overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; background: var(--soft);
    font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .more { color: var(--muted); font-size: 14px; }
  footer { color: var(--muted); font-size: 13px; padding: 24px 0 48px; border-top: 1px solid var(--line); margin-top: 32px; }
  footer .wrap { display: flex; gap: 16px; flex-wrap: wrap; }
  dialog {
    width: min(440px, calc(100vw - 32px)); padding: 0; border: 1px solid var(--line); border-radius: 16px;
    background: var(--bg); color: var(--fg);
  }
  dialog::backdrop { background: rgb(0 0 0 / 0.4); }
  .sheet { padding: 20px; }
  .sheet header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
  .sheet header h3 { margin: 0; font-size: 17px; overflow-wrap: anywhere; margin-right: auto; }
  .sheet .close { border: 0; background: transparent; cursor: pointer; font-size: 20px; padding: 4px; color: var(--muted); }
  .big { display: grid; place-items: center; height: 160px; border-radius: 12px; background: var(--soft); font-size: 72px; }
  .sizes { display: flex; justify-content: center; align-items: center; gap: 20px; margin: 12px 0 4px; color: var(--muted); font-size: 12px; }
  .sizes span { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .sizes i { color: var(--fg); }
  .info { font-size: 13px; color: var(--muted); margin: 12px 0 16px; }
  .info b { color: var(--fg); font-weight: 600; }
  .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .actions .btn { justify-content: center; padding: 8px 12px; text-decoration: none; }
  .actions .wide { grid-column: 1 / -1; }
  .toast {
    position: fixed; inset-inline: 0; bottom: 24px; margin-inline: auto; width: max-content; z-index: 10;
    background: var(--fg); color: var(--bg); padding: 8px 16px; border-radius: 999px;
    font-size: 13px; opacity: 0; pointer-events: none;
  }
  .toast.on { animation: toast 1.4s; }
  @keyframes toast { 10%, 80% { opacity: 1; } }
</style>
</head>
<body>

<header>
  <div class="wrap">
    <nav>
      <a class="brand" href="./">${glyph('bubble')} Bulle Icons</a>
      <a href="#usage">Usage</a>
      <a href="${repo}">GitHub</a>
      <a href="${npm}">npm</a>
    </nav>
    <div class="hero">
      <h1>Bulle Icons</h1>
      <p>${count} icons for the web and React Native, in one font. They take the size and color of the text around them.</p>
      <div class="install">
        <code>npm i ${pkg.name}</code>
        <button class="btn" data-copy="npm i ${pkg.name}">${glyph('copy')} Copy</button>
      </div>
      <div class="facts">Version ${pkg.version}, MIT license</div>
    </div>
  </div>
</header>

<div class="bar">
  <div class="wrap">
    <label class="search">
      ${glyph('magnifier')}
      <input type="search" id="q" placeholder="Search ${count} icons" autocomplete="off" aria-label="Search icons">
    </label>
    <div class="styles" role="group" aria-label="Style">
      <button data-style="all" aria-pressed="true">All</button>
      <button data-style="outline" aria-pressed="false">Outline</button>
      <button data-style="fill" aria-pressed="false">Fill</button>
    </div>
  </div>
</div>

<main class="wrap">
  <div id="icons">
    ${sections}
  </div>
  <p class="none" id="none" hidden>No icons found.</p>
</main>

<section class="usage" id="usage">
  <div class="wrap">
    <h2>Usage</h2>
    <div class="tabs" role="tablist">
      <button role="tab" data-tab="web" aria-selected="true">Web</button>
      <button role="tab" data-tab="native" aria-selected="false">React Native</button>
      <button role="tab" data-tab="element" aria-selected="false">Web component</button>
    </div>
    <pre data-panel="web">${esc(usage.web)}</pre>
    <pre data-panel="native" hidden>${esc(usage.native)}</pre>
    <pre data-panel="element" hidden>${esc(usage.element)}</pre>
    <p class="more">Sizes, colors and the font setup for Expo are in the <a href="${repo}#readme">README</a>.</p>
  </div>
</section>

<footer>
  <div class="wrap">
    <span>MIT license</span>
    <a href="${repo}">GitHub</a>
    <a href="${npm}">npm</a>
  </div>
</footer>

<dialog id="sheet" aria-labelledby="sheet-name">
  <div class="sheet">
    <header>
      <h3 id="sheet-name"></h3>
      <button class="close" id="close" aria-label="Close">${glyph('x')}</button>
    </header>
    <div class="big" id="big"></div>
    <div class="sizes" id="sizes"></div>
    <p class="info"><b id="sheet-category"></b><span id="sheet-keywords"></span></p>
    <div class="actions">
      <button class="btn" data-copy-as="name">${glyph('copy')} Name</button>
      <button class="btn" data-copy-as="html">${glyph('copy')} HTML</button>
      <button class="btn" data-copy-as="native">${glyph('copy')} React Native</button>
      <button class="btn" data-copy-as="svg">${glyph('copy')} SVG</button>
      <a class="btn wide" id="download" download>${glyph('download')} Download SVG</a>
    </div>
  </div>
</dialog>

<div class="toast" id="toast" role="status"></div>

<script>
  const prefix = '${cfg.prefix}'
  const q = document.getElementById('q')
  const sections = [...document.querySelectorAll('#icons section')]
  const sheet = document.getElementById('sheet')
  const toast = document.getElementById('toast')
  let style = 'all'
  let current = null

  const isFill = (name) => name.endsWith('-fill')
  const icon = (name) => '<i class="' + prefix + ' ' + prefix + '-' + name + '" aria-hidden="true"></i>'

  function filter () {
    const term = q.value.trim().toLowerCase()
    let shown = 0

    for (const section of sections) {
      let inSection = 0

      for (const cell of section.querySelectorAll('.cell')) {
        const name = cell.dataset.name
        const styleOk = style === 'all' || (style === 'fill') === isFill(name)
        cell.hidden = !styleOk || (term !== '' && !cell.dataset.search.includes(term))
        if (!cell.hidden) inSection++
      }

      section.hidden = inSection === 0
      shown += inSection
    }

    document.getElementById('none').hidden = shown > 0

    const url = new URL(location.href)
    if (term) url.searchParams.set('q', term)
    else url.searchParams.delete('q')
    history.replaceState(null, '', url)
  }

  function say (text) {
    toast.textContent = text
    toast.classList.remove('on')
    toast.getBoundingClientRect()
    toast.classList.add('on')
  }

  async function copy (text, what) {
    await navigator.clipboard.writeText(text)
    say(what + ' copied')
  }

  function open (cell) {
    const name = cell.dataset.name
    current = name
    document.getElementById('sheet-name').textContent = name
    document.getElementById('big').innerHTML = icon(name)
    document.getElementById('sizes').innerHTML = [16, 20, 24, 32]
      .map((size) => '<span><i class="' + prefix + ' ' + prefix + '-' + name + '" style="font-size:' + size + 'px" aria-hidden="true"></i>' + size + '</span>')
      .join('')
    document.getElementById('sheet-category').textContent = cell.dataset.category
    document.getElementById('sheet-keywords').textContent = cell.dataset.keywords ? ' · ' + cell.dataset.keywords : ''
    const download = document.getElementById('download')
    download.href = 'svg/' + name + '.svg'
    download.setAttribute('download', name + '.svg')
    sheet.showModal()
  }

  const formats = {
    name: (name) => [name, 'Name'],
    html: (name) => ['<i class="' + prefix + ' ' + prefix + '-' + name + '"></i>', 'HTML'],
    native: (name) => ['<BulleIcon name="' + name + '" />', 'React Native']
  }

  document.querySelectorAll('[data-copy-as]').forEach((button) => {
    button.addEventListener('click', async () => {
      const as = button.dataset.copyAs
      if (as === 'svg') {
        const svg = await (await fetch('svg/' + current + '.svg')).text()
        return copy(svg.trim(), 'SVG')
      }
      const [text, what] = formats[as](current)
      copy(text, what)
    })
  })

  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', () => copy(button.dataset.copy, 'Command'))
  })

  document.getElementById('icons').addEventListener('click', (event) => {
    const cell = event.target.closest('.cell')
    if (cell) open(cell)
  })

  document.getElementById('close').addEventListener('click', () => sheet.close())
  sheet.addEventListener('click', (event) => { if (event.target === sheet) sheet.close() })

  document.querySelectorAll('[data-style]').forEach((button) => {
    button.addEventListener('click', () => {
      style = button.dataset.style
      document.querySelectorAll('[data-style]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)))
      filter()
    })
  })

  document.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)))
      document.querySelectorAll('[data-panel]').forEach((panel) => { panel.hidden = panel.dataset.panel !== tab.dataset.tab })
    })
  })

  // The slash key jumps to the search field, as on most icon sites.
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== q && !sheet.open) {
      event.preventDefault()
      q.focus()
    }
  })

  q.addEventListener('input', filter)
  const start = new URL(location.href).searchParams.get('q')
  if (start) { q.value = start; filter() }
</script>

</body>
</html>
`

  await fs.writeFile(path.join(siteDir, 'index.html'), html)
  log.done('site: index.html')
}
