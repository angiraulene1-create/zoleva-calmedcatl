// Zoleva · aplicación web PWA. Sin frameworks, sin build, sin dependencias.
import { buildStudySchedule, localDateKey, sessionsForDate, scheduleSummary } from './schedule.js';

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
  { id: 'tutor', icon: '💬', label: 'Preguntar al tutor' },
  { id: 'plan', icon: '🗺️', label: 'Mi plan' },
  { id: 'cards', icon: '🧠', label: 'Tarjetas' },
  { id: 'quiz', icon: '✅', label: 'Practicar' },
  { id: 'exam', icon: '📝', label: 'Examen de práctica' },
  { id: 'materials', icon: '📚', label: 'Mis apuntes' },
  { id: 'progress', icon: '📈', label: 'Mi progreso' },
  { id: 'cuenta', icon: '🎖️', label: 'Mi cuenta' },
  { id: 'docente', icon: '🍎', label: 'Para docentes' },
  { id: 'settings', icon: '⚙️', label: 'Ajustes' },
];
const navItems = () => NAV.filter((n) => n.id !== 'docente' || profile()?.role === 'teacher');
const TITLES = {
  home: ['Tu espacio de estudio', 'Empieza por el paso 1. Puedes ir a tu ritmo y sin presión.'],
  tutor: ['Preguntar al tutor', 'Escribe lo que no entiendas: te da pistas, no respuestas.'],
  plan: ['Mi plan', 'Tus apuntes se convierten en un calendario con pasos pequeños hasta tu examen.'],
  cards: ['Tarjetas de memoria', 'Una pregunta por lado. Vuelven cuando conviene repasarlas.'],
  quiz: ['Practicar', 'Preguntas cortas con explicación. Equivocarte también ayuda.'],
  exam: ['Examen de práctica', 'Practica como si fuera el examen real, o sin temporizador.'],
  materials: ['Mis apuntes', 'Aquí guardas lo que el tutor usa para ayudarte.'],
  progress: ['Mi progreso', 'Mira cuánto has avanzado, sin compararte con nadie.'],
  cuenta: ['Mi cuenta', 'Tu nombre, tu nivel, tus recompensas y tus respaldos.'],
  docente: ['Para docentes', 'Grupos, guías, rúbricas y juegos para tu clase.'],
  settings: ['Ajustes', 'Elige tu IA. No necesitas configurar nada para empezar.'],
};

// Términos náhuatl documentados. Se muestran como glosas junto a la interfaz
// en español para no sustituir etiquetas funcionales por traducciones dudosas.
// Fuentes: UNAM (León-Portilla), Wired Humanities Nahuatl Dictionary.
const NAHUATL = {
  home: ['Calmecac', 'escuela superior'],
  tutor: ['Tlamatinime', 'sabios que enseñan'],
  plan: ['Tonalpohualli', 'cuenta de los días'],
  cards: ['Amox', 'códice, libro'],
  quiz: ['Tlamatiliztli', 'saber activo'],
  exam: ['Momachtique', 'estudiantes'],
  materials: ['Amoxcalli', 'casa de los libros'],
  progress: ['Ixtlamachiliztli', 'hacer sabios los rostros'],
  settings: ['Tlacahuapahualiztli', 'arte de educar'],
  cuenta: ['Ixtli', 'rostro, identidad'],
  docente: ['Tlamachtiliztli', 'enseñanza'],
};
const nah = (view) => (state.lang === 'nah' ? NAHUATL[view] : null);

// De kínder a doctorado. Cada nivel define sesiones sugeridas y tono del tutor.
const LEVELS = [
  { id: 'kinder', label: 'Kínder', short: 'Kínder', minutes: 10, age: [3, 5] },
  { id: 'primaria', label: 'Primaria', short: 'Primaria', minutes: 15, age: [6, 11] },
  { id: 'secundaria', label: 'Secundaria', short: 'Secundaria', minutes: 25, age: [12, 15] },
  { id: 'bachillerato', label: 'Bachillerato', short: 'Prepa', minutes: 35, age: [16, 18] },
  { id: 'universidad', label: 'Universidad', short: 'Univ.', minutes: 50, age: [19, 25] },
  { id: 'posgrado', label: 'Maestría', short: 'Maestría', minutes: 60, age: [26, 35] },
  { id: 'doctorado', label: 'Doctorado', short: 'Doctorado', minutes: 75, age: [36, 99] },
];
const STYLES = [
  ['visual', 'Visual · esquemas y colores'],
  ['auditivo', 'Auditivo · hablar y escuchar'],
  ['kinestesico', 'Kinestésico · práctica y movimiento'],
  ['lector', 'Lector · texto y listas'],
  ['mixto', 'Mixto · un poco de todo'],
];
const TONES = [['amable', 'Amable y paciente'], ['jugueton', 'Juguetón'], ['serio', 'Sobrio y directo']];
const MODES = [
  ['didactic', '🧩 Didáctico'], ['socratic', '🎯 Socrático'], ['calm', '🌿 Sin presión'],
  ['play', '🎲 Juego'], ['solve', '🧮 Resolver'], ['tutor', '💬 Explicar'],
];
// Cada tutor es una ilustración detallada: cuatro animales y un maestro humano.
const SKINS = [
  { id: 'jade', name: 'Búho de jade', emoji: '🦉', art: 'owl', cost: 0, desc: 'Sabio y tranquilo, siempre contigo' },
  { id: 'obsidiana', name: 'Lobo de obsidiana', emoji: '🐺', art: 'wolf', cost: 30, desc: 'Calma y concentración' },
  { id: 'oro', name: 'Águila de oro', emoji: '🦅', art: 'eagle', cost: 80, desc: 'Mirada aguda para temas difíciles' },
  { id: 'estelar', name: 'Zorro estelar', emoji: '🦊', art: 'fox', cost: 150, desc: 'Curioso, veloz y amable' },
  { id: 'maestro', name: 'Tlamatinime', emoji: '🧙', art: 'tlamatinime', cost: 300, desc: 'El maestro humano que te guía' },
];
const ACCESSORIES = [
  { id: 'none', name: 'Sin accesorio', icon: '—', cost: 0, desc: 'Look clásico' },
  { id: 'penacho', name: 'Penacho', icon: '🪶', cost: 60, desc: 'Plumas de sabiduría' },
  { id: 'gafas', name: 'Gafas de lectura', icon: '👓', cost: 90, desc: 'Para mirar de cerca' },
  { id: 'amuleto', name: 'Amuleto de jade', icon: '📿', cost: 140, desc: 'Buena fortuna' },
  { id: 'capa', name: 'Capa ligera', icon: '🧣', cost: 200, desc: 'Paranoches frías' },
];
const FRAMES = [
  { id: 'none', name: 'Sin marco', cost: 0 }, { id: 'jade', name: 'Marco de jade', cost: 40 },
  { id: 'oro', name: 'Marco de oro', cost: 100 }, { id: 'estelar', name: 'Marco estelar', cost: 200 },
];
const BADGES = [
  { id: 'first-plan', icon: '🌱', name: 'Primer paso', desc: 'Creaste tu primer plan' },
  { id: 'curious', icon: '❓', name: 'Curioso', desc: 'Preguntaste al tutor 5 veces' },
  { id: 'cards-10', icon: '🧠', name: 'Memoria despierta', desc: 'Repasaste 10 tarjetas' },
  { id: 'quiz-100', icon: '🎯', name: 'Tiro certero', desc: 'Cuestionario perfecto' },
  { id: 'exam-done', icon: '📝', name: 'Simulacro hecho', desc: 'Completaste un simulacro' },
  { id: 'streak-3', icon: '🔥', name: 'Tres días seguidos', desc: 'Racha de 3 días' },
  { id: 'teacher', icon: '🍎', name: 'Maestro', desc: 'Creaste una guía didáctica' },
];
const AVATARS = ['🦉', '🦊', '🐢', '🐺', '🦅', '🧙', '🌻', '🐝', '🦋', '🐣', '🌙', '⭐'];
const levelByAge = (age) => LEVELS.find((l) => age >= l.age[0] && age <= l.age[1])?.id || 'bachillerato';
const profile = () => state.profiles?.find((p) => p.id === state.activeProfile) || state.profiles?.[0] || null;
const levelInfo = () => LEVELS.find((l) => l.id === profile()?.level) || LEVELS[3];
const kidMode = () => ['kinder', 'primaria'].includes(profile()?.level) || (Number(profile()?.age) > 0 && Number(profile()?.age) <= 10);
const tutorEmoji = () => SKINS.find((s) => s.id === profile()?.skin)?.emoji || '🦉';
const tutorAccessory = () => ACCESSORIES.find((a) => a.id === profile()?.accessory) || ACCESSORIES[0];

/** Tutor ilustrado 2D: SVG plano con accesorios CSS, sin WebGL ni dependencias. */
function tutor3d(size = 'sm', skinId = profile()?.skin || 'jade', accessoryId = profile()?.accessory || 'none') {
  const skin = SKINS.find((s) => s.id === skinId) || SKINS[0];
  const accessory = ACCESSORIES.find((a) => a.id === accessoryId) || ACCESSORIES[0];
  return `<span class="tutor3d ${size} skin-${esc(skin.id)} acc-${esc(accessory.id)}" role="img" aria-label="${esc(skin.name)} con ${esc(accessory.name)}">
    <span class="t3d-stage">
      <span class="t3d-shadow"></span>
      <span class="t3d-cape"></span>
      <img class="t3d-art" src="/tutors/${esc(skin.art)}.svg" alt="" />
      <span class="t3d-amulet"></span>
      <span class="t3d-glasses"></span>
      <span class="t3d-crest"></span>
    </span>
  </span>`;
}

const tutorFaceHtml = (size = 'sm') => (profile()?.avatar3d === false
  ? `<span class="tutor-emoji ${size}">${esc(tutorEmoji())}</span>`
  : tutor3d(size));

const profilePayload = () => ({
  level: profile()?.level || 'bachillerato', role: profile()?.role || 'student',
  age: Number(profile()?.age) || 0, style: profile()?.style || 'mixto',
  tone: profile()?.tone || 'amable', calm: profile()?.calm !== false,
});
const PROFILE_KEYS = ['courses', 'activeCourse', 'chat', 'chatMode', 'useMaterial', 'lang', 'srs', 'stats', 'groups'];
const pickProfileData = (source) => Object.fromEntries(PROFILE_KEYS.map((k) => [k, source[k]]));
const stripImages = (list) => (list || []).map((m) => ({ ...m, images: [] }));

function freshProfileData() {
  return {
    courses: [], activeCourse: null, chat: [], chatMode: 'didactic', useMaterial: true,
    lang: 'es', srs: {}, stats: { minutes: {}, quizResults: [] }, groups: [],
  };
}

function makeProfile(meta = {}, data = freshProfileData()) {
  return {
    id: uid(),
    name: String(meta.name || 'Mi cuenta').slice(0, 60),
    role: meta.role === 'teacher' ? 'teacher' : 'student',
    age: Math.max(0, Math.min(99, Number(meta.age) || 0)),
    level: meta.level || 'bachillerato',
    style: meta.style || 'mixto',
    tone: meta.tone || 'amable',
    calm: meta.calm !== false,
    avatar: meta.avatar || '🦉',
    photo: meta.photo || '',
    frame: meta.frame || 'none',
    skin: meta.skin || 'jade',
    accessory: meta.accessory || 'none',
    avatar3d: meta.avatar3d !== false,
    onboarded: meta.onboarded === true,
    guideDismissed: meta.guideDismissed === true,
    points: Number(meta.points) || 0,
    badges: Array.isArray(meta.badges) ? meta.badges.slice() : [],
    createdAt: meta.createdAt || new Date().toISOString(),
    save: pickProfileData({ ...freshProfileData(), ...data }),
  };
}

function freshState() {
  return {
    ...freshProfileData(),
    profiles: [],
    activeProfile: null,
    ui: {
      busy: false, toast: null, draft: '', images: [], cardSession: null, quiz: null,
      exam: null, models: [], noPressure: false, breathing: null, help: false,
      showAllDays: false, activeGroup: null, pendingPlanFiles: [], pendingMaterialFiles: [],
    },
  };
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!stored || !Array.isArray(stored.courses)) return freshState();
    const base = freshState();
    const merged = {
      ...base, ...stored,
      stats: { ...base.stats, ...(stored.stats || {}) },
      ui: { ...base.ui, toast: null, busy: false },
    };
    if (!Array.isArray(merged.profiles) || !merged.profiles.length) {
      const first = makeProfile({ name: 'Mi cuenta', level: stored.level || 'bachillerato' }, merged);
      merged.profiles = [first];
      merged.activeProfile = first.id;
    }
    const active = merged.profiles.find((p) => p.id === merged.activeProfile) || merged.profiles[0];
    merged.activeProfile = active.id;
    Object.assign(merged, pickProfileData({ ...base, ...(active.save || {}) }));
    merged.stats = { ...base.stats, ...(merged.stats || {}) };
    return merged;
  } catch {
    return freshState();
  }
}

let state = loadState();
if (!state.profiles.length) {
  const first = makeProfile({ name: 'Mi cuenta' }, state);
  state.profiles = [first];
  state.activeProfile = first.id;
}
let config = null;
let status = null;
let auth = null;

function save() {
  const active = profile();
  if (active) active.save = pickProfileData(state);
  const snapshot = {
    ...state,
    chat: stripImages(state.chat),
    profiles: state.profiles.map((p) => ({
      ...p,
      save: { ...p.save, chat: stripImages(p.save?.chat) },
    })),
    ui: { ...state.ui, images: [], toast: null, busy: false, draft: '', breathing: null },
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    state.ui.toast = { text: 'No se pudo guardar en el navegador (almacenamiento lleno). Prueba con fotos más pequeñas.', error: true };
  }
}

/** Respaldo completo de todas las cuentas locales para subir a la nube elegida. */
function cloudPayload() {
  const active = profile();
  if (active) active.save = pickProfileData(state);
  return {
    app: 'zoleva-calmedcatl',
    version: 6,
    exportedAt: new Date().toISOString(),
    owner: auth?.user ? { id: auth.user.id, email: auth.user.email, provider: auth.user.provider } : null,
    activeProfile: state.activeProfile,
    profiles: state.profiles.map((p) => ({
      ...p,
      save: { ...p.save, chat: stripImages(p.save?.chat) },
    })),
  };
}

