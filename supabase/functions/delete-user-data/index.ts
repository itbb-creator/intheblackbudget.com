import { handleOptions, jsonResponse, readJson } from '../_shared/cors.ts';
import { getSupabase } from '../_shared/supabase.ts';

const TABLES = ['budget_entries', 'goals', 'debts', 'net_worth_items', 'user_settings', 'push_device_tokens'] as const;

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, req);
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const body = await readJson<{ confirmation?: string }>(req);
    if (body.confirmation !== 'DELETE DATA') return jsonResponse({ error: 'Confirmation required.' }, 400, req);
    const sb = getSupabase();
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user?.id) return jsonResponse({ error: 'Your session is no longer valid.' }, 401, req);
    for (const table of TABLES) {
      const { error: deleteError } = await sb.from(table).delete().eq('user_id', data.user.id);
      if (deleteError) throw deleteError;
    }
    return jsonResponse({ deleted: true }, 200, req);
  } catch (error) {
    console.error('delete-user-data error:', error);
    return jsonResponse({ error: 'Financial data deletion could not be completed.' }, 500, req);
  }
});
