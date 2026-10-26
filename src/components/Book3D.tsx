import type { CSSProperties } from 'react'

interface Props {
  from: string
  to: string
  accent: string
  art?: 'sun' | 'hills' | 'rings' | 'bars'
  w?: number
  h?: number
  /** thickness of the book block */
  d?: number
  rx?: number
  ry?: number
  rz?: number
  label?: string
  style?: CSSProperties
}

const face: CSSProperties = { position: 'absolute', backfaceVisibility: 'hidden' }

/** Decorative hardcover book rendered with CSS 3D transforms (cover, spine, page block, top edge, soft shadow). */
export function Book3D({ from, to, accent, art = 'sun', w = 170, h = 245, d = 34, rx = 6, ry = -28, rz = 0, label, style }: Props) {
  const half = d / 2
  const pages = 'repeating-linear-gradient(90deg,#f7f1e3 0 2px,#e2d9c3 2px 3px)'
  return (
    <div aria-hidden="true" style={{ width: w, height: h, perspective: 1400, ...style }}>
      <div style={{ position: 'relative', width: w, height: h, transformStyle: 'preserve-3d', transform: `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)` }}>
        {/* back cover */}
        <div style={{ ...face, inset: 0, transform: `translateZ(${-half}px) rotateY(180deg)`, background: to, borderRadius: '4px 8px 8px 4px' }} />
        {/* spine */}
        <div style={{ ...face, top: 0, left: 0, width: d, height: h, transform: `translateX(${-half}px) rotateY(-90deg)`, background: `linear-gradient(90deg, rgba(0,0,0,.28), ${from} 35%, ${from} 65%, rgba(0,0,0,.2))`, borderRadius: 3 }} />
        {/* page block (fore-edge) */}
        <div style={{ ...face, top: 4, left: w - half, width: d - 2, height: h - 8, transform: 'rotateY(90deg)', background: pages, boxShadow: 'inset 0 0 8px rgba(0,0,0,.18)' }} />
        {/* top edge */}
        <div style={{ ...face, top: 0, left: 3, width: w - 6, height: d - 2, transform: `translateY(${-half}px) rotateX(90deg)`, background: 'repeating-linear-gradient(0deg,#f7f1e3 0 2px,#ddd3bc 2px 3px)' }} />
        {/* front cover */}
        <div style={{
          ...face, inset: 0, transform: `translateZ(${half}px)`, borderRadius: '3px 8px 8px 3px', overflow: 'hidden',
          background: `linear-gradient(135deg, ${from}, ${to})`,
          boxShadow: 'inset 5px 0 8px -4px rgba(0,0,0,.35), inset -1px 0 0 rgba(255,255,255,.18), 0 18px 30px -12px rgba(20,16,60,.45)',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 38%, rgba(0,0,0,.12) 100%)' }} />
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 9, background: 'linear-gradient(90deg, rgba(0,0,0,.28), rgba(255,255,255,.1) 55%, rgba(0,0,0,0))' }} />
          {art === 'sun' && <><div style={{ position: 'absolute', left: '50%', top: '22%', width: w * 0.42, height: w * 0.42, marginLeft: -w * 0.21, borderRadius: '50%', background: accent, opacity: 0.95 }} /><div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%', background: 'rgba(0,0,0,.18)', borderRadius: '60% 60% 0 0 / 40% 40% 0 0' }} /></>}
          {art === 'hills' && <><div style={{ position: 'absolute', left: '-10%', right: '-10%', bottom: '-8%', height: '55%', background: accent, borderRadius: '50% 50% 0 0', opacity: 0.9 }} /><div style={{ position: 'absolute', left: '30%', right: '-30%', bottom: '-12%', height: '42%', background: 'rgba(0,0,0,.2)', borderRadius: '50% 50% 0 0' }} /></>}
          {art === 'rings' && [0.8, 0.55, 0.3].map((k) => <div key={k} style={{ position: 'absolute', left: '50%', top: '40%', width: w * k, height: w * k, marginLeft: -(w * k) / 2, marginTop: -(w * k) / 2, borderRadius: '50%', border: `3px solid ${accent}`, opacity: 0.85 }} />)}
          {art === 'bars' && [0, 1, 2, 3, 4].map((i) => <div key={i} style={{ position: 'absolute', left: 18, right: 18, top: `${24 + i * 9}%`, height: 5, borderRadius: 3, background: accent, opacity: 0.9 - i * 0.12, width: `${70 - i * 8}%` }} />)}
          {label && <div style={{ position: 'absolute', left: 16, right: 12, bottom: 14, color: '#fff', fontWeight: 800, fontSize: 13, lineHeight: 1.15, textShadow: '0 1px 2px rgba(0,0,0,.35)' }}>{label}</div>}
        </div>
      </div>
    </div>
  )
}

/** Soft floor shadow to ground a book. */
export function FloorShadow({ width = 200 }: { width?: number }) {
  return <div aria-hidden="true" style={{ width, height: 22, margin: '-6px auto 0', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(20,16,60,.35), rgba(20,16,60,0))', filter: 'blur(2px)' }} />
}
