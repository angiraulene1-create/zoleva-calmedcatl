import http from 'node:http';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVIDERS, chat, modelsFor, defaultModel, isCli, cliBinary, cliWorks } from './src/providers.js';
import { buildGenerateMessages, buildChatMessages, normalizeGenerated } from './src/prompts.js';
import { demoGenerate } from './src/demo.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const DATA = join(ROOT, '.data');
const CONFIG_FILE = join(DATA, 'config.json');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY = 24 * 1024 * 1024;

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
  };
}

async function readConfig() {
  try {
    const stored = JSON.parse(await readFile(CONFIG_FILE, 'utf8'));
    const base = defaultConfig();
    return {
      ...base,
      ...stored,
      apiKeys: { ...base.apiKeys, ...(stored.apiKeys || {}) },
      endpoints: { ...base.endpoints, ...(stored.endpoints || {}) },
      cli: { ...base.cli, ...(stored.cli || {}) },
      cloud: { ...base.cloud, ...(stored.cloud || {}) },
    };
  } catch {
    return defaultConfig();
  }
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
        for (const [name, value] of Object.entries(safe.apiKeys)) {
          safe.apiKeys[name] = value ? '••••••••' : '';
        }
        safe.cloud = {
          ...safe.cloud,
          token: safe.cloud.token ? '••••••••' : '',
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
        if (typeof body.cloud?.url === 'string') next.cloud.url = body.cloud.url.trim().slice(0, 500);
        if (typeof body.cloud?.token === 'string' && body.cloud.token && !body.cloud.token.startsWith('••')) {
          next.cloud.token = body.cloud.token.trim().slice(0, 500);
        }
        if (body.cloud?.token === '') next.cloud.token = '';
        if (next.cloud.url) {
          try {
            const parsed = new URL(next.cloud.url);
            if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocolo');
          } catch {
            return json(res, 400, { error: 'La URL de la nube debe empezar con http:// o https://' });
          }
        }
        if (!PROVIDERS.some((p) => p.id === next.provider)) return json(res, 400, { error: 'Proveedor no válido' });
        await writeConfig(next);
        return json(res, 200, { ok: true });
      }

      if (path === '/api/cloud/push' && req.method === 'POST') {
        const body = await readBody(req);
        if (!body.data || typeof body.data !== 'object') return json(res, 400, { error: 'No hay datos para subir.' });
        const raw = JSON.stringify(body.data);
        const bytes = Buffer.byteLength(raw);
        if (bytes > 4 * 1024 * 1024) return json(res, 413, { error: 'El respaldo supera 4 MB. Quita fotos o conversaciones antiguas.' });
        const response = await cloudRequest(config, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: raw,
        });
        if (!response.ok) throw new Error(`La nube respondió ${response.status}: ${(await response.text()).slice(0, 200)}`);
        return json(res, 200, { ok: true, bytes, at: new Date().toISOString() });
      }

      if (path === '/api/cloud/pull' && req.method === 'POST') {
        const response = await cloudRequest(config);
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
