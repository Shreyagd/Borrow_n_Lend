import { useState } from 'react'

// [background gradient start, end, text colour, accent band]
const PALETTE: [string, string, string, string][] = [
  ['#244d3b', '#66806a', '#edf3e8', '#c5ebd6'],
  ['#a04028', '#c46b4a', '#fff4ef', '#f1c8b9'],
  ['#284d59', '#4c7a82', '#e4f1f0', '#efbf73'],
  ['#6a4a3d', '#9a735c', '#f8eee5', '#eab7a6'],
  ['#8a6a14', '#b89537', '#fff8dc', '#244d3b'],
  ['#3d5a3a', '#72875b', '#eef6e8', '#eab7a6'],
  ['#8c4850', '#b76869', '#fdeeee', '#f3d98b'],
]

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

interface Props {
  title: string
  author?: string
  src?: string
  className?: string
  eager?: boolean
  /** `sm` for thumbnails: smaller type, no author line. */
  size?: 'md' | 'sm'
}

/** Shows the uploaded cover photo, or a colourful typographic placeholder cover when there is none. */
export function BookCover({ title, author, src, className = '', eager, size = 'md' }: Props) {
  const [failed, setFailed] = useState<string | null>(null)
  if (src && failed !== src) {
    return (
      <img
        src={src}
        alt={`Cover of ${title}${author ? ` by ${author}` : ''}`}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(src)}
        width={300}
        height={400}
        className={`aspect-[3/4] w-full rounded-md bg-pine-light object-cover shadow-md ring-1 ring-black/5 ${className}`}
      />
    )
  }
  const [from, to, fg, accent] = PALETTE[hash(title) % PALETTE.length]
  const small = size === 'sm'
  return (
    <div
      role="img"
      aria-label={`Placeholder cover for ${title}${author ? ` by ${author}` : ''}`}
      className={`relative flex aspect-[3/4] w-full flex-col justify-between overflow-hidden rounded-md shadow-md ring-1 ring-black/10 ${small ? 'p-1.5' : 'p-3 sm:p-4'} ${className}`}
      style={{ background: `linear-gradient(145deg, ${from}, ${to})`, color: fg }}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-black/20" />
      <span aria-hidden="true" className={`block h-0.5 ${small ? 'w-4' : 'w-8'}`} style={{ background: accent }} />
      <span
        className={`font-sans font-black leading-snug [overflow-wrap:anywhere] ${small ? 'text-[10px]' : 'text-base sm:text-lg'}`}
        style={{ display: '-webkit-box', WebkitLineClamp: small ? 4 : 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {title}
      </span>
      {author && !small ? <span className="truncate text-xs opacity-80">{author}</span> : <span aria-hidden="true" />}
    </div>
  )
}
