import type { ReactElement } from 'react'
import type { BiomeType } from '@/types/level'
import { biomeTheme, type BiomeUITheme } from '@/ui/theme'

function ring(cx: number, cy: number, r: number, count: number): [number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  })
}
const WHEEL = ring(136, 46, 30, 10)

const EMBERS: [number, number, number][] = [
  [62, 30, 1.4], [84, 18, 1], [118, 24, 1.6], [140, 12, 1], [160, 34, 1.2], [36, 46, 1], [176, 20, 1.3],
]
const STARS: [number, number][] = [
  [14, 10], [38, 22], [70, 8], [104, 16], [128, 6], [150, 24], [186, 12], [174, 34],
]

type Scene = (t: BiomeUITheme) => ReactElement

const SCENES: Record<BiomeType, Scene> = {
  themePark: (t) => (
    <>
      <circle cx="34" cy="24" r="9" fill="#fff6c8" />
      <ellipse cx="70" cy="22" rx="16" ry="5" fill="#fff" opacity="0.75" />
      <ellipse cx="84" cy="18" rx="10" ry="5" fill="#fff" opacity="0.75" />
      <path d="M118 90 L136 46 L154 90" stroke="#5a2147" strokeWidth="3" fill="none" />
      <circle cx="136" cy="46" r="30" stroke={t.accent} strokeWidth="3" fill="none" />
      <circle cx="136" cy="46" r="20" stroke={t.accent} strokeWidth="1.5" fill="none" opacity="0.7" />
      {WHEEL.map(([x, y], i) => (
        <line key={i} x1="136" y1="46" x2={x} y2={y} stroke={t.accent} strokeWidth="1.2" opacity="0.8" />
      ))}
      {WHEEL.map(([x, y], i) => (
        <rect key={i} x={x - 3} y={y} width="6" height="5" rx="1.5" fill={i % 2 ? t.accent2 : '#fff'} />
      ))}
      <circle cx="136" cy="46" r="3.5" fill={t.accent2} />
      <path d="M0 84 Q36 70 76 80 T150 82 T200 76 V100 H0Z" fill="#43b04f" />
      <path d="M0 92 Q60 82 120 92 T200 90 V100 H0Z" fill="#2e8a3c" />
      <path d="M30 86 L42 70 L54 86Z" fill={t.accent} />
      <rect x="31" y="86" width="22" height="6" fill="#fff" />
    </>
  ),
  desert: (t) => (
    <>
      <circle cx="150" cy="44" r="16" fill="#fff0c2" opacity="0.95" />
      <path d="M150 84 L156 62 L176 60 L180 84Z M176 84 L184 54 L200 54 V84Z" fill={t.accent2} opacity="0.85" />
      <path d="M30 84 L72 36 L114 84Z" fill="#b6702d" />
      <path d="M72 36 L114 84 L82 84Z" fill="#83491c" />
      <path d="M104 84 L128 56 L152 84Z" fill="#a8652a" />
      <path d="M128 56 L152 84 L134 84Z" fill="#7a4419" />
      <path d="M0 86 Q50 74 100 86 T200 82 V100 H0Z" fill="#eaa547" />
      <path d="M0 94 Q70 86 140 94 T200 92 V100 H0Z" fill="#d48a33" />
    </>
  ),
  ocean: (t) => (
    <>
      <path d="M48 0 L70 0 L110 76 L30 76Z" fill="#fff" opacity="0.12" />
      <circle cx="58" cy="34" r="11" fill="#fffbe2" />
      <path d="M116 78 L121 44 Q130 34 139 44 L144 78Z" fill="#0c3a50" />
      <path d="M150 80 L153 58 Q159 51 165 58 L168 80Z" fill="#0c3a50" />
      <path d="M121 44 Q130 34 139 44 L136 50 Q130 44 124 50Z" fill="#2c7a4a" />
      <rect x="0" y="74" width="200" height="26" fill="#0d6aa3" />
      <path d="M0 80 Q10 77 20 80 T40 80 T60 80 T80 80 T100 80 T120 80 T140 80 T160 80 T180 80 T200 80" stroke={t.accent} strokeWidth="1.5" fill="none" opacity="0.8" />
      <path d="M0 90 Q12 87 24 90 T48 90 T72 90 T96 90 T120 90 T144 90 T168 90 T192 90" stroke={t.accent} strokeWidth="1.2" fill="none" opacity="0.5" />
      <path d="M70 70 Q78 60 88 66 L84 70Z" fill="#0c3a50" />
    </>
  ),
  arctic: (t) => (
    <>
      {STARS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="0.9" fill="#fff" opacity="0.85" />
      ))}
      <path d="M-10 40 Q40 10 90 32 T210 22" stroke={t.accent} strokeWidth="9" fill="none" opacity="0.45" />
      <path d="M-10 48 Q50 22 100 40 T210 32" stroke={t.accent2} strokeWidth="6" fill="none" opacity="0.4" />
      <path d="M0 90 L18 62 L30 70 L50 40 L68 64 L82 54 L104 90Z" fill="#e9f5ff" />
      <path d="M50 40 L68 64 L82 54 L104 90 L60 90 L56 60Z" fill="#9fb4ea" />
      <path d="M120 90 L134 66 L150 74 L166 50 L184 72 L200 66 V90Z" fill="#d4e8ff" />
      <path d="M166 50 L184 72 L200 66 V90 L172 90Z" fill="#8ea3dd" />
      <rect x="0" y="88" width="200" height="12" fill="#f4f9ff" />
    </>
  ),
  volcanic: (t) => (
    <>
      <circle cx="96" cy="22" r="14" fill="#3a2a28" opacity="0.85" />
      <circle cx="112" cy="14" r="11" fill="#2c201f" opacity="0.85" />
      <circle cx="84" cy="10" r="9" fill="#2c201f" opacity="0.7" />
      <ellipse cx="100" cy="44" rx="16" ry="6" fill={t.accent} opacity="0.55" />
      <path d="M46 92 L88 44 L112 44 L154 92Z" fill="#1a0e0d" />
      <ellipse cx="100" cy="44" rx="12" ry="3" fill={t.accent2} />
      <path d="M96 46 Q92 58 98 66 T90 92" stroke={t.accent} strokeWidth="3" fill="none" />
      <path d="M106 46 Q112 60 118 70" stroke={t.accent} strokeWidth="2" fill="none" opacity="0.8" />
      {EMBERS.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={t.accent2} />
      ))}
      <path d="M0 90 Q50 84 100 92 T200 88 V100 H0Z" fill="#0b0606" />
      <path d="M0 96 Q40 92 80 96 T160 95 T200 94" stroke={t.accent} strokeWidth="2" fill="none" opacity="0.9" />
    </>
  ),
}

/** Tiny inline-SVG "postcard" of a biome's hero landmark on its sky gradient. */
export default function LevelPostcard({ biome }: { biome: BiomeType }) {
  const theme = biomeTheme(biome)
  return (
    <div className="level-postcard" style={{ background: theme.bg }} aria-hidden="true">
      <svg viewBox="0 0 200 100" preserveAspectRatio="xMidYMax slice">
        {SCENES[biome](theme)}
      </svg>
    </div>
  )
}
