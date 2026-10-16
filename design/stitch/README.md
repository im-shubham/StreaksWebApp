# Stitch design archive

This is a frozen export of the Google Stitch project **"Streaks Habit Tracker Design System"** (project `13101509909071158775`), taken 2026-10-16. **These designs are the source of truth for the app's UI.** Don't edit these files by hand; re-export them instead.

| Path | Contents |
|---|---|
| `screens/<slug>/index.html` | Exported HTML/Tailwind for each of the 45 screens |
| `screens/<slug>/screenshot.png` | Full-resolution render (780px wide, which is 2× of the 390pt canvas) |
| `manifest.json` | Screen id, title, slug, size and canvas position for every screen |
| `project.json` | Project theme (named colors, fonts, roundness, spacing) |
| `DESIGN.md` | "Obsidian Velocity" design-system spec |
| `assets/images/` | Images referenced by screens, with `images.json` mapping URL → file → screens |
| `assets/material-symbols-outlined.codepoints` | Icon name → codepoint map for the bundled Material Symbols font |

The canvas also holds one design-system card, so it shows 46 items plus the design system (the "~47"). Eight screens were still labelled "Generating Screen..." on the canvas, but they all exported complete.

## How the app uses this

- `scripts/sync-stitch-tokens.mjs` reads the Tailwind config embedded in every screen and generates `src/theme/tokens.generated.ts`. Colors, radius, spacing and the type scale come from there; don't hand-copy them.
- `scripts/build-icon-glyphmap.mjs` builds the icon glyph map from the codepoints file. All 193 icons used by the screens resolve in the bundled fonts.
- `src/design/stitchScreens.ts` maps each screen slug to its build stage and route.

## Known discrepancies (decisions recorded in code)

1. **Two palettes.** 41 screens use the M3 palette (`surface #131313`, lime `#bcf540`). Four auth screens (`auth-error-recovery`, `forgot-password`, `password-reset-email-sent`, `session-expired-account-confirmation`) use the DESIGN.md prose palette (`#050505`, `#c5ff4a`). The app uses the 41-screen palette everywhere; the generator records the variant in `stitchVariants`.
2. **DESIGN.md prose vs rendered tokens.** The prose describes radius 16/24px and `#101014` surfaces. The screens render with the Tailwind config (radius 4/8/12px, `#1c1b1b` surfaces). The rendered screens win.
3. **Hold duration.** The DESIGN.md gauge is 450ms; the Main Dashboard hero runs 1500ms. `HoldToComplete` takes `duration` as a prop, and each screen uses the value from its own design.
4. **Plan limits and prices differ between screens.** See `src/domain/plans.ts`.

## Missing asset

The **STREAKS flame logo** (header `img`, 11 screens) is a private Stitch upload, and its URL returns 403 through the API. The app currently uses the flame vector from the Main Dashboard markup (`src/components/streaks/FlameMark.tsx`). To restore it, download the logo from the Stitch editor (signed in) into `assets/brand/` and swap it in. The app icon and splash also still use the Expo template images.

## Re-export

```bash
STITCH_API_KEY=... python3 scripts/stitch_export.py design/stitch
python3 scripts/stitch_assets.py design/stitch
node scripts/sync-stitch-tokens.mjs
```

Review the token diff before committing; a token change restyles every screen.
