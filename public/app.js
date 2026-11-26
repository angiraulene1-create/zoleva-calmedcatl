// Zoleva · aplicación web PWA. Sin frameworks, sin build, sin dependencias.
const STORAGE_KEY = 'estudio-libre-v1';
const $ = (selector) => document.querySelector(selector);
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (text) => esc(text)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/^#{1,3}\s*(.+)$/gm, '<strong>$1</strong>')
  .replace(/\n/g, '<br />');

const NAV = [
  { id: 'home', icon: '◈', label: 'Inicio' },
  { id: 'tutor', icon: '💬', label: 'Tutor IA' },
  { id: 'plan', icon: '🗺️', label: 'Plan de estudio' },
  { id: 'cards', icon: '🧠', label: 'Tarjetas' },
  { id: 'quiz', icon: '✅', label: 'Cuestionario' },
  { id: 'exam', icon: '📝', label: 'Simulacro' },
  { id: 'materials', icon: '📚', label: 'Materiales' },
  { id: 'progress', icon: '📈', label: 'Progreso' },
  { id: 'settings', icon: '⚙️', label: 'Ajustes' },
];
const TITLES = {
  home: ['Tu espacio de estudio', 'Sigue el plan, pregunta lo que no entiendas y mide tu progreso.'],
  tutor: ['Tutor IA', 'Te guía paso a paso usando tus propios apuntes.'],
  plan: ['Plan de estudio', 'De tus materiales a un camino claro hasta el examen.'],
  cards: ['Tarjetas de memoria', 'Repetición espaciada: vuelven cuando estás a punto de olvidarlas.'],
  quiz: ['Cuestionario', 'Comprueba lo que sabes y repasa los errores.'],
  exam: ['Simulacro', 'Practica como si fuera el examen real.'],
  materials: ['Materiales', 'Tus apuntes son la fuente de todo lo que genera la IA.'],
  progress: ['Progreso', 'Constancia, dominio de temas y resultados.'],
  settings: ['Ajustes', 'Elige tu IA: local, gratuita o un CLI que ya tengas instalado.'],
};

function freshState() {
  return {
    courses: [],
    activeCourse: null,
    chat: [],
    chatMode: 'socratic',
    useMaterial: true,
    srs: {},
    stats: { minutes: {}, quizResults: [] },
    ui: { busy: false, toast: null, draft: '', images: [], cardSession: null, quiz: null, exam: null, models: [], sample: false },
  };
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!stored || !Array.isArray(stored.courses)) return freshState();
    const base = freshState();
    return {
      ...base,
      ...stored,
      stats: { ...base.stats, ...(stored.stats || {}) },
      ui: { ...base.ui, toast: null, busy: false },
    };
  } catch {
    return freshState();
  }
}

let state = loadState();
let config = null;
let status = null;

