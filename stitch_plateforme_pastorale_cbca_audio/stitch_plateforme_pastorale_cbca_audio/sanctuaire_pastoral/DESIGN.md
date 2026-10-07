---
name: Sanctuaire Pastoral
colors:
  surface: '#fbf9f5'
  surface-dim: '#dbdad6'
  surface-bright: '#fbf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3ef'
  surface-container: '#efeeea'
  surface-container-high: '#eae8e4'
  surface-container-highest: '#e4e2de'
  on-surface: '#1b1c1a'
  on-surface-variant: '#43474c'
  inverse-surface: '#30312e'
  inverse-on-surface: '#f2f0ed'
  outline: '#74777d'
  outline-variant: '#c3c7cd'
  surface-tint: '#4c6075'
  primary: '#000f1d'
  on-primary: '#ffffff'
  primary-container: '#0f2537'
  on-primary-container: '#788da3'
  inverse-primary: '#b3c9e0'
  secondary: '#775a19'
  on-secondary: '#ffffff'
  secondary-container: '#fed488'
  on-secondary-container: '#785a1a'
  tertiary: '#000d23'
  on-tertiary: '#ffffff'
  tertiary-container: '#012349'
  on-tertiary-container: '#728bb7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cfe5fd'
  primary-fixed-dim: '#b3c9e0'
  on-primary-fixed: '#061d2f'
  on-primary-fixed-variant: '#34495c'
  secondary-fixed: '#ffdea5'
  secondary-fixed-dim: '#e9c176'
  on-secondary-fixed: '#261900'
  on-secondary-fixed-variant: '#5d4201'
  tertiary-fixed: '#d6e3ff'
  tertiary-fixed-dim: '#adc7f7'
  on-tertiary-fixed: '#001b3c'
  on-tertiary-fixed-variant: '#2d476f'
  background: '#fbf9f5'
  on-background: '#1b1c1a'
  surface-variant: '#e4e2de'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 34px
    fontWeight: '600'
    lineHeight: 42px
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  title-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-tablet: 2rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system expresses compassionate spiritual authority, quiet reverence, and contemplative clarity. Built for the pastoral ministry of the CBCA and its dedicated sermon audio streaming service, the visual atmosphere balances solemnity with warmth. It steers clear of corporate austerity and high-gloss commercial aesthetics, leaning instead into an editorial, sacred sanctuary aesthetic that fosters focus, meditation, and auditory immersion.

The visual execution pairs refined editorial serif typography with an accessible, human-centric sans-serif, grounded in deep atmospheric blues, luminous liturgical gold accents, and serene parchment-toned surfaces. Subtle, silky elevations, hairline ivory borders, and gentle curves create an ambiance of shelter, dignity, and calm.

## Colors

The palette establishes an intentional spiritual hierarchy centered on depth, light, and peaceful contemplation:

- **Primary (`#0F2537`)**: Midnight Blue, conveying rooted pastoral authority, depth, and contemplative presence. Used for primary text, high-emphasis icons, and dominant backgrounds in dark-accented surfaces.
- **Secondary (`#C5A059`)**: Muted Liturgical Gold, evocative of grace, hope, and sacred illumination. Used with disciplined restrain for active audio states, scripture badges, playback indicators, and key touchpoints.
- **Tertiary (`#1A365D`)**: Deep Slate Blue, providing mid-tone depth for active states, nested card containers, and secondary interactive framing.
- **Neutral Light (`#FDFBF7`)**: Warm Alabaster/Parchment, serving as the foundational background to reduce eye strain and provide an organic, hospitable surface. Secondary light surfaces use Ivory (`#F7F5F0`).
- **Supportive Grays**: Warm Slate (`#64748B`) for secondary metadata, verses citations, and duration timestamps; Delicate Slate (`#E2E8F0`) for low-contrast borders; Midnight Slate (`#1E293B`) for the persistent mini-player and footer environments.

## Typography

Typography establishes an intentional cadence between literary solemnity and clean functional utility.

- **Headlines & Titles (`Playfair Display`)**: Conveys dignity, biblical wisdom, and timeless pastoral legacy. Reserved for sermon titles, series banners, section headings, and featured biblical passages.
- **Body & Labels (`Plus Jakarta Sans`)**: Delivers open, comfortable legibility for scripture verses, pastoral summaries, timestamps, track progress, and metadata filtering.
- **Stylistic Conventions**:
  - Scripture references on sermon cards and audio banners must utilize `label-sm` set in small caps or tracking of `+0.06em`.
  - Long-form sermon notes, biblical excerpts, and reflections must maintain relaxed line heights (`1.65` to `1.75`) to encourage unhurried reading and contemplation.

## Layout & Spacing

The layout follows a centered, generous 12-column responsive grid with expansive white-space to reinforce serenity and mental clarity:

