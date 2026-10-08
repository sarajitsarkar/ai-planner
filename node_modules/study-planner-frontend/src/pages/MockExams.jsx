import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios.js';
import { WEEKDAY_LABELS } from '../utils/sessionMeta.js';

const emptyForm = {
  subject: '',
  title: '',
  dayOfWeek: 6,
  startTime: '10:00',
  durationMinutes: 120,
  repeatWeekly: true,
  date: new Date().toISOString().slice(0, 10),
};

export default function MockExams() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [conflicts, setConflicts] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/mock-exams');
      setExams(data.exams);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setConflicts([]);
    try {
      const { data } = await api.post('/mock-exams', {
        ...form,
        dayOfWeek: Number(form.dayOfWeek),
        durationMinutes: Number(form.durationMinutes),
      });
      setExams((prev) => [...prev, data.exam]);
      if (data.conflicts?.length) {
        setConflicts(data.conflicts);
        setError('Mock exam created, but it overlaps with other sessions on some dates — see below.');
      }
      setForm(emptyForm);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create mock exam');
    }
  };

  const handleDelete = async (exam) => {
    if (!confirm(`Delete mock exam "${exam.title || exam.subject}"?`)) return;
    setExams((prev) => prev.filter((e) => e._id !== exam._id));
    await api.delete(`/mock-exams/${exam._id}`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Weekly Mock Exam Planner</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Designate any day of the week (or a specific date) as a mock exam slot.
      </p>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-4 p-5">
        {error && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            <p>{error}</p>
            {conflicts.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-xs">
                {conflicts.map((c, i) => (
                  <li key={i}>
                    {new Date(c.date).toLocaleDateString()}: overlaps with {c.with.map((w) => w.title).join(', ')}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            name="subject"
            className="input"
            placeholder="Subject"
            value={form.subject}
            onChange={handleChange}
            required
          />
          <input
            name="title"
            className="input"
            placeholder="Title (optional, e.g. Full Mock Test 1)"
            value={form.title}
            onChange={handleChange}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            name="repeatWeekly"
            checked={form.repeatWeekly}
            onChange={handleChange}
            className="accent-primary-600"
          />
          Repeat every week until the exam
        </label>

        {form.repeatWeekly ? (
          <div>
            <label className="label">Day of week</label>
            <select name="dayOfWeek" value={form.dayOfWeek} onChange={handleChange} className="input">
              {WEEKDAY_LABELS.map((label, day) => (
                <option key={day} value={day}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label">Date</label>
            <input type="date" name="date" value={form.date} onChange={handleChange} className="input" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start time</label>
            <input type="time" name="startTime" value={form.startTime} onChange={handleChange} className="input" />
          </div>
          <div>
            <label className="label">Duration (min)</label>
            <input
              type="number"
              min="5"
              step="5"
              name="durationMinutes"
              value={form.durationMinutes}
              onChange={handleChange}
              className="input"
            />
          </div>
        </div>

        <button type="submit" className="btn-primary">
          + Add mock exam
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading mock exams...</p>}
        {!loading && exams.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No mock exams scheduled yet.
          </p>
        )}
        {exams.map((exam) => (
          <div key={exam._id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white break-words">
                🧪 {exam.title || `${exam.subject} Mock Exam`}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {exam.subject} ·{' '}
                {exam.repeatWeekly
                  ? `Every ${WEEKDAY_LABELS[exam.dayOfWeek]}`
                  : new Date(exam.date).toLocaleDateString()}{' '}
                · {exam.startTime} · {exam.durationMinutes} min
              </p>
            </div>
            <button onClick={() => handleDelete(exam)} className="btn-danger">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
