// Capa de proveedores: misma interfaz para IA local, APIs gratuitas y CLIs.
// chat({ messages, model, config }) -> string

import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { demoChat } from './demo.js';

const TIMEOUT = Number(process.env.AI_TIMEOUT_MS || 180000);

const DEFAULT_MODELS = {
  ollama: 'llama3.2',
  'openai-compatible': 'local-model',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.3-70b-versatile',
  'cli-opencode': 'opencode/big-pickle',
  'cli-codex': '',
  'cli-claude': '',
  'cli-gemini': '',
  'cli-custom': '',
};

export const PROVIDERS = [
  { id: 'demo', name: 'Demo sin IA', kind: 'demo', free: true, note: 'Funciona sin instalar nada' },
  { id: 'ollama', name: 'Ollama (local)', kind: 'local', free: true, note: 'Offline, sin clave' },
  { id: 'openai-compatible', name: 'LM Studio / llama.cpp / local', kind: 'local', free: true, note: 'Endpoint OpenAI-compatible' },
  { id: 'openrouter', name: 'OpenRouter (modelos :free)', kind: 'api', free: true, note: 'Clave gratuita' },
  { id: 'gemini', name: 'Google Gemini', kind: 'api', free: true, note: 'Capa gratuita' },
  { id: 'groq', name: 'Groq', kind: 'api', free: true, note: 'Capa gratuita' },
  { id: 'cli-opencode', name: 'OpenCode CLI', kind: 'cli', free: true, note: 'Reutiliza tu sesión' },
  { id: 'cli-codex', name: 'Codex CLI', kind: 'cli', free: true, note: 'Reutiliza tu sesión' },
  { id: 'cli-claude', name: 'Claude CLI', kind: 'cli', free: false, note: 'Requiere suscripción' },
  { id: 'cli-gemini', name: 'Gemini CLI', kind: 'cli', free: true, note: 'Reutiliza tu sesión' },
  { id: 'cli-custom', name: 'Otro comando CLI', kind: 'cli', free: true, note: 'Cualquier CLI con {prompt}' },
];

function keyOf(config, name) {
  return String(config?.apiKeys?.[name] || process.env[`${name.toUpperCase()}_API_KEY`] || '').trim();
}

async function http(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.text();
    if (!response.ok) throw new Error(`${response.status}: ${body.slice(0, 400)}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function jsonHttp(url, options) {
  return http(url, options).then((text) => JSON.parse(text));
}

function ollamaMessages(messages) {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.images?.length
      ? { images: m.images.map((image) => String(image.base64 || '').replace(/^data:[^;]+;base64,/, '')) }
      : {}),
  }));
}

function openAiMessages(messages) {
  return messages.map((m) => {
    if (!m.images?.length) return { role: m.role, content: m.content };
    return {
      role: m.role,
      content: [
        { type: 'text', text: m.content },
        ...m.images.map((i) => ({
          type: 'image_url',
          image_url: { url: i.base64 || '' },
        })),
      ],
    };
  });
}

function geminiContents(messages) {
  const merged = [];
  for (const message of messages) {
    if (message.role === 'system') continue;
    const role = message.role === 'assistant' ? 'model' : 'user';
    const parts = [{ text: message.content }];
    for (const image of message.images || []) {
      parts.push({
        inline_data: {
          mime_type: image.mime || 'image/png',
          data: String(image.base64 || '').replace(/^data:[^;]+;base64,/, ''),
        },
      });
    }
    if (merged.length && merged[merged.length - 1].role === role) {
      merged[merged.length - 1].parts.push(...parts);
    } else {
      merged.push({ role, parts });
    }
  }
  if (!merged.length || merged[merged.length - 1].role !== 'user') {
    merged.push({ role: 'user', parts: [{ text: 'Continúa.' }] });
  }
  return merged;
}

async function openAiCompatible(config, model, messages, baseUrl, apiKey, extraHeaders = {}) {
  const url = `${String(baseUrl).replace(/\/$/, '')}/chat/completions`;
  const data = await jsonHttp(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...extraHeaders,
    },
    body: JSON.stringify({ model, messages: openAiMessages(messages), temperature: 0.6 }),
  });
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('El proveedor no devolvió texto');
  return typeof text === 'string' ? text : JSON.stringify(text);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...(options.env || {}) },
      cwd: options.cwd || process.cwd(),
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Tiempo de espera agotado (${TIMEOUT / 1000}s) en ${command}`));
    }, TIMEOUT);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`No se pudo ejecutar ${command}: ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} salió con código ${code}: ${(stderr || stdout).slice(-500)}`));
    });
    if (options.input) child.stdin.write(options.input);
    child.stdin.end();
  });
}

