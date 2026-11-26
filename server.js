import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVIDERS, chat, modelsFor, defaultModel, isCli, cliBinary, cliWorks } from './src/providers.js';
import { buildGenerateMessages, buildChatMessages, normalizeGenerated } from './src/prompts.js';
import { demoGenerate } from './src/demo.js';
import {
  AUTH_COOKIE, OAUTH_COOKIE, AUTH_PROVIDERS, normalizeAuth, publicAuthStatus, publicUser,
  providerUrl, signToken, verifyToken, pkceChallenge, newOAuthState, parseCookies,
  readAccounts, writeAccounts, createEmailUser, verifyEmailUser, findOrCreateOAuthUser,
} from './src/auth.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const DATA = join(ROOT, '.data');
const CONFIG_FILE = join(DATA, 'config.json');
const ACCOUNTS_FILE = join(DATA, 'accounts.json');
const BACKUPS = join(DATA, 'backups');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY = 24 * 1024 * 1024;
let generatedAuthSecret = null;
const loginAttempts = new Map();

function loadEnv() {
  const file = join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

loadEnv();

function defaultConfig() {
  return {
    provider: process.env.PROVIDER || 'demo',
    model: process.env.MODEL || '',
    chatMode: 'didactic',
    level: 'bachillerato',
    apiKeys: {
      openrouter: process.env.OPENROUTER_API_KEY || '',
      gemini: process.env.GEMINI_API_KEY || '',
      groq: process.env.GROQ_API_KEY || '',
      openai: process.env.OPENAI_API_KEY || '',
    },
    endpoints: {
      ollama: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
      openaiCompatible: process.env.OPENAI_COMPATIBLE_BASE_URL || 'http://127.0.0.1:1234/v1',
    },
    cli: { customCommand: '' },
    cloud: { url: process.env.ZOLEVA_CLOUD_URL || '', token: process.env.ZOLEVA_CLOUD_TOKEN || '' },
    auth: {},
  };
}

async function readConfig() {
  let stored = {};
  let parsed = false;
  try {
    stored = JSON.parse(await readFile(CONFIG_FILE, 'utf8'));
    parsed = true;
  } catch {
    // Sin configuración previa se usa la configuración por defecto.
  }
  const base = defaultConfig();
  const auth = normalizeAuth(stored.auth || {}, process.env, generatedAuthSecret);
  generatedAuthSecret = auth.sessionSecret;
  const config = {
    ...base,
    ...stored,
    apiKeys: { ...base.apiKeys, ...(stored.apiKeys || {}) },
    endpoints: { ...base.endpoints, ...(stored.endpoints || {}) },
    cli: { ...base.cli, ...(stored.cli || {}) },
    cloud: { ...base.cloud, ...(stored.cloud || {}) },
    auth,
  };
  const missingSecret = !stored.auth?.sessionSecret && !process.env.ZOLEVA_SESSION_SECRET;
  if (missingSecret && (parsed || !existsSync(CONFIG_FILE))) await writeConfig(config);
  return config;
}

async function writeConfig(config) {
  await mkdir(DATA, { recursive: true });
  const temp = `${CONFIG_FILE}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(config, null, 2), { mode: 0o600 });
  await rename(temp, CONFIG_FILE);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function send(res, status, body, type = 'application/json; charset=utf-8', headers = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache', ...headers });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function json(res, status, data) {
  send(res, status, data);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('La petición es demasiado grande (máx. 24 MB)');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('JSON no válido');
  }
}

/** Guardado opcional en la nube: el usuario elige URL y token; nunca es automático. */
function cloudRequest(config, options = {}) {
  const raw = String(config.cloud?.url || '').trim();
  if (!raw) throw new Error('Configura primero la URL de tu nube en Mi cuenta.');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('La URL de la nube no es válida.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('La URL debe usar http o https.');
  const token = String(config.cloud?.token || '').trim();
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (token && url.protocol === 'http:' && !localHost) {
    throw new Error('Con token, la URL de la nube debe usar https (o http en localhost).');
  }
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20000),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Zoleva-Client': 'calmedcatl',
      ...(options.headers || {}),
    },
  });
}

/** Las cuentas iniciadas tienen su propia nube; sin sesión se usa la nube del equipo. */
function effectiveConfig(config, user) {
  if (!user) return config;
  return { ...config, cloud: { url: user.cloud?.url || '', token: user.cloud?.token || '' } };
}

/** Respaldo directo en el servidor de la app: solo para cuentas con sesión. */
function backupFile(userId) {
  const id = String(userId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'anon';
  return join(BACKUPS, `${id}.json`);
}

async function writeBackup(file, value) {
  await mkdir(BACKUPS, { recursive: true });
  const temp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temp, file);
}

function isSecure(req) {
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return Boolean(forwarded === 'https' || req.socket.encrypted);
}

function cookieString(req, name, value, maxAge) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${isSecure(req) ? '; Secure' : ''}`;
}

function clearCookieString(req, name) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isSecure(req) ? '; Secure' : ''}`;
}

function sessionHeader(req, user, config) {
  const maxAge = 30 * 24 * 60 * 60;
  const token = signToken({ kind: 'session', uid: user.id, exp: Date.now() + maxAge * 1000 }, config.auth.sessionSecret);
  return cookieString(req, AUTH_COOKIE, token, maxAge);
}

function publicOrigin(req, config) {
  const configured = String(config.auth.baseUrl || '').replace(/\/$/, '');
  if (configured) return configured;
  const proto = isSecure(req) ? 'https' : 'http';
  const host = req.headers.host || `${HOST}:${PORT}`;
  return `${proto}://${host}`;
}

