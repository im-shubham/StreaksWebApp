---
name: Obsidian Velocity
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c3c9af'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8d937c'
  outline-variant: '#434935'
  surface-tint: '#a1d820'
  primary: '#ffffff'
  on-primary: '#253600'
  primary-container: '#bcf540'
  on-primary-container: '#4f6e00'
  inverse-primary: '#4a6700'
  secondary: '#c6c5d5'
  on-secondary: '#2f2f3c'
  secondary-container: '#474855'
  on-secondary-container: '#b7b7c7'
  tertiary: '#ffffff'
  on-tertiary: '#00305f'
  tertiary-container: '#d5e3ff'
  on-tertiary-container: '#1165b7'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#bcf540'
  primary-fixed-dim: '#a1d820'
  on-primary-fixed: '#141f00'
  on-primary-fixed-variant: '#374e00'
  secondary-fixed: '#e2e1f2'
  secondary-fixed-dim: '#c6c5d5'
  on-secondary-fixed: '#1a1b26'
  on-secondary-fixed-variant: '#454653'
  tertiary-fixed: '#d5e3ff'
  tertiary-fixed-dim: '#a6c8ff'
  on-tertiary-fixed: '#001c3b'
  on-tertiary-fixed-variant: '#004787'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-hero:
    fontFamily: Inter
    fontSize: 56px
    fontWeight: '800'
    lineHeight: 60px
    letterSpacing: -0.04em
  display-hero-mobile:
    fontFamily: Inter
    fontSize: 42px
    fontWeight: '800'
    lineHeight: 46px
    letterSpacing: -0.035em
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.025em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.005em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  caption-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.08em
  micro-counter:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.25rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system is engineered for obsessive habit tracking, physical momentum, and discipline. Built around athletic restraint and high-contrast focus, it eliminates ambient visual clutter to highlight progress, streaks, and accountability.

### Design Movement & Core Sensibility
- **Tactile Technical Minimalist:** Combines pure obsidian layers, surgical 1px borders, and ultra-high-contrast kinetic accents.
- **Athletic Precision:** Draws visual cues from performance monitors, track timers, and luxury horology dials.
- **Restraint Over Decoration:** Glows, blurs, and neon highlights are reserved exclusively for completion events, continuous chains, and core interaction targets.

### Target Audience & Emotional Impact
- **Audience:** High-performers, athletes, creators, and individuals striving for relentless daily consistency.
- **Emotional Response:** Sharpness, quiet confidence, dopamine upon completion, and high clarity. Every interaction feels deliberate, physical, and earned.

## Colors

The palette relies on absolute darkness interrupted by high-velocity kinetic neon. Color distribution must obey an 85/10/5 discipline: 85% obsidian depth, 10% structural grays and typography, and 5% pure electric accent.

### Base Foundations & Surfaces
- **Canvas / Root Background (`#050505`):** Deep absolute obsidian. Used for screen baselines and safe areas.
- **Primary Surface (`#101014`):** Elevated container layer for actionable habit cards, list modules, and modal sheets.
- **Secondary Surface (`#17171D`):** Recessed tracks, day indicator inactive wells, active pill switches, and nested chips.
- **Subtle Structural Border (`#252530`):** Crisp 1px outline defining edges between cards, separators, and inactive rings.

### Accents & Kinetic State
- **Electric Neon Lime (`#C5FF4A`):** The primary kinetic signal. Reserved for active streaks, complete state rings, dynamic progress arcs, and primary interaction triggers.
- **Text Primary (`#F5F5F7`):** Brilliant off-white for numerical readouts, titles, and active labels.
- **Text Secondary (`#858594`):** Neutral slate for metadata, day-of-week abbreviations, inactive days, and unit indicators.

### Semantic / Status Accents
- **Warning / At Risk (`#FFC857`):** Pending streak expiration within the final 2 hours of the day.
- **Error / Broken Streak (`#FF5C5C`):** Missed habits, resets, or destructive settings.
- **Info / Milestone (`#69A8FF`):** Deep focus trends, metrics, and non-actionable statistical data.

## Typography

Typographic scale is structured around tabular numerals, compressed negative tracking for display impact, and spaced uppercase micro-caps for categorical organization.

### Hierarchical Treatment
- **Display & Large Digits (`display-hero`, `headline-xl`):** Configured with negative tracking (`-0.03em` to `-0.04em`) and tabular figure settings (`font-variant-numeric: tabular-nums`). Large streak milestones (e.g., `48`) feel monolithic and immediate.
- **Section Headers & Titles (`headline-lg`, `headline-md`):** High contrast white `#F5F5F7`, tightly anchored directly above metric blocks.
- **Body & Habit Names (`body-lg`, `body-md`):** Balanced, clean neutral tone with neutral kerning to prioritize immediate scannability.
- **Micro-Caps & Labels (`caption-caps`, `micro-counter`):** Always transformed to uppercase with positive tracking (`0.08em` to `0.1em`) using `#858594`. Applied to weekday initials (M, T, W, T, F, S, S), category pills, and completion percentages.

## Layout & Spacing

The layout is built for single-thumb mobile ergonomics and vertical scan efficiency. It uses a fluid vertical stack anchored to device safe areas.

### Layout Rhythm & Fluid Grid
- **Mobile Grid:** Single-column layout with fluid internal card widths, bounded by a fixed `16px` (`1rem`) lateral canvas margin.
- **Tablet / Large Form Factor:** Dual-column asymmetrical layout (`5-7` column distribution) with a centered maximum container width of `680px` to maintain focused density.
- **Component Stack Spacing:** Vertical gaps between habit cards are locked to `12px` (`0.75rem`) to build cohesive, tactile stacks without excessive dead space.

