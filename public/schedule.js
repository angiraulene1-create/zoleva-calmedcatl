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

const usableDate = (value, today) => (
  /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && value >= today ? value : ''
);

export const localDateKey = (date = new Date()) => dateKey(date);

/**
 * Reparte los temas en sesiones diarias. Si hay varias materias, alterna una
 * tema de cada una para que ninguna quede abandonada al final del calendario.
 */
export function buildStudySchedule({
  topics = [], examDate = '', hoursPerDay = 1.5, now = new Date(), deadlines = {},
} = {}) {
  const pending = (Array.isArray(topics) ? topics : []).filter(
    (topic) => topic && topic.status !== 'done' && String(topic.title || '').trim(),
  );
  if (!pending.length) return null;

  // Agrupar por materia y ordenar cada grupo por prioridad.
  const groups = new Map();
  for (const topic of pending) {
    const key = String(topic.subject || 'General').trim() || 'General';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(topic);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => (ORDER[a.priority] ?? 1) - (ORDER[b.priority] ?? 1));
  }

  // Ronda equitativa: un tema de cada materia por vuelta.
  const keys = [...groups.keys()];
  const ordered = [];
  let groupsLeft = keys.length;
  while (groupsLeft > 0) {
    for (const key of keys) {
      const list = groups.get(key);
      if (!list.length) continue;
      ordered.push({ topic: list.shift(), subject: key });
      if (!list.length) groupsLeft--;
    }
  }

  const budget = Math.max(15, Math.min(480, Math.round((Number(hoursPerDay) || 1.5) * 60)));
  const blocks = [];
  for (const { topic, subject } of ordered) {
    let remaining = Math.max(5, Math.min(240, Math.round(Number(topic.minutes) || 30)));
    while (remaining > 0) {
      const minutes = Math.min(remaining, budget);
      blocks.push({
        topicId: topic.id,
        title: String(topic.title).slice(0, 120),
        subject,
        minutes,
      });
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
      subject: block.subject,
      minutes: block.minutes,
      done: false,
    });
    used += block.minutes;
  }

  const deadlinesMap = { ...(deadlines && typeof deadlines === 'object' ? deadlines : {}) };
  for (const topic of pending) {
    const deadline = topic.examDate || topic.subjectDate || deadlinesMap[topic.id];
    if (deadline) deadlinesMap[topic.id] = deadline;
  }
  const hasOwnDeadlines = Object.values(deadlinesMap).some((value) => usableDate(value, today));
  const globalDeadline = hasOwnDeadlines ? '' : usableDate(examDate, today);
  const lastDate = sessions.at(-1)?.date || '';
  const lateBySubject = sessions.some((session) => {
    const deadline = usableDate(deadlinesMap[session.topicId], today);
    return deadline && session.date > deadline;
  });

  return {
    hoursPerDay: Number(hoursPerDay) || 1.5,
    examDate: globalDeadline,
    deadlines: deadlinesMap,
    generatedAt: new Date().toISOString(),
    late: lateBySubject || Boolean(globalDeadline && lastDate > globalDeadline),
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
    subjects: new Set(sessions.map((session) => session.subject).filter(Boolean)).size,
  };
}