function authRedirect(res, origin, status, message = '') {
  const query = new URLSearchParams({ auth: status });
  if (message) query.set('authMessage', message.slice(0, 200));
  return send(res, 302, '', 'text/plain; charset=utf-8', { Location: `${origin}/?${query}#/app/cuenta` });
}

async function currentUser(req, config) {
  if (!config.auth.enabled) return null;
  const token = parseCookies(req.headers.cookie)[AUTH_COOKIE];
  const payload = verifyToken(token, config.auth.sessionSecret);
  if (!payload || payload.kind !== 'session' || !payload.uid || payload.exp <= Date.now()) return null;
  const accounts = await readAccounts(ACCOUNTS_FILE);
  return accounts.users.find((user) => user.id === payload.uid) || null;
}

function inheritGlobalCloud(accounts, user, config) {
  const index = accounts.users.findIndex((item) => item.id === user.id);
  if (index >= 0 && !accounts.users[index].cloud?.url && config.cloud?.url) {
    accounts.users[index].cloud = { ...config.cloud };
  }
  return accounts;
}

function rateLimited(key) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.until <= now) {
    loginAttempts.set(key, { count: 0, until: now + 10 * 60 * 1000 });
    return false;
  }
  return entry.count >= 8;
}

function recordAttempt(key, ok) {
  const now = Date.now();
  let entry = loginAttempts.get(key);
  if (!entry || entry.until <= now) entry = { count: 0, until: now + 10 * 60 * 1000 };
  entry.count = ok ? 0 : entry.count + 1;
  loginAttempts.set(key, entry);
}

async function probeOllama(config) {
  const base = String(config.endpoints?.ollama || 'http://127.0.0.1:11434').replace(/\/$/, '');
  try {
    const response = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return false;
    const data = await response.json();
    return Array.isArray(data.models) && data.models.length > 0;
  } catch {
    return false;
  }
}

async function providerStatus(config) {
  const ollamaReady = await probeOllama(config);
  const configured = {
    openrouter: Boolean(config.apiKeys?.openrouter),
    gemini: Boolean(config.apiKeys?.gemini),
    groq: Boolean(config.apiKeys?.groq),
    openai: Boolean(config.apiKeys?.openai),
  };
  return PROVIDERS.map((provider) => {
    let ready = true;
    let note = provider.note;
    if (provider.id === 'ollama') {
      ready = ollamaReady;
      if (!ready) note = 'Instala Ollama y descarga un modelo (ollama pull llama3.2)';
    } else if (provider.id === 'openai-compatible') {
      ready = configured.openai;
      if (!ready) note = 'Añade una clave (puede ser local) o configura el endpoint';
    } else if (['openrouter', 'gemini', 'groq'].includes(provider.id)) {
      ready = configured[provider.id];
      if (!ready) note = 'Añade tu clave gratuita en Ajustes';
    } else if (isCli(provider.id)) {
      const binary = cliBinary(provider.id);
      ready = binary ? cliWorks(provider.id) : Boolean(config.cli?.customCommand);
      if (!ready) note = binary ? `${binary} no está disponible o no se puede ejecutar` : 'Escribe tu comando en Ajustes';
    }
    return { ...provider, ready, note };
  });
}