function applyCloudData(data) {
  if (!data || !Array.isArray(data.profiles) || !data.profiles.length) {
    throw new Error('El respaldo de la nube no contiene cuentas válidas.');
  }
  const profiles = data.profiles.map((raw) => {
    const made = makeProfile(raw, { ...freshProfileData(), ...(raw.save || {}) });
    return {
      ...made,
      id: String(raw.id || made.id),
      createdAt: raw.createdAt || made.createdAt,
      save: { ...freshProfileData(), ...(raw.save || {}) },
    };
  });
  state.profiles = profiles;
  hydrateProfile(profiles.find((p) => p.id === data.activeProfile) || profiles[0]);
  save();
}

/** Suma puntos y desbloquea una insignia; el progreso nunca es una nota negativa. */
function award(points, badgeId) {
  const p = profile();
  if (!p) return;
  p.points = (p.points || 0) + points;
  if (badgeId && !p.badges.includes(badgeId)) {
    p.badges.push(badgeId);
    const badge = BADGES.find((b) => b.id === badgeId);
    state.ui.toast = { text: `🏅 ${badge?.name || 'Insignia'} desbloqueada · +${points} ✦`, error: false };
  }
  save();
}

function checkBadges() {
  const p = profile();
  if (!p) return;
  const earned = [];
  if (streak() >= 3) earned.push('streak-3');
  if (state.chat.filter((m) => m.role === 'user').length >= 5) earned.push('curious');
  if (Object.keys(state.srs).length >= 10) earned.push('cards-10');
  const fresh = earned.find((id) => !p.badges.includes(id));
  if (fresh && !state.ui.toast) {
    p.badges.push(fresh);
    const badge = BADGES.find((b) => b.id === fresh);
    state.ui.toast = { text: `🏅 ${badge?.name || 'Insignia'} desbloqueada`, error: false };
  }
}

let breathTimer = null;
function stopBreathing() {
  if (breathTimer) clearInterval(breathTimer);
  breathTimer = null;
  if (state.ui) state.ui.breathing = null;
}

/** Pausa guiada 4-4-6 para bajar la ansiedad antes de estudiar. */
function startBreathing() {
  stopBreathing();
  const phases = [
    { phase: 'Inhala 🌬️', hint: 'Cuenta hasta 4…' },
    { phase: 'Mantén ✨', hint: 'Cuenta hasta 4…' },
    { phase: 'Exhala 🌿', hint: 'Cuenta hasta 6…' },
  ];
  const lengths = [4, 4, 6];
  let index = 0; let elapsed = 0;
  state.ui.breathing = { ...phases[0], count: 0 };
  render();
  breathTimer = setInterval(() => {
    if (!state.ui.breathing) return stopBreathing();
    elapsed++;
    if (elapsed >= lengths[index]) {
      elapsed = 0;
      index = (index + 1) % phases.length;
      state.ui.breathing.count = (state.ui.breathing.count || 0) + 1;
    }
    Object.assign(state.ui.breathing, phases[index]);
    render();
  }, 1000);
}

function hydrateProfile(p) {
  if (!p) return;
  state.activeProfile = p.id;
  Object.assign(state, pickProfileData({ ...freshProfileData(), ...(p.save || {}) }));
  state.stats = { minutes: {}, quizResults: [], ...(state.stats || {}) };
  state.ui.toast = null;
  state.ui.cardSession = null;
  state.ui.quiz = null;
  state.ui.exam = null;
}

function switchProfile(id) {
  const target = state.profiles.find((p) => p.id === id);
  if (!target) return;
  const current = profile();
  if (current) current.save = pickProfileData(state);
  hydrateProfile(target);
  save();
  render();
}

function toast(text, error = false) {
  state.ui.toast = { text, error };
  render();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
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
  const requested = parts[1] || 'home';
  const view = requested === 'perfil' ? 'cuenta' : requested;
  return { app: true, view: navItems().some((n) => n.id === view) ? view : 'home' };
}

function course() {
  return state.courses.find((c) => c.id === state.activeCourse) || state.courses[0] || null;
}

