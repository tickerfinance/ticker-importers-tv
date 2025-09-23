import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/database.js'
import 'dotenv/config'

// Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY // Using service role key for admin operations

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Supabase URL and service role key must be set in environment variables')
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY)

// Table names
export const VIDEOS_TABLE = 'tv_media_items'
export const CHANNELS_TABLE = 'tv_channels'
export const CHANNEL_STATISTICS_TABLE = 'tv_channel_statistics'