function extractText(value, depth = 0) {
  if (typeof value === 'string') return value;
  if (!value || depth > 5) return '';
  if (Array.isArray(value)) return value.map((v) => extractText(v, depth + 1)).filter(Boolean).join('\n');
  const keys = ['result', 'text', 'content', 'response', 'message', 'output', 'final'];
  for (const key of keys) if (typeof value[key] === 'string') return value[key];
  for (const key of [...keys, 'part', 'parts', 'message']) {
    if (value[key]) {
      const found = extractText(value[key], depth + 1);
      if (found) return found;
    }
  }
  return '';
}

function parseCliOutput(raw) {
  const out = raw.trim();
  if (!out) throw new Error('El CLI no devolvió salida');
  try {
    const value = JSON.parse(out);
    const text = extractText(value);
    if (text) return text;
  } catch { /* salida no JSON */ }
  const parsed = out.split(/\r?\n/).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
  if (parsed.length) {
    for (const value of parsed) {
      if (value.type === 'text' && typeof value.part?.text === 'string') return value.part.text;
      if (value.part?.type === 'text' && typeof value.part.text === 'string') return value.part.text;
      if (value.type === 'item.completed' && value.item?.type === 'agent_message' && value.item.text) return value.item.text;
      if (value.type === 'result' && typeof value.result === 'string') return value.result;
      if (value.type === 'assistant' && typeof value.message?.content === 'string') return value.message.content;
    }
    const text = parsed
      .filter((value) => ['text', 'result', 'assistant', 'item.completed'].includes(value.type))
      .map(extractText)
      .filter(Boolean)
      .join('\n');
    if (text) return text;
  }
  return out;
}

function flatten(messages, images) {
  const parts = messages.map((m) => `${m.role === 'assistant' ? 'Tutor:' : m.role === 'system' ? 'Instrucciones:' : 'Estudiante:'} ${m.content}`);
  if (images?.length) parts.push(`El estudiante ha adjuntado ${images.length} imagen(es) en: ${images.map((i) => i.path).join(', ')}. Léelas antes de responder.`);
  return parts.join('\n\n');
}

