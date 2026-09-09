import fs from 'node:fs/promises'
import path from 'node:path'

export const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

// Markup between the opening and closing svg tags, whitespace collapsed.
export function innerSvg (source) {
  const open = source.indexOf('>', source.indexOf('<svg'))
  const close = source.lastIndexOf('</svg>')
  if (open === -1 || close === -1) return ''
  return source.slice(open + 1, close).replace(/\s+/g, ' ').replace(/> </g, '><').trim()
}

export function camel (name) {
  return name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}

export async function ensureDir (dir) {
  await fs.mkdir(dir, { recursive: true })
}

export async function readJson (file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

export async function writeJson (file, data) {
  await ensureDir(path.dirname(file))
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n')
}

export const log = {
  step: (msg) => console.log(`\x1b[36m▸\x1b[0m ${msg}`),
  done: (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m!\x1b[0m ${msg}`),
  fail: (msg) => console.log(`\x1b[31m✗\x1b[0m ${msg}`)
}
