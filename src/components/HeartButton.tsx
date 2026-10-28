import { motion } from 'framer-motion'
import { useSaved } from '../lib/saved'
import { HeartIcon } from './Icons'

export { HeartIcon }

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
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-md transition-colors ${saved ? 'text-clay' : 'text-ink-soft hover:text-clay'} ${className}`}
    >
      <HeartIcon filled={saved} size={16} />
    </motion.button>
  )
}
