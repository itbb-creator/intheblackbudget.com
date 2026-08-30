import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const config = await fetch('./content.json', { cache: 'no-store' }).then((response) => response.json());
const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const byId = (id) => document.getElementById(id);
const loading = byId('loading'), authView = byId('auth-view'), accountView = byId('account-view');
const authStatus = byId('auth-status'), accountStatus = byId('account-status');
const signupForm = byId('signup-form'), loginForm = byId('login-form'), forgotForm = byId('forgot-form');
const changePasswordForm = byId('change-password-form');
const productionAccountUrl = 'https://pravely.com/account.html';
const accountUrl = location.hostname === 'localhost' ? `${location.origin}/account.html` : productionAccountUrl;

byId('year').textContent = new Date().getFullYear();

function showStatus(element, message, type = 'good') {
  element.textContent = message;
  element.className = `status show ${type}`;
}
function clearStatus(element) { element.className = 'status'; element.textContent = ''; }
function initials(metadata = {}) {
  const first = String(metadata.first_name ?? '').trim();
  const last = String(metadata.last_name ?? '').trim();
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?';
}
function setBusy(form, busy, busyText) {
  const button = form.querySelector('button[type="submit"]');
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? busyText : button.dataset.label;
}
function showAuthForm(name) {
  const signup = name === 'signup', login = name === 'login';
  signupForm.classList.toggle('hide', !signup);
  loginForm.classList.toggle('hide', !login);
  forgotForm.classList.toggle('hide', name !== 'forgot');
  byId('signup-tab').classList.toggle('active', signup);
  byId('login-tab').classList.toggle('active', login || name === 'forgot');
  byId('signup-tab').setAttribute('aria-selected', String(signup));
  byId('login-tab').setAttribute('aria-selected', String(login || name === 'forgot'));
  clearStatus(authStatus);
}

byId('signup-tab').addEventListener('click', () => showAuthForm('signup'));
byId('login-tab').addEventListener('click', () => showAuthForm('login'));
byId('forgot-button').addEventListener('click', () => {
  byId('forgot-email').value = byId('login-email').value;
  showAuthForm('forgot');
});
document.querySelectorAll('[data-show-login]').forEach((button) => button.addEventListener('click', () => showAuthForm('login')));

function updatePreviewAvatar() {
  byId('name-avatar').textContent = initials({ first_name: byId('first-name').value, last_name: byId('last-name').value });
}
byId('first-name').addEventListener('input', updatePreviewAvatar);
byId('last-name').addEventListener('input', updatePreviewAvatar);

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault(); clearStatus(authStatus); setBusy(signupForm, true, 'Creating account…');
  const firstName = byId('first-name').value.trim(), lastName = byId('last-name').value.trim();
  const { data, error } = await supabase.auth.signUp({
    email: byId('signup-email').value.trim(), password: byId('signup-password').value,
    options: { emailRedirectTo: accountUrl, data: {
      first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`,
      avatar_initials: initials({ first_name: firstName, last_name: lastName }),
    } },
  });
  setBusy(signupForm, false);
  if (error) return showStatus(authStatus, error.message, 'bad');
  if (data.session) return renderSession(data.session);
  signupForm.reset(); updatePreviewAvatar();
  showStatus(authStatus, 'Check your inbox for the Pravely verification email. After confirming, return here to access your workbook.');
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault(); clearStatus(authStatus); setBusy(loginForm, true, 'Logging in…');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: byId('login-email').value.trim(), password: byId('login-password').value,
  });
  setBusy(loginForm, false);
  if (error) return showStatus(authStatus, error.message, 'bad');
  await renderSession(data.session);
});

forgotForm.addEventListener('submit', async (event) => {
  event.preventDefault(); clearStatus(authStatus); setBusy(forgotForm, true, 'Sending reset link…');
  const { error } = await supabase.auth.resetPasswordForEmail(byId('forgot-email').value.trim(), {
    redirectTo: `${productionAccountUrl}?mode=recovery`,
  });
  setBusy(forgotForm, false);
  if (error) return showStatus(authStatus, error.message, 'bad');
  showStatus(authStatus, 'If an account exists for that email, a password-reset link is on its way.');
});

changePasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault(); clearStatus(accountStatus);
  const password = byId('new-password').value;
  if (password !== byId('confirm-password').value) return showStatus(accountStatus, 'The passwords do not match.', 'bad');
  setBusy(changePasswordForm, true, 'Updating password…');
  const { error } = await supabase.auth.updateUser({ password });
  setBusy(changePasswordForm, false);
  if (error) return showStatus(accountStatus, error.message, 'bad');
  changePasswordForm.reset(); changePasswordForm.classList.add('hide');
  showStatus(accountStatus, 'Your password has been updated.');
  history.replaceState({}, '', './account.html');
});

byId('show-password').addEventListener('click', () => changePasswordForm.classList.toggle('hide'));
byId('nav-signout').addEventListener('click', async () => { await supabase.auth.signOut(); renderSession(null); });
byId('download-button').addEventListener('click', async () => {
  clearStatus(accountStatus); const button = byId('download-button'); button.disabled = true; button.textContent = 'Preparing your licensed copy…';
  const { data, error } = await supabase.functions.invoke('claim-essentials', { body: {} });
  button.disabled = false; button.textContent = 'Prepare my workbook';
  if (error || !data?.downloadUrl) return showStatus(accountStatus, data?.error || error?.message || 'We could not prepare your workbook.', 'bad');
  byId('license-id').textContent = `License ID: ${data.licenseId}`;
  showStatus(accountStatus, 'Your licensed workbook is ready. The secure download will begin now.');
  location.assign(data.downloadUrl);
});

async function renderSession(session) {
  loading.classList.add('hide');
  const signedIn = Boolean(session?.user);
  authView.classList.toggle('hide', signedIn); accountView.classList.toggle('hide', !signedIn);
  byId('nav-signout').classList.toggle('hide', !signedIn);
  if (!signedIn) { showAuthForm('login'); return; }
  const metadata = session.user.user_metadata ?? {};
  byId('account-avatar').textContent = initials(metadata);
  byId('account-name').textContent = metadata.full_name || [metadata.first_name, metadata.last_name].filter(Boolean).join(' ') || 'Your account';
  byId('account-email').textContent = session.user.email || '';
  if (new URLSearchParams(location.search).get('mode') === 'recovery') {
    changePasswordForm.classList.remove('hide');
    showStatus(accountStatus, 'Choose a new password to finish recovering your account.');
  }
}

supabase.auth.onAuthStateChange((_event, session) => { renderSession(session); });
const { data: { session } } = await supabase.auth.getSession();
await renderSession(session);
