import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudySchedule, sessionsForDate, scheduleSummary } from '../public/schedule.js';

const NOW = new Date('2026-11-26T09:00:00');

test('reparte los temas por prioridad en sesiones del tamaño disponible', () => {
  const schedule = buildStudySchedule({
    topics: [
      { id: 'b', title: 'Repaso', minutes: 60, priority: 'low' },
      { id: 'a', title: 'Lo difícil', minutes: 90, priority: 'high' },
      { id: 'c', title: 'Ya visto', minutes: 30, priority: 'medium', status: 'done' },
    ],
    examDate: '2026-11-28',
    hoursPerDay: 1,
    now: NOW,
  });

  assert.equal(schedule.sessions.length, 3);
  assert.deepEqual(schedule.sessions.map((s) => [s.title, s.minutes]), [
    ['Lo difícil', 60], ['Lo difícil', 30], ['Repaso', 60],
  ]);
  assert.equal(schedule.sessions[0].date, '2026-11-26');
  assert.equal(schedule.sessions.at(-1).date, '2026-11-28');
  assert.equal(schedule.late, false);
});

test('avisa si el calendario termina después del examen', () => {
  const schedule = buildStudySchedule({
    topics: [{ id: 'a', title: 'Tema', minutes: 180, priority: 'high' }],
    examDate: '2026-11-27',
    hoursPerDay: 1,
    now: NOW,
  });
  assert.equal(schedule.late, true);
  assert.equal(schedule.sessions.at(-1).date, '2026-11-28');
});

test('consulta el día de hoy y resume el trabajo pendiente', () => {
  const schedule = buildStudySchedule({
    topics: [{ id: 'a', title: 'Tema A', minutes: 30, priority: 'high' }],
    hoursPerDay: 1,
    now: NOW,
  });
  schedule.sessions[0].done = true;
  assert.equal(sessionsForDate(schedule, '2026-11-26').length, 1);
  assert.equal(sessionsForDate(schedule, '2026-11-27').length, 0);
  assert.deepEqual(scheduleSummary(schedule), {
    total: 1, done: 1, minutes: 30, doneMinutes: 30, leftMinutes: 0, days: 1, subjects: 1,
  });
});

test('alterna materias para no abandonar ninguna', () => {
  const schedule = buildStudySchedule({
    topics: [
      { id: 'b1', subject: 'Biología', title: 'B1', minutes: 30, priority: 'high' },
      { id: 'b2', subject: 'Biología', title: 'B2', minutes: 30, priority: 'high' },
      { id: 'h1', subject: 'Historia', title: 'H1', minutes: 30, priority: 'low' },
      { id: 'h2', subject: 'Historia', title: 'H2', minutes: 30, priority: 'low' },
    ],
    hoursPerDay: 2,
    now: NOW,
  });
  assert.deepEqual(schedule.sessions.map((s) => `${s.subject}:${s.title}`), [
    'Biología:B1', 'Historia:H1', 'Biología:B2', 'Historia:H2',
  ]);
  assert.equal(scheduleSummary(schedule).subjects, 2);
});

test('avisa si una sesión cae después de la fecha de su materia', () => {
  const schedule = buildStudySchedule({
    topics: [
      { id: 'a', subject: 'Mate', title: 'A', minutes: 120, examDate: '2026-11-26' },
      { id: 'b', subject: 'Historia', title: 'B', minutes: 60, examDate: '2026-12-10' },
    ],
    hoursPerDay: 1,
    now: NOW,
  });
  assert.equal(schedule.late, true);
  assert.equal(schedule.sessions.filter((s) => s.subject === 'Mate').length, 2);
});

test('sin temas pendientes no hay calendario', () => {
  assert.equal(buildStudySchedule({ topics: [], now: NOW }), null);
  assert.equal(buildStudySchedule({
    topics: [{ id: 'a', title: 'Hecho', status: 'done' }], now: NOW,
  }), null);
});
