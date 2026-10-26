export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || ''
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || ''
/** Without Supabase credentials the app runs against a local, browser-only demo backend. */
export const IS_DEMO = !(SUPABASE_URL && SUPABASE_ANON_KEY)
/** Optional: URL of a generated hero image (see scripts/generate-hero-image.mjs). Falls back to the CSS 3D books. */
export const HERO_IMAGE_URL = (import.meta.env.VITE_HERO_IMAGE_URL as string | undefined)?.trim() || ''
