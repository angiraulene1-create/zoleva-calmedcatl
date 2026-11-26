import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const AUTH_COOKIE = 'zoleva_session';
export const OAUTH_COOKIE = 'zoleva_oauth';

export const AUTH_PROVIDERS = [
  {
    id: 'google',
    name: 'Google',
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    profile: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    pkce: true,
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    authorize: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',
    profile: 'https://graph.microsoft.com/oidc/userinfo',
    scope: 'openid email profile User.Read',
    pkce: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    authorize: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token',
    profile: 'https://api.github.com/user',
    emails: 'https://api.github.com/user/emails',
    scope: 'read:user user:email',
    pkce: false,
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cleanEmail = (value) => String(value || '').trim().toLowerCase().slice(0, 254);

export function providerUrl(provider, key, auth) {
  const template = String(provider[key] || '');
  const tenant = encodeURIComponent(String(auth?.providers?.microsoft?.tenant || 'common'));
  return template.replace('{tenant}', tenant);
}

/** Configuración de identidad: todo se puede fijar por entorno o en .data/config.json. */
export function normalizeAuth(raw = {}, env = {}, fallbackSecret = '') {
  const text = (value) => String(value ?? '').trim();
  const providers = {};
  for (const provider of AUTH_PROVIDERS) {
    const current = raw.providers?.[provider.id] || {};
    const prefix = provider.id.toUpperCase();
    providers[provider.id] = {
      clientId: text(current.clientId || env[`${prefix}_CLIENT_ID`]),
      clientSecret: text(current.clientSecret || env[`${prefix}_CLIENT_SECRET`]),
      ...(provider.id === 'microsoft'
        ? { tenant: text(current.tenant || env.MICROSOFT_TENANT || 'common') }
        : {}),
    };
  }
  return {
    enabled: raw.enabled !== false && text(env.ZOLEVA_AUTH_ENABLED) !== 'false',
    email: raw.email !== false && text(env.ZOLEVA_AUTH_EMAIL) !== 'false',
    baseUrl: text(raw.baseUrl || env.ZOLEVA_PUBLIC_URL),
    sessionSecret: text(raw.sessionSecret || env.ZOLEVA_SESSION_SECRET || fallbackSecret || randomBytes(32).toString('hex')),
    providers,
  };
}

export function publicAuthStatus(auth) {
  return {
    enabled: auth?.enabled !== false,
    email: auth?.email !== false,
    providers: AUTH_PROVIDERS.map((provider) => ({
      id: provider.id,
      name: provider.name,
      configured: Boolean(auth?.providers?.[provider.id]?.clientId && auth?.providers?.[provider.id]?.clientSecret),
    })),
  };
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || '',
    name: user.name || '',
    photo: user.photo || '',
    provider: user.provider || 'email',
    linked: user.linked || {},
    createdAt: user.createdAt || '',
  };
}

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, salt, hex] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hex) return false;
  const expected = Buffer.from(hex, 'hex');
  if (expected.length !== 64) return false;
  const actual = scryptSync(String(password), salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export function signToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyToken(token, secret) {
  if (typeof token !== 'string') return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const given = Buffer.from(signature);
  const correct = Buffer.from(expected);
  if (given.length !== correct.length || !timingSafeEqual(given, correct)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function pkceChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function newOAuthState(secret, provider, verifier) {
  const state = randomBytes(18).toString('base64url');
  const token = signToken({
    kind: 'oauth', provider, state, verifier,
    exp: Date.now() + 10 * 60 * 1000,
  }, secret);
  return { state, token };
}

export function parseCookies(header) {
  const result = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      result[key] = part.slice(index + 1).trim();
    }
  }
  return result;
}

export async function readAccounts(file) {
  try {
    const stored = JSON.parse(await readFile(file, 'utf8'));
    return { users: Array.isArray(stored.users) ? stored.users : [] };
  } catch {
    return { users: [] };
  }
}

export async function writeAccounts(file, accounts) {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(temp, JSON.stringify(accounts, null, 2), { mode: 0o600 });
  await rename(temp, file);
}

export function createEmailUser(accounts, { email, password, name }) {
  const mail = cleanEmail(email);
  if (!EMAIL_RE.test(mail)) throw new Error('Escribe un correo válido.');
  const pass = String(password || '');
  if (pass.length < 8 || pass.length > 128) throw new Error('La contraseña debe tener entre 8 y 128 caracteres.');
  if (accounts.users.some((user) => user.email === mail)) {
    throw new Error('Ese correo ya tiene una cuenta en este servidor.');
  }
  const user = {
    id: randomUUID(),
    email: mail,
    name: String(name || mail.split('@')[0]).trim().slice(0, 60) || 'Estudiante',
    photo: '',
    provider: 'email',
    linked: {},
    passwordHash: hashPassword(pass),
    cloud: { url: '', token: '' },
    createdAt: new Date().toISOString(),
  };
  return { accounts: { users: [...accounts.users, user] }, user };
}

export function verifyEmailUser(accounts, { email, password }) {
  const mail = cleanEmail(email);
  const user = accounts.users.find((item) => item.email === mail && item.passwordHash);
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  return user;
}

export function findOrCreateOAuthUser(accounts, profile) {
  const provider = String(profile.provider || '');
  const providerId = String(profile.providerId || '');
  const email = cleanEmail(profile.email);
  const name = String(profile.name || '').trim().slice(0, 60);
  const photo = String(profile.photo || '').slice(0, 1000);
  if (!providerId) throw new Error('El proveedor no devolvió una identidad válida.');

  const users = accounts.users.map((user) => ({ ...user }));
  let user = users.find((item) => item.provider === provider && item.providerId === providerId);
  if (user) {
    if (name) user.name = name;
    if (photo) user.photo = photo;
    if (email && !user.email) user.email = email;
    return { accounts: { users }, user, created: false };
  }

  if (email) {
    user = users.find((item) => item.email === email);
    if (user) {
      user.linked = { ...(user.linked || {}), [provider]: providerId };
      if (name) user.name = name;
      if (photo) user.photo = photo;
      return { accounts: { users }, user, created: false };
    }
  }

  user = {
    id: randomUUID(),
    email,
    name: name || (email ? email.split('@')[0] : 'Estudiante'),
    photo,
    provider,
    providerId,
    linked: { [provider]: providerId },
    cloud: { url: '', token: '' },
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  return { accounts: { users }, user, created: true };
}
