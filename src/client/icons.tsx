/**
 * The panels' glyphs, drawn inline at 14px.
 *
 * openchamber uses its own sprite; the host ships an icon set too, but names
 * and props are not part of any public contract, so the panels carry their own
 * strokes rather than betting on them.
 */
import * as React from 'react'

type IconProps = { className?: string }

const base = (props: IconProps): React.SVGProps<SVGSVGElement> => ({
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
  className: props.className,
})

/** Context fill. */
export function DonutIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="5.4" opacity="0.35" />
      <path d="M8 2.6a5.4 5.4 0 0 1 5.4 5.4" />
    </svg>
  )
}

/** Window capacity. */
export function GaugeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.6 11.4a5.6 5.6 0 1 1 10.8 0" />
      <path d="M8 11.4 10.6 7.4" />
    </svg>
  )
}

/** Token usage. */
export function CoinIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M8 5.2v5.6M6.3 6.6h2.5a1.2 1.2 0 0 1 0 2.4H6.6a1.2 1.2 0 0 0 0 2.4h2.6" />
    </svg>
  )
}

/** Turn stats. */
export function PulseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M1.8 8h2.6l1.4-3.4L7.8 12l1.6-4 1.2 2.6h3.6" />
    </svg>
  )
}

/** Skills in flight. */
export function BoltIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8.8 1.8 4.4 8.6h3l-.8 5.6 4.6-6.8h-3z" />
    </svg>
  )
}

/** MCP servers. */
export function ServerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.4" y="2.8" width="11.2" height="4.4" rx="1" />
      <rect x="2.4" y="8.8" width="11.2" height="4.4" rx="1" />
      <path d="M4.8 5h.01M4.8 11h.01" strokeWidth="1.8" />
    </svg>
  )
}

/** Section collapse affordance; the same swap the transcript's blocks use. */
export function ChevronIcon({ open, className }: IconProps & { open: boolean }) {
  return (
    <svg {...base({ className })}>
      {open ? <path d="M3.6 6.2 8 10.4l4.4-4.2" /> : <path d="M6.2 3.6 10.4 8l-4.2 4.4" />}
    </svg>
  )
}
