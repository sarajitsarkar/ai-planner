// Shared helpers for validating a day's schedule: overlapping sessions,
// total time exceeding 24 hours, and remaining free time.

/** "HH:mm" -> minutes since midnight. Returns null if not a valid time string. */
function timeToMinutes(time) {
  if (!time || typeof time !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** minutes since midnight -> "HH:mm" */
function minutesToTime(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Duration in minutes between two "HH:mm" strings. Supports end times past midnight is NOT supported — end must be after start within the same day. */
function durationBetween(startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null || end <= start) return null;
  return end - start;
}

/**
 * Finds overlaps between a candidate session's time range and a list of
 * existing sessions (both using "HH:mm" startTime/endTime). Sessions
 * without a time range (legacy tasks) are ignored for overlap purposes.
 * Returns the array of conflicting sessions (empty if none).
 */
function findOverlaps(existingSessions, candidate, excludeId = null) {
  const candStart = timeToMinutes(candidate.startTime);
  const candEnd = timeToMinutes(candidate.endTime);
  if (candStart === null || candEnd === null) return [];

  return existingSessions.filter((s) => {
    if (excludeId && String(s._id) === String(excludeId)) return false;
    const start = timeToMinutes(s.startTime);
    const end = timeToMinutes(s.endTime);
    if (start === null || end === null) return false;
    return candStart < end && start < candEnd; // standard interval overlap check
  });
}

/**
 * Summarizes a day's sessions: total scheduled minutes, free minutes left
 * in the 24-hour day, and a breakdown per session type.
 */
function calcDaySummary(sessions) {
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const byType = {};
  sessions.forEach((s) => {
    byType[s.type] = (byType[s.type] || 0) + (s.durationMinutes || 0);
  });

  return {
    totalMinutes,
    freeMinutes: Math.max(0, 1440 - totalMinutes),
    overCapacity: totalMinutes > 1440,
    byType,
  };
}

/**
 * Checks whether a subject's target completion date is achievable —
 * i.e. it falls on or before the user's exam date. Returns a warning
 * message, or null if there's no conflict.
 */
function checkDeadlineFeasible(targetCompletionDate, examDate) {
  if (!targetCompletionDate || !examDate) return null;
  const target = new Date(targetCompletionDate);
  const exam = new Date(examDate);
  if (target > exam) {
    return `Target completion date (${target.toDateString()}) is after the exam date (${exam.toDateString()}).`;
  }
  return null;
}

module.exports = {
  timeToMinutes,
  minutesToTime,
  durationBetween,
  findOverlaps,
  calcDaySummary,
  checkDeadlineFeasible,
};