function materialText(c = course()) {
  const notes = c?.materials?.map((m) => m.text || '').filter(Boolean).join('\n\n').slice(0, 60000);
  if (notes) return notes;
  const topics = (c?.plan?.topics || [])
    .map((t) => `${t.subject ? `[${t.subject}] ` : ''}${t.title}. ${t.description || ''}`.trim())
    .filter(Boolean)
    .join('\n');
  return topics.slice(0, 60000);
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

/* ------------------------- Calendario de estudio ------------------------- */
function dayLabel(day) {
  if (day === localDateKey()) return 'Hoy';
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  if (day === localDateKey(tomorrow)) return 'Mañana';
  return new Date(`${day}T12:00:00`).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
}

function syncTopicFromSchedule(c, topicId) {
  const topic = c?.plan?.topics?.find((t) => t.id === topicId);
  const sessions = (c?.schedule?.sessions || []).filter((s) => s.topicId === topicId);
  if (!topic || !sessions.length) return false;
  const wasDone = topic.status === 'done';
  const allDone = sessions.every((s) => s.done);
  topic.status = allDone ? 'done' : sessions.some((s) => s.done) ? 'doing' : 'todo';
  return !wasDone && topic.status === 'done';
}

/** Reparte de nuevo los temas conservando las sesiones ya terminadas. */
function rebuildSchedule(c) {
  if (!c?.plan?.topics?.length) return null;
  const doneByTopic = new Map();
  for (const session of c.schedule?.sessions || []) {
    if (session.done) doneByTopic.set(session.topicId, (doneByTopic.get(session.topicId) || 0) + 1);
  }
  c.hoursPerDay = Number(c.hoursPerDay) || 1.5;
  const deadlines = Object.fromEntries(c.plan.topics
    .filter((t) => t.examDate || t.subjectDate)
    .map((t) => [t.id, t.examDate || t.subjectDate]));
  c.schedule = buildStudySchedule({
    topics: c.plan.topics,
    examDate: c.examDate || '',
    hoursPerDay: c.hoursPerDay,
    deadlines,
  });
  for (const session of c.schedule?.sessions || []) {
    const left = doneByTopic.get(session.topicId) || 0;
    if (left > 0) { session.done = true; doneByTopic.set(session.topicId, left - 1); }
  }
  for (const topic of c.plan.topics) syncTopicFromSchedule(c, topic.id);
  return c.schedule;
}

function schedulePanel(c) {
  if (!c?.plan?.topics?.length) return '';
  const schedule = c.schedule;
  const sum = scheduleSummary(schedule);
  const days = schedule ? [...new Set(schedule.sessions.map((s) => s.date))].sort() : [];
  const visible = state.ui.showAllDays ? days : days.slice(0, 7);
  return `<div class="panel stack" id="calendario">
    <div class="panel-title"><div><span class="eyebrow">Tu calendario</span><h2 style="margin:6px 0 0">Qué estudiar cada día</h2></div>
      <div class="row"><span class="pill ${schedule?.late ? 'medium' : 'done'}">${schedule ? `${sum.done}/${sum.total} sesiones` : 'sin calendario'}</span>
        <button class="btn small" data-action="build-schedule">${schedule ? 'Rehacer' : 'Crear calendario'}</button></div></div>
    ${!schedule ? '<p class="muted small">Con tus fechas y el tiempo diario repartimos los temas de todas tus materias en sesiones cortas. Así sabes siempre qué toca.</p>' : `
      <p class="muted small">${sum.total} sesiones · ${sum.days} días · ${sum.subjects} materia${sum.subjects === 1 ? '' : 's'} · ${Math.round(sum.leftMinutes)} min por delante${schedule.examDate || c.examDate ? ` · examen el ${esc(schedule.examDate || c.examDate)}` : ''}.</p>
      ${schedule.late ? '<p class="muted small" style="color:var(--amber)">A este ritmo algunas sesiones caen después de su fecha. Sube tus horas al día al rehacer el plan o cambia prioridades.</p>' : ''}
      <div class="schedule-days">${visible.map((day) => {
        const items = sessionsForDate(schedule, day);
        return `<div class="schedule-day ${day === localDateKey() ? 'today' : ''}">
          <div class="row between"><strong>${esc(dayLabel(day))}</strong><span class="muted tiny">${items.reduce((a, s) => a + s.minutes, 0)} min</span></div>
          ${items.map((s) => `<div class="session ${s.done ? 'done' : ''}"><button class="session-check" data-action="toggle-session" data-id="${esc(s.id)}" title="${s.done ? 'Marcar pendiente' : 'Marcar lista'}">${s.done ? '✓' : ''}</button><span class="grow">${esc(s.title)}${s.subject ? ` <span class="tiny muted">· ${esc(s.subject)}</span>` : ''}</span><span class="tiny muted">${s.minutes} min</span></div>`).join('')}
        </div>`;
      }).join('')}</div>
      ${days.length > visible.length ? `<button class="btn small ghost" data-action="toggle-all-days">${state.ui.showAllDays ? 'Ver solo una semana' : `Ver los ${days.length} días`}</button>` : ''}
      <p class="muted tiny">Marca cada sesión al terminarla. Cuando se acaban las sesiones de un tema, ese tema pasa a «Dominado» y sale del calendario, pero sigue en la lista de Temas.</p>`}
  </div>`;
}

function todayPanel(c) {
  if (!c?.plan?.topics?.length) return '';
  const today = localDateKey();
  const sessions = sessionsForDate(c.schedule, today);
  const overdue = (c.schedule?.sessions || []).filter((s) => !s.done && s.date < today);
  const pending = [...overdue, ...sessions.filter((s) => !s.done)];
  const nextPending = [...(c.schedule?.sessions || [])].filter((s) => !s.done).sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextLabel = nextPending ? dayLabel(nextPending.date).replace(/^./, (letter) => letter.toLowerCase()) : '';
  if (!c.schedule || (!sessions.length && !overdue.length)) {
    return `<div class="panel stack"><div class="panel-title"><div><span class="eyebrow">Lo de hoy</span><h2 style="margin:6px 0 0">Tu siguiente paso</h2></div></div>
      <p class="muted small">Crea tu calendario y verás qué tema toca hoy y cuánto tiempo dedicarle.</p>
      <div class="row"><button class="btn small primary" data-action="build-schedule">Crear mi calendario →</button><a class="btn small" href="#/app/tutor">Preguntar al tutor</a></div></div>`;
  }
  return `<div class="panel stack"><div class="panel-title"><div><span class="eyebrow">Lo de hoy</span><h2 style="margin:6px 0 0">${pending.length ? `${pending.length} sesión${pending.length === 1 ? '' : 'es'} pendiente${pending.length === 1 ? '' : 's'}` : '¡Todo hecho por hoy! 🎉'}</h2></div>
      <a class="btn small" href="#/app/plan">Ver calendario</a></div>
    ${pending.length ? `<div class="onboard-steps">${pending.map((s) => `<div class="onboard-step"><span class="onboard-num">${s.minutes}′</span>
      <div class="grow"><strong>${esc(s.title)}</strong><p class="muted small">${s.subject ? `${esc(s.subject)} · ` : ''}${s.date < today ? 'Pendiente de otro día' : 'Sesión de hoy'}</p></div>
      <button class="btn small primary" data-action="toggle-session" data-id="${esc(s.id)}">Marcar lista ✓</button></div>`).join('')}</div>`
      : `<p class="muted small">${nextPending ? `Tu próxima sesión es ${esc(nextLabel)}. Puedes adelantarte si quieres.` : '¡Plan completo! Haz un simulacro para comprobar lo que aprendiste.'} También puedes repasar tarjetas o preguntar al tutor.</p>`}
    <div class="row" style="margin-top:14px"><a class="btn primary small" href="#/app/tutor">Preguntar al tutor</a><a class="btn small" href="#/app/cards">Repasar tarjetas</a></div>
  </div>`;
}

/* ------------------------- Guía para principiantes ------------------------- */
function beginnerSteps() {
  return [
    {
      n: 1,
      title: 'Cuéntame quién eres',
      text: 'Escribe tu nombre y elige tu nivel. Así el tutor te habla a tu medida.',
      done: Boolean(profile()?.onboarded),
      href: '#/app/cuenta',
      cta: 'Configurar mi cuenta',
    },
    {
      n: 2,
      title: 'Crea tu plan de materias',
      text: 'Escribe los temas de cada materia, sin apuntes. Verás un calendario que combina todas.',
      done: Boolean(course()),
      href: '#/app/plan',
      cta: 'Crear mi plan',
    },
    {
      n: 3,
      title: 'Habla con tu tutor',
      text: 'Pregunta lo que no entiendas. Te dará pistas, no respuestas.',
      done: state.chat.some((m) => m.role === 'user'),
      href: '#/app/tutor',
      cta: 'Hacer una pregunta',
    },
  ];
}

function beginnerChecklist() {
  const p = profile();
  if (!p || p.guideDismissed) return '';
  const steps = beginnerSteps();
  const done = steps.filter((step) => step.done).length;
  return `<div class="panel stack onboard" id="guia">
    <div class="panel-title"><div><span class="eyebrow">Guía para empezar</span><h2 style="margin:6px 0 0">Solo tres pasos y ya sabes usarlo</h2></div>
      <div class="row"><span class="pill ${done === 3 ? 'done' : 'medium'}">${done} de 3</span><button class="btn small ghost" data-action="dismiss-guide" title="Ocultar esta guía">Ocultar</button></div></div>
    <div class="onboard-steps">${steps.map((step) => `<div class="onboard-step ${step.done ? 'done' : ''}">
      <span class="onboard-num">${step.done ? '✓' : step.n}</span>
      <div class="grow"><strong>${esc(step.title)}</strong><p class="muted small">${esc(step.text)}</p></div>
      <a class="btn small ${step.done ? 'ghost' : 'primary'}" href="${step.href}">${step.done ? 'Ver de nuevo' : `${esc(step.cta)} →`}</a>
    </div>`).join('')}</div>
    <p class="muted tiny">¿Te queda alguna duda? Pulsa <button class="linklike" data-action="show-help">❓ Cómo empezar</button> en la barra de arriba.</p>
  </div>`;
}

function helpOverlay() {
  if (!state.ui.help) return '';
  const steps = beginnerSteps();
  return `<div class="help-overlay"><div class="help-box stack">
    <div class="panel-title"><div><span class="eyebrow">Guía rápida</span><h2 style="margin:6px 0 0">🌱 Así se usa Zoleva</h2></div><button class="btn small ghost" data-action="close-help">Cerrar ✕</button></div>
    <div class="onboard-steps">${steps.map((step) => `<div class="onboard-step">
      <span class="onboard-num">${step.n}</span>
      <div class="grow"><strong>${esc(step.title)}</strong><p class="muted small">${esc(step.text)}</p></div>
      <button class="btn small primary" data-action="help-go" data-href="${step.href}">Ir ahí →</button>
    </div>`).join('')}</div>
    <div class="panel compact"><p class="muted small" style="margin:0">En <strong>Mi plan</strong> puedes poner varias materias y sus temas sin necesitar apuntes. El calendario alterna materias para que avances en todas; en <strong>Inicio</strong> ves «Lo de hoy». Después usa <strong>Tarjetas</strong> para repasar, <strong>Practicar</strong> con preguntas y <strong>Examen de práctica</strong> para medirte. Todo se guarda en tu navegador: sin registro obligatorio, sin pago y sin anuncios.</p></div>
    <p class="muted tiny">Si algo no funciona, prueba Ajustes: con el modo demo puedes ver la app entera sin configurar IA.</p>
  </div></div>`;
}

/* ------------------------- Landing ------------------------- */
function landing() {
  return `<div class="landing">
    <nav class="nav container">
      <a class="brand" href="#/"><img class="brand-icon" src="/icons/app-icon.svg" alt="" /><span class="brand-name">Zoleva Calmécatl</span></a>
      <div class="nav-links"><a href="#origen">Origen</a><a href="#niveles">Niveles</a><a href="#glosario">Náhuatl</a><a href="#caracteristicas">Funciones</a><a href="#ia">Tu IA</a><a href="#faq">Preguntas</a></div>
      <div class="row"><button class="pill" data-action="show-help">❓ Cómo empezar</button><button class="pill" data-action="toggle-lang">${state.lang === 'nah' ? '◈ Náhuatl' : '◈ Español'}</button><a class="btn primary small" href="#/app">Entrar gratis →</a></div>
    </nav>

    <header class="hero container"><div class="hero-grid">
      <div>
        <img class="hero-wordmark" src="/icons/wordmark.svg" alt="Zoleva Calmécatl" />
        <span class="badge">◈ Del náhuatl: escuela de élite mexica · código abierto</span>
        <h1>${state.lang === 'nah' ? 'Calmecac: <span class="gradient-text">tlamatiliztli para todos.</span>' : 'La escuela de élite mexica, <span class="gradient-text">gratis y en tu bolsillo.</span>'}</h1>
        <p class="lead"><strong>Zoleva Calmécatl</strong> convierte tus temas o apuntes en un calendario de estudio, lecciones, tarjetas, cuestionarios y simulacros. Puedes organizar varias materias a la vez, sin registro obligatorio, sin pago y sin anuncios.</p>
        ${state.lang === 'nah' ? '<p class="small muted">Calmecac = escuela superior · tlamatiliztli = saber activo, sabiduría.</p>' : ''}
        <div class="actions"><a class="btn primary" href="#/app">Entrar a la escuela →</a><button class="btn ghost" data-action="show-help">❓ ¿Por dónde empiezo?</button></div>
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
      <div class="card origen"><div><span class="eyebrow">El nombre</span><h2 style="margin:10px 0">Zoleva Calmécatl</h2><p>Del náhuatl, <strong>escuela de élite mexica</strong>. El calmecac era el lugar donde se formaban los jóvenes de la nobleza: disciplina, memoria, lectura del cielo y dominio de las artes. Aquí recuperamos esa idea —aprender con rigor y sin excusas— y la ponemos al alcance de cualquiera, gratis y con la IA que tú elijas.</p></div><div class="origen-sello origen-logo" aria-hidden="true"><img src="/icons/app-icon-detail.svg" alt="" /></div></div>
    </section>

    <section class="block container" id="glosario">
      <div class="section-head"><span class="eyebrow">Glosario náhuatl</span><h2>Las palabras que dan nombre a cada paso</h2><p>Términos documentados por el Instituto de Investigaciones Históricas de la UNAM y el Wired Humanities Nahuatl Dictionary. La interfaz sigue en español para que nada pierda claridad.</p></div>
      <div class="grid cols-3">
        <div class="card"><div class="icon">◈</div><h3>Calmecac</h3><p>Escuela superior; literalmente “en la hilera de casas”. Formaba en saber, disciplina y artes.</p></div>
        <div class="card"><div class="icon">✧</div><h3>Tlamatiliztli</h3><p>Saber activo, sabiduría que se busca y se ejercita.</p></div>
        <div class="card"><div class="icon">✧</div><h3>Ixtlamachiliztli</h3><p>“Hacer sabios los rostros ajenos”: transmitir el conocimiento.</p></div>
        <div class="card"><div class="icon">✧</div><h3>Tlamatinime</h3><p>Los sabios, maestros y poseedores del código.</p></div>
        <div class="card"><div class="icon">✧</div><h3>Amoxcalli</h3><p>Casa de los libros o códices: biblioteca del saber.</p></div>
        <div class="card"><div class="icon">✧</div><h3>Tonalpohualli</h3><p>Cuenta de los días; el calendario con el que se ordena el tiempo.</p></div>
      </div>
    </section>

    <section class="block container" id="como-funciona">
      <div class="section-head"><span class="eyebrow">Cómo funciona</span><h2>De un montón de apuntes a un plan que puedes seguir</h2><p>Tú aportas el material. Zoleva Calmécatl lo convierte en pasos pequeños, práctica real y un tutor que te espera cuando te atascas.</p></div>
      <div class="grid cols-4">
        <div class="card"><div class="step-num">01</div><h3>Pon la fecha</h3><p>Dime qué asignatura tienes y cuándo es el examen. El plan se adapta al tiempo que queda.</p></div>
        <div class="card"><div class="step-num">02</div><h3>Pon tus materias y temas</h3><p>Escribe los temas de cada materia sin apuntes. Si tienes material, pégalo después para generar lecciones y preguntas.</p></div>
        <div class="card"><div class="step-num">03</div><h3>Estudia paso a paso</h3><p>Un calendario te dice qué toca cada día. Lecciones, tarjetas, preguntas y simulacros salen de tu material.</p></div>
        <div class="card"><div class="step-num">04</div><h3>Pregunta sin parar</h3><p>El tutor te da pistas, no respuestas. Tú decides cuándo usar la IA local o la de la nube.</p></div>
      </div>
    </section>

    <section class="block container" id="caracteristicas">
      <div class="section-head"><span class="eyebrow">Funciones</span><h2>Disciplina, repetición y dominio</h2><p>Como en el calmecac, pero sin puertas cerradas: gratis, de código abierto y con tus datos guardados en tu dispositivo.</p></div>
      <div class="grid cols-3">
        <div class="card"><div class="icon">🗺️</div><h3>Varias materias, un calendario</h3><p>Escribe temas sin apuntes y reparte sesiones entre todas tus materias. Siempre sabes qué toca hoy y qué sigue.</p></div>
        <div class="card"><div class="icon">💬</div><h3>Tutor socrático</h3><p>Preguntas, pistas y comprobación de comprensión. También puede resolver paso a paso si lo pides.</p></div>
        <div class="card"><div class="icon">🧠</div><h3>Tarjetas inteligentes</h3><p>Repetición espaciada: las difíciles vuelven antes y las que dominas se espacian.</p></div>
        <div class="card"><div class="icon">✅</div><h3>Cuestionarios corregidos</h3><p>Preguntas con explicación para que sepas exactamente dónde fallaste.</p></div>
        <div class="card"><div class="icon">📝</div><h3>Simulacros con tiempo</h3><p>Preguntas objetivas y desarrolladas, con rúbrica y resultados por tema.</p></div>
        <div class="card"><div class="icon">📷</div><h3>Fotos de ejercicios</h3><p>Adjunta una imagen al tutor y que te guíe paso a paso con proveedores con visión.</p></div>
      </div>
    </section>

    <section class="block container" id="niveles">
      <div class="section-head"><span class="eyebrow">De kínder a doctorado</span><h2>Una escuela para cada edad, también para quienes enseñan</h2><p>El tutor ajusta las palabras, la longitud de los pasos, el ritmo y el tono. Tú eliges cómo quieres aprender: con dibujos, hablando, practicando o leyendo.</p></div>
      <div class="grid cols-4">
        <div class="card"><div class="icon">🧸</div><h3>Kínder y primaria</h3><p>Juegos, emojis, pasos de un minuto y estrellas. Sin presión y con mucho ánimo.</p></div>
        <div class="card"><div class="icon">🎒</div><h3>Secundaria y prepa</h3><p>Ejemplos claros, pistas antes que respuestas y simulacros para ganar confianza.</p></div>
        <div class="card"><div class="icon">🎓</div><h3>Universidad, maestría y doctorado</h3><p>Rigor, matices, análisis crítico y síntesis a partir de tus propios materiales.</p></div>
        <div class="card"><div class="icon">🍎</div><h3>Docentes</h3><p>Grupos locales, guías didácticas, rúbricas y juegos adaptados a cada nivel.</p></div>
      </div>
      <div class="card" style="margin-top:20px"><h3>Recompensas que no son un examen</h3><p>Ganas ✦ puntos por estudiar, desbloqueas insignias y cambias la apariencia de tu tutor con skins de jade, obsidiana, oro y más. Todo se guarda en tu cuenta local: no hay clasificación, ni competencia con otros, ni castigos. Y si quieres, puedes subirlo a tu propia nube.</p></div>
    </section>

    <section class="block container" id="ia">
      <div class="section-head"><span class="eyebrow">Tu IA, tus reglas</span><h2>Cámbiala cuando quieras. Incluso sin internet.</h2><p>Elige un proveedor en Ajustes. Si uno falla, Zoleva Calmécatl sigue funcionando con el modo demo.</p></div>
      <div class="provider-strip">
        <span>🦙 Ollama / llama.cpp / LM Studio</span><span>🌐 OpenRouter (modelos :free)</span><span>◈ Google Gemini</span>
        <span>⚡ Groq</span><span>🖥️ opencode</span><span>🖥️ Codex CLI</span><span>🖥️ Claude CLI</span><span>🖥️ Gemini CLI</span><span>⌨️ Tu comando personalizado</span>
      </div>
      <div class="card" style="margin-top:20px"><h3>Sin proveedor también funciona</h3><p>El modo demo genera planes, tarjetas y preguntas de ejemplo a partir de tu texto, sin red y sin claves. Es ideal para probar la app antes de configurar nada.</p></div>
    </section>

    <section class="cta-band container"><div class="cta-inner"><div class="greca" aria-hidden="true" style="margin:0 auto 18px"></div><h2>Entra al calmecac. Cuesta cero.</h2><p>Sin tarjeta, sin registro obligatorio y sin anuncios. Tu cuenta vive en tu equipo; tú decides si la respaldas en la nube.</p><div class="actions" style="justify-content:center"><a class="btn primary" href="#/app">Abrir Zoleva Calmécatl →</a><a class="btn ghost" href="#ia">Qué IA puedo usar</a></div></div></section>

    <section class="block container" id="faq">
      <div class="section-head"><span class="eyebrow">Preguntas frecuentes</span><h2>Lo que probablemente te preguntes</h2></div>
      <details class="faq"><summary>¿Qué significa Zoleva Calmécatl?</summary><p>Es náhuatl: «escuela de élite mexica». El calmecac formaba a la élite con disciplina, memoria y conocimiento. Tomamos esa herencia como idea de estudio riguroso, pero abierta a todo el mundo y sin coste.</p></details>
      <details class="faq"><summary>¿Es realmente gratis?</summary><p>Sí. El código es MIT y no hay suscripción. La IA local es gratuita; los proveedores en nube tienen capas gratuitas o usan la clave/CLI que tú ya tienes.</p></details>
      <details class="faq"><summary>¿Sirve para niños y para doctorado?</summary><p>Sí. La cuenta guarda edad y nivel (de kínder a doctorado) y el tutor adapta vocabulario, extensión y ejemplos. También hay modos Juego y Sin presión para quienes se frustran fácil.</p></details>
      <details class="faq"><summary>¿Pueden usarlo los docentes?</summary><p>Sí. Activa el rol Docente en Mi cuenta: aparece un panel de grupos donde preparar guías didácticas, rúbricas y juegos, y donde resumir el progreso que exportan tus estudiantes.</p></details>
      <details class="faq"><summary>¿Qué son los puntos y las skins?</summary><p>Son recompensas internas y locales: ganas ✦ por estudiar, desbloqueas insignias y cambias el compañero que te acompaña en el tutor. No hay pagos, clasificaciones ni competencia.</p></details>
      <details class="faq"><summary>¿Necesito saber programar?</summary><p>No. Solo abre la página web. Si quieres IA local, instala Ollama y descarga un modelo; en Ajustes puedes pegar la dirección y el nombre del modelo.</p></details>
      <details class="faq"><summary>¿Adónde van mis apuntes?</summary><p>A tu navegador y, si usas IA en la nube, al proveedor que elijas. No hay servidor central ni telemetría: tu cuenta y tus datos se guardan en tu equipo. El respaldo en la nube solo ocurre si tú lo activas.</p></details>
      <details class="faq"><summary>¿Funciona en móvil?</summary><p>Sí. Es una PWA: ábrela en el navegador y añádela a la pantalla de inicio. En el mismo WiFi de tu ordenador puedes usar el modelo local.</p></details>
    </section>

    <footer class="footer container"><span>◈ Zoleva Calmécatl · escuela de élite mexica · código abierto</span><span>Hecho para aprender de verdad · MIT License</span></footer>
    ${helpOverlay()}
  </div>`;
}

/* ------------------------- App shell ------------------------- */
function appShell(view) {
  const [title, subtitle] = TITLES[view];
  const active = status?.providers?.find((p) => p.id === status.active);
  const ready = active?.ready;
  return `<div class="app">
    <aside class="sidebar">
      <a class="brand" href="#/"><img class="sidebar-wordmark" src="/icons/wordmark-alt.svg" alt="Zoleva Calmécatl" /></a>
      <nav>${navItems().map((item) => {
        const term = nah(item.id);
        return `<a class="nav-item ${view === item.id ? 'active' : ''}" href="#/app/${item.id}"><span class="ic">${item.icon}</span><span>${item.label}${term ? `<span class="nah-term">${esc(term[0])}</span>` : ''}</span></a>`;
      }).join('')}</nav>
      <div class="sidebar-foot">
        <a class="profile-chip" href="#/app/cuenta"><span class="avatar sm frame-${esc(profile()?.frame || 'none')}">${profile()?.photo ? `<img src="${esc(profile().photo)}" alt="" />` : esc(profile()?.avatar || '🦉')}</span><span><strong>${esc(profile()?.name || 'Mi cuenta')}</strong><br /><span class="tiny">${profile()?.points || 0} ✦ · ${esc(levelInfo().label)} · ${profile()?.role === 'teacher' ? 'Docente' : 'Estudiante'}</span></span></a>
        <div class="status-pill"><span class="dot ${ready ? 'ok' : 'bad'}"></span><div><strong>${esc(active?.name || 'Cargando…')}</strong><br /><span class="tiny">${esc(status?.model || '')}</span></div></div>
        <a class="nav-item" href="#/app/settings"><span class="ic">⚙️</span>${ready ? 'IA conectada' : 'Configurar IA'}</a>
        <a class="nav-item" href="#/"><span class="ic">←</span>Página de inicio</a>
      </div>
    </aside>
    <main class="main">
      <header class="topbar"><div><h1>${esc(title)}</h1>${nah(view) ? `<div class="nah-line"><span class="nah-term">${esc(nah(view)[0])}</span><span class="nah-gloss">${esc(nah(view)[1])}</span></div>` : ''}<p>${esc(subtitle)}</p></div>
        <div class="right"><button class="pill" data-action="show-help" title="Guía rápida para principiantes">❓ Cómo empezar</button><button class="pill" data-action="breathe" title="Pausa de respiración de 60 segundos">🌿 Respirar</button><a class="pill" href="#/app/cuenta" title="Tus recompensas">✦ ${profile()?.points || 0}</a><button class="pill" data-action="toggle-lang" title="Alternar español / náhuatl">${state.lang === 'nah' ? '◈ Náhuatl' : '◈ Español'}</button><span class="pill">${esc(active?.name || 'IA')}</span>${state.ui.busy ? '<span class="spinner"></span>' : ''}</div>
      </header>
      <nav class="mobile-nav">${navItems().map((item) => `<a class="tab ${view === item.id ? 'active' : ''}" href="#/app/${item.id}">${item.icon} ${item.label}</a>`).join('')}</nav>
      <div id="content">${views[view] ? views[view]() : views.home()}</div>
    </main>
    ${state.ui.breathing ? `<div class="breath-overlay" data-action="close-breathing"><div class="breath-box" data-stop="1"><div class="breath-circle"><span>${esc(state.ui.breathing.phase)}</span></div><p>${esc(state.ui.breathing.hint)}</p><div class="muted tiny">${state.ui.breathing.count} / 6 · pulsa fuera para salir</div></div></div>` : ''}
    ${state.ui.toast ? `<div class="toast ${state.ui.toast.error ? 'error' : ''}" data-action="close-toast">${esc(state.ui.toast.text)}</div>` : ''}
    ${helpOverlay()}
  </div>`;
}

/* ------------------------- Vistas ------------------------- */
const views = {};

views.home = () => {
  const c = course();
  const k = kidMode();
  const p = profile();
  const header = `<div class="panel profile-banner">
    <span class="avatar lg frame-${esc(p?.frame || 'none')}">${p?.photo ? `<img src="${esc(p.photo)}" alt="Tu foto de cuenta" />` : esc(p?.avatar || '🦉')}</span>
    <div class="grow"><span class="eyebrow">${k ? 'Tu misión de hoy' : 'Tu espacio de estudio'}</span>
      <h2 style="margin:6px 0">${k ? `¡Hola, ${esc(p?.name || 'explorador')}! 👋` : `Hola, ${esc(p?.name || 'estudiante')}.`}</h2>
      <p class="muted small">${k ? 'Un pasito a la vez. Tu tutor te acompaña y no hay prisa.' : `${esc(levelInfo().label)} · sesiones sugeridas de ${levelInfo().minutes} min. Puedes ir a tu ritmo.`}</p>
    </div>
    <div class="row">${tutorFaceHtml('sm')}<span class="pill gold">✦ ${p?.points || 0}</span><a class="btn small" href="#/app/cuenta">Recompensas</a><button class="btn small" data-action="breathe">🌿 Respirar</button></div>
  </div>`;
  if (!c) {
    return `<div class="stack">${header}${beginnerChecklist()}<div class="panel empty">${tutorFaceHtml('lg')}<h3>${k ? '¡Vamos a crear tu primera misión!' : 'Empecemos con tu primer plan'}</h3>
      <p>${k ? 'Pon un tema que te guste y tus apuntes. Hacemos pasos pequeños y ganas estrellas.' : 'Crea un plan a partir de tus apuntes. Tu cuenta es local y no pagas nada.'}</p><div class="actions" style="justify-content:center;margin-top:18px"><a class="btn primary" href="#/app/plan">${k ? 'Crear mi misión →' : 'Crear mi plan →'}</a><a class="btn ghost" href="#/app/tutor">Hablar con el tutor</a></div></div></div>`;
  }
  const left = daysUntil(c.examDate);
  const done = c.plan?.topics?.filter((t) => t.status === 'done').length || 0;
  const total = c.plan?.topics?.length || 0;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { day: d, key: d.toISOString().slice(0, 10) };
  });
  return `<div class="stack">
    ${header}
    ${beginnerChecklist()}
    ${todayPanel(c)}
    <div class="panel">
      <div class="row between"><div><span class="eyebrow">${k ? 'Tu meta' : 'Tu examen'}</span><h2 style="margin:8px 0 4px">${esc(c.title || c.subject || 'Mi examen')}</h2><div class="muted small">${esc(c.subject || '')} · nivel ${esc(profile()?.level || config?.level || 'bachillerato')}</div></div>
        ${left !== null ? `<div class="center"><div style="font-family:'Space Grotesk';font-size:34px">${left >= 0 ? left : '—'}</div><div class="muted tiny">días restantes</div></div>` : ''}</div>
      <div class="bar" style="margin-top:18px"><i style="width:${percent}%"></i></div>
      <div class="row between tiny muted" style="margin-top:8px"><span>${done} de ${total} temas dominados</span><span>${percent} % del plan</span></div>
    </div>
    <div class="grid cols-3-app">
      <div class="stat"><div class="value">${streak()} 🔥</div><div class="label">días de racha</div></div>
      <div class="stat"><div class="value">${dueCards()}</div><div class="label">tarjetas para repasar</div></div>
      <div class="stat"><div class="value">${state.stats.minutes[new Date().toISOString().slice(0, 10)] || 0} min</div><div class="label">estudiados hoy</div></div>
    </div>
    <div class="panel"><div class="panel-title"><h2>Tu semana</h2><span class="muted small">minutos por día</span></div>
      <div class="chart">${last7.map(({ day, key }) => `<div class="col"><i style="height:${Math.max(3, Math.min(100, (state.stats.minutes[key] || 0) * 2))}%"></i><span>${day.toLocaleDateString('es', { weekday: 'short' }).slice(0, 2)}</span></div>`).join('')}</div>
    </div>
  </div>`;
};