function save() {
  const copy = { ...state, ui: { ...state.ui, images: [], toast: null, busy: false, draft: '' } };
  copy.chat = state.chat.map((m) => ({ ...m, images: [] }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
  } catch {
    state.ui.toast = { text: 'No se pudo guardar en el navegador (almacenamiento lleno).', error: true };
  }
}

function toast(text, error = false) {
  state.ui.toast = { text, error };
  render();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
}

function route() {
  const hash = location.hash || '';
  if (!hash.startsWith('#/')) return { app: false, view: 'home' };
  const parts = hash.replace(/^#\//, '').split('/').filter(Boolean);
  if (parts[0] !== 'app') return { app: false, view: 'home' };
  const view = parts[1] || 'home';
  return { app: true, view: NAV.some((n) => n.id === view) ? view : 'home' };
}

function course() {
  return state.courses.find((c) => c.id === state.activeCourse) || state.courses[0] || null;
}

function materialText(c = course()) {
  return c?.materials?.map((m) => m.text || '').filter(Boolean).join('\n\n').slice(0, 60000) || '';
}

function materialImages(c = course()) {
  return c?.materials?.flatMap((m) => m.images || []) || [];
}

function dueCards() {
  const now = Date.now();
  return Object.values(course()?.flashcards || []).filter((card) => {
    const s = state.srs[card.id];
    return !s || s.due <= now;
  }).length;
}

function streak() {
  const days = Object.entries(state.stats.minutes).filter(([, m]) => m > 0).map(([d]) => d).sort().reverse();
  if (!days.length) return 0;
  let count = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.includes(key)) count++;
    else if (i > 0 || days[0] !== key) break;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function daysUntil(date) {
  if (!date) return null;
  const diff = Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86400000);
  return Number.isFinite(diff) ? diff : null;
}

/* ------------------------- Landing ------------------------- */
function landing() {
  return `<div class="landing">
    <nav class="nav container">
      <a class="brand" href="#/"><span class="brand-mark">◈</span><span class="brand-name">Zoleva Calmécatl</span></a>
      <div class="nav-links"><a href="#origen">Origen</a><a href="#caracteristicas">Funciones</a><a href="#como-funciona">Cómo funciona</a><a href="#ia">Tu IA</a><a href="#faq">Preguntas</a></div>
      <a class="btn primary small" href="#/app">Entrar gratis →</a>
    </nav>

    <header class="hero container"><div class="hero-grid">
      <div>
        <span class="badge">◈ Del náhuatl: escuela de élite mexica · código abierto</span>
        <h1>La escuela de élite mexica, <span class="gradient-text">gratis y en tu bolsillo.</span></h1>
        <p class="lead"><strong>Zoleva Calmécatl</strong> convierte tus apuntes en un plan de examen, lecciones, tarjetas, cuestionarios y simulacros. Funciona con IA local, proveedores gratuitos o los CLIs que ya usas. Sin cuenta, sin pago y sin anuncios.</p>
        <div class="actions"><a class="btn primary" href="#/app">Entrar a la escuela →</a><a class="btn ghost" href="#origen">Conoce el nombre</a></div>
        <div class="chips"><span class="chip">◈ Offline con Ollama</span><span class="chip">◈ OpenRouter :free</span><span class="chip">◈ Gemini / Groq</span><span class="chip">◈ opencode / codex / claude</span></div>
        <div class="greca" aria-hidden="true"></div>
      </div>
      <div class="mock" aria-hidden="true">
        <div class="mock-header"><div class="mock-dots"><i></i><i></i><i></i></div> zoleva · tutor</div>
        <div class="mock-card">
          <h3>¿Por qué es negativo el coseno en el tercer cuadrante?</h3>
          <div class="bubble user">No lo entiendo, ¿me das una pista?</div>
          <div class="bubble ai">Antes de responder: ¿en qué cuadrante es positiva la abscisa? Piénsalo con el círculo unitario…</div>
          <div class="bubble user">En el cuarto, ¿verdad?</div>
          <div class="bubble ai">¡Casi! En el cuarto. En el tercero, x e y son negativas. ¿Qué signo tiene x/r?</div>
        </div>
        <div class="mock-card mock-flash"><div><h3 style="margin-bottom:4px">Tarjetas de hoy</h3><div class="muted small">8 pendientes · repetición espaciada</div></div><div class="progress-ring"><span>72%</span></div></div>
        <div class="mock-card"><h3>Próximo examen · 12 días</h3><div class="bar"><i style="width:64%"></i></div><div class="muted tiny" style="margin-top:8px">Tema 4 de 7 · dominio 64 %</div></div>
      </div>
    </div></header>

    <section class="block container" id="origen">
      <div class="card origen"><div><span class="eyebrow">El nombre</span><h2 style="margin:10px 0">Zoleva Calmécatl</h2><p>Del náhuatl, <strong>escuela de élite mexica</strong>. El calmecac era el lugar donde se formaban los jóvenes de la nobleza: disciplina, memoria, lectura del cielo y dominio de las artes. Aquí recuperamos esa idea —aprender con rigor y sin excusas— y la ponemos al alcance de cualquiera, gratis y con la IA que tú elijas.</p></div><div class="origen-sello" aria-hidden="true">◈</div></div>
    </section>

    <section class="block container" id="como-funciona">
      <div class="section-head"><span class="eyebrow">Cómo funciona</span><h2>De un montón de apuntes a un plan que puedes seguir</h2><p>Tú aportas el material. Zoleva Calmécatl lo convierte en pasos pequeños, práctica real y un tutor que te espera cuando te atascas.</p></div>
      <div class="grid cols-4">
        <div class="card"><div class="step-num">01</div><h3>Pon la fecha</h3><p>Dime qué asignatura tienes y cuándo es el examen. El plan se adapta al tiempo que queda.</p></div>
        <div class="card"><div class="step-num">02</div><h3>Aporta tu material</h3><p>Apuntes, texto, fotos de ejercicios o lo que tengas. Solo se usa lo que subes.</p></div>
        <div class="card"><div class="step-num">03</div><h3>Estudia paso a paso</h3><p>Lecciones con ejemplos, tarjetas, preguntas y simulacros generados a partir de tu material.</p></div>
        <div class="card"><div class="step-num">04</div><h3>Pregunta sin parar</h3><p>El tutor te da pistas, no respuestas. Tú decides cuándo usar la IA local o la de la nube.</p></div>
      </div>
    </section>

    <section class="block container" id="caracteristicas">
      <div class="section-head"><span class="eyebrow">Funciones</span><h2>Disciplina, repetición y dominio</h2><p>Como en el calmecac, pero sin puertas cerradas: gratis, de código abierto y con tus datos guardados en tu dispositivo.</p></div>
      <div class="grid cols-3">
        <div class="card"><div class="icon">🗺️</div><h3>Plan hasta el examen</h3><p>Temas priorizados y repartidos según los días que tengas. Siempre sabes qué toca después.</p></div>
        <div class="card"><div class="icon">💬</div><h3>Tutor socrático</h3><p>Preguntas, pistas y comprobación de comprensión. También puede resolver paso a paso si lo pides.</p></div>
        <div class="card"><div class="icon">🧠</div><h3>Tarjetas inteligentes</h3><p>Repetición espaciada: las difíciles vuelven antes y las que dominas se espacian.</p></div>
        <div class="card"><div class="icon">✅</div><h3>Cuestionarios corregidos</h3><p>Preguntas con explicación para que sepas exactamente dónde fallaste.</p></div>
        <div class="card"><div class="icon">📝</div><h3>Simulacros con tiempo</h3><p>Preguntas objetivas y desarrolladas, con rúbrica y resultados por tema.</p></div>
        <div class="card"><div class="icon">📷</div><h3>Fotos de ejercicios</h3><p>Adjunta una imagen al tutor y que te guíe paso a paso con proveedores con visión.</p></div>
      </div>
    </section>

    <section class="block container" id="ia">
      <div class="section-head"><span class="eyebrow">Tu IA, tus reglas</span><h2>Cámbiala cuando quieras. Incluso sin internet.</h2><p>Elige un proveedor en Ajustes. Si uno falla, Zoleva Calmécatl sigue funcionando con el modo demo.</p></div>
      <div class="provider-strip">
        <span>🦙 Ollama / llama.cpp / LM Studio</span><span>🌐 OpenRouter (modelos :free)</span><span>◈ Google Gemini</span>
        <span>⚡ Groq</span><span>🖥️ opencode</span><span>🖥️ Codex CLI</span><span>🖥️ Claude CLI</span><span>🖥️ Gemini CLI</span><span>⌨️ Tu comando personalizado</span>
      </div>
      <div class="card" style="margin-top:20px"><h3>Sin proveedor también funciona</h3><p>El modo demo genera planes, tarjetas y preguntas de ejemplo a partir de tu texto, sin red y sin claves. Es ideal para probar la app antes de configurar nada.</p></div>
    </section>

    <section class="cta-band container"><div class="cta-inner"><div class="greca" aria-hidden="true" style="margin:0 auto 18px"></div><h2>Entra al calmecac. Cuesta cero.</h2><p>Sin tarjeta, sin cuenta, sin anuncios. Solo tú, tus apuntes y la IA que decidas usar.</p><div class="actions" style="justify-content:center"><a class="btn primary" href="#/app">Abrir Zoleva Calmécatl →</a><a class="btn ghost" href="#ia">Qué IA puedo usar</a></div></div></section>

    <section class="block container" id="faq">
      <div class="section-head"><span class="eyebrow">Preguntas frecuentes</span><h2>Lo que probablemente te preguntes</h2></div>
      <details class="faq"><summary>¿Qué significa Zoleva Calmécatl?</summary><p>Es náhuatl: «escuela de élite mexica». El calmecac formaba a la élite con disciplina, memoria y conocimiento. Tomamos esa herencia como idea de estudio riguroso, pero abierta a todo el mundo y sin coste.</p></details>
      <details class="faq"><summary>¿Es realmente gratis?</summary><p>Sí. El código es MIT y no hay suscripción. La IA local es gratuita; los proveedores en nube tienen capas gratuitas o usan la clave/CLI que tú ya tienes.</p></details>
      <details class="faq"><summary>¿Necesito saber programar?</summary><p>No. Solo abre la página web. Si quieres IA local, instala Ollama y descarga un modelo; en Ajustes puedes pegar la dirección y el nombre del modelo.</p></details>
      <details class="faq"><summary>¿Adónde van mis apuntes?</summary><p>A tu navegador y, si usas IA en la nube, al proveedor que elijas. No hay cuentas, telemetría ni servidores centrales: todo se guarda en tu equipo.</p></details>
      <details class="faq"><summary>¿Funciona en móvil?</summary><p>Sí. Es una PWA: ábrela en el navegador y añádela a la pantalla de inicio. En el mismo WiFi de tu ordenador puedes usar el modelo local.</p></details>
    </section>

    <footer class="footer container"><span>◈ Zoleva Calmécatl · escuela de élite mexica · código abierto</span><span>Hecho para aprender de verdad · MIT License</span></footer>
  </div>`;
}

/* ------------------------- App shell ------------------------- */
function appShell(view) {
  const [title, subtitle] = TITLES[view];
  const active = status?.providers?.find((p) => p.id === status.active);
  const ready = active?.ready;
  return `<div class="app">
    <aside class="sidebar">
      <a class="brand" href="#/"><span class="brand-mark">◈</span><span class="brand-name">Zoleva</span></a>
      <nav>${NAV.map((item) => `<a class="nav-item ${view === item.id ? 'active' : ''}" href="#/app/${item.id}"><span class="ic">${item.icon}</span>${item.label}</a>`).join('')}</nav>
      <div class="sidebar-foot">
        <div class="status-pill"><span class="dot ${ready ? 'ok' : 'bad'}"></span><div><strong>${esc(active?.name || 'Cargando…')}</strong><br /><span class="tiny">${esc(status?.model || '')}</span></div></div>
        <a class="nav-item" href="#/app/settings"><span class="ic">⚙️</span>${ready ? 'IA conectada' : 'Configurar IA'}</a>
        <a class="nav-item" href="#/"><span class="ic">←</span>Página de inicio</a>
      </div>
    </aside>
    <main class="main">
      <header class="topbar"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>
        <div class="right"><span class="pill">${esc(active?.name || 'IA')}</span>${state.ui.busy ? '<span class="spinner"></span>' : ''}</div>
      </header>
      <nav class="mobile-nav">${NAV.map((item) => `<a class="tab ${view === item.id ? 'active' : ''}" href="#/app/${item.id}">${item.icon} ${item.label}</a>`).join('')}</nav>
      <div id="content">${views[view] ? views[view]() : views.home()}</div>
    </main>
    ${state.ui.toast ? `<div class="toast ${state.ui.toast.error ? 'error' : ''}" data-action="close-toast">${esc(state.ui.toast.text)}</div>` : ''}
  </div>`;
}

/* ------------------------- Vistas ------------------------- */
const views = {};

views.home = () => {
  const c = course();
  if (!c) {
    return `<div class="panel empty"><div style="font-size:44px">◈</div><h3>Empecemos con tu primer examen</h3>
      <p>Crea un plan a partir de tus apuntes. Sin cuenta y sin pagar.</p><div class="actions" style="justify-content:center;margin-top:18px"><a class="btn primary" href="#/app/plan">Crear mi plan →</a><a class="btn ghost" href="#/app/tutor">Hablar con el tutor</a></div></div>`;
  }
  const left = daysUntil(c.examDate);
  const done = c.plan?.topics?.filter((t) => t.status === 'done').length || 0;
  const total = c.plan?.topics?.length || 0;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const next = c.plan?.topics?.find((t) => t.status !== 'done');
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { day: d, key: d.toISOString().slice(0, 10) };
  });
  return `<div class="stack">
    <div class="panel">
      <div class="row between"><div><span class="eyebrow">Tu examen</span><h2 style="margin:8px 0 4px">${esc(c.title || c.subject || 'Mi examen')}</h2><div class="muted small">${esc(c.subject || '')} · nivel ${esc(config?.level || 'bachillerato')}</div></div>
        ${left !== null ? `<div class="center"><div style="font-family:'Space Grotesk';font-size:34px">${left >= 0 ? left : '—'}</div><div class="muted tiny">días restantes</div></div>` : ''}</div>
      <div class="bar" style="margin-top:18px"><i style="width:${percent}%"></i></div>
      <div class="row between tiny muted" style="margin-top:8px"><span>${done} de ${total} temas dominados</span><span>${percent} % del plan</span></div>
    </div>
    <div class="grid cols-3-app">
      <div class="stat"><div class="value">${streak()} 🔥</div><div class="label">días de racha</div></div>
      <div class="stat"><div class="value">${dueCards()}</div><div class="label">tarjetas para repasar</div></div>
      <div class="stat"><div class="value">${state.stats.minutes[new Date().toISOString().slice(0, 10)] || 0} min</div><div class="label">estudiados hoy</div></div>
    </div>
    <div class="grid cols-2">
      <div class="panel"><div class="panel-title"><h2>Qué toca ahora</h2><a class="btn small" href="#/app/plan">Ver plan</a></div>
        ${next ? `<div class="topic"><div><h4>${esc(next.title)}</h4><p>${esc(next.description || 'Repasa este tema y haz un ejercicio.')}</p></div><span class="pill ${next.priority}">${esc(next.priority)}</span></div>` : '<p class="muted">¡Plan completo! Haz un simulacro para comprobarlo.</p>'}
        <div class="row" style="margin-top:14px"><a class="btn primary small" href="#/app/tutor">Preguntar al tutor</a><a class="btn small" href="#/app/cards">Repasar tarjetas</a></div>
      </div>
      <div class="panel"><div class="panel-title"><h2>Tu semana</h2><span class="muted small">minutos por día</span></div>
        <div class="chart">${last7.map(({ day, key }) => `<div class="col"><i style="height:${Math.max(3, Math.min(100, (state.stats.minutes[key] || 0) * 2))}%"></i><span>${day.toLocaleDateString('es', { weekday: 'short' }).slice(0, 2)}</span></div>`).join('')}</div>
      </div>
    </div>
  </div>`;
};

