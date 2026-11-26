// Prompts y esquemas de salida. Todo el contenido se genera a partir de los
// materiales del estudiante: no se inventa temario externo.

const JSON_RULE =
  'Responde ÚNICAMENTE con JSON válido, sin texto antes ni después, sin bloques de código.';
const LANGUAGE = 'Escribe siempre en español.';

const SYSTEMS = {
  plan: `${JSON_RULE} ${LANGUAGE} Eres un planificador de estudio. Divide SOLO el material aportado en temas ordenados, realistas y específicos. No añadas temas que no aparezcan en el material. Formato: {"subject":"string","summary":"string","topics":[{"id":"t1","title":"string","description":"string","minutes":20,"priority":"high|medium|low"}],"tips":["string"]}. Máximo 8 temas.`,
  lessons: `${JSON_RULE} ${LANGUAGE} Eres un profesor que explica con ejemplos. Explica cada tema usando exclusivamente el material. Formato: {"lessons":[{"topicId":"string","title":"string","explanation":"string","example":"string","keyPoints":["string"],"question":"string"}]}.`,
  flashcards: `${JSON_RULE} ${LANGUAGE} Crea tarjetas de memoria activa a partir del material. Una cara = una pregunta concreta; reverso = respuesta breve. Formato: {"cards":[{"front":"string","back":"string","topic":"string"}]}. Entre 8 y 15 tarjetas.`,
  quiz: `${JSON_RULE} ${LANGUAGE} Crea un cuestionario de 6 a 10 preguntas sobre el material. Solo una opción correcta. Formato: {"questions":[{"question":"string","options":["string","string","string","string"],"answer":0,"explanation":"string","topic":"string"}]}. El campo answer es el índice (0-3) de la opción correcta.`,
  exam: `${JSON_RULE} ${LANGUAGE} Crea un simulacro de examen con preguntas de opción múltiple y desarrolladas, basado solo en el material. Formato: {"questions":[{"question":"string","type":"mcq|written","options":["string"],"answer":0,"rubric":"string","topic":"string","points":1}]}.`,
  podcast: `${JSON_RULE} ${LANGUAGE} Convierte el material en un guion de podcast corto para estudiar, con dos voces. Formato: {"segments":[{"speaker":"A| B","text":"string"}]}. Máximo 16 segmentos.`,
  explain: `${LANGUAGE} Eres un tutor paciente. Explica paso a paso, con ejemplos sencillos y sin dar la respuesta final hasta el final. Usa Markdown.`,
  socratic: `${LANGUAGE} Eres un tutor socrático. NUNCA des la respuesta directamente. Haz una pregunta guía, espera a que el estudiante responda, da una pista pequeña y vuelve a preguntar. Si el estudiante se rinde tras varios intentos, explica el paso a paso. Usa Markdown, frases cortas y máximo 150 palabras.`,
  solve: `${LANGUAGE} Eres un tutor que resuelve ejercicios. Muestra cada paso, justifica por qué, y al final comprueba con una pregunta breve que el estudiante haya entendido. Usa Markdown.`,
  tutor: `${LANGUAGE} Eres un tutor personal. Explicas a la altura del estudiante, usas ejemplos de su material y terminas con una pregunta para comprobar la comprensión. Usa Markdown.`,
};

const USER_PROMPTS = {
  plan: (p) =>
    `Asignatura: ${p.subject || 'general'}\nNivel: ${p.level || 'bachillerato'}\nFecha del examen: ${p.examDate || 'sin fecha'}\nObjetivo: ${p.goal || 'aprobar'}\nHoras diarias aproximadas: ${p.hoursPerDay || 1}\n\nMATERIAL:\n${clip(p.material)}`,
  lessons: (p) =>
    `Tema(s) a explicar: ${p.topic || 'todos los temas del plan'}\n\nMATERIAL:\n${clip(p.material)}\n\nPLAN: ${JSON.stringify(p.plan || []).slice(0, 3000)}`,
  flashcards: (p) => `Tema: ${p.topic || 'todos'}\n\nMATERIAL:\n${clip(p.material)}`,
  quiz: (p) => `Tema: ${p.topic || 'todos'}\n\nMATERIAL:\n${clip(p.material)}`,
  exam: (p) =>
    `Tema: ${p.topic || 'todos'}\nDuración: ${p.minutes || 60} minutos\n\nMATERIAL:\n${clip(p.material)}`,
  podcast: (p) => `Tema: ${p.topic || 'todos'}\n\nMATERIAL:\n${clip(p.material)}`,
};

function clip(text, max = 18000) {
  const value = String(text || '').trim();
  return value.length > max ? `${value.slice(0, max)}\n…[material recortado]` : value || '(sin material: inventa un tema de ejemplo y dilo explícitamente)';
}

