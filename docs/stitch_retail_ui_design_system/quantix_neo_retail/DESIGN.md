---
name: Quantix Neo-Retail
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#732ee4'
  on-tertiary: '#ffffff'
  tertiary-container: '#b48fff'
  on-tertiary-container: '#4900a4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#eaddff'
  tertiary-fixed-dim: '#d2bbff'
  on-tertiary-fixed: '#25005a'
  on-tertiary-fixed-variant: '#5a00c6'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  title-lg:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-numeric-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  label-numeric-md:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.08em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  touch-min: 3rem
  touch-standard: 3.5rem
  touch-large: 4.5rem
  gutter-split: 1.5rem
  pad-terminal: 1.5rem
  pad-card-sm: 1rem
  pad-card-lg: 1.75rem
  gap-compact: 0.5rem
  gap-standard: 1rem
  gap-spacious: 1.5rem
---

## Brand & Style

The design system embodies an elevated modern neo-retail aesthetic engineered for fast-paced transaction environments, terminal registers, and store operations. It bridges industrial functional precision with the welcoming softness of contemporary enterprise software.

### Emotional Response & Personality
- **Surgical Precision:** Operators feel confident in transactional accuracy, inventory tracking, and split-second register actions. Tabular values and structured layouts eliminate ambiguity under checkout stress.
- **Approachable Velocity:** The touch-first, generous physical targets reduce fatigue during high-volume shifts while projecting a polished, high-tier brand experience to customers viewing client-facing displays.
- **Command & Clarity:** High-contrast contextual signaling instantly communicates critical terminal states (online vs. offline sync, cash drawer balancing, supervisor overrides).

### Design Style: Neo-Retail Industrial Minimalism
Drawing from DIN-inspired technical architecture and contemporary soft tactile surfaces, this style pairs:
1. **Generous curvature:** Pill profiles and expansive rounded cards (`rounded-2xl` to `rounded-3xl`) to soften dense point-of-sale displays.
2. **Subtle micro-borders:** `1px` crisp structural dividers that define active interactive zones without visual clutter.
3. **Ergonomic affordances:** Broad touch surfaces, dedicated scanning feedback indicators, and high-legibility tabular telemetry.

## Colors

The color palette utilizes a clean, low-fatigue canvas layered with high-contrast functional accents designed for quick glance-and-scan terminal identification.

### Palette Architecture
- **Primary (`#10B981` / Emerald Green):** Represents positive states, tender completion, cash intake, network connectivity, and transaction finalization.
- **Secondary (`#2563EB` / Electric Tech Blue):** Drives direct operator workflows, cart additions, primary order action buttons, and scan confirmations.
- **Tertiary (`#7C3AED` / Royal Purple):** Reserved exclusively for administrative, supervisor, and store manager privileges (e.g., price overrides, manual refunds, safe drops, and drawer reconciliation).
- **Warning (`#F59E0B` / Vivid Amber):** Critical retail state warnings, including offline mode, drawer discrepancies, low stock thresholds, and peripheral disconnects.
- **Neutral (`#0F172A` / Deep Slate):** Primary ink for high-contrast typography, monetary totals, and prominent container outlines.
- **Canvas (`#F8FAFC` / Slate-50):** The primary off-white backdrop preventing screen glare under retail luminescent lighting, complemented by pure white (`#FFFFFF`) interaction cards and tonal containers.

### Dark Mode Semantic Mapping
In dark mode, surfaces shift from `#0F172A` down to `#020617`, with subtle border definitions transitioning to `rgba(51, 65, 85, 0.7)` (`slate-700/70`) to maintain micro-border definition without luminous bloom.

## Typography

The typographical engine combines the technical, geometric strength of **Space Grotesk** for monetary values, barcodes, and headlines with the clinical clarity of **Geist** for dense order lines and customer records.

### Numeric & Currency Rules
- Monetary figures, SKU codes, quantities, and weights must always enforce `font-feature-settings: "tnum"` (tabular numerals) to ensure horizontal decimal stability during real-time cart recalculations.
- Primary register transaction totals utilize `label-numeric-lg` to ensure effortless readability at a distance of 1.5 meters.
- Micro-labels, SKU headers, and status flags apply `label-caps` in uppercase format with wide tracking (`+0.08em`) to guarantee quick peripheral recognition.

## Layout & Spacing

The terminal layout relies on a rigid ergonomic split-screen grid engineered specifically for landscape touch displays (tablets, touch kiosks, and standard 1080p all-in-one POS terminals).

### Layout Grid Models
- **Split-Screen Register (Tablet & Desktop):** 
  - **Left Rail (Catalog & Quick-Keys):** Dynamic fluid grid spanning 55% to 65% of screen width.
  - **Right Rail (Tape & Cart):** Fixed-width container at `400px` to `480px` locking subtotal, itemized list, tax breakdown, and checkout action buttons into an immovable anchor zone.