- **Desktop (1200px+)**: 12 columns, max content container width of 1280px, 3rem margins, 1.5rem gutters. Sermon grids align in 3-column clusters; sermon detail views allocate 8 columns for scripture/audio notes and 4 columns for related series.
- **Tablet (768px – 1199px)**: 8 columns, 2rem margins, 1.25rem gutters. Sermon grids collapse to 2 columns.
- **Mobile (< 768px)**: 4 columns, 1.25rem margins, 1rem gutters. Cards stack vertically in a unified flow.
- **Persistent Player Offset**: A permanent bottom padding clearance of `5.5rem` (`88px`) on mobile and `6rem` (`96px`) on desktop is strictly enforced across all viewports to ensure content is never obscured by the persistent audio player dock.

## Elevation & Depth

Visual depth mirrors soft morning light filtering through high sanctuary windows: subtle, warm, and atmospheric rather than stark or mechanical.

- **Low-Contrast Outlines**: Surface layers are primarily demarcated by delicate borders (`1px solid #E2E8F0` on light containers, or `1px solid rgba(197, 160, 89, 0.25)` on active or featured items).
- **Silky Ambient Shadows**:
  - *Resting Surface*: `0px 2px 8px -2px rgba(15, 37, 55, 0.04), 0px 1px 3px -1px rgba(15, 37, 55, 0.02)`.
  - *Elevated Card (Hover/Focus)*: `0px 12px 24px -6px rgba(15, 37, 55, 0.07), 0px 4px 8px -2px rgba(15, 37, 55, 0.03)`.
  - *Floating Audio Dock*: `0px -8px 30px -4px rgba(15, 37, 55, 0.12), 0px -2px 6px -1px rgba(15, 37, 55, 0.04)`.
- **Tonal Layers**:
  - Level 0 (Base Canvas): `#FDFBF7`
  - Level 1 (Sermon Cards & Audio Panels): `#FFFFFF` with hairline `#E2E8F0` border
  - Level 2 (Persistent Audio Dock & Dropdown Popovers): `#1E293B` or `#FFFFFF` with soft ambient bloom

## Shapes

The interface adopts soft, comforting rounded geometry (`roundedness: 2`) that conveys grace and approachable dignity:

- Base elements (buttons, text inputs, scripture tags): `0.5rem` (`rounded-md`).
- Standard content cards and waveform player embeds: `1rem` (`rounded-lg`).
- Feature sermon spotlights and modal dialogues: `1.5rem` (`rounded-xl`).
- Floating audio action pills (play/pause circles, biblical topic pills): full pill radius (`9999px`).
- Waveform scrubber bars use rounded caps on both ends of individual vertical bars to maintain visual softness.

## Components

### Buttons
- **Primary (Pastoral Action)**: Background `#0F2537`, text `#FDFBF7`, subtle gold border hover (`#C5A059`), corner radius `rounded-md`. Provides high contrast for actions like "Écouter la prédication" or "Télécharger l'audio".
- **Secondary (Contemplative)**: Transparent background, `1.5px` border in `#C5A059`, text `#0F2537`, hovering into an ivory tint (`#F7F5F0`).
- **Play/Pause Trigger**: Circular pill button, gold background `#C5A059` with midnight blue icon `#0F2537`, offering immediate haptic recognition.

### Sermon Cards
- Background `#FFFFFF` encased in a soft border (`#E2E8F0`).
- Top header showcases a dedicated scripture badge (e.g., `Jean 14:1-6` or `Psaumes 23`), set against a soft gold background (`#FAF5E9`) with `#C5A059` typography.
- Title in `Playfair Display`, subtitle showing pastor/speaker name and congregation (e.g., CBCA Goma-Ville).
- Embedded miniature waveform visualization showing playback duration, download icon, and bookmark button.

### Persistent Audio Player Dock
- Affixed permanently to the bottom of the viewport with a blurred translucent base (`#0F2537` with `95%` opacity, or `#FFFFFF` in pure light mode).
- Features current sermon title, speaker, interactive scrubbable waveform graphic rendered in gold (`#C5A059`), volume slider, playback rate switcher (1x, 1.2x, 1.5x), and continuous audio chapter markers.

### Biblical & Thematic Chips
- Oval pill-shaped tags used for theological themes (e.g., *Grâce*, *Foi*, *Consolation*, *Prière*).
- Default state: `#F7F5F0` background with `#64748B` label.
- Selected state: Deep Blue `#0F2537` background with gold border `#C5A059` and `#FDFBF7` text.

### Audio Waveform Scrubber
- Composed of rhythmic vertical bars representing frequency peaks. Unplayed segments are colored warm slate (`#E2E8F0`), while listened progress activates radiant gold (`#C5A059`). Hovering displays precise minute and second scripture marks.

### Input Fields & Search
- Generously padded with `0.5rem` radius, warm ivory background `#FDFBF7`, framed by `#E2E8F0`. Focus state shifts outline to glowing gold (`#C5A059`) with zero harsh blue halo.