function sanitizeMessages(input) {
  if (!Array.isArray(input)) throw new Error('messages debe ser una lista');
  return input.slice(-60).map((m) => ({
    role: ['system', 'user', 'assistant'].includes(m?.role) ? m.role : 'user',
    content: String(m?.content || '').slice(0, 20000),
    images: Array.isArray(m?.images)
      ? m.images.slice(0, 4).map((i) => ({
          mime: String(i?.mime || 'image/png').slice(0, 50),
          base64: String(i?.base64 || '').slice(0, 8 * 1024 * 1024),
        }))
      : [],
  }));
}

function cleanPayload(body) {
  return {
    material: String(body.material || '').slice(0, 60000),
    subject: String(body.subject || '').slice(0, 200),
    topic: String(body.topic || '').slice(0, 300),
    level: String(body.level || '').slice(0, 100),
    examDate: String(body.examDate || '').slice(0, 40),
    goal: String(body.goal || '').slice(0, 200),
    hoursPerDay: Number(body.hoursPerDay) || 1,
    minutes: Number(body.minutes) || 60,
    plan: body.plan,
    role: body.role === 'teacher' ? 'teacher' : 'student',
    age: (Number(body.age) || 0) > 0 ? Math.max(3, Math.min(99, Number(body.age))) : 0,
    style: ['visual', 'auditivo', 'kinestesico', 'lector', 'mixto'].includes(body.style) ? body.style : 'mixto',
    tone: ['amable', 'jugueton', 'serio'].includes(body.tone) ? body.tone : 'amable',
    calm: Boolean(body.calm),
  };
}

