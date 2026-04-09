# Design Brief: Unified RCM Workflow + Healthcare Revenue Cycle Management

## Purpose & Context
Healthcare revenue cycle management (RCM) unified workflow module for hospital administrators and billing staff. Consolidates Find Package, Pre-Auth, Clinical Docs, and Claims into a single guided 4-step experience (Patient Setup → Pre-Auth Review → Clinical Evidence → Claim Submission). Emphasizes real-time validation, status transparency, and free-navigate stepper design that feels like a surgical checklist. Data-dense, professional, trustworthy. Users reduce workflow fatigue by working in one cohesive module instead of jumping between tabs.

## Visual Tone
**Clinical Workflow Theater** — Horizontal stepper is the spine. Each stage is a card revealing its checklist with clear status visibility. Blue-gray-white palette with teal accents for positive actions, amber for progress/warnings, red for missing/critical. High information density, zero decoration, every motion serves clarity. Status badges use icon + text (never color-only). Follows healthcare UI conventions: compact rows, data-first layouts, unambiguous action states.

## Color Palette

| Token | OKLCH | Usage | Role |
|-------|-------|-------|------|
| **hp-blue** | `0.44 0.13 230` | Primary actions, active stepper steps, CTAs | Primary |
| **hp-navy** | `0.28 0.09 232` | Sidebar, header, deep backgrounds | Deep accent |
| **hp-bg** | `0.95 0.012 237` | Page background, card backgrounds | Light neutral |
| **hp-body** | `0.24 0.03 232` | Body text, highest contrast labels | Text |
| **workflow-success** | `0.67 0.15 142` | Completed steps, approved status, checkmarks | Complete/Positive |
| **workflow-progress** | `0.78 0.16 85` | In-progress steps, pending items, warnings | Progress/Caution |
| **workflow-critical** | `0.577 0.245 27.325` | Missing documents, critical alerts, errors | Critical/Red |
| **workflow-settled** | `0.52 0.08 234` | Settled/final states, confirmation badges | Settled |

## Typography
- **Display**: Plus Jakarta Sans (700) — 4-step stepper titles, mode selection headers, KPI values
- **Body**: Plus Jakarta Sans (500, 400) — step descriptions, checklist items, form labels, table text
- **Mono**: Inherited system monospace (future) — claim IDs, package codes, validation messages

## Structural Zones

| Zone | Treatment | Purpose |
|------|-----------|---------|
| **Workflow Header** | hp-navy bar with hp-bg text, left-aligned "RCM Workflow" title + mode selector | Fixed navigation, shows current mode (Quick Surgical/Medical/Advanced) |
| **Mode Selection Landing** | 3 card grid (icon + title + desc + CTA button), centered, 2 cols on tablet, 1 on mobile | Entry point; user picks workflow mode before stepper appears |
| **Stepper Container** | Vertical card stack (mobile) → horizontal on desktop via CSS grid; gap 1.5rem | Main workflow spine; 4 steps always visible, free-jump navigation |
| **Step Card** | Rounded border, hp-border outline, bg-card. Active = blue-50 tint + thicker border. Completed = green-50 tint | Clear state indicators without cognitive load |
| **Checklist Section** | Rows with icon + text + badge, 1rem padding per item, color-coded bg (green/amber/red) | Dense, scannable, status-at-a-glance |
| **Progress Bar** | Thin 1.5px bar, filled height animates 0.6s, color = step state (blue active / green complete) | Real-time visual feedback |
| **Validation Banner** | Left border accent, full-width alert box (amber/red/green), 1rem padding, icon + message | Inline warnings/errors prevent form submission |

## Component Patterns

| Pattern | Specification | States |
|---------|---------------|--------|
| **Mode Card** | Icon + title + description + "Continue" button, border-2, cursor-pointer | Default (border-gray) → Hover (border-primary, shadow) → Selected (blue-50 bg, primary border) |
| **Stepper Step Card** | Number badge (1-4), title, status pill (In Progress/Complete/Pending), content area | Active (blue border, blue-50 bg) / Completed (green border, green-50 bg) / Pending (gray border, opacity-75) |
| **Checklist Item** | Icon (✓/✗/◐) + text (name of doc) + badge (Uploaded/Missing/Optional) + action button | Completed (green-50 bg, text-green-900) / Missing (red-50 bg, text-red-900) / Optional (amber-50 bg, text-amber-900) |
| **Progress Bar** | Thin horizontal bar, filled from left, color-coded by step state | Animated fill on status change (0.6s ease-out) |
| **Action Button** | Rounded corners, 1rem padding, icon + text, semantic color (primary/secondary/destructive) | Hover: opacity reduction, active: subtle scale |

