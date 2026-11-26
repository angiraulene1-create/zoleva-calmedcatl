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
    total: 1, done: 1, minutes: 30, doneMinutes: 30, leftMinutes: 0, days: 1,
  });
});

test('sin temas pendientes no hay calendario', () => {
  assert.equal(buildStudySchedule({ topics: [], now: NOW }), null);
  assert.equal(buildStudySchedule({
    topics: [{ id: 'a', title: 'Hecho', status: 'done' }], now: NOW,
  }), null);
});