async function cliChat(id, config, model, messages) {
  const images = [];
  let dir = null;
  const imageMessages = messages.flatMap((m) => m.images || []);
  try {
    if (imageMessages.length) {
      dir = await mkdtemp(join(tmpdir(), 'estudio-libre-'));
      for (const [index, image] of imageMessages.entries()) {
        const path = join(dir, `imagen-${index + 1}.png`);
        const data = String(image.base64 || '').replace(/^data:[^;]+;base64,/, '');
        await writeFile(path, Buffer.from(data, 'base64'));
        images.push({ path });
      }
    }
    const prompt = flatten(messages, images);
    let command;
    let args;
    switch (id) {
      case 'cli-opencode':
        command = 'opencode';
        args = ['run', '--format', 'json', '--title', 'Zoleva Calmécatl'];
        if (model) args.push('--model', model);
        for (const image of images) args.push('--file', image.path);
        args.push(prompt);
        break;
      case 'cli-claude':
        command = 'claude';
        args = ['-p', prompt, '--output-format', 'json'];
        if (model) args.push('--model', model);
        break;
      case 'cli-codex':
        command = 'codex';
        args = ['exec', '--skip-git-repo-check', '--json'];
        if (model) args.push('--model', model);
        for (const image of images) args.push('--image', image.path);
        args.push(prompt);
        break;
      case 'cli-gemini':
        command = 'gemini';
        args = ['-p', prompt, '--output-format', 'json'];
        if (model) args.push('--model', model);
        break;
      case 'cli-custom': {
        const template = String(config?.cli?.customCommand || '').trim();
        if (!template) throw new Error('Configura un comando en Ajustes, por ejemplo: mi-ia "{prompt}"');
        if (!template.includes('{prompt}')) {
          command = 'sh';
          args = ['-c', template];
          return parseCliOutput(await runCommand(command, args, { input: `${prompt}\n` }));
        }
        const quoted = `'${prompt.replace(/'/g, `'\\''`)}'`;
        command = 'sh';
        args = ['-c', template.replace('{prompt}', quoted)];
        break;
      }
      default:
        throw new Error(`CLI desconocido: ${id}`);
    }
    return parseCliOutput(await runCommand(command, args));
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function modelsFor(id, config) {
  try {
    switch (id) {
      case 'ollama': {
        const base = String(config?.endpoints?.ollama || 'http://127.0.0.1:11434').replace(/\/$/, '');
        const data = await jsonHttp(`${base}/api/tags`, {}, 3000);
        return (data.models || []).map((m) => m.name);
      }
      case 'openai-compatible': {
        const base = String(config?.endpoints?.openaiCompatible || 'http://127.0.0.1:1234/v1').replace(/\/$/, '');
        const data = await jsonHttp(`${base}/models`, {}, 3000);
        return (data.data || []).map((m) => m.id);
      }
      case 'openrouter': {
        const key = keyOf(config, 'openrouter');
        if (!key) return [];
        const data = await jsonHttp('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        }, 8000);
        return (data.data || []).filter((m) => String(m.id).endsWith(':free')).map((m) => m.id).slice(0, 40);
      }
      case 'gemini': {
        const key = keyOf(config, 'gemini');
        if (!key) return [];
        const data = await jsonHttp(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, {}, 8000);
        return (data.models || [])
          .filter((m) => String(m.name).includes('flash') && (m.supportedGenerationMethods || []).includes('generateContent'))
          .map((m) => String(m.name).replace(/^models\//, ''))
          .slice(0, 20);
      }
      case 'groq': {
        const key = keyOf(config, 'groq');
        if (!key) return [];
        const data = await jsonHttp('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        }, 8000);
        return (data.data || []).map((m) => m.id).slice(0, 30);
      }
      default:
        return [];
    }
  } catch {
    return [];
  }
}

export function defaultModel(id) {
  return DEFAULT_MODELS[id] || '';
}

export function isCli(id) {
  return String(id).startsWith('cli-');
}

export function cliBinary(id) {
  return ({ 'cli-opencode': 'opencode', 'cli-claude': 'claude', 'cli-codex': 'codex', 'cli-gemini': 'gemini', 'cli-custom': null })[id];
}

export function commandExists(command) {
  if (!command) return false;
  const result = spawnSync('sh', ['-c', `command -v ${command}`], { encoding: 'utf8' });
  return result.status === 0 && Boolean(result.stdout.trim());
}

/** Comprueba que el CLI no solo esté en el PATH, sino que pueda ejecutarse. */
export function cliWorks(id) {
  const binary = cliBinary(id);
  if (!binary) return false;
  const result = spawnSync(binary, ['--version'], { encoding: 'utf8', timeout: 2000, stdio: 'ignore' });
  return result.status === 0;
}

export async function chat({ provider, config, messages, model }) {
  const resolvedModel = model || defaultModel(provider);
  switch (provider) {
    case 'demo':
      return demoChat(messages, config?.chatMode || 'tutor');

    case 'ollama': {
      const base = String(config?.endpoints?.ollama || 'http://127.0.0.1:11434').replace(/\/$/, '');
      const data = await jsonHttp(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: resolvedModel, messages: ollamaMessages(messages), stream: false, options: { temperature: 0.6 } }),
      }, TIMEOUT);
      return data?.message?.content || '';
    }

    case 'openai-compatible':
      return openAiCompatible(
        config,
        resolvedModel,
        messages,
        String(config?.endpoints?.openaiCompatible || 'http://127.0.0.1:1234/v1'),
        keyOf(config, 'openai'),
      );

    case 'openrouter':
      return openAiCompatible(config, resolvedModel, messages, 'https://openrouter.ai/api/v1', keyOf(config, 'openrouter'), {
        'HTTP-Referer': 'https://zoleva-calmedcatl.local',
        'X-Title': 'Zoleva Calmécatl',
      });

    case 'groq':
      return openAiCompatible(config, resolvedModel, messages, 'https://api.groq.com/openai/v1', keyOf(config, 'groq'));

    case 'gemini': {
      const key = keyOf(config, 'gemini');
      if (!key) throw new Error('Falta la clave de Gemini');
      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
      const data = await jsonHttp(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(resolvedModel)}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
            contents: geminiContents(messages),
            generationConfig: { temperature: 0.6 },
          }),
        },
        TIMEOUT,
      );
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
      if (!text) throw new Error('Gemini no devolvió texto');
      return text;
    }

    default:
      if (isCli(provider)) return cliChat(provider, config, model, messages);
      throw new Error(`Proveedor desconocido: ${provider}`);
  }
}
