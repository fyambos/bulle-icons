#!/usr/bin/env node
import { loadIcons } from '../build/icons.mjs'
import { log } from '../build/lib.mjs'

const { icons, problems } = await loadIcons()

for (const problem of problems) log.fail(problem)

if (problems.length) {
  console.log(`\n${problems.length} problem(s)`)
  process.exit(1)
}

log.done(`${icons.length} icons OK`)
