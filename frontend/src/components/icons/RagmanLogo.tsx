// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import type { SVGAttributes } from 'react'

interface RagmanLogoProps extends SVGAttributes<SVGSVGElement> {
  size?: number
  theme?: 'light' | 'dark' | 'auto'
  variant?: 'full' | 'mono' | 'transparent'
  title?: string
}

const COLORS = {
  light: { bg: '#FDF6EC', mark: '#C2410C', accent: '#F59E0B', sep: '#FDF6EC' },
  dark:  { bg: '#2A1A10', mark: '#FB7156', accent: '#F59E0B', sep: '#2A1A10' },
}

const VERTICES: [number, number][] = [[80,8],[141,43],[141,117],[80,152],[19,117],[19,43]]

export default function RagmanLogo({
  size = 32,
  theme = 'light',
  variant = 'full',
  title = 'RAGman',
  className,
  ...rest
}: RagmanLogoProps) {
  const isAuto = theme === 'auto'
  const c = COLORS[theme === 'dark' ? 'dark' : 'light']

  const transparent = variant === 'transparent'
  const mono = variant === 'mono'

  const stroke = mono ? 'currentColor' : c.mark
  const fill   = mono ? 'currentColor' : c.mark
  const bg     = transparent || mono ? 'none' : c.bg
  const accent = mono ? 'currentColor' : c.accent
  const sep    = transparent || mono ? 'none' : c.sep

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
      {...rest}
    >
      <title>{title}</title>

      {isAuto && !mono && (
        <style>{`
          .ragman-bg     { fill: ${COLORS.light.bg}; }
          .ragman-stroke { stroke: ${COLORS.light.mark}; }
          .ragman-fill   { fill: ${COLORS.light.mark}; }
          .ragman-sep    { stroke: ${COLORS.light.sep}; }
          @media (prefers-color-scheme: dark) {
            .ragman-bg     { fill: ${COLORS.dark.bg}; }
            .ragman-stroke { stroke: ${COLORS.dark.mark}; }
            .ragman-fill   { fill: ${COLORS.dark.mark}; }
            .ragman-sep    { stroke: ${COLORS.dark.sep}; }
          }
        `}</style>
      )}

      {/* Hex frame */}
      <path
        d="M80 8 L141 43 L141 117 L80 152 L19 117 L19 43 Z"
        className={isAuto ? 'ragman-bg ragman-stroke' : undefined}
        fill={isAuto ? undefined : bg}
        stroke={isAuto ? undefined : stroke}
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Vertex nodes */}
      {VERTICES.map(([cx, cy], i) => (
        <circle
          key={i} cx={cx} cy={cy} r="5"
          className={isAuto ? 'ragman-fill' : undefined}
          fill={isAuto ? undefined : fill}
        />
      ))}

      {/* Monogram R */}
      <path
        d="M58 50 L58 116 M58 50 L92 50 C106 50 113 57 113 67 C113 77 106 84 92 84 L58 84 M88 84 L113 116"
        className={isAuto ? 'ragman-stroke' : undefined}
        stroke={isAuto ? undefined : stroke}
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Amber hub node */}
      <circle
        cx="113" cy="67" r="7"
        fill={accent}
        className={isAuto ? 'ragman-sep' : undefined}
        stroke={isAuto ? undefined : sep}
        strokeWidth="2"
      />
    </svg>
  )
}
