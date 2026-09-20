import fs from 'node:fs/promises'
import path from 'node:path'
import { dirs, categories, colors, font as cfg } from './config.mjs'
import { ensureDir, log } from './lib.mjs'
import { elementSource } from './element.mjs'
import { stylesheet } from './css.mjs'

const glyph = (name) => `<i class="${cfg.prefix} ${cfg.prefix}-${name}"></i>`
const element = (name) => `<bulle-icon name="${name}"></bulle-icon>`

// Writes the demo page, icons inside sentences at four sizes then every icon by category.
export async function buildDemo (icons, woff2, { demoDir = dirs.demo } = {}) {
  await ensureDir(demoDir)

  const sections = Object.entries(categories)
    .map(([id, label]) => {
      const cells = icons
        .filter((icon) => icon.category === id)
        .map((icon) => `<button class="cell" data-name="${icon.name}" data-search="${[icon.name, ...icon.keywords].join(' ')}">
        ${glyph(icon.name)}
        <span>${icon.name}</span>
      </button>`)

      if (!cells.length) return ''

      return `<section>
    <h2>${label}</h2>
    <div class="grid">
      ${cells.join('\n      ')}
    </div>
  </section>`
    })
    .join('\n  ')

  // Font, styles and element are inlined, browsers block local files on pages opened from disk.
  const css = stylesheet(icons, [`url("data:font/woff2;base64,${woff2.toString('base64')}") format("woff2")`])
  const inlineElement = elementSource(icons, woff2).replace(/<\//g, '<\\/')

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bulle Icons</title>
<style>
${css}</style>
<style>
  :root {
    color-scheme: light dark;
    --bg: ${colors.light.paper};
    --fg: ${colors.light.ink};
    --muted: #6b7280;
    --line: #e5e7eb;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: ${colors.dark.paper}; --fg: ${colors.dark.ink}; --muted: #8b8b93; --line: #26262b; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto;
    padding: 40px 24px 96px;
    max-width: 1080px;
    background: var(--bg);
    color: var(--fg);
    font: 15px/1.6 system-ui, "Segoe UI", sans-serif;
  }
  h1 { font-size: 28px; letter-spacing: -0.02em; margin: 0 0 4px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin: 40px 0 12px; }
  .sub { color: var(--muted); margin: 0 0 8px; }
  .lines { border: 1px solid var(--line); border-radius: 14px; padding: 20px 24px; }
  .lines p { margin: 0 0 12px; }
  .lines p:last-child { margin: 0; }
  .s13 { font-size: 13px; }
  .s22 { font-size: 22px; }
  .s34 { font-size: 34px; letter-spacing: -0.02em; }
  .boxes .lines .${cfg.prefix}, .boxes .lines bulle-icon { outline: 1px dotted var(--muted); }
  label { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); margin-top: 12px; }
  .send {
    font: inherit; color: inherit; background: transparent;
    padding: 8px 16px; border: 1px solid var(--line); border-radius: 999px;
  }
  input[type=search] {
    width: 100%; margin-top: 40px; padding: 12px 16px; font: inherit; color: inherit;
    background: transparent; border: 1px solid var(--line); border-radius: 999px;
  }
  .grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); }
  .cell {
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    padding: 16px 8px; border: 1px solid var(--line); border-radius: 12px;
    background: transparent; color: inherit; cursor: pointer; font: inherit;
  }
  .cell[hidden] { display: none; }
  .cell:hover { border-color: var(--fg); }
  .cell i { font-size: 24px; }
  .cell span {
    font-size: 11px; line-height: 1.3; min-height: 2.6em; color: var(--muted);
    text-align: center; overflow-wrap: anywhere;
  }
  .none { color: var(--muted); margin-top: 24px; }
  .toast {
    position: fixed; inset-inline: 0; bottom: 24px; margin-inline: auto; width: max-content;
    background: var(--fg); color: var(--bg); padding: 10px 18px; border-radius: 999px;
    font-size: 13px; opacity: 0; pointer-events: none;
  }
  .toast.on { animation: toast 1.4s; }
  @keyframes toast { 10%, 80% { opacity: 1; } }
</style>
</head>
<body>

<h1>Bulle Icons</h1>
<p class="sub">${icons.length} icons</p>

<h2>In text</h2>
<div class="lines">
  <p class="s13">13 px. Tap ${glyph('heart')} to like, ${glyph('bubble')} to reply, ${glyph('arrows-repeat')} to repost.</p>
  <p>15 px. ${glyph('check-double')} Read at 9:41, ${glyph('bell')} 3 new, ${glyph('person-plus')} Follow.</p>
  <p>15 px, as elements. ${element('heart')} Like, ${element('bubble')} Reply, ${element('arrows-repeat')} Repost.</p>
  <p class="s22">22 px. ${glyph('magnifier')} Search, ${glyph('gear')} Settings.</p>
  <p class="s34">34 px. ${glyph('house')} Home</p>
  <p><button class="send">${glyph('paper-plane')} Send</button></p>
</div>
<label><input type="checkbox" id="boxes"> Show the box of each icon</label>

<input type="search" id="q" placeholder="Search by name or keyword" autocomplete="off">
<p class="none" id="none" hidden>No icons found.</p>

<main id="icons">
  ${sections}
</main>

<div class="toast" id="toast"></div>

<script type="module">
${inlineElement}
</script>
<script>
  const q = document.getElementById('q')
  const toast = document.getElementById('toast')
  const sections = [...document.querySelectorAll('#icons section')]

  q.addEventListener('input', () => {
    const term = q.value.trim().toLowerCase()
    let shown = 0

    for (const section of sections) {
      let inSection = 0

      for (const cell of section.querySelectorAll('.cell')) {
        cell.hidden = term !== '' && !cell.dataset.search.includes(term)
        if (!cell.hidden) inSection++
      }

      section.hidden = inSection === 0
      shown += inSection
    }

    document.getElementById('none').hidden = shown > 0
  })

  // A page opened from the disk may have no clipboard access, the selection is copied instead.
  async function copy (text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const field = document.createElement('textarea')
      field.value = text
      document.body.append(field)
      field.select()
      document.execCommand('copy')
      field.remove()
    }
  }

  document.getElementById('icons').addEventListener('click', async (event) => {
    const cell = event.target.closest('.cell')
    if (!cell) return

    await copy(cell.dataset.name)
    toast.textContent = cell.dataset.name + ' copied'
    toast.classList.remove('on')
    toast.getBoundingClientRect()
    toast.classList.add('on')
  })

  document.getElementById('boxes').addEventListener('change', (event) => {
    document.body.classList.toggle('boxes', event.target.checked)
  })
</script>

</body>
</html>
`

  await fs.writeFile(path.join(demoDir, 'index.html'), html)
  log.done('demo: index.html')
}
