# Brand — 0shared

## Overview

**0shared** is a serverless file-sharing platform. The identity is dark, technical,
and minimal: monospace type, sharp edges, flat surfaces, and a restrained two-tone
palette (signal red + brass gold) on a near-black base.

> Tagline: **Share files. Zero hassle.**

---

## Logo

The mark is a geometric **zero-lens with a slashed-zero diagonal and a
magnifying-glass handle** — a zero that searches.

- The lens and handle render in `currentColor` (usually foreground).
- The diagonal slash renders in the **accent** (`#D4AF37`).
- The wordmark sets the `0` in accent: `0shared`.

Source: `frontend/src/components/brand/Logo.tsx` (`Logo` + `Wordmark`).
Favicon: `frontend/public/favicon.svg`.

![logo](../frontend/public/favicon.svg)

Usage:
- Always pair the mark with the wordmark in the header.
- Do not recolor the mark ad hoc; use `currentColor` + accent.
- Keep at least 8px padding around the mark on dark surfaces.

---

## Color palette

All colors are exposed as design tokens (see [design-system.md](design-system.md)).

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-background` | `#0D0D0F` | App background |
| `--color-surface` | `#16181D` | Cards, inputs, panels |
| `--color-surface-elevated` | `#1F2127` | Hover, raised surfaces, avatars |
| `--color-primary` | `#C43A32` | Primary actions, alerts |
| `--color-primary-hover` | `#A82F2A` | Primary hover |
| `--color-accent` | `#D4AF37` | Highlights, links, focus, logo arrow |
| `--color-accent-2` | `#9E6A2E` | Accent hover (darker brass) |
| `--color-foreground` | `#F2EAD3` | Body text, headings |
| `--color-muted` | `#A0A4AE` | Secondary text, placeholders |
| `--color-border` | `#3A3F47` | Borders, dividers, table rules |
| `--color-success` | `#4F7F4C` | Success states |
| `--color-warning` | `#D99B2B` | Warnings |
| `--color-danger` | `#B33939` | Errors, destructive actions |

Rules:
- Red = action/alert. Gold = highlight/link/focus. Never invert these roles.
- Never hardcode hex values in components — always use the tokens.

---

## Typography

- **Family:** JetBrains Mono Variable (self-hosted via `@fontsource-variable/jetbrains-mono`).
- Everything is monospace. There is no secondary/humanist font.
- **Labels & buttons:** uppercase, `tracking-widest`, small size.
- **Headings:** bold, tight tracking (`tracking-tight`), uppercase where possible.

---

## Shape & motion

- **Sharp edges:** no border radius anywhere (all radius tokens are `0`).
- **Flat surfaces:** 1px `--color-border` lines; minimal, hard shadows only on
  overlays/dropdowns for depth.
- **Motion:** fast, restrained transitions (`transition-colors`); no bounce/spring.

---

## Voice

- Terse, terminal-flavored, lowercase microcopy where technical, uppercase labels.
- Errors are prefixed `ERROR:`.
- Avoid emoji, decorative language, and exclamation-heavy copy.

---

## Do / Don't

| Do | Don't |
|----|-------|
| Use gold for interactive highlights & focus | Use gold for bulk backgrounds |
| Use red sparingly for primary actions | Overuse red — it reads as "error" |
| Use tokens everywhere | Hardcode hex/typography values |
| Keep spacing multiples of 4px | Mix border radius "just for this one" |
