import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pzoavdnqrqvvjibunnhk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2F2ZG5xcnF2dmppYnVubmhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzM3ODMsImV4cCI6MjA5NTcwOTc4M30.7UL_VpuzUUOBBiVO-Tk4Sf93Jks0t-f0BQ5U41OseQY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const SUPABASE_URL = supabaseUrl;
