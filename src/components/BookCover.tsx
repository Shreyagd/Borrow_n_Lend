// [background gradient start, end, text colour, accent band]
const PALETTE: [string, string, string, string][] = [
  ['#3b2fa0', '#5848d0', '#ecebff', '#f6dc94'],
  ['#c4492f', '#ee8b73', '#fff4ef', '#fdf3d8'],
  ['#12606b', '#2c8a94', '#e4f6f6', '#f6dc94'],
  ['#6a3558', '#8d4d78', '#f8e8f2', '#eab7a6'],
  ['#f0b94a', '#f7d27a', '#2a1c05', '#5848d0'],
  ['#3d5a3a', '#587a52', '#eef6e8', '#eab7a6'],
  ['#9a3f4a', '#c0606a', '#fdeeee', '#f3d98b'],
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
  if (src) {
    return (
      <img
        src={src}
        alt={`Cover of ${title}${author ? ` by ${author}` : ''}`}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
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
