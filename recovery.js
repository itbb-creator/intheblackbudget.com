import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const config = await fetch('./content.json', { cache: 'no-store' }).then((response) => response.json());
const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
const byId = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
if (params.get('email')) byId('email').textContent = params.get('email');
let recoveryAuthorized = false;
const hash = new URLSearchParams(location.hash.slice(1));
const recoveryIntent =
  hash.get('type') === 'recovery' ||
  params.get('type') === 'recovery' ||
  params.has('code') ||
  params.has('token_hash');

function show(view) {
  ['sent', 'reset-form', 'invalid'].forEach((id) => byId(id).classList.toggle('hide', id !== view));
}
function status(message, bad = false) {
  byId('status').textContent = message;
  byId('status').className = `status${bad ? ' bad' : ''}`;
}
if (params.has('sent')) show('sent'); else show('invalid');

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' || (session && recoveryIntent && event === 'SIGNED_IN')) {
    recoveryAuthorized = true;
    show('reset-form');
    history.replaceState({}, '', './recovery.html?authorized=1');
  }
});
if (hash.get('type') === 'recovery') {
  recoveryAuthorized = true;
  show('reset-form');
}
if (hash.get('error_description')) status(hash.get('error_description').replaceAll('+', ' '), true);

const { data: { session }, error: sessionError } = await supabase.auth.getSession();
if (session && recoveryIntent) {
  recoveryAuthorized = true;
  show('reset-form');
  history.replaceState({}, '', './recovery.html?authorized=1');
} else if (sessionError) {
  status(sessionError.message, true);
}
if (['localhost', '127.0.0.1'].includes(location.hostname) && params.has('preview')) {
  show('reset-form');
}

byId('reset-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = byId('password').value;
  if (password !== byId('confirm-password').value) return status('The passwords do not match.', true);
  if (!recoveryAuthorized) return status('This reset link is no longer valid. Request a new link and try again.', true);
  const button = event.currentTarget.querySelector('button');
  button.disabled = true; button.textContent = 'Updating password…';
  const { error } = await supabase.auth.updateUser({ password });
  button.disabled = false; button.textContent = 'Update password';
  if (error) return status(error.message, true);
  await supabase.auth.signOut();
  show('invalid');
  byId('invalid').innerHTML = '<h1>Password updated</h1><p>Your password has been changed. Sign in with your new password to continue.</p><a class="button" href="./account.html">Sign in to Pravely</a>';
  status('Your account is secure and ready.', false);
  history.replaceState({}, '', './recovery.html?complete=1');
});
