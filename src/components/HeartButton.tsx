import { motion } from 'framer-motion'
import { useSaved } from '../lib/saved'

export function HeartIcon({ filled, size = 18 }: { filled?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3 5.5 6.2 5.5c2 0 3.3 1.1 3.8 2 .5-.9 1.8-2 3.8-2 3.2 0 5 3.1 3.7 6.3C19.5 16.4 12 21 12 21z" />
    </svg>
  )
}

export function HeartButton({ id, title, className = '' }: { id: string; title: string; className?: string }) {
  const { has, toggle } = useSaved()
  const saved = has(id)
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.85 }}
      whileHover={{ scale: 1.1 }}
      onClick={() => toggle(id)}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved books` : `Save ${title}`}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-md ${saved ? 'text-red-500' : 'text-ink-soft'} ${className}`}
    >
      <HeartIcon filled={saved} />
    </motion.button>
  )
}
