import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { STATUS_LABELS, STATUS_COLORS, WEEKDAY_LABELS } from '../utils/sessionMeta.js';

const emptySubjectForm = {
  name: '',
  priority: 3,
  difficulty: 3,
  weightage: '',
  estimatedHours: '',
  color: '#6366f1',
  planningStartDate: '',
  completionDeadline: '',
};
const emptyChapterForm = { name: '', estimatedHours: 2, importance: 3, pyqWeightage: 0 };

const STATUS_BADGES = {
  completed: { label: '✅ Completed', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
  not_started: { label: '⏳ Not started yet', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  early: { label: '🟢 Early', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
  on_track: { label: '🟢 On Track', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
  behind: { label: '🟡 At Risk', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
  critical: { label: '🔴 Behind', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
};

export default function Subjects() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [revisionPlans, setRevisionPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState(emptySubjectForm);
  const [chapterForms, setChapterForms] = useState({}); // { [subjectId]: {name, estimatedHours, importance, pyqWeightage} }
  const [error, setError] = useState('');
  const [editingRemainingId, setEditingRemainingId] = useState(null); // subject.id currently being edited
  const [remainingHoursInput, setRemainingHoursInput] = useState('');
  const [editingEstimatedId, setEditingEstimatedId] = useState(null);
  const [estimatedHoursInput, setEstimatedHoursInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subjectsRes, revisionRes] = await Promise.all([api.get('/subjects'), api.get('/revision')]);
      setSubjects(subjectsRes.data.subjects);
      setRevisionPlans(revisionRes.data.plans);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    setError('');
    if (form.planningStartDate && form.completionDeadline && form.planningStartDate > form.completionDeadline) {
      setError('Planning Start Date must be on or before the Completion Deadline.');
      return;
    }
    try {
      const payload = {
        ...form,
        weightage: form.weightage === '' ? undefined : Number(form.weightage),
        estimatedHours: form.estimatedHours === '' ? undefined : Number(form.estimatedHours),
        planningStartDate: form.planningStartDate || undefined,
        completionDeadline: form.completionDeadline || undefined,
      };
      const { data } = await api.post('/subjects', payload);
      setSubjects((prev) => [...prev, data.subject]);
      if (data.warning) setError(data.warning);
      setForm(emptySubjectForm);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create subject');
    }
  };

  const handleSeedGateCse = async () => {
    setSeeding(true);
    setError('');
    try {
      const { data } = await api.post('/subjects/seed-gate-cse');
      if (data.created > 0) {
        setSubjects((prev) => [...prev, ...data.subjects]);
      }
      if (data.skipped > 0 && data.created === 0) {
        setError('You already have all 13 GATE CSE subjects.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to seed GATE CSE subjects');
    } finally {
      setSeeding(false);
    }
  };

  const handleDeleteSubject = async (subject) => {
    if (!confirm(`Delete "${subject.name}" and all its chapters?`)) return;
    setSubjects((prev) => prev.filter((s) => s.id !== subject.id));
    await api.delete(`/subjects/${subject.id}`);
  };

  const handlePlanningWindowChange = async (subject, patch) => {
    const nextStart = patch.planningStartDate !== undefined ? patch.planningStartDate : subject.planningStartDate?.slice(0, 10);
    const nextDeadline = patch.completionDeadline !== undefined ? patch.completionDeadline : subject.completionDeadline?.slice(0, 10);
    if (nextStart && nextDeadline && nextStart > nextDeadline) {
      setError('Planning Start Date must be on or before the Completion Deadline.');
      return;
    }
    try {
      const { data } = await api.put(`/subjects/${subject.id}`, patch);
      setSubjects((prev) => prev.map((s) => (s.id === subject.id ? data.subject : s)));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update planning window');
    }
  };

  const handleOverride = async (subject, action, extra = {}) => {
    const { data } = await api.patch(`/subjects/${subject.id}/override`, { action, ...extra });
    setSubjects((prev) => prev.map((s) => (s.id === subject.id ? data.subject : s)));
  };

  const startEditRemaining = (subject) => {
    setError('');
    setEditingRemainingId(subject.id);
    setRemainingHoursInput(String(subject.remainingHours ?? subject.deadlineMetrics?.remainingHours ?? ''));
  };

  const cancelEditRemaining = () => {
    setEditingRemainingId(null);
    setRemainingHoursInput('');
  };

  const handleSaveRemainingHours = async (subject) => {
    setError('');
    const value = Number(remainingHoursInput);
    if (Number.isNaN(value) || value < 0) {
      setError('Remaining Hours must be a non-negative number.');
      return;
    }
    if (subject.estimatedHours && value > subject.estimatedHours) {
      setError(`Remaining Hours cannot exceed Estimated Hours (${subject.estimatedHours}h).`);
      return;
    }
    try {
      const { data } = await api.patch(`/subjects/${subject.id}/remaining-hours`, { remainingHours: value });
      setSubjects((prev) => prev.map((s) => (s.id === subject.id ? data.subject : s)));
      cancelEditRemaining();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update Remaining Hours');
    }
  };

  const handleResetRemainingHours = async (subject) => {
    setError('');
    try {
      const { data } = await api.patch(`/subjects/${subject.id}/remaining-hours/reset`);
      setSubjects((prev) => prev.map((s) => (s.id === subject.id ? data.subject : s)));
      cancelEditRemaining();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset Remaining Hours');
    }
  };

  const startEditEstimated = (subject) => {
    setError('');
    setEditingEstimatedId(subject.id);
    setEstimatedHoursInput(String(subject.estimatedHours ?? ''));
  };

  const cancelEditEstimated = () => {
    setEditingEstimatedId(null);
    setEstimatedHoursInput('');
  };

  const handleSaveEstimatedHours = async (subject) => {
    setError('');
    const value = Number(estimatedHoursInput);
    if (Number.isNaN(value) || value <= 0) {
      setError('Estimated Hours must be greater than zero.');
      return;
    }
    if (subject.completedHours && value < subject.completedHours) {
      setError(`Estimated Hours cannot be less than the ${subject.completedHours}h already completed.`);
      return;
    }
    try {
      const { data } = await api.put(`/subjects/${subject.id}`, { estimatedHours: value });
      setSubjects((prev) => prev.map((s) => (s.id === subject.id ? data.subject : s)));
      cancelEditEstimated();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update Estimated Hours');
    }
  };

  const handleAutoDeadlines = async () => {
    setError('');
    try {
      const { data } = await api.post('/subjects/auto-deadlines', {});
      setSubjects(data.subjects);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to auto-generate deadlines');
    }
  };

  const chapterFormFor = (subjectId) => chapterForms[subjectId] || emptyChapterForm;

  const handleAddSubtopic = async (subject) => {
    const chapter = chapterFormFor(subject.id);
    const name = (chapter.name || '').trim();
    if (!name) return;
    const { data } = await api.post(`/subjects/${subject.id}/subtopics`, {
      name,
      estimatedHours: Number(chapter.estimatedHours) || 2,
      importance: Number(chapter.importance) || 3,
      pyqWeightage: Number(chapter.pyqWeightage) || 0,
    });
    setSubjects((prev) => prev.map((s) => (s.id === subject.id ? data.subject : s)));
    setChapterForms((prev) => ({ ...prev, [subject.id]: emptyChapterForm }));
  };

  const handleSubtopicStatus = async (subject, subtopic, status) => {
    const { data } = await api.put(`/subjects/${subject.id}/subtopics/${subtopic._id}`, { status });
    setSubjects((prev) => prev.map((s) => (s.id === subject.id ? data.subject : s)));
  };

  const handleDeleteSubtopic = async (subject, subtopic) => {
    const { data } = await api.delete(`/subjects/${subject.id}/subtopics/${subtopic._id}`);
    setSubjects((prev) => prev.map((s) => (s.id === subject.id ? data.subject : s)));
  };

  const planFor = (subjectName) => revisionPlans.find((p) => p.subject === subjectName);

  const handleRevisionToggleDay = async (subject, day) => {
    const existing = planFor(subject.name);
    const daysOfWeek = existing ? [...existing.daysOfWeek] : [];
    const idx = daysOfWeek.indexOf(day);
    if (idx >= 0) daysOfWeek.splice(idx, 1);
    else daysOfWeek.push(day);

    if (existing) {
      const { data } = await api.put(`/revision/${existing._id}`, { daysOfWeek });
      setRevisionPlans((prev) => prev.map((p) => (p._id === existing._id ? data.plan : p)));
    } else if (daysOfWeek.length) {
      const { data } = await api.post('/revision', {
        subject: subject.name,
        daysOfWeek,
        startTime: '18:00',
        durationMinutes: 30,
      });
      setRevisionPlans((prev) => [...prev, data.plan]);
    }
  };

  const handleRevisionDuration = async (subject, durationMinutes) => {
    const existing = planFor(subject.name);
    if (!existing) return;
    const { data } = await api.put(`/revision/${existing._id}`, { durationMinutes: Number(durationMinutes) });
    setRevisionPlans((prev) => prev.map((p) => (p._id === existing._id ? data.plan : p)));
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subject Completion Timeline</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Track subtopics, completion deadlines, and weekly revision for every subject.
        {user?.examDate && ` Exam date: ${new Date(user.examDate).toLocaleDateString()}.`}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">Add a subject manually, or seed the full GATE CSE syllabus in one click.</p>
        <div className="flex gap-2">
          <button onClick={handleAutoDeadlines} className="btn-secondary shrink-0">
            🪄 Auto-generate deadlines
          </button>
          <button onClick={handleSeedGateCse} disabled={seeding} className="btn-secondary shrink-0">
            {seeding ? 'Seeding...' : '⚡ Seed GATE CSE subjects (13)'}
          </button>
        </div>
      </div>

      <form onSubmit={handleCreateSubject} className="card mt-3 space-y-3 p-5">
        {error && (
          <p className="rounded-lg bg-amber-50 dark:bg-amber-950 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            {error}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="input"
            placeholder="Subject name (e.g. Operating Systems)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
            Planning start date
            <input
              type="date"
              className="input"
              value={form.planningStartDate}
              onChange={(e) => setForm({ ...form, planningStartDate: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
            Complete this subject before <span className="text-red-500">*</span>
            <input
              type="date"
              className="input"
              value={form.completionDeadline}
              onChange={(e) => setForm({ ...form, completionDeadline: e.target.value })}
              required
            />
          </label>
          <input
            type="number"
            min="0"
            max="100"
            className="input"
            placeholder="Exam weightage %"
            value={form.weightage}
            onChange={(e) => setForm({ ...form, weightage: e.target.value })}
          />
          <input
            type="number"
            min="0"
            className="input"
            placeholder="Estimated total hours"
            value={form.estimatedHours}
            onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            Color
            <input
              type="color"
              className="h-9 w-14 rounded-lg border border-gray-200 dark:border-gray-700"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </label>
        </div>
        <button type="submit" className="btn-primary">
          + Add subject
        </button>
      </form>

      {loading && <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">Loading subjects...</p>}

      <div className="mt-6 space-y-4">
        {subjects.map((subject) => {
          const plan = planFor(subject.name);
          return (
            <div key={subject.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: subject.color }} />
                    {subject.name}
                    {subject.locked && <span title="Locked" className="text-xs">🔒</span>}
                    {subject.paused && <span title="Paused" className="text-xs">⏸️</span>}
                    {subject.deadlineMetrics?.status && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          STATUS_BADGES[subject.deadlineMetrics.status]?.className || ''
                        }`}
                      >
                        {STATUS_BADGES[subject.deadlineMetrics.status]?.label || subject.deadlineMetrics.status}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Priority {subject.priority} · Difficulty {subject.difficulty}
                    {subject.weightage ? ` · ${subject.weightage}% weightage` : ''}
                    {' · '}
                    {subject.completedChapters}/{subject.totalChapters} chapters
                  </p>
                </div>
                <button onClick={() => handleDeleteSubject(subject)} className="btn-danger">
                  Delete subject
                </button>
              </div>

              <div className="mt-4">
                <ProgressBar
                  label="Chapters completed"
                  percent={subject.completionPercent}
                  sublabel={`${subject.completedChapters}/${subject.totalChapters} chapters · ${subject.completedHours}/${subject.totalHours}h`}
                />
                <div className="mt-1.5 flex items-center gap-2">
                  {editingEstimatedId === subject.id ? (
                    <>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">Estimated (total) hours:</span>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        className="input !w-24 !py-1 !text-xs"
                        value={estimatedHoursInput}
                        onChange={(e) => setEstimatedHoursInput(e.target.value)}
                        autoFocus
                      />
                      <button onClick={() => handleSaveEstimatedHours(subject)} className="btn-secondary !py-1 !px-2 !text-[11px]">
                        Save
                      </button>
                      <button onClick={cancelEditEstimated} className="btn-secondary !py-1 !px-2 !text-[11px]">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startEditEstimated(subject)}
                      className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      ✏️ Edit total estimated hours
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Planning start date</label>
                  <input
                    type="date"
                    className="input max-w-xs"
                    value={subject.planningStartDate ? subject.planningStartDate.slice(0, 10) : ''}
                    onChange={(e) => handlePlanningWindowChange(subject, { planningStartDate: e.target.value })}
                    disabled={subject.locked}
                  />
                </div>
                <div>
                  <label className="label">Complete this subject before</label>
                  <input
                    type="date"
                    className="input max-w-xs"
                    value={subject.completionDeadline ? subject.completionDeadline.slice(0, 10) : ''}
                    onChange={(e) => handlePlanningWindowChange(subject, { completionDeadline: e.target.value })}
                    disabled={subject.locked}
                  />
                </div>
              </div>
              <div className="mt-2">
                {subject.deadlineAfterExam && (
                  <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                    ⚠️ This deadline is after your exam date — you won't finish in time at this rate.
                  </p>
                )}

                {subject.deadlineMetrics && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                        Remaining Hours
                        {subject.remainingHoursAutoCalculated === false && (
                          <span
                            className="rounded bg-indigo-100 dark:bg-indigo-950 px-1 text-indigo-600 dark:text-indigo-400"
                            title="This value was set manually and won't change until you reset it"
                          >
                            manual
                          </span>
                        )}
                      </p>
                      {editingRemainingId === subject.id ? (
                        <div className="mt-1 flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            max={subject.estimatedHours || undefined}
                            className="input !w-16 !py-0.5 !text-xs"
                            value={remainingHoursInput}
                            onChange={(e) => setRemainingHoursInput(e.target.value)}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRemainingHours(subject)}
                            className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-indigo-500"
                          >
                            ✓
                          </button>
                          <button
                            onClick={cancelEditRemaining}
                            className="rounded bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:text-gray-200"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {subject.deadlineMetrics.remainingHours}h
                          </p>
                          <button
                            onClick={() => startEditRemaining(subject)}
                            className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Edit
                          </button>
                          {subject.remainingHoursAutoCalculated === false && (
                            <button
                              onClick={() => handleResetRemainingHours(subject)}
                              className="text-[10px] text-gray-500 dark:text-gray-400 hover:underline"
                              title="Reset to auto-calculated (Estimated - Completed)"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">Remaining Days</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {subject.deadlineMetrics.remainingDays ?? '—'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">Available Slots</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {subject.deadlineMetrics.availableStudySlots ?? '—'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">Required Hrs/Day</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {subject.deadlineMetrics.requiredDailyHours ?? '∞'}
                      </p>
                    </div>
                  </div>
                )}

                {subject.deadlineMetrics?.warning && (
                  <div className="mt-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 px-3 py-2.5">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-400">{subject.deadlineMetrics.warning}</p>
                    {subject.deadlineMetrics.suggestions?.length > 0 && (
                      <ul className="mt-1 list-inside list-disc text-[11px] text-red-600 dark:text-red-400">
                        {subject.deadlineMetrics.suggestions.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {subject.deadlineMetrics?.aiSuggestion && !subject.deadlineMetrics?.warning && (
                  <p className="mt-2 text-xs italic text-indigo-600 dark:text-indigo-400">
                    💡 {subject.deadlineMetrics.aiSuggestion}
                  </p>
                )}

                {subject.expectedCompletionDate && subject.completionDeadline && (
                  <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                    Expected finish: {new Date(subject.expectedCompletionDate).toLocaleDateString()} · Deadline:{' '}
                    {new Date(subject.completionDeadline).toLocaleDateString()}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <button onClick={() => handleOverride(subject, 'extend', { days: 3 })} className="btn-secondary !py-1 !px-2.5 !text-xs">
                    +3 days
                  </button>
                  <button onClick={() => handleOverride(subject, 'shorten', { days: 3 })} className="btn-secondary !py-1 !px-2.5 !text-xs">
                    -3 days
                  </button>
                  <button
                    onClick={() => handleOverride(subject, subject.paused ? 'resume' : 'pause')}
                    className="btn-secondary !py-1 !px-2.5 !text-xs"
                  >
                    {subject.paused ? '▶ Resume' : '⏸ Pause'}
                  </button>
                  <button
                    onClick={() => handleOverride(subject, subject.locked ? 'unlock' : 'lock')}
                    className="btn-secondary !py-1 !px-2.5 !text-xs"
                  >
                    {subject.locked ? '🔓 Unlock' : '🔒 Lock'}
                  </button>
                  <label className="flex items-center gap-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-2.5 py-1 text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={subject.allowDeadlineExtension}
                      onChange={(e) => api.put(`/subjects/${subject.id}`, { allowDeadlineExtension: e.target.checked }).then(({ data }) => setSubjects((prev) => prev.map((s) => (s.id === subject.id ? data.subject : s))))}
                    />
                    Allow deadline extension
                  </label>
                </div>
              </div>

              <div className="mt-4">
                <p className="label !mb-2">Chapters</p>
                <div className="space-y-2">
                  {subject.subtopics.map((sub) => (
                    <div
                      key={sub._id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2"
                    >
                      <div>
                        <span className="text-sm text-gray-800 dark:text-gray-100">{sub.name}</span>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                          {sub.estimatedHours}h · Importance {sub.importance} · PYQ {sub.pyqWeightage}%
                          {sub.revisionCount > 0 ? ` · Revised ${sub.revisionCount}x` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={sub.status}
                          onChange={(e) => handleSubtopicStatus(subject, sub, e.target.value)}
                          className={`rounded-lg border-none px-2 py-1 text-xs font-medium ${STATUS_COLORS[sub.status]}`}
                        >
                          <option value="not_started">{STATUS_LABELS.not_started}</option>
                          <option value="in_progress">{STATUS_LABELS.in_progress}</option>
                          <option value="completed">{STATUS_LABELS.completed}</option>
                        </select>
                        <button
                          onClick={() => handleDeleteSubtopic(subject, sub)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  {subject.subtopics.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">No chapters added yet.</p>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <input
                    className="input sm:col-span-2"
                    placeholder="Chapter name..."
                    value={chapterFormFor(subject.id).name || ''}
                    onChange={(e) =>
                      setChapterForms((prev) => ({ ...prev, [subject.id]: { ...chapterFormFor(subject.id), name: e.target.value } }))
                    }
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubtopic(subject))}
                  />
                  <input
                    type="number"
                    min="0"
                    className="input"
                    placeholder="Hours"
                    value={chapterFormFor(subject.id).estimatedHours ?? 2}
                    onChange={(e) =>
                      setChapterForms((prev) => ({
                        ...prev,
                        [subject.id]: { ...chapterFormFor(subject.id), estimatedHours: e.target.value },
                      }))
                    }
                  />
                  <input
                    type="number"
                    min="1"
                    max="5"
                    className="input"
                    placeholder="Importance"
                    value={chapterFormFor(subject.id).importance ?? 3}
                    onChange={(e) =>
                      setChapterForms((prev) => ({
                        ...prev,
                        [subject.id]: { ...chapterFormFor(subject.id), importance: e.target.value },
                      }))
                    }
                  />
                  <button onClick={() => handleAddSubtopic(subject)} className="btn-secondary shrink-0">
                    Add
                  </button>
                </div>
              </div>

              <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-4">
                <p className="label !mb-2">Weekly revision days</p>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_LABELS.map((label, day) => {
                    const active = plan?.daysOfWeek.includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => handleRevisionToggleDay(subject, day)}
                        className={`h-9 w-9 rounded-lg text-xs font-semibold transition ${
                          active
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {plan && (
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Duration (min):</label>
                    <input
                      type="number"
                      min="5"
                      step="5"
                      className="input w-24 !py-1.5"
                      value={plan.durationMinutes}
                      onChange={(e) => handleRevisionDuration(subject, e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {!loading && subjects.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No subjects yet — add one above to start tracking its timeline.
          </p>
        )}
      </div>
    </div>
  );
}
