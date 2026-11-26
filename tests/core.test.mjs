import test from 'node:test';
import assert from 'node:assert/strict';
import { demoGenerate, demoChat } from '../src/demo.js';
import {
  buildGenerateMessages, buildChatMessages, normalizeGenerated, parseModelJson,
  adaptationText, LEVELS,
} from '../src/prompts.js';
import { defaultModel, isCli } from '../src/providers.js';

const MATERIAL = 'La fotosíntesis convierte la luz en energía química. Ocurre en los cloroplastos. La clorofila absorbe luz roja y azul.';

test('el modo demo genera los cinco formatos sin IA', () => {
  for (const kind of ['plan', 'lessons', 'flashcards', 'quiz', 'exam', 'podcast']) {
    const data = demoGenerate(kind, { material: MATERIAL, subject: 'Biología' });
    assert.ok(Object.keys(data).length > 0, `${kind} devolvió vacío`);
  }
  const plan = demoGenerate('plan', { material: MATERIAL });
  assert.ok(plan.topics.length >= 1);
  assert.equal(plan.topics[0].status, 'todo');
});

test('parsea JSON con bloques de código y texto alrededor', () => {
  assert.deepEqual(parseModelJson('```json\n{"a": 1}\n```'), { a: 1 });
  assert.deepEqual(parseModelJson('Claro: {"a": 1} Espero que sirva.'), { a: 1 });
});

test('normaliza salidas incompletas sin romper la UI', () => {
  const plan = normalizeGenerated('plan', '{"topics":[{"title":"Tema 1"},{"title":"Tema 2","minutes":999}]}');
  assert.equal(plan.topics.length, 2);
  assert.equal(plan.topics[0].status, 'todo');
  assert.equal(plan.topics[1].minutes, 180);

  const cards = normalizeGenerated('flashcards', '{"cards":[{"front":"Pregunta","back":"Respuesta"},{"front":"sin reverso"}]}');
  assert.equal(cards.cards.length, 1);

  const quiz = normalizeGenerated('quiz', '{"questions":[{"question":"Q","options":["a","b","c","d"],"answer":9}]}');
  assert.equal(quiz.questions[0].answer, 3);
});

test('los prompts incluyen el material y excluyen temas externos', () => {
  const messages = buildGenerateMessages('plan', { material: MATERIAL, subject: 'Biología' });
  assert.equal(messages.length, 2);
  assert.match(messages[0].content, /JSON/);
  assert.match(messages[1].content, /fotosíntesis/);
  assert.match(messages[1].content, /Biología/);
});

test('el chat conserva roles, imágenes y material de contexto', () => {
  const messages = buildChatMessages({
    mode: 'socratic',
    material: MATERIAL,
    messages: [{ role: 'user', content: 'Hola', images: [{ mime: 'image/png', base64: 'AAA' }] }],
  });
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /fotosíntesis/);
  assert.equal(messages[1].images[0].base64, 'AAA');
  assert.match(demoChat(messages, 'socratic'), /pregunta/i);
});

test('los proveedores CLI se identifican y tienen modelo opcional', () => {
  assert.equal(isCli('cli-opencode'), true);
  assert.equal(isCli('ollama'), false);
  assert.ok(defaultModel('ollama'));
  assert.equal(defaultModel('cli-custom'), '');
});

test('los siete niveles cubren desde kínder hasta doctorado', () => {
  const keys = Object.keys(LEVELS);
  assert.equal(keys.length, 7);
  assert.equal(keys[0], 'kinder');
  assert.equal(keys.at(-1), 'doctorado');
  assert.ok(LEVELS.kinder.minutes < LEVELS.doctorado.minutes);
  assert.deepEqual(LEVELS.primaria.age, [6, 11]);
});

test('la adaptación usa nivel, rol, edad, estilo, tono y calma', () => {
  const adapted = adaptationText({
    level: 'kinder', role: 'teacher', age: 6, style: 'visual', tone: 'jugueton', calm: true,
  });
  assert.match(adapted, /docente de nivel Kínder/);
  assert.match(adapted, /Edad: 6 años/);
  assert.match(adapted, /esquemas/);
  assert.match(adapted, /juguetón/);
  assert.match(adapted, /baja la presión/);

  const withoutAge = adaptationText({ level: 'universidad', age: 0, style: 'lector', tone: 'serio' });
  assert.doesNotMatch(withoutAge, /Edad:/);
  assert.match(withoutAge, /Universidad/);
});

test('los nuevos modos del tutor llegan al prompt con la adaptación', () => {
  for (const mode of ['didactic', 'calm', 'play']) {
    const messages = buildChatMessages({
      mode, material: MATERIAL, level: 'primaria', age: 8,
      messages: [{ role: 'user', content: 'Hola' }],
    });
    assert.match(messages[0].content, /Primaria/);
    assert.match(messages[0].content, /Edad: 8 años/);
    assert.equal(messages[1].role, 'user');
  }
  assert.match(buildChatMessages({ mode: 'play' })[0].content, /juego corto/);
  assert.match(buildChatMessages({ mode: 'calm' })[0].content, /bajo estrés/);
  assert.match(buildChatMessages({ mode: 'didactic' })[0].content, /pasos numerados/);
});

test('los formatos docentes piden JSON e incluyen la adaptación', () => {
  for (const kind of ['guide', 'rubric', 'game']) {
    const messages = buildGenerateMessages(kind, {
      material: MATERIAL, level: 'kinder', role: 'teacher', age: 5,
      style: 'kinestesico', tone: 'jugueton', calm: true,
    });
    assert.match(messages[0].content, /JSON válido/);
    assert.match(messages[0].content, /docente de nivel Kínder/);
    assert.match(messages[1].content, /fotosíntesis/);
  }
});

test('normaliza guías, rúbricas y juegos sin romper la UI', () => {
  const guide = normalizeGenerated('guide', '{"title":"Guía","duration":999,"development":[{"title":"Paso","minutes":999}]}');
  assert.equal(guide.title, 'Guía');
  assert.equal(guide.duration, 180);
  assert.equal(guide.development[0].minutes, 90);

  const rubric = normalizeGenerated('rubric', '{"criteria":[{"name":"Claridad","levels":[{"label":"Excelente"}]}],"tips":["Compartir antes"]}');
  assert.equal(rubric.criteria[0].levels[0].label, 'Excelente');
  assert.deepEqual(rubric.tips, ['Compartir antes']);

  const game = normalizeGenerated('game', '{"name":"Juego","duration":1,"instructions":["Leer en voz alta"]}');
  assert.equal(game.duration, 5);
  assert.deepEqual(game.instructions, ['Leer en voz alta']);
});

test('el modo demo genera material docente y responde con los nuevos tonos', () => {
  for (const kind of ['guide', 'rubric', 'game']) {
    const data = demoGenerate(kind, { material: MATERIAL, subject: 'Biología' });
    assert.ok(Object.keys(data).length > 0, `${kind} devolvió vacío`);
  }
  assert.ok(demoGenerate('guide', { material: MATERIAL }).development.length >= 1);
  assert.equal(demoGenerate('rubric', { material: MATERIAL }).criteria.length, 3);
  const messages = [{ role: 'user', content: 'Explícame esto' }];
  assert.match(demoChat(messages, 'didactic'), /paso a paso/);
  assert.match(demoChat(messages, 'calm'), /no hay prisa/);
  assert.match(demoChat(messages, 'play'), /🎲/);
});
