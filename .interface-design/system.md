# EMQPGS Design System

## Direction & Feel
**Enterprise examination management.** Authoritative, precise, calm. Like a cross between Linear's focus and a university registrar's formality. Every pixel serves clarity — this is high-stakes software for people managing exam papers.

## Typography
- **Font:** Inter (body + headings), JetBrains Mono (code/data)
- **Body:** text-sm (14px) with `--text-primary` (#171717)
- **Headings:** font-semibold, tracking-tight, text-2xl/3xl
- **Labels:** text-xs uppercase tracking-wider
- **Hierarchy:** `--text-primary` > `--text-secondary` > `--text-tertiary` > `--text-muted`
- Monospace: `0.875em` relative size

## Depth Strategy
**Borders-only.** No shadows on cards or surfaces. Hierarchy established through background shifts:
- Base: `--background` (#fff)
- Elevated: `--surface-elevated` (#fafafa)
- Hover: `--surface-hover` (#f5f5f5)
- Cards: `--card` (#fff) + `border-[--border]`

## Border System
- Standard: `--border` (#e5e5e5) — default separation
- Soft: `--border-soft` (#f0f0f0) — lighter row separators
- Emphasis: `--border-emphasis` (#d4d4d4)
- Focus ring: 2px `--ring` (#171717) with 2px offset

## Color Palette
| Token | Value | Usage |
|---|---|---|
| `--text-primary` | #171717 | Body text, headings |
| `--text-secondary` | #525252 | Supporting text |
| `--text-tertiary` | #8b8b8b | Labels, metadata |
| `--text-muted` | #a3a3a3 | Placeholders, disabled |
| `--accent` | #171717 | Primary actions, focus |
| `--accent-hover` | #404040 | Button hover |
| `--success` | #16a34a | Success states |
| `--warning` | #d97706 | Warning states |
| `--danger` | #dc2626 | Destructive actions |
| `--info` | #2563eb | Info states |

Each semantic color has a `-bg` and `-border` variant for badge/chip backgrounds.

## Spacing
- **Base unit:** 4px (Tailwind default)
- **Micro:** gap-1.5 (6px) for icon-text pairs
- **Component:** gap-2 (8px) for button content, p-3 (12px) for dense cards
- **Section:** gap-6 (24px) between card groups
- **Page:** px-6 (24px) horizontal, py-8 (32px) vertical

## Border Radius
- Inputs, buttons: rounded-lg (8px)
- Cards: rounded-xl (12px)
- Badges: rounded-full
- Small elements (stat labels): no forced radius

## Components

### Button
- Default: `bg-[--accent]` on `--accent-foreground` with `active:scale-[0.97]`
- Secondary: bordered with `--surface-hover` background
- Outline: transparent with border
- Ghost: transparent with hover background
- Sizes: sm (h-8), default (h-9), lg (h-10), icon (h-9 w-9)

### Card
- `rounded-xl border border-[--border] bg-[--card]` — no shadows
- Header: `px-6 pt-6 pb-4` (asymmetric: more top padding)
- Content: `px-6 pb-6`
- Title: `text-base font-semibold tracking-tight`
- Description: `text-sm text-[--text-tertiary]`

### Form Controls
- Height: h-9 (36px) for inputs, selects, textareas
- Background: `--background` (not white — matches page)
- Border: `--border`, focus turns `--accent` with ring-1
- Placeholder: `--text-muted`
- Label: `text-sm font-medium`

### Table
- Header: uppercase tracking-wider, `--text-tertiary`
- Rows: `border-b border-[--border-soft]`
- Cells: px-4 py-3

### Badge
- Variants: default, success, warning, danger, info
- Semantic colors use `--{variant}` (text), `--{variant}-bg` (bg), `--{variant}-border`
- Rounded-full with pill shape

## Navigation (Sidebar)
- Background: same as page (`--background`), separated by `border-r`
- Active: `--surface-hover` bg + `--text-primary`
- Inactive: `--text-secondary`, hover to `--text-primary` on `--surface-elevated`
- Focus: ring-2 with `--ring`
- User section at bottom: `--surface-elevated` card with initials avatar

## States
Every interactive element has: default, hover, focus-visible (ring), active (scale/color shift), disabled (opacity-50).
Data states: loading (skeleton via animate-pulse), empty (icon + message + optional action), error.

## Dark Mode
Not implemented. When adding: invert surface levels (higher elevation = lighter in dark mode), desaturate semantic colors, use borders instead of shadows.
