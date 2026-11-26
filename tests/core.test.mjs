import test from 'node:test';
import assert from 'node:assert/strict';
import { demoGenerate, demoChat } from '../src/demo.js';
import { buildGenerateMessages, buildChatMessages, normalizeGenerated, parseModelJson } from '../src/prompts.js';
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