async function generate(res, body, config) {
  const kind = String(body.kind || '');
  const allowed = ['plan', 'lessons', 'flashcards', 'quiz', 'exam', 'podcast', 'guide', 'rubric', 'game'];
  if (!allowed.includes(kind)) return json(res, 400, { error: `Tipo no soportado: ${kind}` });
  const payload = cleanPayload(body);
  const provider = String(body.provider || config.provider);
  const model = String(body.model || config.model || '');
  if (provider === 'demo') {
    return json(res, 200, { data: demoGenerate(kind, payload), provider, model: 'demo' });
  }
  const messages = buildGenerateMessages(kind, payload);
  let text;
  let warning = null;
  try {
    text = await chat({ provider, config, messages, model });
    return json(res, 200, { data: normalizeGenerated(kind, text), provider, model: model || defaultModel(provider) });
  } catch (error) {
    warning = error.message;
  }
  try {
    const retry = [
      ...messages,
      { role: 'assistant', content: 'Lo siento, mi respuesta anterior no era JSON válido.' },
      { role: 'user', content: 'Corrige tu respuesta anterior y devuelve SOLO el JSON solicitado, sin explicaciones ni bloques de código.' },
    ];
    text = await chat({ provider, config, messages: retry, model });
    return json(res, 200, { data: normalizeGenerated(kind, text), provider, model, warning: null });
  } catch {
    return json(res, 200, {
      data: demoGenerate(kind, payload),
      provider: 'demo',
      model: 'demo',
      warning: `${provider} no pudo generar contenido válido (${warning}). Se usó el modo demo.`,
    });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = decodeURIComponent(url.pathname);

    if (path.startsWith('/api/')) {
      const config = await readConfig();
      const user = await currentUser(req, config);

      if (path === '/api/status' && req.method === 'GET') {
        return json(res, 200, {
          ok: true,
          active: config.provider,
          model: config.model || defaultModel(config.provider),
          providers: await providerStatus(config),
        });
      }

      if (path === '/api/config' && req.method === 'GET') {
        const safe = structuredClone(config);
        delete safe.auth;
        for (const [name, value] of Object.entries(safe.apiKeys)) {
          safe.apiKeys[name] = value ? '••••••••' : '';
        }
        const cloud = user ? (user.cloud || {}) : safe.cloud;
        safe.cloud = {
          url: cloud.url || '',
          token: cloud.token ? '••••••••' : '',
        };
        return json(res, 200, safe);
      }

      if (path === '/api/config' && req.method === 'POST') {
        const body = await readBody(req);
        const current = await readConfig();
        const next = {
          ...current,
          provider: String(body.provider || current.provider),
          model: String(body.model ?? current.model),
          chatMode: ['socratic', 'solve', 'tutor', 'explain', 'didactic', 'calm', 'play'].includes(body.chatMode) ? body.chatMode : current.chatMode,
          level: String(body.level || current.level),
          apiKeys: { ...current.apiKeys },
          endpoints: { ...current.endpoints },
          cli: { ...current.cli },
          cloud: { ...current.cloud },
        };
        for (const name of Object.keys(current.apiKeys)) {
          const value = body.apiKeys?.[name];
          if (typeof value === 'string' && value && !value.startsWith('••')) next.apiKeys[name] = value.trim();
          if (value === '') next.apiKeys[name] = '';
        }
        for (const name of Object.keys(current.endpoints)) {
          if (typeof body.endpoints?.[name] === 'string') next.endpoints[name] = body.endpoints[name].trim();
        }
        if (typeof body.cli?.customCommand === 'string') next.cli.customCommand = body.cli.customCommand.slice(0, 1000);

        const cloud = { ...(user ? (user.cloud || {}) : current.cloud) };
        if (typeof body.cloud?.url === 'string') cloud.url = body.cloud.url.trim().slice(0, 500);
        if (typeof body.cloud?.token === 'string' && body.cloud.token && !body.cloud.token.startsWith('••')) {
          cloud.token = body.cloud.token.trim().slice(0, 500);
        }
        if (body.cloud?.token === '') cloud.token = '';
        if (cloud.url) {
          try {
            const parsed = new URL(cloud.url);
            if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocolo');
          } catch {
            return json(res, 400, { error: 'La URL de la nube debe empezar con http:// o https://' });
          }
        }
        if (!PROVIDERS.some((p) => p.id === next.provider)) return json(res, 400, { error: 'Proveedor no válido' });
        if (user) {
          const accounts = await readAccounts(ACCOUNTS_FILE);
          const index = accounts.users.findIndex((item) => item.id === user.id);
          if (index >= 0) {
            accounts.users[index].cloud = cloud;
            await writeAccounts(ACCOUNTS_FILE, accounts);
          }
        } else {
          next.cloud = cloud;
        }
        await writeConfig(next);
        return json(res, 200, { ok: true });
      }

      if (path === '/api/cloud/push' && req.method === 'POST') {
        const body = await readBody(req);
        if (!body.data || typeof body.data !== 'object') return json(res, 400, { error: 'No hay datos para subir.' });
        const raw = JSON.stringify(body.data);
        const bytes = Buffer.byteLength(raw);
        if (bytes > 4 * 1024 * 1024) return json(res, 413, { error: 'El respaldo supera 4 MB. Quita fotos o conversaciones antiguas.' });
        const response = await cloudRequest(effectiveConfig(config, user), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: raw,
        });
        if (!response.ok) throw new Error(`La nube respondió ${response.status}: ${(await response.text()).slice(0, 200)}`);
        return json(res, 200, { ok: true, bytes, at: new Date().toISOString() });
      }

      if (path === '/api/cloud/pull' && req.method === 'POST') {
        const response = await cloudRequest(effectiveConfig(config, user));
        if (response.status === 404) return json(res, 200, { data: null, at: new Date().toISOString() });
        if (!response.ok) throw new Error(`La nube respondió ${response.status}: ${(await response.text()).slice(0, 200)}`);
        const text = await response.text();
        if (Buffer.byteLength(text) > 8 * 1024 * 1024) throw new Error('El respaldo de la nube supera 8 MB.');
        let data = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            throw new Error('La nube no devolvió JSON válido.');
          }
        }
        return json(res, 200, { data, at: new Date().toISOString() });
      }

      if (path === '/api/account/backup' && req.method === 'POST') {
        if (!user) return json(res, 401, { error: 'Inicia sesión para guardar el respaldo de tu cuenta.' });
        const body = await readBody(req);
        if (!body.data || typeof body.data !== 'object') return json(res, 400, { error: 'No hay datos para subir.' });
        const raw = JSON.stringify(body.data);
        const bytes = Buffer.byteLength(raw);
        if (bytes > 4 * 1024 * 1024) return json(res, 413, { error: 'El respaldo supera 4 MB. Quita fotos o conversaciones antiguas.' });
        const at = new Date().toISOString();
        await writeBackup(backupFile(user.id), { version: 1, at, data: body.data });
        return json(res, 200, { ok: true, bytes, at });
      }

      if (path === '/api/account/backup' && req.method === 'GET') {
        if (!user) return json(res, 401, { error: 'Inicia sesión para bajar el respaldo de tu cuenta.' });
        let stored = null;
        try {
          stored = JSON.parse(await readFile(backupFile(user.id), 'utf8'));
        } catch {
          // Sin respaldo previo para esta cuenta.
        }
        if (!stored?.data) return json(res, 200, { data: null, at: new Date().toISOString() });
        return json(res, 200, { data: stored.data, at: stored.at || '' });
      }

      if (path === '/api/auth/status' && req.method === 'GET') {
        return json(res, 200, { ...publicAuthStatus(config.auth), user: publicUser(user) });
      }

      if (path === '/api/auth/register' && req.method === 'POST') {
        if (!config.auth.enabled || !config.auth.email) {
          return json(res, 403, { error: 'El acceso con correo está desactivado en este servidor.' });
        }
        const body = await readBody(req);
        const key = `${req.socket.remoteAddress || ''}:${String(body.email || '').trim().toLowerCase()}`;
        if (rateLimited(key)) return json(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' });
        const accounts = await readAccounts(ACCOUNTS_FILE);
        let created;
        try {
          created = createEmailUser(accounts, body);
        } catch (error) {
          recordAttempt(key, false);
          return json(res, 400, { error: error.message });
        }
        recordAttempt(key, true);
        await writeAccounts(ACCOUNTS_FILE, inheritGlobalCloud(created.accounts, created.user, config));
        return send(res, 200, { ok: true, user: publicUser(created.user) },
          'application/json; charset=utf-8', { 'Set-Cookie': sessionHeader(req, created.user, config) });
      }

      if (path === '/api/auth/login' && req.method === 'POST') {
        if (!config.auth.enabled || !config.auth.email) {
          return json(res, 403, { error: 'El acceso con correo está desactivado en este servidor.' });
        }
        const body = await readBody(req);
        const key = `${req.socket.remoteAddress || ''}:${String(body.email || '').trim().toLowerCase()}`;
        if (rateLimited(key)) return json(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' });
        const accounts = await readAccounts(ACCOUNTS_FILE);
        const found = verifyEmailUser(accounts, body);
        recordAttempt(key, Boolean(found));
        if (!found) return json(res, 401, { error: 'Correo o contraseña incorrectos.' });
        await writeAccounts(ACCOUNTS_FILE, inheritGlobalCloud(accounts, found, config));
        return send(res, 200, { ok: true, user: publicUser(found) },
          'application/json; charset=utf-8', { 'Set-Cookie': sessionHeader(req, found, config) });
      }

      if (path === '/api/auth/logout' && req.method === 'POST') {
        return send(res, 200, { ok: true }, 'application/json; charset=utf-8',
          { 'Set-Cookie': clearCookieString(req, AUTH_COOKIE) });
      }

      const oauthStart = path.match(/^\/api\/auth\/(google|microsoft|github)$/);
      if (oauthStart && req.method === 'GET') {
        if (!config.auth.enabled) return json(res, 403, { error: 'Las cuentas están desactivadas en este servidor.' });
        const provider = AUTH_PROVIDERS.find((item) => item.id === oauthStart[1]);
        const settings = config.auth.providers[provider.id];
        if (!settings.clientId || !settings.clientSecret) {
          return json(res, 400, { error: `${provider.name} no está configurado en este servidor.` });
        }
        const origin = publicOrigin(req, config);
        const redirectUri = `${origin}/api/auth/callback/${provider.id}`;
        const verifier = randomBytes(32).toString('base64url');
        const { state, token } = newOAuthState(config.auth.sessionSecret, provider.id, verifier);
        const params = new URLSearchParams({
          client_id: settings.clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: provider.scope,
          state,
        });
        if (provider.pkce) {
          params.set('code_challenge', pkceChallenge(verifier));
          params.set('code_challenge_method', 'S256');
        }
        const location = `${providerUrl(provider, 'authorize', config.auth)}?${params}`;
        return send(res, 302, '', 'text/plain; charset=utf-8',
          { Location: location, 'Set-Cookie': cookieString(req, OAUTH_COOKIE, token, 600) });
      }

      const oauthCallback = path.match(/^\/api\/auth\/callback\/(google|microsoft|github)$/);
      if (oauthCallback && req.method === 'GET') {
        const origin = publicOrigin(req, config);
        const provider = AUTH_PROVIDERS.find((item) => item.id === oauthCallback[1]);
        try {
          const cookies = parseCookies(req.headers.cookie);
          const oauth = verifyToken(cookies[OAUTH_COOKIE], config.auth.sessionSecret);
          const state = String(url.searchParams.get('state') || '');
          const error = url.searchParams.get('error');
          if (error) throw new Error(`Acceso cancelado: ${error}`);
          if (!oauth || oauth.kind !== 'oauth' || oauth.provider !== provider.id
            || !state || oauth.state !== state || oauth.exp <= Date.now()) {
            throw new Error('La sesión de acceso caducó. Inténtalo de nuevo.');
          }
          const code = String(url.searchParams.get('code') || '');
          if (!code) throw new Error('El proveedor no devolvió un código de acceso.');
          const settings = config.auth.providers[provider.id];
          const redirectUri = `${origin}/api/auth/callback/${provider.id}`;
          const tokenParams = new URLSearchParams({
            client_id: settings.clientId,
            client_secret: settings.clientSecret,
            code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          });
          if (provider.pkce && oauth.verifier) tokenParams.set('code_verifier', oauth.verifier);
          const tokenResponse = await fetch(providerUrl(provider, 'token', config.auth), {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Zoleva-Calmedcatl' },
            body: tokenParams,
            signal: AbortSignal.timeout(15000),
          });
          if (!tokenResponse.ok) throw new Error(`El proveedor rechazó el acceso (${tokenResponse.status}).`);
          const tokenData = await tokenResponse.json().catch(() => null);
          const accessToken = tokenData?.access_token;
          if (!accessToken) throw new Error('El proveedor no devolvió un token.');

          const profileResponse = await fetch(providerUrl(provider, 'profile', config.auth), {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'User-Agent': 'Zoleva-Calmedcatl' },
            signal: AbortSignal.timeout(15000),
          });
          const profile = profileResponse.ok ? await profileResponse.json().catch(() => ({})) : {};
          let email = String(profile.email || profile.preferred_username || profile.mail || '').toLowerCase();
          let name = String(profile.name || profile.login || '').slice(0, 60);
          let photo = '';
          let providerId = '';
          if (provider.id === 'google') {
            providerId = String(profile.sub || '');
            photo = String(profile.picture || '').slice(0, 1000);
          } else if (provider.id === 'microsoft') {
            providerId = String(profile.sub || profile.oid || profile.id || '');
          } else {
            providerId = String(profile.id || '');
            photo = String(profile.avatar_url || '').slice(0, 1000);
            if (!email) {
              const emailsResponse = await fetch(provider.emails, {
                headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'User-Agent': 'Zoleva-Calmedcatl' },
                signal: AbortSignal.timeout(15000),
              });
              const emails = emailsResponse.ok ? await emailsResponse.json().catch(() => []) : [];
              const chosen = emails.find((item) => item.primary && item.verified) || emails.find((item) => item.verified) || emails[0];
              email = String(chosen?.email || '').toLowerCase();
            }
          }

          const accounts = await readAccounts(ACCOUNTS_FILE);
          const matched = findOrCreateOAuthUser(accounts, { provider: provider.id, providerId, email, name, photo });
          await writeAccounts(ACCOUNTS_FILE, inheritGlobalCloud(matched.accounts, matched.user, config));
          return send(res, 302, '', 'text/plain; charset=utf-8', {
            Location: `${origin}/?auth=ok#/app/cuenta`,
            'Set-Cookie': [clearCookieString(req, OAUTH_COOKIE), sessionHeader(req, matched.user, config)],
          });
        } catch (error) {
          return authRedirect(res, origin, 'error', error.message);
        }
      }

      if (path === '/api/models' && req.method === 'GET') {
        const id = String(url.searchParams.get('provider') || config.provider);
        return json(res, 200, { models: await modelsFor(id, config), default: defaultModel(id) });
      }

      if (path === '/api/chat' && req.method === 'POST') {
        const body = await readBody(req);
        const messages = sanitizeMessages(body.messages);
        if (!messages.length) return json(res, 400, { error: 'No hay mensajes' });
        const provider = String(body.provider || config.provider);
        const model = String(body.model || config.model || '');
        const payload = {
          messages,
          mode: ['socratic', 'solve', 'tutor', 'explain', 'didactic', 'calm', 'play'].includes(body.mode) ? body.mode : config.chatMode,
          material: String(body.material || '').slice(0, 60000),
          level: String(body.level || config.level || 'bachillerato').slice(0, 60),
          role: body.role === 'teacher' ? 'teacher' : 'student',
          age: (Number(body.age) || 0) > 0 ? Math.max(3, Math.min(99, Number(body.age))) : 0,
          style: ['visual', 'auditivo', 'kinestesico', 'lector', 'mixto'].includes(body.style) ? body.style : 'mixto',
          tone: ['amable', 'jugueton', 'serio'].includes(body.tone) ? body.tone : 'amable',
          calm: Boolean(body.calm),
        };
        const finalMessages = buildChatMessages(payload);
        // Conserva las imágenes adjuntas del último mensaje del usuario.
        const lastOriginal = [...messages].reverse().find((m) => m.role === 'user');
        if (lastOriginal?.images?.length) {
          const lastBuilt = [...finalMessages].reverse().find((m) => m.role === 'user');
          lastBuilt.images = lastOriginal.images;
        }
        const text = await chat({ provider, config: { ...config, chatMode: payload.mode }, messages: finalMessages, model });
        return json(res, 200, { text: String(text || ''), provider, model: model || defaultModel(provider) });
      }

      if (path === '/api/generate' && req.method === 'POST') {
        return generate(res, await readBody(req), config);
      }

      if (path === '/api/test' && req.method === 'POST') {
        const body = await readBody(req);
        const provider = String(body.provider || config.provider);
        const model = String(body.model || config.model || '');
        try {
          const text = await chat({
            provider,
            config,
            model,
            messages: [
              { role: 'system', content: 'Responde exactamente: OK' },
              { role: 'user', content: 'Prueba de conexión. Responde OK.' },
            ],
          });
          return json(res, 200, { ok: true, text: String(text || '').slice(0, 400) });
        } catch (error) {
          return json(res, 200, { ok: false, error: error.message });
        }
      }

      return json(res, 404, { error: 'Ruta API no encontrada' });
    }

    const requested = path === '/' ? '/index.html' : path;
    const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, '');
    const file = join(PUBLIC, safePath);
    if (!file.startsWith(PUBLIC)) return send(res, 403, 'Prohibido', 'text/plain; charset=utf-8');
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error('No es un archivo');
      const content = await readFile(file);
      return send(res, 200, content, MIME[extname(file)] || 'application/octet-stream');
    } catch {
      const fallback = await readFile(join(PUBLIC, 'index.html'), 'utf8');
      return send(res, 200, fallback, MIME['.html']);
    }
  } catch (error) {
    console.error('[estudio-libre]', error);
    return json(res, error.message.includes('demasiado') ? 413 : 500, { error: error.message || 'Error interno' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  ◈ Zoleva Calmécatl listo en http://${HOST}:${PORT}`);
  console.log('  Pulsa Ctrl+C para detener.\n');
});