### Edge Insets & Safe Zones
- **Bottom Navigation Bar Offset:** Maintain `24px` clearance above the physical or software home indicator line. Habit creation and primary triggers sit docked in this thumb-accessible zone.
- **Header Top Clearances:** Maintain `16px` space below the status bar for large date badges and total completion metrics.

## Elevation & Depth

Visual hierarchy uses physical tonal stacking and precise boundary strokes instead of blurred drop shadows. In an obsidian interface, ambient shadows are replaced by luminescence and edge definition.

### Layer Stacking Model
- **Level 0 (Canvas Base - `#050505`):** Screen viewport foundation.
- **Level 1 (Card Plinths - `#101014`):** Habit rows, weekly performance grids, and analytic modules. Every card features a crisp `1px` continuous border of `#252530`.
- **Level 2 (In-Card Wells & Toggles - `#17171D`):** Day circles, inactive ring tracks, search fields, and slider backgrounds.
- **Level 3 (Floating Sheets & Alerts - `#1B1B22`):** Drag-to-dismiss detail views and modal interaction drawers. Bounded by a top-edge highlight (`rgba(197, 255, 74, 0.15)` fading to `#252530`).

### Optical Accents & Neon Bloom
- Standard cards carry zero box-shadow.
- Upon 100% habit completion, the element receives a surgical kinetic rim: `box-shadow: 0 0 20px -4px rgba(197, 255, 74, 0.35)`.
- Never use diffused ambient gray shadows; depth is strictly determined by surface luminance shifts.

## Shapes

The design uses a rounded, tactile geometry that pairs circular metrics with softened rectangular containers.

### Shape Hierarchy
- **Primary Habit Containers:** Radii set between `16px` and `20px` (`rounded-lg`). Creates a smooth, pebble-like card profile.
- **Modals, Sheets & Primary Action Triggers:** Max radius of `24px` (`rounded-xl`).
- **Interactive Day Rings & Progress Wheels:** Full circular geometries (`50%` / `pill-shaped`). Day dots, checkmarks, and hold-to-complete circular indicators maintain geometric circularity.
- **Metadata Badges & Chips:** Compact `8px` (`rounded-sm`) to `12px` radius.

## Components

### Habit Item Card
- **Container:** Background `#101014`, border `1px solid #252530`, border-radius `20px`, padding `16px`.
- **Header Row:** Category micro-badge in `caption-caps` `#858594` on the left; streak counter badge on the right (`#C5FF4A` tabular numerals accompanied by a flame/spark vector).
- **Body Row:** Habit title in `headline-md` `#F5F5F7` alongside a target frequency subtext in `body-md` `#858594`.
- **Bottom Activity Array:** Row of 7 circular day indicators representing the current week.

### Circular Day Indicator Rings
- **Dimensions:** `36px × 36px` circular containers.
- **Empty / Incomplete State:** Background `#17171D`, border `1px solid #252530`, weekday letter in `micro-counter` `#858594`.
- **Completed State:** Background `#C5FF4A`, weekday letter or icon in `#050505` with `fontWeight: 800`.
- **Today (Pending):** Background `#101014`, animated pulsing outer border in `1.5px solid #C5FF4A`, text `#F5F5F7`.

### Hold-to-Complete Circular Gauge
- **Core Mechanic:** Central long-press control used for marking habits complete. Prevents accidental taps.
- **Diameter:** `64px` circular SVG hit area.
- **Track Layer:** Base circle with `stroke: #252530`, stroke-width `4px`.
- **Progress Layer:** Animated SVG stroke with `stroke: #C5FF4A`, stroke-width `4px`, round cap. Expands smoothly from `0%` to `100%` over a `450ms` haptic hold duration.
- **Completion State:** Upon trigger, inner target transforms with a scale punch (`transform: scale(1.08)` to `1.0`), filling the circle with `#C5FF4A` and revealing an obsidian checkmark.

### Primary & Action Buttons
- **Primary CTA:** Background `#C5FF4A`, text `#050505`, font `label-md` (`fontWeight: 700`), radius `16px`, height `54px`. Pressed state scales down to `0.98` opacity `0.9`.
- **Secondary / Ghost Button:** Background `transparent`, border `1px solid #252530`, text `#F5F5F7`, radius `16px`, height `54px`. Active state shifts background to `#17171D`.

### Input Fields & Selectors
- **Input Container:** Background `#101014`, border `1px solid #252530`, radius `14px`, height `50px`, padding `0 16px`.
- **Text Entry:** Color `#F5F5F7`, placeholder color `#858594`.
- **Focus State:** Border shifts cleanly to `#C5FF4A`; no generic browser outline.

### Mobile Bottom Navigation Bar
- **Bar Container:** Fixed to bottom, docked background `rgba(5, 5, 5, 0.85)` with `backdrop-filter: blur(20px)`. Top border `1px solid #252530`.
- **Height & Insets:** `64px` height plus device safe area bottom margin.
- **Nav Items:** Clean icon-only or stacked micro-caption. Active item rendered in `#C5FF4A`; inactive items rendered in `#858594`.
- **Center Quick-Add Trigger:** Raised or highlighted `44px × 44px` pill, background `#C5FF4A`, icon `#050505`.

### Chips & Streak Badges
- **Active Streak Tag:** Background `rgba(197, 255, 74, 0.12)`, border `1px solid rgba(197, 255, 74, 0.3)`, text `#C5FF4A`, padding `4px 10px`, radius `20px`.
- **Neutral Filter Tag:** Background `#17171D`, border `1px solid #252530`, text `#858594`, radius `20px`.