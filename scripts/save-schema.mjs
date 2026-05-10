#!/usr/bin/env node
// Persist a generated schema (from `pnpm gen:schema <slug>`) into
// server/data/store-overrides.json so the production crawl picks it up.
//
//   pnpm save:schema <slug>             # save tmp/schemas/<slug>.json into overrides
//   pnpm save:schema <slug1> <slug2>    # save several
//   pnpm save:schema --all              # save every tmp/schemas/*.json (skips _summary)
//
// Skips entries where the generated schema has baseSelector=null (LLM
// declined) since those should not be wired into production.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const overridesPath = resolve(ROOT, 'server/data/store-overrides.json')
const schemasDir = resolve(ROOT, 'tmp/schemas')

const args = process.argv.slice(2).filter(Boolean)
let targetSlugs
if (args.includes('--all')) {
  targetSlugs = readdirSync(schemasDir)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .map(f => f.slice(0, -'.json'.length))
}
else {
  targetSlugs = args
}
if (targetSlugs.length === 0) {
  console.error('Usage: pnpm save:schema <slug> [<slug>...]   |   pnpm save:schema --all')
  process.exit(1)
}

const overrides = JSON.parse(readFileSync(overridesPath, 'utf8'))
let saved = 0
let skipped = 0

for (const slug of targetSlugs) {
  const schemaPath = resolve(schemasDir, `${slug}.json`)
  let schema
  try {
    schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
  }
  catch (err) {
    console.warn(`[skip] ${slug}: cannot read ${schemaPath} (${err.message})`)
    skipped++
    continue
  }
  const base = schema?.value?.baseSelector
  if (!base || base === 'null') {
    console.warn(`[skip] ${slug}: schema baseSelector is null (LLM declined)`)
    skipped++
    continue
  }
  const store = overrides[slug]
  if (!store) {
    console.warn(`[skip] ${slug}: not found in store-overrides.json`)
    skipped++
    continue
  }
  store.crawl = store.crawl || {}
  store.crawl.schema = schema
  console.log(`[save] ${slug}: base=${base} fields=${schema.value.fields.length}`)
  saved++
}

writeFileSync(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`)
console.log(`\nDone. Saved ${saved}, skipped ${skipped}. Wrote ${overridesPath}.`)
