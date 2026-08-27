export function getCurrentWeekStart(date = new Date()) {
  const start = new Date(date);
  const dayFromMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - dayFromMonday);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export function getCurrentWeekKey(date = new Date()) {
  return getCurrentWeekStart(date).toISOString().slice(0, 10);
}

export function getNextWeekStart(date = new Date()) {
  const next = getCurrentWeekStart(date);
  next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

export function getWeekLabel(date = new Date()) {
  const start = getCurrentWeekStart(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
  return start.getUTCMonth() === end.getUTCMonth()
    ? `${month.format(start)} ${start.getUTCDate()}–${end.getUTCDate()}`
    : `${month.format(start)} ${start.getUTCDate()}–${month.format(end)} ${end.getUTCDate()}`;
}

export function getBattlePairKey(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join(":");
}
