import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../src/auth/passwordRecovery.js', import.meta.url),
  'utf8',
).replace(/export const /g, 'const ');

const { redirect, parse } = new Function(
  `${source}; return { redirect: PASSWORD_RECOVERY_REDIRECT, parse: parsePasswordRecoveryUrl };`,
)();

test('uses the redirect URL registered in Supabase', () => {
  assert.equal(redirect, 'mytime://reset-password');
});

test('parses implicit-flow recovery tokens from the URL fragment', () => {
  assert.deepEqual(
    parse('mytime://reset-password#access_token=access%20token&refresh_token=refresh%2Btoken&type=recovery'),
    { code: null, accessToken: 'access token', refreshToken: 'refresh+token' },
  );
});

test('parses a PKCE recovery code from the query string', () => {
  assert.deepEqual(
    parse('mytime://reset-password?code=abc123&type=recovery'),
    { code: 'abc123', accessToken: null, refreshToken: null },
  );
});

test('rejects unrelated, incomplete and non-recovery links', () => {
  assert.equal(parse('https://example.com/reset-password?code=abc'), null);
  assert.equal(parse('mytime://reset-password-evil?code=abc'), null);
  assert.equal(parse('mytime://reset-password?code=abc&type=signup'), null);
  assert.deepEqual(
    parse('mytime://reset-password?type=recovery'),
    { error: 'Este link de recuperação é inválido ou já expirou.' },
  );
});

test('auth UI and app shell retain the complete recovery flow', () => {
  const auth = fs.readFileSync(new URL('../src/screens/AuthScreen.js', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  const config = fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8');

  assert.match(auth, /resetPasswordForEmail\(normalizedEmail/);
  assert.match(auth, /updateUser\(\{ password: newPassword \}\)/);
  assert.match(auth, /Se existir uma conta associada a este email/);
  assert.match(auth, /autoComplete="new-password"/);
  assert.match(auth, /O teu dia, ao teu ritmo\./);
  assert.match(auth, /Pirilampo da My Time/);
  assert.match(auth, /Abelha da My Time/);
  assert.match(auth, /<Image[\s\S]*?style=\{styles\.mascot\}/);
  assert.doesNotMatch(auth, /<Imagem|style=\{styles\.mascot\}Image/);
  assert.equal((auth.match(/selectionColor=\{colors\.selection\}/g) || []).length, 2);
  assert.equal((auth.match(/cursorColor=\{colors\.selection\}/g) || []).length, 2);
  assert.equal((auth.match(/underlineColorAndroid="transparent"/g) || []).length, 2);
  assert.match(auth, /fieldFocused: \{ borderColor: colors\.selection \}/);
  assert.equal((auth.match(/onFocus=\{\(\) => setFocused\(true\)\}/g) || []).length, 2);
  assert.equal((auth.match(/onBlur=\{\(\) => setFocused\(false\)\}/g) || []).length, 2);
  assert.equal((auth.match(/outlineStyle: 'none'/g) || []).length, 2);
  assert.match(auth, /<Text style=\{styles\.fieldLabel\}>Email<\/Text>/);
  assert.match(app, /Linking\.getInitialURL\(\)/);
  assert.match(app, /Linking\.addEventListener\('url'/);
  assert.match(app, /session === undefined \|\| !initialLinkChecked/);
  assert.match(app, /exchangeCodeForSession/);
  assert.match(app, /setSession/);
  assert.equal(JSON.parse(config).expo.scheme, 'mytime');
});
