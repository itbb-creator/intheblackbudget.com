import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const config = await fetch('./content.json', { cache: 'no-store' }).then((response) => response.json());
const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
const params = new URLSearchParams(location.search);
const email = params.get('email');
if (email) document.getElementById('email').textContent = email;
document.getElementById('open-app').href = config.appUrl || 'https://app.pravely.com';

function showVerified() {
  document.getElementById('waiting').classList.add('hide');
  document.getElementById('verified').classList.remove('hide');
  document.getElementById('icon').textContent = '✓';
  history.replaceState({}, '', './confirmation.html?verified=1');
}
function showError(message) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status bad';
}
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.get('error_description')) showError(hash.get('error_description').replaceAll('+', ' '));
supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user && event !== 'PASSWORD_RECOVERY') showVerified();
});
const { data: { session } } = await supabase.auth.getSession();
if (session?.user && !params.has('sent')) showVerified();