views.plan = () => {
  const c = course();
  if (!c) return planForm();
  const topics = c.plan?.topics || [];
  const done = topics.filter((t) => t.status === 'done').length;
  return `<div class="stack">
    <div class="panel"><div class="panel-title"><div><h2>${esc(c.title || c.subject)}</h2><div class="muted small">${esc(c.subject || 'Sin materias')} · ${c.subjects?.length || 1} materia${c.subjects?.length === 1 ? '' : 's'} · ${topics.length} temas · ${done} completados</div></div>
      <div class="row"><a class="btn small" href="#/app/materials">Mis apuntes</a><button class="btn small" data-action="new-course">Nuevo plan</button></div></div>
      ${c.plan?.summary ? `<p class="muted" style="line-height:1.6">${esc(c.plan.summary)}</p>` : ''}
      <div class="bar"><i style="width:${topics.length ? Math.round(done / topics.length * 100) : 0}%"></i></div>
      <div class="row" style="margin-top:16px">
        <button class="btn small" data-action="generate" data-kind="lessons">📖 Generar lecciones</button>
        <button class="btn small" data-action="generate" data-kind="flashcards">🧠 Generar tarjetas</button>
        <button class="btn small" data-action="generate" data-kind="quiz">✅ Generar preguntas</button>
        <button class="btn small" data-action="generate" data-kind="exam">📝 Generar simulacro</button>
        <button class="btn small" data-action="generate" data-kind="podcast">🎧 Generar podcast</button>
      </div>
    </div>
    ${todayPanel(c)}
    ${schedulePanel(c)}
    <div class="panel"><div class="panel-title"><h2>Temas</h2><span class="muted small">marca lo que domines</span></div>
      ${topics.length ? topics.map((t) => `<div class="topic"><div style="flex:1"><h4>${esc(t.title)}</h4><p>${esc(t.description)}</p><div class="row wrap tiny muted" style="margin-top:6px"><span>📚 ${esc(t.subject || 'General')}</span>${t.examDate || t.subjectDate ? `<span>📅 ${esc(t.examDate || t.subjectDate)}</span>` : ''}<span>⏱ ${t.minutes} min</span><span class="pill ${esc(t.priority)}">${esc(t.priority)}</span></div></div>
        <select data-change="topic-status" data-id="${esc(t.id)}" style="width:auto"><option value="todo" ${t.status === 'todo' ? 'selected' : ''}>Pendiente</option><option value="doing" ${t.status === 'doing' ? 'selected' : ''}>En curso</option><option value="done" ${t.status === 'done' ? 'selected' : ''}>Dominado</option></select></div>`).join('') : '<p class="muted">Todavía no hay temas. Crea un plan escribiendo los temas de tus materias.</p>'}
    </div>
    ${c.plan?.tips?.length ? `<div class="panel"><h3>Consejos para esta preparación</h3><ul class="muted">${c.plan.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    ${c.lessons?.length ? `<div class="panel"><h2>Lecciones</h2>${c.lessons.map((l) => `<details class="faq" style="padding:12px 0"><summary>${esc(l.title)}</summary><p>${md(l.explanation)}</p>${l.example ? `<p class="small"><strong>Ejemplo:</strong> ${esc(l.example)}</p>` : ''}${l.keyPoints?.length ? `<p class="small"><strong>Claves:</strong> ${l.keyPoints.map(esc).join(' · ')}</p>` : ''}</details>`).join('')}</div>` : ''}
    ${c.podcast?.segments?.length ? `<div class="panel"><h2>Guion de podcast</h2>${c.podcast.segments.map((s) => `<p class="small"><strong>${esc(s.speaker)}:</strong> ${esc(s.text)}</p>`).join('')}</div>` : ''}
  </div>`;
};

/** Convierte apuntes sueltos en temas cuando la persona no escribió temas. */
function topicsFromText(text) {
  const parts = String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim()).filter((s) => s.length > 25);
  const chunks = [];
  for (let i = 0; i < parts.length && chunks.length < 8; i += 2) {
    chunks.push(parts.slice(i, i + 2).join(' '));
  }
  return chunks.map((chunk) => ({
    title: chunk.split(' ').slice(0, 6).join(' ').replace(/[.,;:]$/, ''),
    description: chunk.slice(0, 400),
  }));
}

function subjectRow(values = {}) {
  const rowId = uid();
  const priority = values.priority || 'medium';
  const priorities = [['high', 'Alta'], ['medium', 'Media'], ['low', 'Baja']];
  return `<div class="subject-row" data-id="${rowId}" data-subject-row>
    <div class="row between"><span class="eyebrow">Materia</span>
      <button class="btn small ghost" type="button" data-action="remove-subject" data-id="${rowId}" title="Quitar esta materia">Quitar ✕</button></div>
    <div class="grid cols-2">
      <label class="field">Materia<input name="subject" placeholder="Ej.: Biología" value="${esc(values.subject || '')}" /></label>
      <label class="field">Fecha de su examen (opcional)<input name="subjectDate" type="date" value="${esc(values.subjectDate || '')}" /></label>
    </div>
    <label class="field">Temas (uno por línea)<textarea name="topics" rows="3" placeholder="Fotosíntesis&#10;Ciclo de Calvin&#10;Respiración celular">${esc(values.topics || '')}</textarea></label>
    <div class="grid cols-2">
      <label class="field">Minutos por tema<input name="minutes" type="number" min="5" max="240" step="5" value="${esc(values.minutes || 30)}" /></label>
      <label class="field">Prioridad<select name="priority">${priorities.map(([value, label]) => `<option value="${value}" ${priority === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    </div>
  </div>`;
}

function planForm() {
  return `<form class="panel stack" data-form="create-plan" data-multi-plan>
    <div><span class="eyebrow">Tu plan</span><h2 style="margin:8px 0">Organiza todas tus materias</h2>
      <p class="muted small">Escribe los temas de cada materia, uno por línea. No necesitas apuntes ni ejemplos: con tus horas al día haremos un calendario que combine todas las materias.</p></div>
    <label class="field">Nombre del plan (opcional)<input name="title" placeholder="Ej.: Exámenes de julio" /></label>
    <div class="grid cols-2">
      <label class="field">Horas al día para estudiar<input name="hoursPerDay" type="number" min="0.5" max="12" step="0.5" value="1.5" /></label>
      <label class="field">Fecha general (opcional)<input name="examDate" type="date" /></label>
    </div>
    <div id="subjects" class="stack">${subjectRow()}</div>
    <div><button class="btn small" type="button" data-action="add-subject">+ Añadir otra materia</button></div>
    <details class="faq"><summary>Opcional: pegar apuntes o subir archivos</summary>
      <label class="field">Apuntes<textarea name="material" rows="5" placeholder="Pega aquí tu texto, esquemas o exámenes anteriores…"></textarea></label>
      <label class="field"><input type="file" data-change="plan-file" accept=".txt,.md,.markdown,.json,image/*" multiple /></label>
      <div id="plan-files" class="muted small"></div>
      <p class="muted tiny">Si no pones apuntes, el plan se crea igual con los temas que escribiste.</p>
    </details>
    <div class="row"><button class="btn primary" type="submit" ${state.ui.busy ? 'disabled' : ''}>${state.ui.busy ? '<span class="spinner"></span> Creando…' : '✨ Crear mi plan'}</button></div>
  </form>`;
}

views.tutor = () => {
  const c = course();
  const k = kidMode();
  const teacher = profile()?.role === 'teacher';
  const examples = teacher
    ? ['Dame una estrategia para enseñar este tema', 'Crea una pregunta de comprobación', '¿Cómo lo adaptaría a nivel kínder?', 'Propón una actividad de 10 minutos']
    : k
      ? ['🎨 Explícame esto con un dibujo imaginario', '🎲 Hagamos un juego con este tema', 'Dame una pista, no la respuesta', 'Explícame como si tuviera 7 años']
      : ['Explica este tema paso a paso', 'Dame una pista, no la respuesta', 'Hazme un ejercicio parecido al de mis apuntes', 'Corrige mi razonamiento paso a paso'];
  return `<div class="chat-wrap">
    <div class="panel" style="padding:0;display:flex;flex-direction:column;overflow:hidden">
      <div class="row wrap" style="padding:12px 16px;border-bottom:1px solid var(--line)">
        ${tutorFaceHtml('sm')}
        ${MODES.filter(([id]) => !(id === 'play' && !k && !teacher)).map(([id, label]) => `<button class="tab ${state.chatMode === id ? 'active' : ''}" data-action="chat-mode" data-mode="${id}">${label}</button>`).join('')}
        <label class="checkbox" style="margin-left:auto"><input type="checkbox" data-change="use-material" ${state.useMaterial ? 'checked' : ''} /> Usar mis apuntes</label>
      </div>
      <div class="chat-log">
        ${state.chat.length ? state.chat.map((m) => `<div class="msg ${m.role}">${m.role === 'assistant' ? `<span class="tutor-face">${tutorFaceHtml('xs')}</span>` : ''}${md(m.content)}${(m.images || []).map((i) => `<img src="${esc(i.base64)}" alt="imagen adjunta" />`).join('')}</div>`).join('') : `<div class="empty" style="margin:20px">${tutorFaceHtml('md')}<h3>${k ? '¿Qué quieres descubrir hoy?' : '¿Por dónde empezamos?'}</h3><p>${k ? 'Pregunta sin miedo. Aquí no hay respuestas malas: solo pasitos.' : profile()?.calm ? 'Pregunta lo que quieras, sin prisas y sin presión.' : 'Pregúntame lo que no entiendas. Te iré guiando con pistas.'}</p><div class="row wrap" style="justify-content:center;margin-top:14px">${examples.map((e) => `<button class="btn small" data-action="use-example" data-text="${esc(e)}">${esc(e)}</button>`).join('')}</div></div>`}
        ${state.ui.busy ? `<div class="msg assistant typing"><span class="tutor-face">${tutorFaceHtml('xs')}</span> Pensando…</div>` : ''}
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
      <div class="row between tiny muted" style="margin-top:8px"><span>${c ? `Contexto: ${esc(c.title || c.subject)}` : 'Sin material: puedes preguntar cualquier cosa'} · adaptado a ${esc(levelInfo().label)}</span><div class="row"><button class="btn small ghost" data-action="breathe">🌿 Pausa</button><button class="btn small ghost" data-action="clear-chat">Limpiar chat</button></div></div>
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
    }).join('')}</div>` : `<div class="empty"><h3>Aún no hay tarjetas</h3><p>Una tarjeta es una pregunta y su respuesta. Pulsa el botón de arriba para crearlas con tus apuntes.</p>${c ? '' : '<p class="small">Primero <a href="#/app/plan">crea tu plan</a> para que la IA sepa de qué tema se trata.</p>'}</div>`}</div>`;
};

views.quiz = () => {
  const c = course();
  const questions = c?.quiz?.questions || [];
  const quiz = state.ui.quiz;
  if (!questions.length) return `<div class="empty"><h3>Sin preguntas todavía</h3><p>La IA creará preguntas cortas con explicaciones usando solo tus apuntes. No es un examen: es práctica.</p>${c ? '' : '<p class="small">Primero <a href="#/app/plan">crea tu plan</a>.</p>'}<div style="margin-top:16px"><button class="btn primary" data-action="generate" data-kind="quiz">✨ Generar preguntas</button></div></div>`;
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
  if (!exam.length) return `<div class="empty"><h3>Sin examen de práctica</h3><p>Genera un examen con tu material. Puedes hacerlo con tiempo o sin presión.</p>${c ? '' : '<p class="small">Primero <a href="#/app/plan">crea tu plan</a>.</p>'}<div style="margin-top:16px"><button class="btn primary" data-action="generate" data-kind="exam">✨ Generar examen de práctica</button></div></div>`;
  if (!session) {
    return `<div class="panel"><div class="panel-title"><h2>${exam.length} preguntas · ${exam.reduce((a, q) => a + q.points, 0)} puntos</h2><button class="btn small" data-action="generate" data-kind="exam">Regenerar</button></div>
      <p class="muted">${state.ui.noPressure ? 'Sin temporizador: práctica a tu ritmo, sin nota ni presión.' : `Tendrás ${c.examMinutes || 60} minutos. Las preguntas desarrolladas se corrigen con una rúbrica y, si quieres, con IA.`}</p>
      <div class="row"><button class="btn primary" data-action="start-exam">${state.ui.noPressure ? 'Practicar sin presión →' : 'Empezar simulacro →'}</button><button class="btn small ghost" data-action="toggle-no-pressure">${state.ui.noPressure ? '⏱ Activar temporizador' : '🌿 Practicar sin presión'}</button></div></div>`;
  }
  if (session.result !== undefined) {
    return `<div class="panel"><h2>Resultado del simulacro</h2><p class="muted">Objetivas: ${session.result} / ${session.total} puntos. Las desarrolladas tienen su rúbrica debajo; puedes pedirle al tutor que las corrija.</p>
      ${exam.map((q, i) => `<div class="question"><h4>${i + 1}. ${esc(q.question)} <span class="pill">${q.points} pts</span></h4>
        ${q.type === 'mcq' ? q.options.map((o, j) => `<div class="option ${j === q.answer ? 'correct' : session.answers[i] == j ? 'wrong' : ''}">${esc(o)} ${j === q.answer ? '✓' : ''}</div>`).join('') : `<p class="muted small">Tu respuesta: ${esc(session.answers[i] || '—')}</p>`}
        <div class="explanation"><strong>Rúbrica:</strong> ${esc(q.rubric || q.options[q.answer] || 'Cumple los puntos clave del tema.')}</div></div>`).join('')}
      <div class="row" style="margin-top:16px"><button class="btn primary" data-action="start-exam">Repetir</button><button class="btn" data-action="exit-exam">Volver</button></div></div>`;
  }
  return `<form class="panel" data-form="submit-exam"><div class="row between"><h2 style="margin:0">${state.ui.noPressure ? 'Práctica sin presión' : 'Simulacro en curso'}</h2><div class="row"><button class="btn small ghost" type="button" data-action="toggle-no-pressure">${state.ui.noPressure ? '⏱ Activar temporizador' : '🌿 Sin presión'}</button>${state.ui.noPressure ? '' : `<span class="pill" id="exam-timer">${Math.floor((session.end - Date.now()) / 60000)}:${String(Math.floor(((session.end - Date.now()) / 1000) % 60)).padStart(2, '0')}</span>`}</div></div>
    ${state.ui.noPressure ? '<p class="muted small">Tómate el tiempo que necesites. Esto es práctica, no una nota.</p>' : ''}
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

const listBlock = (title, items) => items?.length
  ? `<p class="small"><strong>${esc(title)}:</strong></p><ul class="muted small">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
  : '';

function renderGuide(resource) {
  if (!resource) return '';
  return `<div class="resource"><h3>${esc(resource.title)}</h3>
    <p><strong>Objetivo:</strong> ${esc(resource.objective)}</p>
    <p class="muted small">Duración sugerida: ${resource.duration} min</p>
    ${listBlock('Materiales', resource.materials)}
    ${resource.warmup ? `<p><strong>Inicio:</strong> ${esc(resource.warmup)}</p>` : ''}
    ${(resource.development || []).map((s, i) => `<details class="faq" style="padding:10px 0"><summary>${i + 1}. ${esc(s.title)} · ${s.minutes} min</summary><p>${md(s.explanation)}</p><p class="small"><strong>Actividad:</strong> ${esc(s.activity)}</p></details>`).join('')}
    ${resource.closure ? `<p><strong>Cierre:</strong> ${esc(resource.closure)}</p>` : ''}
    ${resource.assessment ? `<p><strong>Evaluación:</strong> ${esc(resource.assessment)}</p>` : ''}
    ${listBlock('Adaptaciones', resource.adaptations)}</div>`;
}

function renderRubric(resource) {
  if (!resource) return '';
  return `<div class="resource">${(resource.criteria || []).map((c) => `<div class="rubric-block"><h4>${esc(c.name)}</h4><div class="grid cols-3">${(c.levels || []).map((l) => `<div class="rubric-level"><strong>${esc(l.label)}</strong><p class="small muted">${esc(l.description)}</p></div>`).join('')}</div></div>`).join('')}${listBlock('Consejos', resource.tips)}</div>`;
}

function renderGame(resource) {
  if (!resource) return '';
  return `<div class="resource"><h3>🎲 ${esc(resource.name)}</h3>
    <p class="muted small">${esc(resource.type)} · ${resource.duration} min</p>
    ${listBlock('Materiales', resource.materials)}${listBlock('Instrucciones', resource.instructions)}${listBlock('Reglas', resource.rules)}${listBlock('Variantes', resource.variations)}</div>`;
}

const AUTH_META = {
  email: { icon: '✉️', name: 'Correo' },
  google: { icon: '🔵', name: 'Google' },
  microsoft: { icon: '🪟', name: 'Microsoft' },
  github: { icon: '🐙', name: 'GitHub' },
};

function cloudAccountPanel() {
  const info = auth || { enabled: false, email: false, providers: [] };
  if (info.user) {
    const meta = AUTH_META[info.user.provider] || AUTH_META.email;
    return `<div class="panel stack">
      <div class="panel-title"><h2>👤 Tu cuenta en la nube</h2><span class="pill done">sesión iniciada</span></div>
      <div class="row">
        <span class="avatar sm">${info.user.photo ? `<img src="${esc(info.user.photo)}" alt="" />` : '👤'}</span>
        <div class="grow"><strong>${esc(info.user.name || info.user.email || 'Mi cuenta')}</strong><br /><span class="tiny muted">${esc(info.user.email || 'Sin correo público')} · ${meta.icon} ${meta.name}</span></div>
        <button class="btn small ghost" data-action="auth-logout">Cerrar sesión</button>
      </div>
      <p class="muted small"> Tu progreso sigue en este navegador. Con tu cuenta iniciada puedes subir y bajar tu respaldo directamente en este servidor, sin URL ni token. Solo tú puedes verlo, y nada se envía automáticamente.</p>
      <div class="row wrap"><button class="btn small primary" data-action="account-backup-push">⬆ Subir mi cuenta al servidor</button><button class="btn small" data-action="account-backup-pull">⬇ Bajar mi cuenta del servidor</button></div>
      <p class="muted tiny">¿Prefieres tu propio Drive, Gist o servidor? Más abajo puedes configurar tu nube propia (opcional).</p>
    </div>`;
  }
  if (!info.enabled) {
    return `<div class="panel"><h2>🔑 Cuenta en la nube</h2><p class="muted small">El servidor tiene desactivadas las cuentas. Puedes seguir estudiando sin registrarte y usar tu respaldo manual con URL y token.</p></div>`;
  }
  const providers = (info.providers || []).map((provider) => {
    const meta = AUTH_META[provider.id] || { icon: '◈', name: provider.name };
    return provider.configured
      ? `<a class="btn small" href="/api/auth/${provider.id}">${meta.icon} ${meta.name}</a>`
      : `<span class="btn small ghost" title="Configura ${meta.name} en el servidor" aria-disabled="true">${meta.icon} ${meta.name} · no configurado</span>`;
  }).join('');
  return `<div class="panel stack">
    <div class="panel-title"><h2>🔑 Entra con tu cuenta</h2><span class="muted small">opcional</span></div>
    <p class="muted small">No necesitas cuenta para estudiar. Si quieres acceder desde otro dispositivo, entra con tu correo o con Google, Microsoft o GitHub. No hay registro obligatorio, suscripción ni telemetría.</p>
    <div class="row wrap">${providers}</div>
    ${info.email ? `<div class="grid cols-2" style="margin-top:14px">
      <form class="panel stack compact" data-form="auth-login">
        <span class="eyebrow">Ya tengo cuenta</span>
        <label class="field">Correo<input name="email" type="email" required autocomplete="email" /></label>
        <label class="field">Contraseña<input name="password" type="password" required autocomplete="current-password" /></label>
        <button class="btn small primary" type="submit">Entrar</button>
      </form>
      <form class="panel stack compact" data-form="auth-register">
        <span class="eyebrow">Crear cuenta</span>
        <label class="field">Nombre<input name="name" maxlength="60" placeholder="Tu nombre" /></label>
        <label class="field">Correo<input name="email" type="email" required autocomplete="email" /></label>
        <label class="field">Contraseña<input name="password" type="password" minlength="8" required autocomplete="new-password" /></label>
        <button class="btn small" type="submit">Crear cuenta</button>
      </form>
    </div>` : ''}
    <p class="muted tiny">Las cuentas viven en este servidor auto-hospedado. Tus datos de estudio siguen en tu navegador hasta que tú pulses <strong>Subir ahora</strong>.</p>
  </div>`;
}

views.cuenta = () => {
  const p = profile();
  if (!p) return '<div class="panel empty"><h3>No hay cuenta activa</h3></div>';
  const skin = SKINS.find((s) => s.id === p.skin) || SKINS[0];
  const accessory = tutorAccessory();
  const cloudReady = Boolean(config?.cloud?.url);
  return `<div class="stack">
    <div class="panel profile-banner">
      <span class="avatar xl frame-${esc(p.frame || 'none')}">${p.photo ? `<img src="${esc(p.photo)}" alt="Tu foto de cuenta" />` : esc(p.avatar)}</span>
      <div class="grow"><img class="account-emblem" src="/icons/app-icon-detail.svg" alt="" /><span class="eyebrow">Mi cuenta local</span><h2 style="margin:6px 0">${esc(p.name)}</h2>
        <p class="muted small">${esc(levelInfo().label)} · ${p.role === 'teacher' ? 'Docente' : 'Estudiante'} · ${p.badges.length} insignias</p></div>
      <div class="center">${tutorFaceHtml('md')}<div class="tiny muted">${esc(skin.name)} · ${esc(accessory.name)}</div></div>
      <div class="center"><div style="font-family:'Cinzel';font-size:30px;color:var(--violet-2)">✦ ${p.points}</div><div class="muted tiny">puntos ganados</div></div>
    </div>

    <div class="grid cols-2">
      <form class="panel stack" data-form="save-profile">
        <h2>Así aprendo</h2>
        <label class="field">Nombre<input name="name" value="${esc(p.name)}" maxlength="60" required /></label>
        <div class="grid cols-2">
          <label class="field">Soy<select name="role"><option value="student" ${p.role === 'student' ? 'selected' : ''}>Estudiante</option><option value="teacher" ${p.role === 'teacher' ? 'selected' : ''}>Docente</option></select></label>
          <label class="field">Edad<input name="age" type="number" min="0" max="99" value="${p.age || ''}" placeholder="Ej.: 10" /></label>
          <label class="field">Nivel escolar<select name="level">${LEVELS.map((l) => `<option value="${l.id}" ${p.level === l.id ? 'selected' : ''}>${l.label}</option>`).join('')}</select></label>
          <label class="field">Estilo de estudio<select name="style">${STYLES.map(([v, l]) => `<option value="${v}" ${p.style === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
        <label class="field">Tono del tutor<select name="tone">${TONES.map(([v, l]) => `<option value="${v}" ${p.tone === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="checkbox"><input type="checkbox" name="calm" ${p.calm ? 'checked' : ''} /> Modo sin presión (pasos pequeños, sin prisas)</label>
        <label class="checkbox"><input type="checkbox" name="avatar3d" ${p.avatar3d !== false ? 'checked' : ''} /> Mostrar tutor ilustrado (desactívalo en equipos lentos)</label>
        <p class="muted small">Sugerencia: sesiones de ${levelInfo().minutes} min para ${esc(levelInfo().label)}.</p>
        <button class="btn primary" type="submit">Guardar mi cuenta</button>
      </form>

      <div class="panel stack">
        <h2>Mi foto y mi avatar</h2>
        <p class="muted small">La foto se reduce a 160 px y se guarda solo en este navegador.</p>
        <div class="row"><input type="file" id="profile-photo" accept="image/*" hidden data-change="profile-photo" />
          <button class="btn small" data-action="pick-photo">📷 Subir foto</button>
          ${p.photo ? '<button class="btn small ghost" data-action="remove-photo">Quitar foto</button>' : ''}</div>
        <div><span class="eyebrow">O elige un avatar</span><div class="row wrap" style="margin-top:10px">${AVATARS.map((a) => `<button class="emoji-choice ${p.avatar === a && !p.photo ? 'active' : ''}" data-action="choose-avatar" data-avatar="${esc(a)}">${a}</button>`).join('')}</div></div>
        <div><span class="eyebrow">Marco de cuenta</span><div class="row wrap" style="margin-top:10px">${FRAMES.map((f) => `<button class="shop-item ${p.frame === f.id ? 'active' : ''}" data-action="select-frame" data-id="${f.id}" ${f.cost > p.points && p.frame !== f.id ? 'disabled' : ''}><span class="frame-${f.id} avatar sm">${esc(p.avatar)}</span><strong>${esc(f.name)}</strong><span class="tiny">${f.cost ? `✦ ${f.cost}` : 'Gratis'}${f.cost > p.points && p.frame !== f.id ? ' · 🔒' : ''}</span></button>`).join('')}</div></div>
      </div>
    </div>

    <div class="panel"><div class="panel-title"><h2>Viste a tu tutor ilustrado</h2><span class="muted small">Ropa y accesorios se ganan estudiando, nunca se compran</span></div>
      <span class="eyebrow">Atuendos</span>
      <div class="shop-grid">${SKINS.map((s) => `<button class="shop-item ${p.skin === s.id ? 'active' : ''}" data-action="select-skin" data-id="${s.id}" ${s.cost > p.points && p.skin !== s.id ? 'disabled' : ''}>
        ${tutor3d('sm', s.id, p.accessory)}<strong>${esc(s.name)}</strong><span class="tiny muted">${esc(s.desc)}</span><span class="pill ${s.cost <= p.points || p.skin === s.id ? 'done' : 'medium'}">${s.cost ? `✦ ${s.cost}` : 'Incluido'}${s.cost > p.points && p.skin !== s.id ? ' 🔒' : ''}</span></button>`).join('')}</div>
      <span class="eyebrow" style="display:block;margin-top:18px">Accesorios</span>
      <div class="shop-grid">${ACCESSORIES.map((a) => `<button class="shop-item ${p.accessory === a.id ? 'active' : ''}" data-action="select-accessory" data-id="${a.id}" ${a.cost > p.points && p.accessory !== a.id ? 'disabled' : ''}>
        <span class="avatar lg acc-preview">${a.icon}</span><strong>${esc(a.name)}</strong><span class="tiny muted">${esc(a.desc)}</span><span class="pill ${a.cost <= p.points || p.accessory === a.id ? 'done' : 'medium'}">${a.cost ? `✦ ${a.cost}` : 'Incluido'}${a.cost > p.points && p.accessory !== a.id ? ' 🔒' : ''}</span></button>`).join('')}</div>
      <p class="muted small" style="margin-top:14px">Tu compañero actual: <strong>${esc(skin.name)}</strong> con ${esc(accessory.name)} ${accessory.icon}.</p>
    </div>

    ${cloudAccountPanel()}

    <form class="panel stack" data-form="save-cloud">
      <div class="panel-title"><h2>☁️ ${auth?.user ? 'Mi nube propia (opcional)' : 'Guardado en la nube (opcional)'}</h2><span class="pill ${cloudReady ? 'done' : 'medium'}">${cloudReady ? 'configurada' : 'sin configurar'}</span></div>
      <p class="muted small">${auth?.user ? 'Ya puedes subir y bajar tu cuenta con los botones de arriba. Si además quieres usar tu propio JSON en Drive, Gist o servidor, pon aquí su URL y token.' : 'Tu cuenta sigue siendo local. Solo si tú quieres, puedes subir un respaldo a tu propia URL (por ejemplo un JSON en tu Drive, servidor o Gist) con un token tuyo.'} Nada se envía automáticamente y no hay telemetría.</p>
      <div class="grid cols-2">
        <label class="field">URL del respaldo<input name="url" value="${esc(config?.cloud?.url || '')}" placeholder="https://ejemplo.com/zoleva.json" /></label>
        <label class="field">Token (opcional)<input name="token" type="password" value="${esc(config?.cloud?.token || '')}" placeholder="••••••••" /></label>
      </div>
      <div class="row wrap"><button class="btn small primary" type="submit">Guardar nube</button>
        <button class="btn small" type="button" data-action="cloud-test">Probar conexión</button>
        <button class="btn small" type="button" data-action="cloud-push">⬆ Subir ahora</button>
        <button class="btn small" type="button" data-action="cloud-pull">⬇ Bajar ahora</button></div>
      <p class="muted tiny">El token se guarda en ${auth?.user ? 'tu cuenta del servidor (<code>.data/accounts.json</code>)' : '<code>.data/config.json</code> de este equipo'} y se envía como <code>Bearer</code> solo a esa URL. Bajar reemplaza los datos locales: se pedirá confirmación.</p>
    </form>

    <div class="panel"><h2>Insignias</h2><div class="badge-grid">${BADGES.map((b) => `<div class="badge ${p.badges.includes(b.id) ? 'earned' : ''}"><span style="font-size:26px">${p.badges.includes(b.id) ? b.icon : '🔒'}</span><strong>${esc(b.name)}</strong><span class="tiny muted">${esc(b.desc)}</span></div>`).join('')}</div></div>

    <div class="panel"><div class="panel-title"><h2>Cuentas en este equipo</h2><span class="muted small">Cada cuenta guarda sus propios cursos y progreso</span></div>
      <div class="row wrap">${state.profiles.map((item) => `<div class="profile-card ${item.id === p.id ? 'active' : ''}">
        <button class="row" data-action="select-profile" data-id="${esc(item.id)}" style="border:0;background:none;color:inherit"><span class="avatar sm frame-${esc(item.frame || 'none')}">${item.photo ? `<img src="${esc(item.photo)}" alt="" />` : esc(item.avatar)}</span><span><strong>${esc(item.name)}</strong><br /><span class="tiny muted">${esc(item.level)} · ✦ ${item.points || 0}</span></span></button>
        ${state.profiles.length > 1 ? `<button class="btn small ghost" data-action="delete-profile" data-id="${esc(item.id)}" title="Borrar cuenta">×</button>` : ''}</div>`).join('')}</div>
      <form class="row" data-form="create-profile" style="margin-top:16px"><input name="name" placeholder="Nombre de la nueva cuenta" required maxlength="60" /><select name="level">${LEVELS.map((l) => `<option value="${l.id}" ${l.id === 'primaria' ? 'selected' : ''}>${l.label}</option>`).join('')}</select><button class="btn small primary" type="submit">+ Crear cuenta</button></form>
    </div>
  </div>`;
};

// Alias para enlaces antiguos: la interfaz ya solo dice «Mi cuenta».
views.perfil = views.cuenta;

views.docente = () => {
  const groups = state.groups || [];
  const g = groups.find((x) => x.id === state.ui.activeGroup) || groups[0] || null;
  const selector = `<div class="panel"><div class="panel-title"><h2>Mis grupos</h2><span class="muted small">${groups.length} grupo(s) en este equipo</span></div>
    ${groups.length ? `<div class="row wrap">${groups.map((item) => `<button class="pill ${g?.id === item.id ? 'gold' : ''}" data-action="select-group" data-id="${esc(item.id)}">🍎 ${esc(item.name)} · ${item.students?.length || 0} alumnos</button>`).join('')}</div>` : '<p class="muted">Aún no hay grupos. Crea uno abajo.</p>'}</div>`;
  const createForm = `<form class="panel stack" data-form="create-group"><h3>Nuevo grupo</h3>
    <div class="grid cols-2"><label class="field">Nombre del grupo<input name="name" placeholder="Ej.: 3º B - Biología" required /></label>
      <label class="field">Nivel<select name="level">${LEVELS.map((l) => `<option value="${l.id}" ${l.id === 'secundaria' ? 'selected' : ''}>${l.label}</option>`).join('')}</select></label></div>
    <label class="field">Alumnos (uno por línea)<textarea name="students" rows="4" placeholder="Ana\nLuis\nMarta"></textarea></label>
    <label class="field">Material de la clase<textarea name="material" rows="4" placeholder="Pega aquí el tema o los apuntes que usarás con el grupo…"></textarea></label>
    <button class="btn primary" type="submit">Crear grupo</button></form>`;
  if (!g) return `<div class="stack">${selector}<div class="panel empty"><span style="font-size:38px">🍎</span><h3>Tu aula, también en local</h3><p>Crea un grupo para preparar guías didácticas, rúbricas y juegos adaptados a su nivel.</p></div>${createForm}</div>`;
  return `<div class="stack">
    ${selector}
    <div class="panel"><div class="panel-title"><div><h2>${esc(g.name)}</h2><div class="muted small">${esc(LEVELS.find((l) => l.id === g.level)?.label || g.level)} · ${g.students?.length || 0} estudiantes</div></div>
      <button class="btn small danger" data-action="delete-group" data-id="${esc(g.id)}">Borrar grupo</button></div>
      <div class="row wrap"><button class="btn small primary" data-action="teacher-generate" data-id="${esc(g.id)}" data-kind="guide">📖 Guía didáctica</button>
        <button class="btn small" data-action="teacher-generate" data-id="${esc(g.id)}" data-kind="rubric">📊 Rúbrica</button>
        <button class="btn small" data-action="teacher-generate" data-id="${esc(g.id)}" data-kind="game">🎲 Juego de repaso</button></div>
      ${state.ui.busy ? '<p class="muted small">Preparando material…</p>' : ''}
    </div>
    <div class="grid cols-2">
      <form class="panel stack" data-form="add-students" data-id="${esc(g.id)}"><h3>Añadir estudiantes</h3><label class="field">Nombres (uno por línea)<textarea name="students" rows="3" placeholder="Ana\nLuis"></textarea></label><button class="btn small" type="submit">Añadir</button></form>
      <div class="panel stack"><h3>Importar progreso</h3><p class="muted small">Cada estudiante exporta su JSON desde Ajustes. Aquí lo resumes sin registro ni servidores centrales.</p>
        <input type="file" id="group-progress" accept="application/json" hidden data-change="group-progress" />
        <button class="btn small" data-action="import-progress" data-id="${esc(g.id)}">⬆ Cargar progreso</button></div>
    </div>
    <div class="panel"><h2>Seguimiento local</h2>${g.students?.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Estudiante</th><th>Minutos</th><th>Aciertos</th><th>Dominio</th><th>Actualizado</th></tr></thead><tbody>${g.students.map((s) => `<tr><td>${esc(s.name)}</td><td>${s.minutes || 0}</td><td>${s.accuracy ? `${s.accuracy} %` : '—'}</td><td>${s.mastery ? `${s.mastery} %` : '—'}</td><td>${s.updatedAt ? esc(new Date(s.updatedAt).toLocaleDateString('es')) : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Añade estudiantes para ver su seguimiento.</p>'}</div>
    ${g.resources?.guide ? `<div class="panel"><div class="panel-title"><h2>Guía didáctica</h2><button class="btn small" data-action="teacher-generate" data-id="${esc(g.id)}" data-kind="guide">Regenerar</button></div>${renderGuide(g.resources.guide)}</div>` : ''}
    ${g.resources?.rubric ? `<div class="panel"><div class="panel-title"><h2>Rúbrica</h2><button class="btn small" data-action="teacher-generate" data-id="${esc(g.id)}" data-kind="rubric">Regenerar</button></div>${renderRubric(g.resources.rubric)}</div>` : ''}
    ${g.resources?.game ? `<div class="panel"><div class="panel-title"><h2>Juego de repaso</h2><button class="btn small" data-action="teacher-generate" data-id="${esc(g.id)}" data-kind="game">Regenerar</button></div>${renderGame(g.resources.game)}</div>` : ''}
    ${createForm}
  </div>`;
};

views.settings = () => {
  const providers = status?.providers || [];
  const active = config?.provider || 'demo';
  const selected = providers.find((p) => p.id === active);
  return `<form class="stack" data-form="save-settings">
    <div class="panel"><div class="panel-title"><h2>Proveedor de IA</h2><span class="pill ${selected?.ready ? 'done' : 'medium'}">${selected?.ready ? 'disponible' : 'no disponible'}</span></div>
      <label class="field">Proveedor<select name="provider" data-change="provider-change">${providers.map((p) => `<option value="${esc(p.id)}" ${active === p.id ? 'selected' : ''}>${esc(p.name)} ${p.ready ? '✓' : '· ' + esc(p.note)}</option>`).join('')}</select></label>
      ${selected?.note ? `<p class="muted small">${esc(selected.note)}</p>` : ''}
      <p class="muted small">¿Tu celular o computadora no puede ejecutar IA local? Elige <strong>OpenRouter</strong> o <strong>Gemini</strong>: la generación ocurre en la nube y tu equipo solo muestra el resultado. Si prefieres no enviar apuntes a la nube, usa <strong>Demo sin IA</strong> u <strong>Ollama</strong>.</p>
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
        <label class="field">Modo del tutor<select name="chatMode">${MODES.map(([v, l]) => `<option value="${v}" ${(state.chatMode || config?.chatMode) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Nivel del curso<select name="level">${LEVELS.map((l) => `<option value="${l.id}" ${(profile()?.level || config?.level) === l.id ? 'selected' : ''}>${l.label}</option>`).join('')}</select></label>
        <label class="field">Interfaz<select name="lang"><option value="es" ${state.lang === 'es' ? 'selected' : ''}>Español</option><option value="nah" ${state.lang === 'nah' ? 'selected' : ''}>Náhuatl + Español (glosas)</option></select></label>
      </div>
      <p class="muted small">Edad, estilo de aprendizaje, tono, avatar y recompensas se ajustan en <a href="#/app/cuenta" style="color:var(--violet-2)">Mi cuenta</a>.</p>
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
      minutes: c.examMinutes || 60,
      ...profilePayload(),
    }),
  });
  if (res.warning) state.ui.toast = { text: res.warning, error: false };
  if (!res.data) throw new Error('No se generó contenido');
  if (kind === 'plan') { c.plan = res.data; rebuildSchedule(c); }
  if (kind === 'lessons') c.lessons = res.data.lessons || [];
  if (kind === 'flashcards') c.flashcards = (res.data.cards || []).map((card) => ({ ...card, id: uid() }));
  if (kind === 'quiz') { c.quiz = res.data; state.ui.quiz = null; }
  if (kind === 'exam') { c.exam = res.data; state.ui.exam = null; }
  if (kind === 'podcast') c.podcast = res.data;
  if (!res.warning) toast(`✨ ${kind === 'flashcards' ? 'Tarjetas' : kind === 'quiz' ? 'Cuestionario' : kind === 'exam' ? 'Simulacro' : kind === 'podcast' ? 'Podcast' : kind === 'lessons' ? 'Lecciones' : 'Plan'} generado${kind === 'lessons' || kind === 'flashcards' ? 's' : ''}. +2 ✦`);
  award(2);
}

async function generateTeacher(kind, groupId) {
  const g = state.groups.find((x) => x.id === groupId);
  if (!g) return toast('No se encontró el grupo.', true);
  const res = await api('/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      kind,
      material: g.material || '',
      subject: g.name,
      topic: g.name,
      goal: `${g.students?.length || 0} estudiantes de ${levelLabel(g.level)}`,
      level: g.level,
      role: 'teacher',
      style: profile()?.style || 'mixto',
      tone: profile()?.tone || 'amable',
      calm: profile()?.calm !== false,
    }),
  });
  if (!res.data) throw new Error('No se generó el material docente');
  g.resources = { ...(g.resources || {}), [kind]: res.data };
  const names = { guide: 'Guía didáctica', rubric: 'Rúbrica', game: 'Juego de repaso' };
  const points = kind === 'guide' ? 5 : 2;
  if (kind === 'guide') award(points, 'teacher');
  else award(points);
  if (!state.ui.toast) toast(`✨ ${names[kind]} lista. +${points} ✦`);
}

const levelLabel = (id) => LEVELS.find((l) => l.id === id)?.label || id;

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
        ...profilePayload(),
      }),
    });
    state.chat.push({ role: 'assistant', content: res.text || 'No obtuve respuesta.' });
    award(1);
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

