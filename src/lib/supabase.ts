import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Fallback for development if env vars are missing
  console.warn('Supabase environment variables are missing. Using hardcoded values.')
}

export const supabase = createClient<Database>(
  supabaseUrl || "https://rsmhyvlzyuhygjyiwjyn.supabase.co",
  supabaseAnonKey || "sb_publishable_fNQRmUiuAGgtjoVS0_001w_taajygAc"
)
