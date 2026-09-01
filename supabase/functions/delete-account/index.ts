import { handleOptions, jsonResponse, readJson } from '../_shared/cors.ts';
import { getSupabase } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, req);

  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!token) return jsonResponse({ error: 'Sign in required.' }, 401, req);

    const body = await readJson<{ confirmation?: string }>(req);
    if (body.confirmation !== 'DELETE') return jsonResponse({ error: 'Confirmation required.' }, 400, req);

    const sb = getSupabase();
    const { data, error: authError } = await sb.auth.getUser(token);
    const user = data.user;
    if (authError || !user?.id) return jsonResponse({ error: 'Your session is no longer valid.' }, 401, req);

    const { data: freeFiles } = await sb.from('licenses').select('file_path')
      .eq('user_id', user.id).eq('license_source', 'account_free').not('file_path', 'is', null);
    const paths = (freeFiles ?? []).map((item) => String(item.file_path)).filter(Boolean);
    if (paths.length) await sb.storage.from('licensed-workbooks').remove(paths);

    const { error: deleteError } = await sb.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return jsonResponse({ deleted: true }, 200, req);
  } catch (error) {
    console.error('delete-account error:', error);
    return jsonResponse({ error: 'Account deletion could not be completed.' }, 500, req);
  }
});