- **Mobile Handheld (Inventory / Line-Busting):** Single-column stacked fluid layout with sticky bottom checkout trays and floating barcode triggers.

### Spacing & Ergonomic Guardrails
- **Minimum Hit Surface (`touch-min`):** No register touch component may measure under `48px` (`3rem`). Standard touch keys adhere to `56px` (`3.5rem`) to eliminate missed taps during fast entry.
- **Terminal Outer Padding (`pad-terminal`):** A persistent `24px` (`1.5rem`) buffer protects operational controls from physical edge-bezel occlusions on ruggedized POS mounts.

## Elevation & Depth

Visual hierarchy uses plush tonal depth paired with razor-sharp micro-borders, eliminating harsh drop shadows that produce visual fatigue under harsh retail lighting.

### Depth Hierarchy

1. **Level 0 (Base Canvas):** Background foundation set to `#F8FAFC`. Zero elevation, zero shadows.
2. **Level 1 (Docked Containers & Surfaces):** Primary catalog tiles, customer data cards, and itemized receipt items sit on `#FFFFFF`. Structured by a `1px` micro-border (`#E2E8F0` / `80% opacity`) paired with an ambient diffuse shadow: `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`.
3. **Level 2 (Active Keys & Modals):** Selected register items, active category pills, and numeric keypad buttons gain elevated physical separation: `box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -2px rgba(15, 23, 42, 0.03)`.
4. **Level 3 (Overlay Trays & Supervisor Overrides):** Dialog sheets, sliding receipt previews, and PIN authorization prompts float with broad ambient dampening: `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)`.

## Shapes

The design system incorporates generous curvature (Level 3: Pill-Shaped / Expressive Curvature) to create tactile, high-affordance surfaces that soften the industrial hardware experience.

### Radius Distribution
- **Cards & Surfaces (`rounded-2xl` / `1rem` - `1.5rem`):** Standard inventory tiles, order cart item lists, and metric summary boxes.
- **Primary Display Blocks (`rounded-3xl` / `2rem` - `3rem`):** Transaction payment summary container, supervisor override modals, and receipt drawer trays.
- **Buttons & Micro-Targets (`rounded-full`):** Category filter chips, quick quantity adjusters (`+` / `-`), status badges, and transaction finalization buttons.

## Components

### 1. Buttons
- **Tender Action Button (Primary):** Solid `#10B981` background, white bold Space Grotesk text, minimum height of `56px`, pill-shaped (`rounded-full`), active state compresses slightly (`scale: 0.98`) to deliver physical feedback.
- **Workflow Action Button (Secondary):** Electric Tech Blue (`#2563EB`) fill with white text for item additions, scanning overrides, and cart park operations.
- **Supervisor Action Button (Tertiary):** Royal Purple (`#7C3AED`) background with a soft purple glow outline on focus, reserved for price modifications, voids, and cash drawer management.
- **Secondary / Keypad Buttons:** Light slate-100 fill, slate-900 typography, `rounded-2xl`, with a defined 1px `#E2E8F0` border.

### 2. Category & Filter Chips
- Fully rounded pills (`rounded-full`) with `12px` vertical and `18px` horizontal padding. Inactive state: white surface with `1px` slate-200 micro-border. Active state: solid slate-900 background with crisp white typography.

### 3. Cart & Order Lists
- Itemized lists feature individual row heights of at least `64px`.
- Left: Monospaced quantity badge (`Space Grotesk`) within a soft slate-100 pill.
- Center: Product name in `Geist` Title-MD with SKU in `body-sm` slate-500 below.
- Right: Tabular pricing in `Space Grotesk` with high contrast. Swiping left triggers a soft red contextual void/delete reveal.

### 4. Input Fields & Numeric Keypads
- **Barcode & Search Inputs:** High-visibility search bars with left-aligned Material Symbols Outlined search icons, inset pill design (`rounded-full`), `#FFFFFF` background, and a dedicated tactile "Clear / Scan" button inside the field trailing edge.
- **Numeric Keypad Matrix:** Large-format 3x4 grid. Buttons are minimum `64px` in height with `rounded-2xl` curvature, featuring high-contrast DIN-style numbers (`label-numeric-lg`) centered with subtle press-down states.

### 5. Cards (Product & Inventory Tiles)
- Generous `rounded-2xl` corners, pure white background, framed by a soft `border-slate-200/80`.
- Includes a prominent top image/color block, item title in `Geist`, and an anchored bottom tag displaying stock count and tabular pricing.
- Low inventory states introduce an inline warning chip (`#F59E0B`) at the top right corner.

### 6. Retail-Specific Components
- **Connectivity & Drawer Bar:** Persistent top-of-screen status bar displaying active terminal ID, synced register state (green pulse for online, amber for offline spooling), and cash float balance.
- **Barcode Read Confirmation:** Transient full-perimeter card flash using `#2563EB` (for standard item additions) or `#10B981` (for successful tender receipt scan) providing non-auditory visual feedback.