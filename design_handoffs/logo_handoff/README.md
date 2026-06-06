# RAGman Logo — Handoff

Final logo: **Variant C · Full Hex** — a custom monogram R inside a hexagonal frame with six vertex nodes (knowledge-graph metaphor) and an amber hub node at the R's bowl junction.

## What's in the box

```
logo_handoff/
├── README.md
├── preview.html               # Open in a browser to see every variant at every size
├── svg/
│   ├── ragman-icon.svg            # Default — cream background, terracotta mark
│   ├── ragman-icon-dark.svg       # Inverse — deep brown background, coral mark
│   ├── ragman-icon-mono.svg       # Single-color, transparent — uses currentColor
│   └── favicon.svg                # Adapts to OS light/dark via prefers-color-scheme
└── react/
    └── RagmanLogo.jsx              # React component, themable via prop
```

## Palette

| Token              | Hex       | Where it's used |
| ------------------ | --------- | --------------- |
| `cream`            | `#FDF6EC` | Background, light variant |
| `night`            | `#2A1A10` | Background, dark variant |
| `terracotta`       | `#C2410C` | Frame, vertex nodes, R — light variant |
| `coral`            | `#FB7156` | Frame, vertex nodes, R — dark variant |
| `amber`            | `#F59E0B` | Hub node accent (constant across themes) |

The hub-node accent stays amber in both themes so the logo always has a small spot of warmth pulling the eye to the R's bowl.

## Geometry

- **Canvas:** `viewBox="0 0 160 160"` — keep this aspect when scaling.
- **Hex frame stroke:** `3` units. **Stroke-linejoin:** `round`.
- **Vertex nodes:** circles of radius `5` at each hex corner — `(80,8) (141,43) (141,117) (80,152) (19,117) (19,43)`.
- **Monogram R:** stroke width `12`, linecap and linejoin `round`. Two subpaths — the stem+bowl is one path, the diagonal leg is the other.
- **Hub node:** radius `7` amber circle at `(113, 67)` — the bowl junction of the R. A 2-unit stroke matching the background separates it from the R.

## Minimum sizes

| Use | Size |
| --- | --- |
| App icon, hero | ≥ 48 px |
| Navbar mark, button | 28–40 px |
| Inline (chat avatar, list row) | 20–28 px |
| Favicon | 16 px (still legible, but the vertex nodes reduce to dots) |

Below 16 px, drop the vertex nodes — the hex + R + hub still reads. The Mono SVG (`svg/ragman-icon-mono.svg`) is the easiest base to strip.

## React usage

```jsx
import RagmanLogo from './RagmanLogo';

// Default
<RagmanLogo size={32} />

// Dark variant
<RagmanLogo size={32} theme="dark" />

// Follows the user's OS preference
<RagmanLogo size={32} theme="auto" />

// Single-color — picks up CSS `color`
<div style={{ color: '#fff' }}>
  <RagmanLogo size={32} variant="mono" />
</div>

// Transparent background (no fill behind the hex)
<RagmanLogo size={32} variant="transparent" />
```

Props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `size` | `number` | `32` | px, square |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'light'` | `auto` uses `@media (prefers-color-scheme: dark)` inside the SVG |
| `variant` | `'full' \| 'mono' \| 'transparent'` | `'full'` | `mono` honors `currentColor` so you can theme via CSS |
| `className`, `...rest` | — | — | Pass through to `<svg>` |

### TypeScript signature

```ts
interface RagmanLogoProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
  theme?: 'light' | 'dark' | 'auto';
  variant?: 'full' | 'mono' | 'transparent';
  title?: string;
}
```

## Direct SVG usage

For Next.js / Vite, drop `svg/ragman-icon.svg` into `public/` or import it directly:

```jsx
// Vite (svg-as-component plugin) or Next.js with @svgr/webpack
import Logo from './svg/ragman-icon.svg?react';
// or as image
<img src="/ragman-icon.svg" width="32" height="32" alt="RAGman" />
```

## Favicon

Use `svg/favicon.svg` directly — it embeds a `<style>` block that flips to the dark palette under `prefers-color-scheme: dark`. Modern browsers (Chrome, Safari, Firefox) honor SVG favicons.

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<!-- Optional fallback for older browsers -->
<link rel="alternate icon" type="image/png" href="/favicon.png" />
```

To generate a PNG/ICO fallback, the simplest path is:
- Open `svg/ragman-icon.svg` in any vector editor (Figma, Illustrator)
- Export at `512×512` PNG
- Convert to multi-size ICO with [realfavicongenerator.net](https://realfavicongenerator.net) or `imagemagick`:
  ```bash
  convert ragman-icon-512.png -define icon:auto-resize=16,32,48,64,128,256 favicon.ico
  ```

## Wordmark

There is no baked-in wordmark SVG — the icon pairs with the product name set in **Inter Bold (700)**, `letter-spacing: -0.02em`, sized so the cap-height matches roughly 70% of the icon's height. In React:

```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
  <RagmanLogo size={32} />
  <span style={{ fontFamily: 'Inter, system-ui', fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em' }}>
    RAGman
  </span>
</div>
```

If you'd rather a single SVG wordmark, convert the text to outlines in your vector editor and inline it — that keeps it self-contained.

## Wiring it into the existing app

The current prototype (`RAGman UI.html`) uses a placeholder gradient tile with the letter "R". To swap it for the real logo:

```jsx
// In app.jsx — replace the .logo div
<a href="#" className="brand" onClick={...}>
  <RagmanLogo size={28} />
  <span>RAGman</span>
</a>
```

…and the `.brand .logo` CSS block in `styles.css` can be deleted.

For the favicon, replace the inline `data:` SVG in `RAGman UI.html`'s `<link rel="icon">` with:

```html
<link rel="icon" type="image/svg+xml" href="favicon.svg" />
```

## Don'ts

- Don't recolor the amber hub node — it's the only constant across themes and is what makes the mark feel warm.
- Don't fill the hex with a gradient — the warmth comes from the palette pairing (cream + terracotta + amber), not a sunset wash.
- Don't rotate the hex to point-up unless you also re-derive the vertex node positions; the current geometry assumes flat-top.
- Don't shrink below 16 px with vertex nodes intact — drop them per the "Minimum sizes" note above.
