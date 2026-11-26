import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTH_PROVIDERS, normalizeAuth, publicAuthStatus, hashPassword, verifyPassword,
  signToken, verifyToken, pkceChallenge, newOAuthState, providerUrl,
  createEmailUser, verifyEmailUser, findOrCreateOAuthUser,
} from '../src/auth.js';

test('las contraseñas se guardan con scrypt y sal aleatoria', () => {
  const stored = hashPassword('clave-segura-123');
  assert.match(stored, /^scrypt\$/);
  assert.doesNotMatch(stored, /clave-segura-123/);
  assert.equal(verifyPassword('clave-segura-123', stored), true);
  assert.equal(verifyPassword('otra-clave', stored), false);
});

test('las sesiones firmadas rechazan manipulaciones', () => {
  const token = signToken({ kind: 'session', uid: 'u1', exp: 9999999999999 }, 'secreto');
  assert.equal(verifyToken(token, 'secreto').uid, 'u1');
  assert.equal(verifyToken(token, 'otro-secreto'), null);
  assert.equal(verifyToken(`${token}x`, 'secreto'), null);
});

test('el estado OAuth y PKCE viajan completos', () => {
  const { state, token } = newOAuthState('secreto', 'google', 'verificador-largo');
  const payload = verifyToken(token, 'secreto');
  assert.equal(payload.state, state);
  assert.equal(payload.provider, 'google');
  assert.equal(payload.verifier, 'verificador-largo');
  assert.equal(pkceChallenge('verificador-largo').length, 43);
});

test('la configuración pública no filtra secretos', () => {
  const auth = normalizeAuth({ providers: { google: { clientId: 'publico', clientSecret: 'secreto' } } }, {}, 'firma');
  const status = publicAuthStatus(auth);
  assert.equal(auth.sessionSecret, 'firma');
  assert.equal(status.providers.find((p) => p.id === 'google').configured, true);
  assert.equal(status.providers.find((p) => p.id === 'github').configured, false);
  assert.doesNotMatch(JSON.stringify(status), /secreto/);
});

test('Google y Microsoft usan PKCE y Microsoft permite elegir inquilino', () => {
  assert.equal(AUTH_PROVIDERS.find((p) => p.id === 'google').pkce, true);
  assert.equal(AUTH_PROVIDERS.find((p) => p.id === 'microsoft').pkce, true);
  assert.equal(AUTH_PROVIDERS.find((p) => p.id === 'github').pkce, false);
  const auth = normalizeAuth({}, {}, 'firma');
  assert.match(providerUrl(AUTH_PROVIDERS[1], 'authorize', auth), /\/common\/oauth2\/v2\.0\/authorize/);
});

test('el correo se normaliza y un proveedor se vincula por correo', () => {
  const created = createEmailUser({ users: [] }, {
    email: 'Ana@Ejemplo.com', password: '12345678', name: 'Ana',
  });
  assert.equal(created.user.email, 'ana@ejemplo.com');
  assert.ok(verifyEmailUser(created.accounts, { email: 'ana@ejemplo.com', password: '12345678' }));
  assert.throws(
    () => createEmailUser(created.accounts, { email: 'ana@ejemplo.com', password: '12345678' }),
    /ya tiene una cuenta/,
  );
  const linked = findOrCreateOAuthUser(created.accounts, {
    provider: 'google', providerId: 'g-1', email: 'ana@ejemplo.com', name: 'Ana G',
  });
  assert.equal(linked.created, false);
  assert.equal(linked.user.id, created.user.id);
  assert.equal(linked.user.linked.google, 'g-1');
});