views.plan = () => {
  const c = course();
  if (!c) return planForm();
  const topics = c.plan?.topics || [];
  const done = topics.filter((t) => t.status === 'done').length;
  return `<div class="stack">
    <div class="panel"><div class="panel-title"><div><h2>${esc(c.title || c.subject)}</h2><div class="muted small">${esc(c.examDate || 'Sin fecha')} · ${topics.length} temas · ${done} completados</div></div>
      <div class="row"><a class="btn small" href="#/app/materials">Materiales</a><button class="btn small" data-action="new-course">Nuevo plan</button></div></div>
      ${c.plan?.summary ? `<p class="muted" style="line-height:1.6">${esc(c.plan.summary)}</p>` : ''}
      <div class="bar"><i style="width:${topics.length ? Math.round(done / topics.length * 100) : 0}%"></i></div>
      <div class="row" style="margin-top:16px">
        <button class="btn small" data-action="generate" data-kind="lessons">📖 Generar lecciones</button>
        <button class="btn small" data-action="generate" data-kind="flashcards">🧠 Generar tarjetas</button>
        <button class="btn small" data-action="generate" data-kind="quiz">✅ Generar quiz</button>
        <button class="btn small" data-action="generate" data-kind="exam">📝 Generar simulacro</button>
        <button class="btn small" data-action="generate" data-kind="podcast">🎧 Generar podcast</button>
      </div>
    </div>
    <div class="panel"><div class="panel-title"><h2>Temas</h2><span class="muted small">marca lo que domines</span></div>
      ${topics.length ? topics.map((t) => `<div class="topic"><div style="flex:1"><h4>${esc(t.title)}</h4><p>${esc(t.description)}</p><div class="row tiny muted" style="margin-top:6px"><span>⏱ ${t.minutes} min</span><span class="pill ${esc(t.priority)}">${esc(t.priority)}</span></div></div>
        <select data-change="topic-status" data-id="${esc(t.id)}" style="width:auto"><option value="todo" ${t.status === 'todo' ? 'selected' : ''}>Pendiente</option><option value="doing" ${t.status === 'doing' ? 'selected' : ''}>En curso</option><option value="done" ${t.status === 'done' ? 'selected' : ''}>Dominado</option></select></div>`).join('') : '<p class="muted">Todavía no hay temas. Genera un plan con tus materiales.</p>'}
    </div>
    ${c.plan?.tips?.length ? `<div class="panel"><h3>Consejos para esta preparación</h3><ul class="muted">${c.plan.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    ${c.lessons?.length ? `<div class="panel"><h2>Lecciones</h2>${c.lessons.map((l) => `<details class="faq" style="padding:12px 0"><summary>${esc(l.title)}</summary><p>${md(l.explanation)}</p>${l.example ? `<p class="small"><strong>Ejemplo:</strong> ${esc(l.example)}</p>` : ''}${l.keyPoints?.length ? `<p class="small"><strong>Claves:</strong> ${l.keyPoints.map(esc).join(' · ')}</p>` : ''}</details>`).join('')}</div>` : ''}
    ${c.podcast?.segments?.length ? `<div class="panel"><h2>Guion de podcast</h2>${c.podcast.segments.map((s) => `<p class="small"><strong>${esc(s.speaker)}:</strong> ${esc(s.text)}</p>`).join('')}</div>` : ''}
  </div>`;
};

function planForm() {
  const sample = 'La fotosíntesis es el proceso por el que las plantas convierten la luz solar en energía química. Ocurre en los cloroplastos y requiere agua y dióxido de carbono. Como subproducto se libera oxígeno. La ecuación general es 6CO2 + 6H2O + luz → C6H12O6 + 6O2. La clorofila absorbe principalmente luz roja y azul, y refleja la verde, por eso las hojas son verdes. La fase clara depende de la luz y produce ATP y NADPH; el ciclo de Calvin fija el carbono sin necesidad directa de luz.';
  return `<form class="panel stack" data-form="create-plan">
    <div><span class="eyebrow">Paso 1</span><h2 style="margin:8px 0">Crea tu plan de examen</h2><p class="muted small">Todo se guarda solo en tu navegador.</p></div>
    <div class="grid cols-2">
      <label class="field">Asignatura o tema<input name="subject" placeholder="Ej.: Biología" required /></label>
      <label class="field">Fecha del examen<input name="examDate" type="date" /></label>
      <label class="field">Objetivo<input name="goal" placeholder="Ej.: aprobar con nota alta" /></label>
      <label class="field">Horas al día<input name="hoursPerDay" type="number" min="0.5" max="12" step="0.5" value="1.5" /></label>
    </div>
    <label class="field">Pega aquí tus apuntes<textarea name="material" rows="7" placeholder="Copia aquí tu texto, esquemas o exámenes anteriores…">${state.ui.sample ? esc(sample) : ''}</textarea></label>
    <label class="field">O sube un archivo de texto / Markdown / imagen<input type="file" data-change="plan-file" accept=".txt,.md,.markdown,.json,image/*" multiple /></label>
    <div id="plan-files" class="muted small"></div>
    <div class="row"><button class="btn primary" type="submit" ${state.ui.busy ? 'disabled' : ''}>${state.ui.busy ? '<span class="spinner"></span> Creando…' : '✨ Crear plan'}</button>
      <button class="btn small" type="button" data-action="sample">Usar ejemplo</button></div>
  </form>`;
}

views.tutor = () => {
  const c = course();
  const examples = ['Explícame este tema como si tuviera 12 años', 'Dame una pista, no la respuesta', 'Hazme un ejercicio parecido al de mis apuntes', 'Corrige mi razonamiento paso a paso'];
  return `<div class="chat-wrap">
    <div class="panel" style="padding:0;display:flex;flex-direction:column;overflow:hidden">
      <div class="row" style="padding:12px 16px;border-bottom:1px solid var(--line)">
        ${[['socratic', '🎯 Socrático'], ['solve', '🧮 Resolver'], ['tutor', '💬 Explicar']].map(([id, label]) => `<button class="tab ${state.chatMode === id ? 'active' : ''}" data-action="chat-mode" data-mode="${id}">${label}</button>`).join('')}
        <label class="checkbox" style="margin-left:auto"><input type="checkbox" data-change="use-material" ${state.useMaterial ? 'checked' : ''} /> Usar mis apuntes</label>
      </div>
      <div class="chat-log">
        ${state.chat.length ? state.chat.map((m) => `<div class="msg ${m.role}">${md(m.content)}${(m.images || []).map((i) => `<img src="${esc(i.base64)}" alt="imagen adjunta" />`).join('')}</div>`).join('') : `<div class="empty" style="margin:20px"><h3>¿Por dónde empezamos?</h3><p>Pregúntame lo que no entiendas. Te iré guiando con pistas.</p><div class="row" style="justify-content:center;margin-top:14px">${examples.map((e) => `<button class="btn small" data-action="use-example" data-text="${esc(e)}">${esc(e)}</button>`).join('')}</div></div>`}
        ${state.ui.busy ? '<div class="msg assistant typing">Pensando…</div>' : ''}
      </div>
    </div>
    <div>
      ${state.ui.images.length ? `<div class="row" style="margin-bottom:8px">${state.ui.images.map((i, idx) => `<span class="pill">📎 imagen ${idx + 1} <button data-action="remove-image" data-index="${idx}" style="background:none;border:0;color:var(--red)">×</button></span>`).join('')}</div>` : ''}
      <div class="composer">
        <input type="file" id="chat-image" accept="image/*" hidden data-change="chat-image" />
        <button class="btn small ghost" data-action="pick-image" title="Adjuntar foto de un ejercicio">📷</button>
        <textarea id="chat-input" placeholder="Escribe tu pregunta… (Enter para enviar)" ${state.ui.busy ? 'disabled' : ''}>${esc(state.ui.draft)}</textarea>
        <button class="btn primary" data-action="chat-send" ${state.ui.busy ? 'disabled' : ''}>Enviar ↑</button>
      </div>
      <div class="row between tiny muted" style="margin-top:8px"><span>${c ? `Contexto: ${esc(c.title || c.subject)}` : 'Sin material: puedes preguntar cualquier cosa'}</span><button class="btn small ghost" data-action="clear-chat">Limpiar chat</button></div>
    </div>
  </div>`;
};

views.cards = () => {
  const c = course();
  const cards = c?.flashcards || [];
  const session = state.ui.cardSession;
  if (session && cards.length) {
    const card = cards[session.index];
    if (!card) { state.ui.cardSession = null; return views.cards(); }
    return `<div class="panel center"><div class="row between"><span class="muted small">Tarjeta ${session.index + 1} de ${cards.length}</span><button class="btn small" data-action="exit-cards">Salir</button></div>
      <div class="flashcard" data-action="flip-card" style="margin:22px 0">
        <div><div class="face">${esc(session.flipped ? card.back : card.front)}</div><div class="hint">${session.flipped ? 'Respuesta · pulsa para volver a la pregunta' : esc(card.topic || 'Pulsa para ver la respuesta')}</div></div>
      </div>
      ${session.flipped ? `<div class="row" style="justify-content:center"><button class="btn danger" data-action="grade-card" data-grade="0">Otra vez</button><button class="btn" data-action="grade-card" data-grade="1">Difícil</button><button class="btn cyan" data-action="grade-card" data-grade="2">Bien</button><button class="btn primary" data-action="grade-card" data-grade="3">Fácil</button></div>` : '<button class="btn primary" data-action="flip-card">Mostrar respuesta</button>'}
    </div>`;
  }
  return `<div class="stack"><div class="panel panel-title"><div><h2>${cards.length} tarjetas</h2><div class="muted small">${dueCards()} pendientes hoy</div></div>
    <div class="row"><button class="btn primary small" data-action="generate" data-kind="flashcards">✨ Generar con IA</button>${cards.length ? '<button class="btn small" data-action="study-cards">Estudiar ahora</button>' : ''}</div></div>
    ${cards.length ? `<div class="panel">${cards.map((card, i) => {
      const s = state.srs[card.id];
      const due = !s || s.due <= Date.now();
      return `<div class="topic"><div><h4>${esc(card.front)}</h4><p>${esc(card.back)}</p></div><span class="pill ${due ? 'medium' : 'done'}">${due ? 'pendiente' : `día ${new Date(s.due).toLocaleDateString('es')}`}</span></div>`;
    }).join('')}</div>` : '<div class="empty"><h3>Aún no hay tarjetas</h3><p>Genera tarjetas a partir de tus materiales o créalas tú.</p></div>'}</div>`;
};

views.quiz = () => {
  const c = course();
  const questions = c?.quiz?.questions || [];
  const quiz = state.ui.quiz;
  if (!questions.length) return `<div class="empty"><h3>Sin preguntas todavía</h3><p>La IA creará un cuestionario usando solo tus apuntes.</p><div style="margin-top:16px"><button class="btn primary" data-action="generate" data-kind="quiz">✨ Generar cuestionario</button></div></div>`;
  if (!quiz) {
    return `<div class="panel"><div class="panel-title"><h2>${questions.length} preguntas listas</h2><button class="btn small" data-action="generate" data-kind="quiz">Regenerar</button></div>
      <p class="muted">Cada respuesta se corrige con una explicación. Puedes repetir cuantas veces quieras.</p>
      <button class="btn primary" data-action="start-quiz">Empezar cuestionario →</button></div>`;
  }
  if (quiz.result !== undefined) {
    return `<div class="panel"><h2>Resultado: ${quiz.result} / ${quiz.total}</h2><div class="bar"><i style="width:${Math.round(quiz.result / quiz.total * 100)}%"></i></div>
      ${questions.map((q, i) => `<div class="question"><h4>${i + 1}. ${esc(q.question)}</h4>
        ${q.options.map((o, j) => `<div class="option ${j === q.answer ? 'correct' : quiz.answers[i] === j ? 'wrong' : ''}">${esc(o)} ${j === q.answer ? '✓' : quiz.answers[i] === j ? '✗' : ''}</div>`).join('')}
        <div class="explanation">${esc(q.explanation || 'Repasa este tema en tus apuntes.')}</div></div>`).join('')}
      <div class="row" style="margin-top:16px"><button class="btn primary" data-action="start-quiz">Repetir</button><button class="btn" data-action="exit-quiz">Volver</button></div></div>`;
  }
  return `<form class="panel" data-form="submit-quiz">${questions.map((q, i) => `<div class="question"><h4>${i + 1}. ${esc(q.question)}</h4>
    ${q.options.map((o, j) => `<label class="option"><input type="radio" name="q${i}" value="${j}" /> ${esc(o)}</label>`).join('')}</div>`).join('')}
    <button class="btn primary" type="submit" style="margin-top:18px">Corregir respuestas</button></form>`;
};

views.exam = () => {
  const c = course();
  const exam = c?.exam?.questions || [];
  const session = state.ui.exam;
  if (!exam.length) return `<div class="empty"><h3>Sin simulacro</h3><p>Genera un examen con tu material y practica con tiempo límite.</p><div style="margin-top:16px"><button class="btn primary" data-action="generate" data-kind="exam">✨ Generar simulacro</button></div></div>`;
  if (!session) {
    return `<div class="panel"><div class="panel-title"><h2>${exam.length} preguntas · ${exam.reduce((a, q) => a + q.points, 0)} puntos</h2><button class="btn small" data-action="generate" data-kind="exam">Regenerar</button></div>
      <p class="muted">Tendrás ${c.examMinutes || 60} minutos. Las preguntas desarrolladas se corrigen con una rúbrica y, si quieres, con IA.</p>
      <button class="btn primary" data-action="start-exam">Empezar simulacro →</button></div>`;
  }
  if (session.result !== undefined) {
    return `<div class="panel"><h2>Resultado del simulacro</h2><p class="muted">Objetivas: ${session.result} / ${session.total} puntos. Las desarrolladas tienen su rúbrica debajo; puedes pedirle al tutor que las corrija.</p>
      ${exam.map((q, i) => `<div class="question"><h4>${i + 1}. ${esc(q.question)} <span class="pill">${q.points} pts</span></h4>
        ${q.type === 'mcq' ? q.options.map((o, j) => `<div class="option ${j === q.answer ? 'correct' : session.answers[i] == j ? 'wrong' : ''}">${esc(o)} ${j === q.answer ? '✓' : ''}</div>`).join('') : `<p class="muted small">Tu respuesta: ${esc(session.answers[i] || '—')}</p>`}
        <div class="explanation"><strong>Rúbrica:</strong> ${esc(q.rubric || q.options[q.answer] || 'Cumple los puntos clave del tema.')}</div></div>`).join('')}
      <div class="row" style="margin-top:16px"><button class="btn primary" data-action="start-exam">Repetir</button><button class="btn" data-action="exit-exam">Volver</button></div></div>`;
  }
  return `<form class="panel" data-form="submit-exam"><div class="row between"><h2 style="margin:0">Simulacro en curso</h2><span class="pill" id="exam-timer">${Math.floor((session.end - Date.now()) / 60000)}:${String(Math.floor(((session.end - Date.now()) / 1000) % 60)).padStart(2, '0')}</span></div>
    ${exam.map((q, i) => `<div class="question"><h4>${i + 1}. ${esc(q.question)} <span class="pill">${q.points} pts</span></h4>
      ${q.type === 'mcq' ? q.options.map((o, j) => `<label class="option"><input type="radio" name="e${i}" value="${j}" /> ${esc(o)}</label>`).join('') : `<textarea name="e${i}" placeholder="Escribe tu respuesta…" rows="3"></textarea>`}</div>`).join('')}
    <button class="btn primary" type="submit" style="margin-top:18px">Entregar examen</button></form>`;
};

views.materials = () => {
  const c = course();
  if (!c) return `<div class="empty"><h3>Crea primero un plan</h3><p>Así sabrás dónde guardar tus materiales.</p><a class="btn primary" href="#/app/plan" style="margin-top:14px">Crear plan</a></div>`;
  return `<div class="stack"><div class="panel"><div class="panel-title"><h2>Materiales de ${esc(c.title || c.subject)}</h2><a class="btn small" href="#/app/plan">Ver plan</a></div>
    ${c.materials.length ? c.materials.map((m) => `<div class="topic"><div style="flex:1"><h4>${esc(m.name)}</h4><p>${esc((m.text || '').slice(0, 220))}${m.images?.length ? ` ${m.images.length} imagen(es)` : ''}</p><div class="tiny muted" style="margin-top:5px">${new Date(m.addedAt).toLocaleDateString('es')} · ${(m.text || '').length} caracteres</div></div>
      <button class="btn small danger" data-action="remove-material" data-id="${esc(m.id)}">Eliminar</button></div>`).join('') : '<p class="muted">Todavía no has añadido materiales.</p>'}
    </div>
    <form class="panel" data-form="add-material"><h3>Añadir material</h3>
      <label class="field">Nombre<input name="name" placeholder="Ej.: Apuntes tema 3" /></label>
      <label class="field">Texto<textarea name="text" placeholder="Pega aquí el contenido…"></textarea></label>
      <label class="field">Archivo o imagen<input type="file" data-change="material-file" accept=".txt,.md,.markdown,.json,image/*" multiple /></label>
      <div id="material-files" class="muted small"></div>
      <button class="btn primary" type="submit">Añadir</button>
    </form></div>`;
};

views.progress = () => {
  const c = course();
  const topics = c?.plan?.topics || [];
  const mastered = topics.filter((t) => t.status === 'done').length;
  const totalAnswers = state.stats.quizResults.reduce((a, r) => a + r.total, 0);
  const correct = state.stats.quizResults.reduce((a, r) => a + r.result, 0);
  const days = Object.entries(state.stats.minutes).sort();
  return `<div class="stack"><div class="grid cols-3-app">
    <div class="stat"><div class="value">${streak()} 🔥</div><div class="label">racha actual</div></div>
    <div class="stat"><div class="value">${topics.length ? Math.round(mastered / topics.length * 100) : 0} %</div><div class="label">temas dominados</div></div>
    <div class="stat"><div class="value">${totalAnswers ? Math.round(correct / totalAnswers * 100) : 0} %</div><div class="label">aciertos en cuestionarios</div></div>
  </div>
  <div class="panel"><h2>Tiempo de estudio · últimos 14 días</h2><div class="chart">${days.slice(-14).map(([key, m]) => `<div class="col"><i style="height:${Math.max(3, Math.min(100, m * 2))}%"></i><span>${key.slice(8)}</span></div>`).join('') || '<p class="muted">Aún no hay datos. Estudia un par de minutos para ver tu gráfica.</p>'}</div></div>
  <div class="panel"><h2>Dominio por tema</h2>${topics.length ? topics.map((t) => `<div class="topic"><div><h4>${esc(t.title)}</h4><div class="bar" style="margin-top:8px;width:220px"><i style="width:${t.status === 'done' ? 100 : t.status === 'doing' ? 50 : 8}%"></i></div></div><span class="pill ${t.status === 'done' ? 'done' : 'medium'}">${t.status === 'done' ? 'dominado' : t.status === 'doing' ? 'en curso' : 'pendiente'}</span></div>`).join('') : '<p class="muted">Genera un plan para ver tus temas.</p>'}</div>
  <div class="panel"><h2>Historial de cuestionarios</h2>${state.stats.quizResults.slice(-8).reverse().map((r) => `<div class="topic"><div><h4>${r.result} / ${r.total} aciertos</h4><p>${new Date(r.at).toLocaleString('es')}</p></div></div>`).join('') || '<p class="muted">Sin resultados todavía.</p>'}</div></div>`;
};

views.settings = () => {
  const providers = status?.providers || [];
  const active = config?.provider || 'demo';
  const selected = providers.find((p) => p.id === active);
  return `<form class="stack" data-form="save-settings">
    <div class="panel"><div class="panel-title"><h2>Proveedor de IA</h2><span class="pill ${selected?.ready ? 'done' : 'medium'}">${selected?.ready ? 'disponible' : 'no disponible'}</span></div>
      <label class="field">Proveedor<select name="provider" data-change="provider-change">${providers.map((p) => `<option value="${esc(p.id)}" ${active === p.id ? 'selected' : ''}>${esc(p.name)} ${p.ready ? '✓' : '· ' + esc(p.note)}</option>`).join('')}</select></label>
      ${selected?.note ? `<p class="muted small">${esc(selected.note)}</p>` : ''}
      <label class="field">Modelo (o déjalo vacío para el predeterminado)<div class="row"><input name="model" list="model-list" value="${esc(config?.model || '')}" placeholder="${esc(status?.model || 'predeterminado')}" />
        <button class="btn small" type="button" data-action="load-models">Ver modelos</button></div><datalist id="model-list">${(state.ui.models || []).map((m) => `<option value="${esc(m)}"></option>`).join('')}</datalist></label>
      <div class="row"><button class="btn primary small" type="button" data-action="test-provider">Probar conexión</button><a class="btn small" href="#/app/tutor">Ir al tutor</a></div>
    </div>
    <div class="panel"><h2>Claves y endpoints</h2><p class="muted small">Se guardan solo en <code>.data/config.json</code> de este equipo. Nunca se envían a otro servidor.</p>
      <div class="grid cols-2">
        <label class="field">OpenRouter API key<input type="password" name="openrouterKey" value="${esc(config?.apiKeys?.openrouter || '')}" placeholder="sk-or-…" /></label>
        <label class="field">Gemini API key<input type="password" name="geminiKey" value="${esc(config?.apiKeys?.gemini || '')}" placeholder="AIza…" /></label>
        <label class="field">Groq API key<input type="password" name="groqKey" value="${esc(config?.apiKeys?.groq || '')}" placeholder="gsk_…" /></label>
        <label class="field">OpenAI compatible (opcional)<input type="password" name="openaiKey" value="${esc(config?.apiKeys?.openai || '')}" /></label>
        <label class="field">URL de Ollama<input name="ollamaUrl" value="${esc(config?.endpoints?.ollama || '')}" /></label>
        <label class="field">URL OpenAI-compatible<input name="openaiUrl" value="${esc(config?.endpoints?.openaiCompatible || '')}" /></label>
      </div>
      <label class="field">Comando personalizado (usa {prompt})<input name="customCommand" value="${esc(config?.cli?.customCommand || '')}" placeholder='mi-ia "{prompt}"' /></label>
      <div class="grid cols-2">
        <label class="field">Modo del tutor<select name="chatMode">${[['socratic', 'Socrático (pistas)'], ['solve', 'Resolver paso a paso'], ['tutor', 'Explicar'], ['explain', 'Explicar']].map(([v, l]) => `<option value="${v}" ${config?.chatMode === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Nivel<select name="level">${['primaria', 'eso', 'bachillerato', 'universidad', 'profesional'].map((v) => `<option value="${v}" ${config?.level === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      </div>
      <button class="btn primary" type="submit">Guardar ajustes</button>
    </div>
    <div class="panel"><h2>Instalación rápida de IA local</h2><pre class="muted small" style="white-space:pre-wrap;background:rgba(0,0,0,.3);padding:14px;border-radius:12px">ollama pull llama3.2
# Modelo con visión para fotos de ejercicios:
ollama pull llama3.2-vision</pre>
      <p class="muted small">También puedes usar llama.cpp, LM Studio o cualquier servidor OpenAI-compatible cambiando la URL y el modelo.</p>
    </div>
    <div class="panel"><h2>Tus datos</h2><p class="muted small">Todo vive en este navegador. Puedes exportarlo o borrarlo cuando quieras.</p>
      <div class="row"><button class="btn small" type="button" data-action="export-data">⬇ Exportar datos</button>
        <input type="file" id="import-file" accept="application/json" hidden data-change="import-file" />
        <button class="btn small" type="button" data-action="import-data">⬆ Importar datos</button>
        <button class="btn small danger" type="button" data-action="reset-data">Borrar todo</button></div></div>
  </form>`;
};

/* ------------------------- Acciones ------------------------- */
async function busy(fn) {
  if (state.ui.busy) return;
  state.ui.busy = true;
  render();
  try {
    await fn();
  } catch (error) {
    toast(error.message || 'Ha ocurrido un error', true);
  } finally {
    state.ui.busy = false;
    save();
    render();
  }
}

async function generate(kind) {
  const c = course();
  if (!c) return toast('Crea primero un plan con tus materiales.', true);
  const res = await api('/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      kind,
      material: materialText(c),
      subject: c.subject,
      topic: c.title,
      examDate: c.examDate,
      plan: c.plan?.topics || [],
    }),
  });
  if (res.warning) state.ui.toast = { text: res.warning, error: false };
  if (!res.data) throw new Error('No se generó contenido');
  if (kind === 'plan') c.plan = res.data;
  if (kind === 'lessons') c.lessons = res.data.lessons || [];
  if (kind === 'flashcards') c.flashcards = (res.data.cards || []).map((card) => ({ ...card, id: uid() }));
  if (kind === 'quiz') { c.quiz = res.data; state.ui.quiz = null; }
  if (kind === 'exam') { c.exam = res.data; state.ui.exam = null; }
  if (kind === 'podcast') c.podcast = res.data;
  if (!res.warning) toast(`✨ ${kind === 'flashcards' ? 'Tarjetas' : kind === 'quiz' ? 'Cuestionario' : kind === 'exam' ? 'Simulacro' : kind === 'podcast' ? 'Podcast' : kind === 'lessons' ? 'Lecciones' : 'Plan'} generado${kind === 'lessons' || kind === 'flashcards' ? 's' : ''}.`);
}

function scheduleCard(id, grade) {
  const s = state.srs[id] || { ease: 2.5, interval: 0, reps: 0, due: 0 };
  if (grade === 0) {
    state.srs[id] = { ease: Math.max(1.3, s.ease - 0.2), interval: 0, reps: 0, due: Date.now() + 60000 };
  } else {
    const interval = grade === 1 ? Math.max(1, Math.round(s.interval * 1.2)) : grade === 2 ? Math.max(1, Math.round((s.interval || 1) * s.ease)) : Math.max(3, Math.round((s.interval || 1) * s.ease * 1.35));
    state.srs[id] = { ease: Math.max(1.3, s.ease + (0.1 - (3 - grade) * 0.08)), interval, reps: s.reps + 1, due: Date.now() + interval * 86400000 };
  }
}

async function sendChat() {
  const text = state.ui.draft.trim();
  const images = state.ui.images.slice();
  if (!text && !images.length) return;
  state.chat.push({ role: 'user', content: text || 'Mira esta imagen', images });
  state.ui.draft = '';
  state.ui.images = [];
  try {
    const res = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: state.chat,
        mode: state.chatMode,
        material: state.useMaterial ? materialText() : '',
      }),
    });
    state.chat.push({ role: 'assistant', content: res.text || 'No obtuve respuesta.' });
  } catch (error) {
    state.chat.pop();
    state.ui.draft = text;
    state.ui.images = images;
    throw error;
  }
}

async function readFiles(files) {
  const output = [];
  for (const file of files || []) {
    if (file.type.startsWith('image/')) {
      output.push({ name: file.name, kind: 'image', base64: await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); }) });
    } else {
      output.push({ name: file.name, kind: 'text', text: await file.text() });
    }
  }
  return output;
}

async function handleAction(action, data) {
  switch (action) {
    case 'close-toast': state.ui.toast = null; render(); break;
    case 'new-course': state.activeCourse = null; location.hash = '#/app/plan'; render(); break;
    case 'sample': state.ui.sample = !state.ui.sample; render(); break;
    case 'chat-mode': state.chatMode = data.mode; save(); render(); break;
    case 'use-example': state.ui.draft = data.text; render(); $('#chat-input')?.focus(); break;
    case 'pick-image': $('#chat-image')?.click(); break;
    case 'remove-image': state.ui.images.splice(Number(data.index), 1); render(); break;
    case 'clear-chat': state.chat = []; save(); render(); break;
    case 'clear-draft': state.ui.draft = ''; render(); break;
    case 'generate': busy(() => generate(data.kind)); break;
    case 'study-cards': state.ui.cardSession = { index: 0, flipped: false }; render(); break;
    case 'exit-cards': state.ui.cardSession = null; render(); break;
    case 'flip-card': state.ui.cardSession.flipped = !state.ui.cardSession.flipped; render(); break;
    case 'grade-card': {
      const card = course()?.flashcards?.[state.ui.cardSession.index];
      if (card) scheduleCard(card.id, Number(data.grade));
      state.ui.cardSession.index++;
      state.ui.cardSession.flipped = false;
      if (state.ui.cardSession.index >= (course()?.flashcards?.length || 0)) state.ui.cardSession = null;
      save(); render(); break;
    }
    case 'start-quiz': state.ui.quiz = { answers: {} }; render(); break;
    case 'exit-quiz': state.ui.quiz = null; render(); break;
    case 'start-exam': state.ui.exam = { answers: {}, end: Date.now() + (course()?.examMinutes || 60) * 60000 }; render(); startExamTimer(); break;
    case 'exit-exam': state.ui.exam = null; render(); break;
    case 'chat-send': busy(sendChat); break;
    case 'remove-material': {
      const c = course();
      if (c) c.materials = c.materials.filter((m) => m.id !== data.id);
      save(); render(); break;
    }
    case 'load-models':
      busy(async () => {
        const provider = $('[name="provider"]')?.value || config?.provider;
        const res = await api(`/api/models?provider=${encodeURIComponent(provider)}`);
        state.ui.models = res.models;
        toast(res.models.length ? `${res.models.length} modelos disponibles. Elígelos en el campo Modelo.` : 'No se encontraron modelos. Comprueba la conexión y la clave.', !res.models.length);
      });
      break;
    case 'test-provider':
      busy(async () => {
        const provider = $('[name="provider"]')?.value || config?.provider;
        const model = $('[name="model"]')?.value || '';
        const res = await api('/api/test', { method: 'POST', body: JSON.stringify({ provider, model }) });
        toast(res.ok ? `✓ Conexión correcta: ${res.text}` : `✗ ${res.error}`, !res.ok);
      });
      break;
    case 'export-data': {
      const blob = new Blob([JSON.stringify({ courses: state.courses, chat: state.chat, srs: state.srs, stats: state.stats }, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'estudio-libre-datos.json';
      link.click();
      URL.revokeObjectURL(link.href);
      break;
    }
    case 'import-data': $('#import-file')?.click(); break;
    case 'reset-data':
      if (confirm('¿Borrar todos los cursos, tarjetas y progreso? No se puede deshacer.')) {
        localStorage.removeItem(STORAGE_KEY);
        state = freshState();
        toast('Datos borrados.');
      }
      break;
    default: break;
  }
}

function startExamTimer() {
  const timer = setInterval(() => {
    const el = $('#exam-timer');
    if (!el || !state.ui.exam || state.ui.exam.result !== undefined) return clearInterval(timer);
    const seconds = Math.max(0, Math.floor((state.ui.exam.end - Date.now()) / 1000));
    el.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    if (!seconds) {
      clearInterval(timer);
      toast('Se acabó el tiempo. Entrega el examen.');
    }
  }, 1000);
}

/* ------------------------- Formularios y cambios ------------------------- */
async function handleForm(form, data) {
  switch (form) {
    case 'create-plan':
      await busy(async () => {
        const files = await readFiles(state.ui.pendingPlanFiles || []);
        const text = [data.get('material') || '', ...files.filter((f) => f.kind === 'text').map((f) => f.text)].join('\n\n').trim();
        if (!text) throw new Error('Pega tus apuntes o sube un archivo.');
        const generated = await api('/api/generate', {
          method: 'POST',
          body: JSON.stringify({
            kind: 'plan',
            material: text,
            subject: data.get('subject'),
            examDate: data.get('examDate'),
            goal: data.get('goal'),
            hoursPerDay: data.get('hoursPerDay'),
            level: config?.level,
          }),
        });
        const id = uid();
        state.courses.push({
          id,
          title: data.get('subject') || 'Mi examen',
          subject: data.get('subject') || '',
          examDate: data.get('examDate') || '',
          goal: data.get('goal') || '',
          createdAt: new Date().toISOString(),
          plan: generated.data,
          materials: [{ id: uid(), name: 'Apuntes iniciales', text, images: files.filter((f) => f.kind === 'image'), addedAt: new Date().toISOString() }],
          flashcards: [], lessons: [], quiz: null, exam: null, podcast: null, examMinutes: 60,
        });
        state.activeCourse = id;
        state.ui.pendingPlanFiles = [];
        state.ui.sample = false;
        if (generated.warning) state.ui.toast = { text: generated.warning, error: false };
        location.hash = '#/app/plan';
      });
      break;
    case 'add-material':
      await busy(async () => {
        const c = course();
        if (!c) throw new Error('No hay curso activo');
        const files = await readFiles(state.ui.pendingMaterialFiles || []);
        const text = [data.get('text') || '', ...files.filter((f) => f.kind === 'text').map((f) => f.text)].join('\n\n').trim();
        if (!text && !files.some((f) => f.kind === 'image')) throw new Error('Escribe texto o adjunta un archivo.');
        c.materials.push({ id: uid(), name: data.get('name') || files[0]?.name || 'Material', text, images: files.filter((f) => f.kind === 'image'), addedAt: new Date().toISOString() });
        state.ui.pendingMaterialFiles = [];
        toast('Material añadido.');
      });
      break;
    case 'submit-quiz': {
      const questions = course()?.quiz?.questions || [];
      const answers = {};
      let result = 0;
      questions.forEach((q, i) => {
        const value = Number(data.get(`q${i}`));
        answers[i] = Number.isFinite(value) ? value : -1;
        if (answers[i] === q.answer) result++;
      });
      state.ui.quiz = { answers, result, total: questions.length };
      state.stats.quizResults.push({ result, total: questions.length, at: new Date().toISOString() });
      save(); render(); break;
    }
    case 'submit-exam': {
      const questions = course()?.exam?.questions || [];
      const answers = {};
      let result = 0;
      questions.forEach((q, i) => {
        answers[i] = data.get(`e${i}`) || '';
        if (q.type === 'mcq' && Number(answers[i]) === q.answer) result += q.points;
      });
      state.ui.exam = { answers, result, total: questions.filter((q) => q.type === 'mcq').reduce((a, q) => a + q.points, 0) };
      save(); render(); break;
    }
    case 'save-settings':
      await busy(async () => {
        const payload = {
          provider: data.get('provider'),
          model: data.get('model'),
          chatMode: data.get('chatMode'),
          level: data.get('level'),
          apiKeys: {
            openrouter: data.get('openrouterKey'),
            gemini: data.get('geminiKey'),
            groq: data.get('groqKey'),
            openai: data.get('openaiKey'),
          },
          endpoints: { ollama: data.get('ollamaUrl'), openaiCompatible: data.get('openaiUrl') },
          cli: { customCommand: data.get('customCommand') },
        };
        await api('/api/config', { method: 'POST', body: JSON.stringify(payload) });
        await refreshStatus();
        toast('Ajustes guardados.');
      });
      break;
    default: break;
  }
}

async function handleChange(event) {
  const el = event.target;
  const change = el.dataset.change;
  if (!change) return;
  if (change === 'topic-status') {
    const c = course();
    const topic = c?.plan?.topics?.find((t) => t.id === el.dataset.id);
    if (topic) { topic.status = el.value; save(); }
    return;
  }
  if (change === 'use-material') { state.useMaterial = el.checked; save(); return; }
  if (change === 'provider-change') {
    state.ui.models = [];
    const list = $('#model-list');
    if (list) list.innerHTML = '';
    return;
  }
  if (change === 'plan-file' || change === 'material-file' || change === 'chat-image' || change === 'import-file') {
    const files = Array.from(el.files || []);
    if (change === 'chat-image') {
      for (const file of files.slice(0, 4)) {
        state.ui.images.push({ mime: file.type || 'image/png', base64: await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); }) });
      }
      render();
    } else if (change === 'import-file') {
      try {
        const imported = JSON.parse(await files[0].text());
        if (!Array.isArray(imported.courses)) throw new Error('Archivo no válido');
        state.courses = imported.courses;
        state.chat = imported.chat || [];
        state.srs = imported.srs || {};
        state.stats = imported.stats || state.stats;
        state.activeCourse = imported.courses[0]?.id || null;
        save(); toast('Datos importados.');
      } catch (error) { toast(error.message, true); }
    } else {
      const parsed = await readFiles(files);
      const key = change === 'plan-file' ? 'pendingPlanFiles' : 'pendingMaterialFiles';
      state.ui[key] = (state.ui[key] || []).concat(parsed);
      const target = change === 'plan-file' ? '#plan-files' : '#material-files';
      const node = $(target);
      if (node) node.textContent = `${state.ui[key].map((f) => f.name).join(', ')} (${state.ui[key].length})`;
    }
  }
}

/* ------------------------- Arranque ------------------------- */
async function refreshStatus() {
  try {
    const [s, c] = await Promise.all([api('/api/status'), api('/api/config')]);
    status = s;
    config = c;
  } catch (error) {
    status = { providers: [], active: 'demo', model: 'demo' };
    config = { provider: 'demo', model: '', apiKeys: {}, endpoints: {}, cli: {}, chatMode: 'socratic', level: 'bachillerato' };
    state.ui.toast = { text: `No se pudo conectar con el servidor local: ${error.message}`, error: true };
  }
}

function render() {
  const root = $('#root');
  if (!root) return;
  const current = route();
  root.innerHTML = current.app ? appShell(current.view) : landing();
  if (current.app && current.view === 'tutor') {
    const log = $('.chat-log');
    if (log) log.scrollTop = log.scrollHeight;
  }
}

document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  event.preventDefault();
  handleAction(el.dataset.action, el.dataset);
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  handleForm(form.dataset.form, new FormData(form));
});

document.addEventListener('change', (event) => { handleChange(event).catch((error) => toast(error.message, true)); });

document.addEventListener('input', (event) => {
  if (event.target.id === 'chat-input') state.ui.draft = event.target.value;
});

document.addEventListener('keydown', (event) => {
  if (event.target.id === 'chat-input' && event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleAction('chat-send', {});
  }
});

window.addEventListener('hashchange', render);

if (!location.hash) location.replace('#/');
await refreshStatus();
render();
startExamTimer();
setInterval(() => {
  if (!route().app) return;
  const key = new Date().toISOString().slice(0, 10);
  state.stats.minutes[key] = (state.stats.minutes[key] || 0) + 1;
  save();
}, 60000);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