## Spacing & Rhythm
- **Grid gap**: 1.5rem between step cards (vertical), 2rem section margins
- **Card padding**: 1.5rem standard (step cards), 1rem (checklist items), 0.75rem (status badges)
- **Text spacing**: 0.25rem between icon and label, 0.5rem between label and value, 1rem section dividers
- **Density**: Power-user scanning density; minimize whitespace for 50+ claim batches

## Motion & Interaction
- **Mode selection → Stepper**: Fade-in (0.25s) when mode card is clicked
- **Step card expand/collapse**: Slide (0.3s ease) when toggling between steps on mobile
- **Progress bar fill**: Animates 0.6s on status update, color fade simultaneous
- **Checklist item completion**: Instant visual update + pulse-subtle badge highlight (2s loop)
- **Validation banner**: Slide-in-top (0.25s) when errors detected, auto-dismiss after 5s if success
- **No bouncy animations** — only purposeful motion that aids comprehension

## Responsive Design
- **Mobile (320px–640px)**: Steps stack vertically, full-width cards, single-column mode grid, collapse/expand on tap
- **Tablet (641px–1024px)**: Steps in 2-column grid layout, mode cards 2-column, compact header
- **Desktop (1025px+)**: Steps 1–2 inline visible (expand any to full width), mode cards 3-column, horizontal stepper optional

## Signature Detail
**Color-coded checklist status coding** — Users glance at a step card and instantly see which documents are uploaded (green), optional (amber), or missing (red). Icon + text + badge = three layers of redundancy. No cognitive load. Teal "Submit" button stands out against blue-gray palette as the reward action.

## Constraints
- **Contrast**: Minimum 7:1 WCAG AAA for all text-on-color in both light and dark modes
- **No free colors**: All colors via CSS tokens (--workflow-*, --hp-*, status-* tokens)
- **Dark mode**: Colors auto-adapt via CSS, saturations reduced for readability
- **No decoration**: Shadows only on hover/active states; no gradients, no blur effects, no rounded corners >1rem
- **Accessibility**: All status indicators include icon + text. Stepper steps have aria-labels. Form inputs have labels. Validation messages announced via aria-live.

## New Unified Workflow Features

### Mode Selection Landing
- **3 cards**: Quick Surgical, Quick Medical, Advanced Multi-Package
- **Each card**: Icon + title + description + "Continue" button
- **Layout**: Responsive grid, 1 col (mobile) → 2 col (tablet) → 3 col (desktop)

### 4-Step Stepper (Spine)
1. **Step 1 — Patient Setup**: Find package (by disease/code), auto-suggest from package search
2. **Step 2 — Pre-Auth Review**: Pre-auth data (scheme, doctor, TAT), live patient lookup from registered DB
3. **Step 3 — Clinical Evidence**: Multi-doc upload (colored checklist: green=uploaded, red=missing, amber=optional)
4. **Step 4 — Claim Submission**: Pre-filled form with validation banner, "Submit Claim" CTA

### Free-Jump Navigation
- Click any step number to jump; data persists but invalidates dependent steps
- Completing step N pre-fills step N+1 automatically
- Red validation banner prevents claim submission if critical docs missing

### Real-Time Progress
- Progress bar fills as user completes steps
- Step card colors shift (gray → blue → green) on state changes
- Checklist badges update instantly on document upload

## Dark Mode
All components adapt. Primary colors desaturate 15–20% in dark mode. Text remains hp-body (0.24 0.03 232) for consistency. Card backgrounds darken to hp-navy tint. Status badge backgrounds use dark-mode opacity. No inverse mode switching.

## Accessibility
- Step cards: aria-labels for screen readers, keyboard navigation (Tab/Enter)
- Checklist items: aria-checked for checkboxes, aria-label for status
- Validation banner: aria-live="polite" for dynamic error announcements
- Color-only status never used; always icon + text + color triple redundancy
- Form inputs: proper <label> tags, error messages announced before form submission

## QA Signoff Checklist
- [ ] 4-step stepper renders vertically (mobile) and horizontally (desktop)
- [ ] Mode selection landing shows 3 cards with working CTAs
- [ ] Step cards respond to click (jump navigation) and expand/collapse
- [ ] Checklist items update color on document upload (green/red/amber)
- [ ] Progress bar animates on status changes (0.6s fill)
- [ ] Validation banner shows/hides correctly with proper aria-live announcements
- [ ] Dark mode adapts all colors without inverse inversion
- [ ] Form pre-fill works: step 1 patient data → step 2 pre-auth → step 3 doc list → step 4 claim form
- [ ] Contrast ratio meets WCAG AAA (7:1) in both light and dark
- [ ] All hover states and transitions work at 60fps without layout shift