/** Reduce una foto a un cuadrado pequeño para no agotar localStorage. */
function resizeImage(file, size = 160) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(size / img.width, size / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleAction(action, data) {
  switch (action) {
    case 'show-help': state.ui.help = true; render(); break;
    case 'close-help': state.ui.help = false; render(); break;
    case 'help-go':
      state.ui.help = false;
      if (data.href && location.hash !== data.href) location.hash = data.href;
      render();
      break;
    case 'dismiss-guide': {
      const p = profile();
      if (p) { p.guideDismissed = true; save(); }
      toast('Guía oculta. Puedes volver a verla con «❓ Cómo empezar».');
      break;
    }
    case 'close-toast': state.ui.toast = null; render(); break;
    case 'toggle-lang': state.lang = state.lang === 'nah' ? 'es' : 'nah'; save(); render(); break;
    case 'breathe': startBreathing(); break;
    case 'close-breathing': stopBreathing(); render(); break;
    case 'toggle-no-pressure':
      state.ui.noPressure = !state.ui.noPressure;
      save(); render();
      if (state.ui.exam && !state.ui.noPressure) startExamTimer();
      break;
    case 'select-profile': switchProfile(data.id); break;
    case 'delete-profile': {
      if (state.profiles.length <= 1) { toast('Debe quedar al menos una cuenta.', true); break; }
      if (!confirm('¿Borrar esta cuenta y todo su progreso?')) break;
      const target = state.profiles.find((p) => p.id === data.id);
      state.profiles = state.profiles.filter((p) => p.id !== data.id);
      if (target?.id === state.activeProfile) hydrateProfile(state.profiles[0]);
      save(); render(); break;
    }
    case 'select-skin': {
      const p = profile(); const skin = SKINS.find((s) => s.id === data.id);
      if (p && skin && (skin.cost <= p.points || p.skin === skin.id)) { p.skin = skin.id; save(); render(); toast(`Tu tutor ahora es ${skin.name} ${skin.emoji}`); }
      break;
    }
    case 'select-accessory': {
      const p = profile(); const accessory = ACCESSORIES.find((a) => a.id === data.id);
      if (p && accessory && (accessory.cost <= p.points || p.accessory === accessory.id)) {
        p.accessory = accessory.id; save(); render();
        toast(`Tu tutor ya usa ${accessory.name} ${accessory.icon}`);
      }
      break;
    }
    case 'select-frame': {
      const p = profile(); const frame = FRAMES.find((f) => f.id === data.id);
      if (p && frame && (frame.cost <= p.points || p.frame === frame.id)) { p.frame = frame.id; save(); render(); }
      break;
    }
    case 'choose-avatar': {
      const p = profile(); if (p) { p.avatar = data.avatar; p.photo = ''; save(); render(); }
      break;
    }
    case 'pick-photo': $('#profile-photo')?.click(); break;
    case 'remove-photo': { const p = profile(); if (p) { p.photo = ''; save(); render(); } break; }
    case 'select-group': state.ui.activeGroup = data.id; save(); render(); break;
    case 'delete-group':
      if (confirm('¿Borrar este grupo y sus materiales?')) {
        state.groups = state.groups.filter((g) => g.id !== data.id);
        state.ui.activeGroup = state.groups[0]?.id || null;
        save(); render(); break;
      }
      break;
    case 'import-progress': $('#group-progress')?.click(); break;
    case 'teacher-generate': busy(() => generateTeacher(data.kind, data.id)); break;
    case 'new-course': state.activeCourse = null; location.hash = '#/app/plan'; render(); break;
    case 'add-subject': {
      const wrap = $('#subjects');
      if (!wrap) break;
      const row = wrap.querySelector('.subject-row')?.cloneNode(true);
      if (!row) break;
      row.dataset.id = uid();
      const remove = row.querySelector('[data-action="remove-subject"]');
      if (remove) remove.dataset.id = row.dataset.id;
      row.querySelectorAll('input, textarea').forEach((field) => { field.value = field.type === 'number' ? '30' : ''; });
      const priority = row.querySelector('select[name="priority"]');
      if (priority) priority.value = 'medium';
      wrap.appendChild(row);
      row.querySelector('input[name="subject"]')?.focus();
      break;
    }
    case 'remove-subject': {
      const row = document.querySelector(`.subject-row[data-id="${data.id}"]`);
      const wrap = $('#subjects');
      if (row && wrap && wrap.querySelectorAll('.subject-row').length > 1) row.remove();
      else toast('Debe quedar al menos una materia.', true);
      break;
    }
    case 'build-schedule': {
      const c = course();
      if (!c?.plan?.topics?.length) { toast('Crea primero un plan con tus apuntes.', true); break; }
      const schedule = rebuildSchedule(c);
      save(); render();
      const days = new Set((schedule?.sessions || []).map((s) => s.date)).size;
      toast(schedule ? `📅 Calendario listo: ${schedule.sessions.length} sesiones en ${days} días.` : 'No hay temas para repartir.', !schedule);
      break;
    }
    case 'toggle-session': {
      const c = course();
      const session = c?.schedule?.sessions?.find((s) => s.id === data.id);
      if (!session) break;
      session.done = !session.done;
      const mastered = syncTopicFromSchedule(c, session.topicId);
      award(2);
      if (mastered) toast('🏅 Tema dominado. ¡Buen trabajo!');
      else render();
      break;
    }
    case 'toggle-all-days': state.ui.showAllDays = !state.ui.showAllDays; render(); break;
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
      if (Number(data.grade) >= 2) award(1);
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
    case 'auth-logout':
      busy(async () => {
        await api('/api/auth/logout', { method: 'POST', body: '{}' });
        await refreshStatus();
        toast('Sesión cerrada. Tu progreso sigue en este navegador.');
      });
      break;
    case 'account-backup-push':
      busy(async () => {
        const res = await api('/api/account/backup', {
          method: 'POST',
          body: JSON.stringify({ data: cloudPayload() }),
        });
        toast(`⬆ Cuenta subida a tu servidor (${Math.round(res.bytes / 1024)} KB).`);
      });
      break;
    case 'account-backup-pull':
      if (!confirm('¿Bajar tu cuenta del servidor? Esto reemplaza las cuentas y el progreso guardados en este equipo.')) break;
      busy(async () => {
        const res = await api('/api/account/backup');
        if (!res.data) { toast('Todavía no hay una cuenta subida a este servidor.', true); return; }
        applyCloudData(res.data);
        toast(`⬇ Cuenta bajada del servidor: ${state.profiles.length} cuenta(s) restaurada(s).`);
      });
      break;
    case 'cloud-test':
      busy(async () => {
        const res = await api('/api/cloud/pull', { method: 'POST', body: '{}' });
        toast(res.data ? '✓ Nube conectada: hay un respaldo disponible.' : '✓ Nube conectada. Todavía no hay respaldo.');
      });
      break;
    case 'cloud-push':
      busy(async () => {
        const res = await api('/api/cloud/push', {
          method: 'POST',
          body: JSON.stringify({ data: cloudPayload() }),
        });
        toast(`⬆ Respaldo subido (${Math.round(res.bytes / 1024)} KB).`);
      });
      break;
    case 'cloud-pull':
      if (!confirm('¿Bajar el respaldo de la nube? Esto reemplaza las cuentas y el progreso guardados en este equipo.')) break;
      busy(async () => {
        const res = await api('/api/cloud/pull', { method: 'POST', body: '{}' });
        if (!res.data) { toast('No hay respaldo en la nube todavía.', true); return; }
        applyCloudData(res.data);
        toast(`⬇ Respaldo bajado: ${state.profiles.length} cuenta(s) restaurada(s).`);
      });
      break;
    case 'export-data': {
      const payload = {
        version: 2, name: profile()?.name || '', courses: state.courses, chat: state.chat,
        srs: state.srs, stats: state.stats, groups: state.groups,
        profile: { ...profile(), save: undefined },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'zoleva-calmedcatl-datos.json';
      link.click();
      URL.revokeObjectURL(link.href);
      break;
    }
    case 'import-data': $('#import-file')?.click(); break;
    case 'reset-data':
      if (confirm('¿Borrar todos los cursos, tarjetas y progreso? No se puede deshacer.')) {
        stopBreathing();
        localStorage.removeItem(STORAGE_KEY);
        state = freshState();
        const fresh = makeProfile({ name: 'Mi cuenta' });
        state.profiles = [fresh];
        state.activeProfile = fresh.id;
        save(); toast('Datos borrados.');
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
    case 'auth-register':
    case 'auth-login': {
      const endpoint = form === 'auth-register' ? '/api/auth/register' : '/api/auth/login';
      await busy(async () => {
        const res = await api(endpoint, {
          method: 'POST',
          body: JSON.stringify({
            email: data.get('email'),
            password: data.get('password'),
            name: data.get('name') || '',
          }),
        });
        await refreshStatus();
        toast(form === 'auth-register'
          ? `✓ Cuenta creada para ${res.user.email}. Ya puedes subir tu progreso.`
          : `✓ Sesión iniciada como ${res.user.email}.`);
        location.hash = '#/app/cuenta';
      });
      break;
    }
    case 'create-plan':
      await busy(async () => {
        const files = await readFiles(state.ui.pendingPlanFiles || []);
        const notes = [data.get('material') || '', ...files.filter((f) => f.kind === 'text').map((f) => f.text)].join('\n\n').trim();
        const generalDate = data.get('examDate') || '';
        const subjectsList = data.getAll('subject');
        const topicsList = data.getAll('topics');
        const submitted = subjectsList.map((name, index) => {
          const examDate = String(data.getAll('subjectDate')[index] || '') || generalDate;
          const topicsText = String(topicsList[index] || '');
          const minutes = Math.max(5, Math.min(240, Number(data.getAll('minutes')[index]) || 30));
          const priorityValue = String(data.getAll('priority')[index] || 'medium');
          return {
            name: String(name || '').trim(),
            examDate,
            topicsText,
            minutes,
            priority: ['high', 'medium', 'low'].includes(priorityValue) ? priorityValue : 'medium',
          };
        }).filter((item) => item.name || item.topicsText || item.examDate);
        if (!submitted.length) throw new Error('Escribe al menos una materia y sus temas.');

        const allTopics = [];
        const subjects = [];
        let notesUsed = false;
        for (const item of submitted) {
          const name = item.name || 'General';
          const lines = item.topicsText.split(/\r?\n/)
            .map((line) => line.replace(/^[-•\d.)\s]+/, '').trim()).filter(Boolean);
          let resolved = lines.length ? lines.map((title) => ({ title, description: '' })) : [];
          if (!resolved.length && !notesUsed) {
            resolved = topicsFromText(notes);
            if (resolved.length) notesUsed = true;
          }
          if (!resolved.length) {
            resolved = topicsFromText(notes);
            if (resolved.length) notesUsed = true;
          }
          if (!resolved.length) continue;
          const topicIds = resolved.map((entry) => {
            const topicId = uid();
            allTopics.push({
              id: topicId,
              subject: name,
              examDate: item.examDate || '',
              title: entry.title.slice(0, 120),
              description: entry.description || `Repasa ${entry.title} de ${name}. Si necesitas ayuda, pregúntale al tutor.`,
              minutes: item.minutes,
              priority: item.priority,
              status: 'todo',
            });
            return topicId;
          });
          subjects.push({
            id: uid(), name, examDate: item.examDate || '',
            minutes: item.minutes, priority: item.priority, topicIds,
          });
        }
        if (!allTopics.length) throw new Error('Escribe temas en una materia o pega apuntes para crear el plan.');

        const dates = subjects.map((s) => s.examDate).filter(Boolean).sort();
        const id = uid();
        const title = String(data.get('title') || '').trim()
          || (subjects.length > 1 ? `Mi plan · ${subjects.length} materias` : subjects[0].name);
        const created = {
          id,
          title,
          subject: subjects.map((s) => s.name).join(', '),
          subjects,
          examDate: dates[0] || '',
          goal: '',
          hoursPerDay: Number(data.get('hoursPerDay')) || 1.5,
          createdAt: new Date().toISOString(),
          plan: {
            subject: title,
            summary: `${allTopics.length} temas en ${subjects.length} materia${subjects.length === 1 ? '' : 's'}. El calendario alterna materias para avanzar en todas a la vez.`,
            topics: allTopics,
            tips: [
              'Empieza siempre por «Lo de hoy».',
              'Si una materia tiene examen pronto, pon su prioridad en Alta.',
              'Marca cada sesión al terminarla: el tema pasará a Dominado.',
            ],
          },
          materials: notes || files.some((f) => f.kind === 'image')
            ? [{ id: uid(), name: 'Apuntes del plan', text: notes, images: files.filter((f) => f.kind === 'image'), addedAt: new Date().toISOString() }]
            : [],
          flashcards: [], lessons: [], quiz: null, exam: null, podcast: null, examMinutes: 60,
        };
        rebuildSchedule(created);
        state.courses.push(created);
        state.activeCourse = id;
        state.ui.pendingPlanFiles = [];
        award(5, 'first-plan');
        if (!state.ui.toast) state.ui.toast = { text: `✨ Plan listo: ${allTopics.length} temas en ${subjects.length} materias.`, error: false };
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
      const gained = result * 2;
      award(gained, result === questions.length && questions.length ? 'quiz-100' : null);
      if (!state.ui.toast) state.ui.toast = { text: `¡Buen trabajo! ${result} de ${questions.length} aciertos · +${gained} ✦`, error: false };
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
      award(10, 'exam-done');
      if (!state.ui.toast) state.ui.toast = { text: `Simulacro entregado · +10 ✦. Revisa la rúbrica con calma.`, error: false };
      save(); render(); break;
    }
    case 'save-profile': {
      const p = profile();
      if (!p) break;
      const name = String(data.get('name') || '').trim();
      if (!name) { toast('Escribe tu nombre.', true); break; }
      p.name = name;
      p.role = data.get('role') === 'teacher' ? 'teacher' : 'student';
      p.age = Math.max(0, Math.min(99, Number(data.get('age')) || 0));
      p.level = LEVELS.some((l) => l.id === data.get('level')) ? data.get('level') : p.level;
      p.style = STYLES.some(([v]) => v === data.get('style')) ? data.get('style') : p.style;
      p.tone = TONES.some(([v]) => v === data.get('tone')) ? data.get('tone') : p.tone;
      p.calm = data.get('calm') === 'on';
      if (!p.age && LEVELS.find((l) => l.id === p.level)) p.age = LEVELS.find((l) => l.id === p.level).age[0];
      p.avatar3d = data.get('avatar3d') === 'on';
      p.onboarded = true;
      save(); toast('Cuenta guardada. El tutor se adapta a ti.'); break;
    }
    case 'create-profile': {
      const name = String(data.get('name') || '').trim();
      if (!name) break;
      const level = data.get('level') || 'primaria';
      const info = LEVELS.find((l) => l.id === level);
      const created = makeProfile({ name, level, age: info?.age[0] || 0, role: 'student', onboarded: true });
      state.profiles.push(created);
      hydrateProfile(created);
      save(); toast(`Cuenta «${name}» creada.`); break;
    }
    case 'create-group': {
      const name = String(data.get('name') || '').trim();
      if (!name) break;
      const students = String(data.get('students') || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
        .map((s) => ({ id: uid(), name: s.slice(0, 80), minutes: 0, accuracy: 0, mastery: 0 }));
      const group = {
        id: uid(), name, level: data.get('level') || 'secundaria', students,
        material: String(data.get('material') || '').slice(0, 60000),
        resources: {}, createdAt: new Date().toISOString(),
      };
      state.groups = state.groups || [];
      state.groups.push(group);
      state.ui.activeGroup = group.id;
      save(); toast(`Grupo «${name}» creado con ${students.length} estudiantes.`); break;
    }
    case 'add-students': {
      const group = state.groups.find((x) => x.id === form.dataset.id);
      if (!group) break;
      const names = String(data.get('students') || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      group.students = group.students || [];
      names.forEach((name) => group.students.push({ id: uid(), name: name.slice(0, 80), minutes: 0, accuracy: 0, mastery: 0 }));
      save(); toast(`${names.length} estudiante(s) añadido(s).`); break;
    }
    case 'save-cloud':
      await busy(async () => {
        await api('/api/config', {
          method: 'POST',
          body: JSON.stringify({
            cloud: {
              url: data.get('url') || '',
              token: data.get('token') || '',
            },
          }),
        });
        await refreshStatus();
        toast('Configuración de nube guardada. Nada se envía hasta que pulses Subir ahora.');
      });
      break;
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
        state.lang = data.get('lang') === 'nah' ? 'nah' : 'es';
        const p = profile();
        if (p) {
          if (LEVELS.some((l) => l.id === data.get('level'))) p.level = data.get('level');
          p.chatMode = data.get('chatMode') || p.chatMode;
        }
        state.chatMode = data.get('chatMode') || state.chatMode;
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
    if (topic) {
      const wasDone = topic.status === 'done';
      topic.status = el.value;
      for (const session of c.schedule?.sessions || []) {
        if (session.topicId !== topic.id) continue;
        if (el.value === 'done') session.done = true;
        else if (el.value === 'todo') session.done = false;
      }
      if (el.value === 'done' && !wasDone) award(5);
      save(); render();
    }
    return;
  }
  if (change === 'use-material') { state.useMaterial = el.checked; save(); return; }
  if (change === 'provider-change') {
    state.ui.models = [];
    const list = $('#model-list');
    if (list) list.innerHTML = '';
    return;
  }
  if (change === 'plan-file' || change === 'material-file' || change === 'chat-image' || change === 'import-file' || change === 'profile-photo' || change === 'group-progress') {
    const files = Array.from(el.files || []);
    if (change === 'profile-photo') {
      const file = files[0];
      if (!file) return;
      const p = profile();
      if (p) { p.photo = await resizeImage(file, 160); save(); toast('Foto de cuenta guardada en este equipo.'); }
      el.value = '';
      return;
    }
    if (change === 'group-progress') {
      const file = files[0];
      if (!file) return;
      try {
        const raw = JSON.parse(await file.text());
        const entries = Array.isArray(raw) ? raw : [raw];
        const group = state.groups.find((x) => x.id === state.ui.activeGroup) || state.groups[0];
        if (!group) throw new Error('Crea un grupo primero.');
        let linked = 0;
        for (const entry of entries) {
          const fromStats = entry.stats?.minutes ? Object.values(entry.stats.minutes).reduce((a, b) => a + b, 0) : 0;
          const minutes = Number(entry.minutes) || fromStats || 0;
          const totals = entry.stats?.quizResults?.reduce((a, r) => a + r.total, 0) || 0;
          const corrects = entry.stats?.quizResults?.reduce((a, r) => a + r.result, 0) || 0;
          const accuracy = Number(entry.accuracy) || (totals ? Math.round(corrects / totals * 100) : 0);
          const name = String(entry.name || entry.student || '').trim();
          if (!name) continue;
          let student = group.students.find((s) => s.name.trim().toLowerCase() === name.toLowerCase());
          if (!student) {
            student = { id: uid(), name: name.slice(0, 80), minutes: 0, accuracy: 0, mastery: 0 };
            group.students.push(student);
          }
          Object.assign(student, { minutes, accuracy, mastery: Number(entry.mastery) || 0, updatedAt: new Date().toISOString() });
          linked++;
        }
        save(); toast(`Progreso de ${linked} estudiante(s) importado.`);
      } catch (error) { toast(error.message || 'Archivo no válido', true); }
      el.value = '';
      return;
    }
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
        state.groups = imported.groups || state.groups;
        state.activeCourse = imported.courses[0]?.id || null;
        if (imported.profile && typeof imported.profile === 'object') {
          const p = profile();
          if (p) {
            for (const key of ['name', 'role', 'age', 'level', 'style', 'tone', 'calm', 'avatar', 'photo', 'frame', 'skin', 'accessory', 'avatar3d']) {
              if (imported.profile[key] !== undefined) p[key] = imported.profile[key];
            }
          }
        }
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
    el.value = '';
  }
}

/* ------------------------- Arranque ------------------------- */
function handleAuthReturn() {
  const params = new URLSearchParams(location.search);
  if (!params.has('auth')) return;
  const ok = params.get('auth') === 'ok';
  const message = params.get('authMessage') || '';
  history.replaceState(null, '', `${location.pathname}${location.hash || '#/'}`);
  location.hash = '#/app/cuenta';
  toast(ok
    ? '✓ Sesión iniciada. Ya puedes subir o bajar tu cuenta.'
    : `No se pudo iniciar sesión: ${message || 'inténtalo de nuevo.'}`, !ok);
}

async function refreshStatus() {
  try {
    const [s, c, a] = await Promise.all([api('/api/status'), api('/api/config'), api('/api/auth/status')]);
    status = s;
    config = c;
    auth = a;
  } catch (error) {
    status = { providers: [], active: 'demo', model: 'demo' };
    config = { provider: 'demo', model: '', apiKeys: {}, endpoints: {}, cli: {}, chatMode: 'didactic', level: 'bachillerato', cloud: { url: '', token: '' } };
    auth = { enabled: false, email: false, providers: [], user: null };
    state.ui.toast = { text: `No se pudo conectar con el servidor local: ${error.message}`, error: true };
  }
}

function render() {
  const root = $('#root');
  if (!root) return;
  checkBadges();
  const current = route();
  root.innerHTML = current.app ? appShell(current.view) : landing();
  if (current.app && current.view === 'tutor') {
    const log = $('.chat-log');
    if (log) log.scrollTop = log.scrollHeight;
  }
}

document.addEventListener('click', (event) => {
  if (event.target.classList?.contains('help-overlay')) {
    state.ui.help = false;
    render();
    return;
  }
  if (event.target.closest('[data-stop]')) return;
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
save();
await refreshStatus();
handleAuthReturn();
render();
startExamTimer();
setInterval(() => {
  if (!route().app) return;
  const key = new Date().toISOString().slice(0, 10);
  state.stats.minutes[key] = (state.stats.minutes[key] || 0) + 1;
  save();
}, 60000);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
