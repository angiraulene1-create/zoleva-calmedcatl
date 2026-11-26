// Calendario de estudio: pura lógica, sin navegador ni dependencias.
const DAY = 24 * 60 * 60 * 1000;
const ORDER = { high: 0, medium: 1, low: 2 };

function dateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const localDateKey = (date = new Date()) => dateKey(date);

/** Reparte los temas en sesiones diarias dentro del tiempo que la persona tiene al día. */
export function buildStudySchedule({ topics = [], examDate = '', hoursPerDay = 1.5, now = new Date() } = {}) {
  const pending = (Array.isArray(topics) ? topics : []).filter(
    (topic) => topic && topic.status !== 'done' && String(topic.title || '').trim(),
  );
  if (!pending.length) return null;

  const sorted = [...pending].sort((a, b) => (ORDER[a.priority] ?? 1) - (ORDER[b.priority] ?? 1));
  const budget = Math.max(15, Math.min(480, Math.round((Number(hoursPerDay) || 1.5) * 60)));
  const blocks = [];
  for (const topic of sorted) {
    let remaining = Math.max(10, Math.min(240, Math.round(Number(topic.minutes) || 30)));
    while (remaining > 0) {
      const minutes = Math.min(remaining, budget);
      blocks.push({ topicId: topic.id, title: String(topic.title).slice(0, 120), minutes });
      remaining -= minutes;
    }
  }

  const today = dateKey(now);
  const start = new Date(now);
  start.setHours(12, 0, 0, 0);
  const sessions = [];
  let used = 0;
  let cursor = start;
  for (const block of blocks) {
    if (used + block.minutes > budget) {
      cursor = new Date(cursor.getTime() + DAY);
      used = 0;
    }
    sessions.push({
      id: `ses-${sessions.length + 1}`,
      date: dateKey(cursor),
      topicId: block.topicId,
      title: block.title,
      minutes: block.minutes,
      done: false,
    });
    used += block.minutes;
  }

  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(examDate) && examDate >= today ? examDate : '';
  const lastDate = sessions.at(-1)?.date || '';
  return {
    hoursPerDay: Number(hoursPerDay) || 1.5,
    examDate: deadline,
    generatedAt: new Date().toISOString(),
    late: Boolean(deadline && lastDate > deadline),
    sessions,
  };
}

export function sessionsForDate(schedule, day = localDateKey()) {
  return (schedule?.sessions || []).filter((session) => session.date === day);
}

export function scheduleSummary(schedule) {
  const sessions = schedule?.sessions || [];
  const done = sessions.filter((session) => session.done).length;
  const minutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
  const doneMinutes = sessions.filter((session) => session.done).reduce((sum, session) => sum + session.minutes, 0);
  return {
    total: sessions.length,
    done,
    minutes,
    doneMinutes,
    leftMinutes: Math.max(0, minutes - doneMinutes),
    days: new Set(sessions.map((session) => session.date)).size,
  };
}
