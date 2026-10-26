import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env'

export const supabase = createClient(SUPABASE_URL || 'http://localhost', SUPABASE_ANON_KEY || 'public-anon-placeholder', {
  auth: { persistSession: true, autoRefreshToken: true },
})
