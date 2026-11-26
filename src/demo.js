// Proveedor "demo": genera material de estudio sin IA, sin clave y sin red.
// Sirve para probar la app al instante y como fallback cuando no hay proveedor.

const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();

function sentences(text) {
  return clean(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
}

function chunks(text, size = 2) {
  const parts = sentences(text);
  if (!parts.length) {
    return [
      'Repasa los conceptos fundamentales y sus definiciones.',
      'Practica ejercicios sencillos aplicando cada concepto.',
      'Explica con tus palabras lo aprendido y comprueba los errores.',
    ].map((t, i) => ({ title: `Bloque ${i + 1}`, text: t }));
  }
  const result = [];
  for (let i = 0; i < parts.length; i += size) {
    const body = parts.slice(i, i + size).join(' ');
    const first = clean(parts[i]).split(' ').slice(0, 6).join(' ');
    result.push({
      title: first.charAt(0).toUpperCase() + first.slice(1),
      text: body.length > 400 ? `${body.slice(0, 400)}…` : body,
    });
    if (result.length >= 8) break;
  }
  return result;
}

function topicTitle(chunk, i) {
  return clean(chunk.title).slice(0, 70) || `Tema ${i + 1}`;
}

export function demoGenerate(kind, payload = {}) {
  const parts = chunks(payload.material);
  const subject = clean(payload.subject || payload.topic || 'tu asignatura');
  const topics = parts.map((part, i) => ({
    id: `t${i + 1}`,
    title: topicTitle(part, i),
    description: part.text,
    minutes: 20 + (i % 3) * 10,
    priority: i < 2 ? 'high' : i < 4 ? 'medium' : 'low',
    status: 'todo',
  }));

  switch (kind) {
    case 'plan':
      return {
        subject,
        summary: `Plan de ejemplo generado sin IA a partir de ${parts.length} bloques de tu material. Sustituye el proveedor Demo por Ollama u otro para obtener un plan más rico.`,
        topics,
        tips: ['Repasa 10 minutos cada día.', 'Explica cada tema en voz alta.', 'Anota lo que no entiendas y pregúntalo al tutor.'],
      };
    case 'lessons':
      return {
        lessons: parts.map((part, i) => ({
          topicId: `t${i + 1}`,
          title: topicTitle(part, i),
          explanation: part.text,
          example: `Relaciona esta idea con un ejemplo de tu día a día y explícalo con tus palabras.`,
          keyPoints: sentences(part.text).slice(0, 3),
          question: `¿Cómo explicarías "${topicTitle(part, i)}" sin mirar el apunte?`,
        })),
      };
    case 'flashcards':
      return {
        cards: parts.flatMap((part, i) => {
          const ss = sentences(part.text);
          return ss.slice(0, 2).map((s, j) => ({
            front: j === 0 ? `¿Qué describes en el bloque "${topicTitle(part, i)}"?` : `Completa: "${s.split(' ').slice(0, 5).join(' ')}…"`,
            back: s,
            topic: topicTitle(part, i),
          }));
        }),
      };
    case 'quiz':
      return {
        questions: parts.slice(0, 8).map((part, i) => {
          const correct = part.text;
          const wrong = parts[(i + 1) % parts.length].text;
          const options = [correct, wrong, `No aparece en el material: ${topicTitle(part, i)}`, 'Ninguna de las anteriores'];
          return {
            question: `Según tus apuntes, ¿qué corresponde a "${topicTitle(part, i)}"?`,
            options,
            answer: 0,
            explanation: correct,
            topic: topicTitle(part, i),
          };
        }),
      };
    case 'exam':
      return {
        questions: parts.slice(0, 6).map((part, i) => ({
          question: i % 2 === 0
            ? `Explica con tus palabras "${topicTitle(part, i)}".`
            : `Según el material, ¿qué afirmación es correcta sobre "${topicTitle(part, i)}"?`,
          type: i % 2 === 0 ? 'written' : 'mcq',
          options: i % 2 === 0 ? [] : [part.text, parts[(i + 1) % parts.length].text, 'Ninguna', 'Todas'],
          answer: i % 2 === 0 ? 0 : 0,
          rubric: part.text,
          topic: topicTitle(part, i),
          points: 2,
        })),
      };
    case 'podcast':
      return {
        segments: parts.slice(0, 6).flatMap((part, i) => [
          { speaker: 'A', text: `Vamos con el tema ${i + 1}: ${topicTitle(part, i)}.` },
          { speaker: 'B', text: part.text },
        ]),
      };
    default:
      return {};
  }
}

export function demoChat(messages = [], mode = 'tutor') {
  const last = [...messages].reverse().find((m) => m.role === 'user');
  const question = clean(last?.content || '').slice(0, 180);
  if (mode === 'socratic') {
    return `Buena pregunta. Antes de darte la respuesta: **¿qué parte ya tienes clara?**\n\nPiensa en un ejemplo concreto de "${question || 'tu tema'}" y dime qué pasaría si cambias un dato. Si te atascas, te daré una pista.`;
  }
  return `Estoy en **modo demo** (sin IA), así que no puedo analizar "${question || 'tu pregunta'}" de verdad.\n\nPara tener un tutor real y gratuito:\n1. Instala Ollama y un modelo pequeño, o\n2. Elige OpenRouter / Gemini / Groq en **Ajustes**, o\n3. Selecciona un CLI (opencode, claude, codex, gemini).\n\nMientras tanto puedes usar los materiales de ejemplo y las tarjetas generadas en modo demo.`;
}
