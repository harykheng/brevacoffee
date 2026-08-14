import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

// Reads the single `settings` row (id=1). Used by both apps: customer app applies
// it as branding overrides on top of config.js defaults, admin app edits it.
// If the table doesn't exist yet, fails silently (matches original behavior).
export function useSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (!error && data) setSettings(data);
    } catch {
      // settings table not created yet — callers fall back to config.js defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { settings, loading, refetch };
}
