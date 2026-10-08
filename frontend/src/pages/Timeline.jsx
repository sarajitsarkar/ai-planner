import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios.js';

const STATUS_BAR_COLORS = {
  completed: '#10b981',
  not_started: '#9ca3af',
  early: '#10b981',
  on_track: '#10b981',
  behind: '#f59e0b',
  critical: '#ef4444',
};

const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : '—');

export default function Timeline() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/plan/timeline');
      setData(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-gray-500 dark:text-gray-400">Loading timeline...</div>;
  }
  if (error) {
    return <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-red-500">{error}</div>;
  }
  if (!data || !data.examDate) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Timeline</h1>
        <p className="mt-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Set an exam date on the Planner page to see your Gantt-style timeline.
        </p>
      </div>
    );
  }

  const { today, examDate, revisionStart, mockStart, bars } = data;
  const rangeStart = new Date(today);
  const rangeEnd = new Date(examDate);
  const totalDays = Math.max(1, Math.round((rangeEnd - rangeStart) / (24 * 60 * 60 * 1000)));

  const offsetPercent = (date) => {
    const d = new Date(date);
    const clamped = Math.min(Math.max(d, rangeStart), rangeEnd);
    return ((clamped - rangeStart) / (rangeEnd - rangeStart || 1)) * 100;
  };
  const widthPercent = (start, end) => Math.max(0.5, offsetPercent(end) - offsetPercent(start));

  const rows = [
    ...bars.map((b) => ({
      key: b.id,
      label: b.name,
      color: STATUS_BAR_COLORS[b.status] || b.color || '#6366f1',
      start: b.start,
      end: b.end,
      sublabel: `${fmt(b.start)} → ${fmt(b.end)} · ${b.completionPercent}% done`,
      badge: b.locked ? '🔒' : b.paused ? '⏸️' : b.dormant ? '⏳' : null,
    })),
    ...(revisionStart
      ? [
          {
            key: 'revision',
            label: 'Revision',
            color: '#8b5cf6',
            start: revisionStart,
            end: mockStart || examDate,
            sublabel: `${fmt(revisionStart)} → ${fmt(mockStart || examDate)}`,
            phase: true,
          },
        ]
      : []),
    ...(mockStart
      ? [
          {
            key: 'mocks',
            label: 'Mock Tests',
            color: '#ec4899',
            start: mockStart,
            end: examDate,
            sublabel: `${fmt(mockStart)} → ${fmt(examDate)}`,
            phase: true,
          },
        ]
      : []),
    {
      key: 'exam',
      label: 'Exam',
      color: '#111827',
      start: examDate,
      end: examDate,
      sublabel: fmt(examDate),
      phase: true,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Study Timeline</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Gantt-style view: {fmt(today)} → {fmt(examDate)} ({totalDays} days). Each bar spans today through that subject's own
        completion deadline.
      </p>

      <div className="card mt-6 p-5">
        <div className="mb-3 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> On track</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> At risk</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Behind</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gray-400" /> Not started (⏳)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Revision</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-pink-500" /> Mock tests</span>
        </div>

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-3">
              <div className="w-32 shrink-0 truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                {row.label} {row.badge}
              </div>
              <div className="relative h-6 flex-1 rounded-md bg-gray-100 dark:bg-gray-800">
                <div
                  className="absolute top-0 h-6 rounded-md transition-all"
                  style={{
                    left: `${offsetPercent(row.start)}%`,
                    width: `${row.phase && row.start === row.end ? 1 : widthPercent(row.start, row.end)}%`,
                    backgroundColor: row.color,
                  }}
                  title={row.sublabel}
                />
              </div>
              <div className="hidden w-40 shrink-0 truncate text-[11px] text-gray-400 dark:text-gray-500 sm:block">
                {row.sublabel}
              </div>
            </div>
          ))}
        </div>

        {bars.length === 0 && (
          <p className="mt-4 text-center text-sm text-gray-400 dark:text-gray-500">
            No subjects yet — add some on the Subjects page to see them on the timeline.
          </p>
        )}
      </div>
    </div>
  );
}
