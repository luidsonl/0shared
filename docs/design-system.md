# Design System — 0shared frontend

## Principles

Token-driven, hybrid design system. Source of truth = CSS custom properties (design
tokens), bound to Tailwind utility classes, with Radix headless primitives for
behavior/accessibility and hand-written branded components (shadcn/ui-style).

Rules:

1. **Tokens first.** No hardcoded colors, fonts, or spacing in components.
2. **Variants, not new components.** Visual differences via `cva` variants.
3. **Own the code.** Components live in `frontend/src/components/` — no black-box UI kit.
4. **Sharp, flat, minimal.** Radius `0`, 1px borders, monospace.

---

## Stack

| Concern | Tool |
|---------|------|
| Styling engine | Tailwind CSS v4 (`@tailwindcss/vite` plugin, CSS-first `@theme`) |
| Design tokens | CSS variables in `frontend/src/styles/tokens.css` |
| Behavior/a11y primitives | Radix UI (`@radix-ui/react-dialog`, `-select`, `-dropdown-menu`) |
| Component variants | `class-variance-authority` |
| Class merging | `clsx` + `tailwind-merge` → `cn()` in `src/lib/utils.ts` |
| Icons | `lucide-react` |
| Toasts | `sonner` (wrapped in `src/components/atoms/Toaster.tsx`) |
| Font | `@fontsource-variable/jetbrains-mono` (self-hosted) |

---

## Design tokens

Defined in `frontend/src/styles/tokens.css` via Tailwind v4 `@theme`. Every value maps
to a Tailwind utility:

```css
--color-background   →  bg-background, text-background, border-background
--color-primary      →  bg-primary, text-primary, ...
--color-accent       →  bg-accent, stroke-accent, ring-accent
--font-mono          →  font-mono
```

Semantic palette (full table in [brand.md](brand.md#color-palette)):
`background`, `surface`, `surface-elevated`, `primary`, `primary-hover`,
`accent`, `accent-2`, `foreground`, `muted`, `border`, `success`, `warning`, `danger`.

Shape tokens force sharp edges (`--radius-*: 0`). Motion uses a fast ease-out curve.

---

## Component library

Atomic design, aligned with the design-system layers:

```
components/
├── brand/        # Logo, Wordmark
├── atoms/        # Button, TextInput, Field, Card, Dialog, Select, Spinner,
│                 # EmptyState, ErrorText, PageTitle, Badge, Avatar, Toaster
├── molecules/    # SearchBar, Pagination, SortSelector, UserMenu, FileRow
├── organisms/    # Header, FileList, LoginForm, SignupForm, UploadButton
└── templates/    # AppLayout
```

### Atoms

| Component | API notes |
|-----------|-----------|
| `Button` | `variant` (`primary`/`secondary`/`ghost`/`danger`/`accent`), `size` (`sm`/`md`/`lg`). Forwarded HTML props. |
| `TextInput` | Styled native input; accepts all input props. |
| `Field` | Label + control + optional hint; `htmlFor` for a11y. |
| `Card` / `CardHeader` / `CardBody` / `CardFooter` | Composable card sections. |
| `Dialog` + `DialogTrigger` + `DialogContent` + `DialogBody` + `DialogFooter` | Radix dialog (title bar, overlay, focus trap). Controlled via `open`/`onOpenChange`. |
| `Select` + `SelectTrigger` + `SelectContent` + `SelectItem` | Radix select. |
| `Spinner` | `label` prop, `className` |
| `Badge` | `variant`: `neutral`/`accent`/`primary`/`success`/`warning`/`danger` |
| `Avatar` | Initials square; `username`, `className` |
| `ErrorText` | Renders `ERROR: {message}` in danger. |
| `EmptyState` | Dashed-border empty panel. |
| `PageTitle` | Uppercase heading with accent tick. |
| `Toaster` | Sonner wrapper (dark, bordered, mono). |

### Usage pattern (Button as the template)

```tsx
const buttonVariants = cva(baseClasses, {
  variants: { variant: {...}, size: {...} },
  defaultVariants: { variant: "primary", size: "md" },
});
export default function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
```

### Adding a component

1. Define its visual anatomy (Header/Body/Footer for composites).
2. Map every color/spacing/radius to a token class.
3. Support variants via `cva`; merge overrides with `cn()`.
4. Export a forward-`ref`-friendly, `className`-accepting component.

---

## Layout & pages

`AppLayout` = header (brand + nav + search + auth) / main / footer + `Toaster`.
Pages: `HomePage` (hero + shared files), `LoginPage`, `SignupPage`, `SearchPage`,
`UserProfilePage`, `NotFoundPage`.

---

## Tooling

- **Build:** `npm run build` (`tsc -b && vite build`)
- **Dev:** `npm run dev`
- **Lint:** `npm run lint`
- ESLint: `react-refresh/only-export-components` is disabled for the Radix
  re-export files (`Dialog.tsx`, `Select.tsx`) by design.

See [frontend.md](frontend.md) for architecture, deployment, and local dev.
See [brand.md](brand.md) for the visual identity.
