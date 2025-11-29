import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';


// Better storage adapter using AsyncStorage for larger session data
const ExpoStorageAdapter = {
    getItem: (key) => {
        return AsyncStorage.getItem(key);
    },
    setItem: (key, value) => {
        AsyncStorage.setItem(key, value);
    },
    removeItem: (key) => {
        AsyncStorage.removeItem(key);
    },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://slraybfnzastnloivvbu.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNscmF5YmZuemFzdG5sb2l2dmJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNTQ0ODYsImV4cCI6MjA3OTgzMDQ4Nn0.2Hdalr8GbuCuJn2dtAhGVXewmSsL0m6e2-gvFFhb4l0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ExpoStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Helper to handle app state changes for Auth
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh();
    } else {
        supabase.auth.stopAutoRefresh();
    }
});
