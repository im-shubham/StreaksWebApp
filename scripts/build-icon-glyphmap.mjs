#!/usr/bin/env node
// Builds the Material Symbols glyph map used by src/components/ui/Icon.tsx.
//
// The Stitch screens render icons with the "Material Symbols Outlined" font
// (ligatures). React Native renders by codepoint instead, so we map icon
// names to codepoints from the official codepoints file.
//
// Fonts in assets/fonts are static instances (opsz 24, wght 400, GRAD 0)
// of FILL 0 and FILL 1, downloaded from Google Fonts.
//
// Usage: node scripts/build-icon-glyphmap.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'design/stitch/assets/material-symbols-outlined.codepoints');
const out = join(root, 'src/theme/icon-glyphs.generated.json');

const map = {};
for (const line of readFileSync(src, 'utf8').split('\n')) {
  const [name, hex] = line.trim().split(/\s+/);
  if (name && hex) map[name] = parseInt(hex, 16);
}
writeFileSync(out, JSON.stringify(map));
console.log(`Wrote ${Object.keys(map).length} glyphs to ${out}`);
