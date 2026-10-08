import { useState, useEffect, useMemo } from 'react';
import { SESSION_TYPES } from '../utils/sessionMeta.js';

const emptyForm = {
  type: 'study',
  subject: '',
  subtopic: '',
  title: '',
  notes: '',
  date: new Date().toISOString().slice(0, 10),
  startTime: '',
  endTime: '',
  durationMinutes: 30,
  priority: 3,
  status: 'not_started',
  autoCreateNotes: true,
};

// Duration (minutes) between two "HH:mm" strings, or null if invalid.
function diffMinutes(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  return endMin > startMin ? endMin - startMin : null;
}

function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + Number(minutes);
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/**
 * Session form used across the Dashboard, Tasks page, and Daily Schedule.
 * Supports every session type (study/notes/practice/revision/mock exam/
 * custom), optional start & end time with auto-calculated (but editable)
 * duration, subtopic linking, priority, and status.
 *
 * `onSubmit` should return `{ ok: true }` on success, or
 * `{ ok: false, conflicts, message }` if the backend reported an overlap —
 * in that case this modal offers a "Save anyway" option that resubmits
 * with `force: true`.
 */
export default function TaskFormModal({ open, onClose, onSubmit, initialTask, prefill, subjects = [] }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflicts, setConflicts] = useState([]);

  useEffect(() => {
    if (initialTask) {
      setForm({
        type: initialTask.type || 'study',
        subject: initialTask.subject,
        subtopic: initialTask.subtopic || '',
        title: initialTask.title,
        notes: initialTask.notes || '',
        date: new Date(initialTask.date).toISOString().slice(0, 10),
        startTime: initialTask.startTime || '',
        endTime: initialTask.endTime || '',
        durationMinutes: initialTask.durationMinutes,
        priority: initialTask.priority,
        status: initialTask.status || (initialTask.completed ? 'completed' : 'not_started'),
        autoCreateNotes: true,
      });
    } else {
      setForm({ ...emptyForm, ...(prefill || {}) });
    }
    setError('');
    setConflicts([]);
  }, [initialTask, prefill, open]);

  const matchingSubject = useMemo(
    () => subjects.find((s) => s.name.toLowerCase() === form.subject.trim().toLowerCase()),
    [subjects, form.subject]
  );

  if (!open) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === 'checkbox' ? checked : value;

    setForm((f) => {
      const next = { ...f, [name]: nextValue };

      // Keep duration/end-time in sync automatically (still editable directly)
      if (name === 'startTime' || name === 'endTime') {
        const computed = diffMinutes(next.startTime, next.endTime);
        if (computed) next.durationMinutes = computed;
      }
      if (name === 'durationMinutes' && next.startTime) {
        next.endTime = addMinutes(next.startTime, nextValue || 0);
      }
      return next;
    });
  };

  const submit = async (force = false) => {
    setSaving(true);
    setError('');
    const result = await onSubmit({
      ...form,
      durationMinutes: Number(form.durationMinutes),
      priority: Number(form.priority),
      force,
    });
    setSaving(false);

    if (!result || result.ok) {
      setConflicts([]);
      return;
    }
    setError(result.message || 'Something went wrong');
    setConflicts(result.conflicts || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submit(false);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="card max-h-[90vh] w-full max-w-md overflow-y-auto p-6">
        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">
          {initialTask ? 'Edit session' : 'Add a session'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              <p>{error}</p>
              {conflicts.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-xs">
                  {conflicts.map((c) => (
                    <li key={c.id}>
                      {c.title} ({c.startTime}–{c.endTime})
                    </li>
                  ))}
                </ul>
              )}
              {conflicts.length > 0 && (
                <button
                  type="button"
                  onClick={() => submit(true)}
                  className="mt-2 text-xs font-semibold underline"
                >
                  Save anyway
                </button>
              )}
            </div>
          )}

          <div>
            <label className="label">Session type</label>
            <select name="type" value={form.type} onChange={handleChange} className="input">
              {Object.entries(SESSION_TYPES)
                .filter(([key]) => key !== 'mock_exam') // mock exams are managed on their own page
                .map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.icon} {meta.label}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="label">Subject</label>
            <input
              name="subject"
              value={form.subject}
              onChange={handleChange}
              required
              className="input"
              placeholder="e.g. Chemistry"
              list="subject-options"
            />
            <datalist id="subject-options">
              {subjects.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>

          {matchingSubject?.subtopics?.length > 0 ? (
            <div>
              <label className="label">Subtopic / chapter</label>
              <select name="subtopic" value={form.subtopic} onChange={handleChange} className="input">
                <option value="">— none —</option>
                {matchingSubject.subtopics.map((s) => (
                  <option key={s._id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="label">Subtopic / chapter (optional)</label>
              <input
                name="subtopic"
                value={form.subtopic}
                onChange={handleChange}
                className="input"
                placeholder="e.g. Chapter 4: Thermodynamics"
              />
            </div>
          )}

          <div>
            <label className="label">{form.type === 'custom' ? 'Task title' : 'Session title'}</label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              className="input"
              placeholder="e.g. Revise Chapter 4"
            />
          </div>

          <div>
            <label className="label">Date</label>
            <input type="date" name="date" value={form.date} onChange={handleChange} required className="input" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Start time</label>
              <input type="time" name="startTime" value={form.startTime} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="label">End time</label>
              <input type="time" name="endTime" value={form.endTime} onChange={handleChange} className="input" />
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
                required
                className="input"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
            Duration is calculated automatically from start/end time, but you can edit any of the three directly.
          </p>

          {form.type === 'study' && !initialTask && (
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                name="autoCreateNotes"
                checked={form.autoCreateNotes}
                onChange={handleChange}
                className="accent-primary-600"
              />
              Automatically add a Notes Making session right after this one
            </label>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Priority (1-5)</label>
              <input
                type="range"
                min="1"
                max="5"
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="w-full accent-primary-600"
              />
              <div className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">{form.priority}</div>
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" value={form.status} onChange={handleChange} className="input">
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">{form.type === 'custom' ? 'Description (optional)' : 'Notes (optional)'}</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              className="input"
              placeholder="Any extra detail..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
