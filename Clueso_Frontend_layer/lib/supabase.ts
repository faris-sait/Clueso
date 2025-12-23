import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Client-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client with service role (for webhooks/admin operations)
export const createServerSupabaseClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    console.error('Supabase config missing:', { url: !!url, serviceKey: !!serviceKey });
    throw new Error('Supabase configuration is missing');
  }
  
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

// Database types
export interface User {
  id: string;
  clerk_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Recording {
  id: string;
  user_id: string;
  session_id: string;
  title: string;
  url: string | null;
  video_path: string | null;
  audio_path: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  events_count: number;
  status: 'processing' | 'completed' | 'failed';
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