export function buildGenerateMessages(kind, payload = {}) {
  const system = SYSTEMS[kind];
  if (!system) throw new Error(`Tipo de generación desconocido: ${kind}`);
  const user = USER_PROMPTS[kind] ? USER_PROMPTS[kind](payload) : clip(payload.material);
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export function buildChatMessages(payload = {}) {
  const mode = payload.mode || 'tutor';
  const system = SYSTEMS[mode] || SYSTEMS.tutor;
  const context = payload.material
    ? `MATERIAL DEL ESTUDIANTE (usalo como fuente):\n${clip(payload.material, 10000)}`
    : '';
  const messages = [{ role: 'system', content: context ? `${system}\n\n${context}` : system }];
  for (const message of payload.messages || []) {
    if (!['user', 'assistant'].includes(message.role)) continue;
    messages.push({
      role: message.role,
      content: String(message.content || ''),
      ...(message.images?.length ? { images: message.images } : {}),
    });
  }
  return messages;
}

/** Parsea la salida del modelo tolerando bloques ```json y texto alrededor. */
export function parseModelJson(text) {
  if (text == null) throw new Error('El modelo no devolvió contenido');
  if (typeof text === 'object') return text;
  let value = String(text).trim();
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) value = fenced[1].trim();
  try {
    return JSON.parse(value);
  } catch {
    const start = value.search(/[[{]/);
    const end = Math.max(value.lastIndexOf('}'), value.lastIndexOf(']'));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(value.slice(start, end + 1));
      } catch {
        /* seguimos */
      }
    }
    throw new Error('El modelo no devolvió JSON válido. Prueba otra vez o usa otro proveedor.');
  }
}

const str = (v, fallback = '') => (typeof v === 'string' ? v.trim() : fallback);
const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v, fallback = 1) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/** Normaliza y valida la salida para que la UI nunca reciba datos mal formados. */
export function normalizeGenerated(kind, raw) {
  const data = parseModelJson(raw);
  switch (kind) {
    case 'plan': {
      const topics = arr(data.topics || data.items).map((topic, i) => ({
        id: str(topic.id, `t${i + 1}`),
        title: str(topic.title, `Tema ${i + 1}`),
        description: str(topic.description),
        minutes: Math.max(5, Math.min(180, num(topic.minutes, 25))),
        priority: ['high', 'medium', 'low'].includes(topic.priority) ? topic.priority : 'medium',
        status: 'todo',
      }));
      return {
        subject: str(data.subject),
        summary: str(data.summary),
        topics: topics.slice(0, 12),
        tips: arr(data.tips).map((t) => str(t)).filter(Boolean),
      };
    }
    case 'lessons':
      return {
        lessons: arr(data.lessons).map((l) => ({
          topicId: str(l.topicId),
          title: str(l.title, 'Lección'),
          explanation: str(l.explanation),
          example: str(l.example),
          keyPoints: arr(l.keyPoints).map(str).filter(Boolean),
          question: str(l.question),
        })),
      };
    case 'flashcards':
      return {
        cards: arr(data.cards || data.flashcards)
          .map((c) => ({
            front: str(c.front || c.question),
            back: str(c.back || c.answer),
            topic: str(c.topic),
          }))
          .filter((c) => c.front && c.back)
          .slice(0, 40),
      };
    case 'quiz':
      return {
        questions: arr(data.questions)
          .map((q) => {
            const options = arr(q.options).map(str).filter(Boolean);
            const answer = Math.max(0, Math.min(Math.max(0, options.length - 1), num(q.answer, 0)));
            return {
              question: str(q.question),
              options,
              answer,
              explanation: str(q.explanation),
              topic: str(q.topic),
            };
          })
          .filter((q) => q.question && q.options.length >= 2)
          .slice(0, 20),
      };
    case 'exam':
      return {
        questions: arr(data.questions)
          .map((q) => ({
            question: str(q.question),
            type: q.type === 'written' ? 'written' : 'mcq',
            options: arr(q.options).map(str).filter(Boolean),
            answer: Math.max(0, num(q.answer, 0)),
            rubric: str(q.rubric),
            topic: str(q.topic),
            points: Math.max(1, num(q.points, 1)),
          }))
          .filter((q) => q.question)
          .slice(0, 30),
      };
    case 'podcast':
      return {
        segments: arr(data.segments)
          .map((s) => ({ speaker: s.speaker === 'B' ? 'B' : 'A', text: str(s.text) }))
          .filter((s) => s.text)
          .slice(0, 30),
      };
    default:
      return data;
  }
}
