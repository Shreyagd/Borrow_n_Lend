import type { SVGProps } from 'react'

// Small inline icon set (stroke icons, 24px grid) so the app has no icon-font or CDN dependency.
type P = SVGProps<SVGSVGElement> & { size?: number }
const base = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
})

export const SearchIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
export const UserIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
export const PlusIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>
export const MenuIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
export const CloseIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
export const ArrowRightIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
export const ChevronRightIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="m9 6 6 6-6 6" /></svg>
export const ArrowUpIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
export const LeafIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15" /><path d="M5 19c3-5 6-8 10-10" /></svg>
export const CheckCircleIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>
export const BookIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M9 8h5" /></svg>
export const ListIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>
export const CartIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h3l2.6 12.2a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.1L21 8H6" /></svg>
export const BookOpenIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M2 5c3-1 7-1 10 1 3-2 7-2 10-1v13c-3-1-7-1-10 1-3-2-7-2-10-1z" /><path d="M12 6v13" /></svg>

export function HeartIcon({ filled, size = 18, ...p }: P & { filled?: boolean }) {
  return (
    <svg {...base(size)} fill={filled ? 'currentColor' : 'none'} {...p}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}
