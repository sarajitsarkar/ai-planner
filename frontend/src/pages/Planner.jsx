import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import PlannerLifecycle from '../components/PlannerLifecycle.jsx';

const emptySubject = { name: '', priority: 3, difficulty: 3 };

export default function Planner() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [examName, setExamName] = useState(user?.examName || 'My Exam');
  const [examDate, setExamDate] = useState(user?.examDate ? user.examDate.slice(0, 10) : '');
  const [examTime, setExamTime] = useState(user?.examTime || '09:00');
  const [examDurationMinutes, setExamDurationMinutes] = useState(user?.examDurationMinutes ?? 180);
  const [targetRank, setTargetRank] = useState(user?.targetRank ?? '');
  const [targetScore, setTargetScore] = useState(user?.targetScore ?? '');
  const [difficultyLevel, setDifficultyLevel] = useState(user?.difficultyLevel || 'medium');
  const [hoursPerDay, setHoursPerDay] = useState(user?.hoursPerDay || 2);
  const [weeklyOffDay, setWeeklyOffDay] = useState(user?.weeklyOffDay ?? '');
  const [bufferDays, setBufferDays] = useState(user?.bufferDays ?? 3);
  const [notesDurationMinutes, setNotesDurationMinutes] = useState(user?.notesDurationMinutes ?? 15);
  const [planningMode, setPlanningMode] = useState(user?.planningMode || 'subject_deadline');
  const [subjects, setSubjects] = useState(
    user?.subjects?.length ? user.subjects : [{ ...emptySubject }]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const updateSubject = (idx, field, value) => {
    setSubjects((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const addSubject = () => setSubjects((prev) => [...prev, { ...emptySubject }]);
  const removeSubject = (idx) => setSubjects((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    const cleanSubjects = subjects
      .filter((s) => s.name.trim())
      .map((s) => ({ name: s.name.trim(), priority: Number(s.priority), difficulty: Number(s.difficulty) }));

    if (!examDate) return setError('Please choose an exam date');
    if (cleanSubjects.length === 0 && planningMode === 'exam_deadline') {
      return setError('Add at least one subject (or switch to "Finish every subject before its own deadline" mode and manage subjects on the Subjects page)');
    }

    setLoading(true);
    try {
      const [{ data }] = await Promise.all([
        api.post('/plan/generate', {
          examDate,
          hoursPerDay: Number(hoursPerDay),
          subjects: cleanSubjects,
          planningMode,
        }),
        api.put('/auth/preferences', {
          examName,
          examTime,
          examDurationMinutes: Number(examDurationMinutes),
          targetRank: targetRank === '' ? undefined : Number(targetRank),
          targetScore: targetScore === '' ? undefined : Number(targetScore),
          difficultyLevel,
          weeklyOffDay: weeklyOffDay === '' ? null : Number(weeklyOffDay),
          bufferDays: Number(bufferDays),
          notesDurationMinutes: Number(notesDurationMinutes),
          planningMode,
        }),
      ]);
      setResult(data);
      updateUser({
        ...user,
        examName,
        examDate,
        examTime,
        examDurationMinutes: Number(examDurationMinutes),
        targetRank: targetRank === '' ? undefined : Number(targetRank),
        targetScore: targetScore === '' ? undefined : Number(targetScore),
        difficultyLevel,
        hoursPerDay: Number(hoursPerDay),
        weeklyOffDay: weeklyOffDay === '' ? null : Number(weeklyOffDay),
        bufferDays: Number(bufferDays),
        subjects: cleanSubjects,
        notesDurationMinutes: Number(notesDurationMinutes),
        planningMode,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Study Planner</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Tell us about your exam and subjects, and we'll build a daily schedule for you.
      </p>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-6 p-6">
        {error && (
          <p className="rounded-lg bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Exam name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. GATE CSE 2027"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Exam date</label>
            <input
              type="date"
              required
              className="input"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Exam time</label>
            <input
              type="time"
              required
              className="input"
              value={examTime}
              onChange={(e) => setExamTime(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Exam duration (minutes)</label>
            <input
              type="number"
              min="0"
              step="5"
              className="input"
              value={examDurationMinutes}
              onChange={(e) => setExamDurationMinutes(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Difficulty level</label>
            <select className="input" value={difficultyLevel} onChange={(e) => setDifficultyLevel(e.target.value)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="label">Target rank (optional)</label>
            <input
              type="number"
              min="1"
              className="input"
              placeholder="e.g. 500"
              value={targetRank}
              onChange={(e) => setTargetRank(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Target score (optional)</label>
            <input
              type="number"
              min="0"
              className="input"
              placeholder="e.g. 65"
              value={targetScore}
              onChange={(e) => setTargetScore(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Hours available per day</label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              required
              className="input"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Weekly off day</label>
            <select className="input" value={weeklyOffDay} onChange={(e) => setWeeklyOffDay(e.target.value)}>
              <option value="">None</option>
              <option value="0">Sunday</option>
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
              <option value="5">Friday</option>
              <option value="6">Saturday</option>
            </select>
          </div>
          <div>
            <label className="label">Buffer days before exam</label>
            <input
              type="number"
              min="0"
              className="input"
              value={bufferDays}
              onChange={(e) => setBufferDays(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Default notes session duration (min)</label>
            <input
              type="number"
              min="0"
              step="5"
              className="input"
              value={notesDurationMinutes}
              onChange={(e) => setNotesDurationMinutes(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Auto-added right after every study session (set to 0 to disable). Editable per day too.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <label className="label !mb-2">Planning Mode</label>
          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input
                type="radio"
                name="planningMode"
                className="mt-0.5"
                checked={planningMode === 'subject_deadline'}
                onChange={() => setPlanningMode('subject_deadline')}
              />
              <span>
                <span className="font-medium">Finish every subject before its own deadline</span>
                <span className="block text-xs text-gray-400 dark:text-gray-500">
                  Recommended. Uses each subject's Completion Deadline from the Subjects page — after a subject's deadline
                  passes, only revisions/mocks/PYQs are scheduled for it, never new learning.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input
                type="radio"
                name="planningMode"
                className="mt-0.5"
                checked={planningMode === 'exam_deadline'}
                onChange={() => setPlanningMode('exam_deadline')}
              />
              <span>
                <span className="font-medium">Finish everything before exam</span>
                <span className="block text-xs text-gray-400 dark:text-gray-500">
                  Legacy behavior — every subject is scheduled continuously all the way to the exam date.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label !mb-0">Subjects</label>
            <button type="button" onClick={addSubject} className="text-sm font-semibold text-primary-600 dark:text-primary-400">
              + Add subject
            </button>
          </div>
          {planningMode === 'subject_deadline' && (
            <p className="mb-2 text-xs text-gray-400 dark:text-gray-500">
              Optional here — for per-subject deadlines, chapters, and hour tracking, manage subjects on the{' '}
              <span className="font-medium">Subjects</span> page instead.
            </p>
          )}

          <div className="space-y-3">
            {subjects.map((s, idx) => (
              <div key={idx} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                <div className="flex items-center gap-2">
                  <input
                    className="input"
                    placeholder="Subject name"
                    value={s.name}
                    onChange={(e) => updateSubject(idx, 'name', e.target.value)}
                  />
                  {subjects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSubject(idx)}
                      className="btn-danger shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Priority: {s.priority}
                    </span>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={s.priority}
                      onChange={(e) => updateSubject(idx, 'priority', e.target.value)}
                      className="w-full accent-primary-600"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Difficulty: {s.difficulty}
                    </span>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={s.difficulty}
                      onChange={(e) => updateSubject(idx, 'difficulty', e.target.value)}
                      className="w-full accent-primary-600"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Generating your plan...' : 'Generate AI study plan'}
        </button>
      </form>

      {result && (
        <div className="card mt-6 p-6">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Plan generated {result.generatedBy === 'deadline-aware' ? 'using per-subject deadlines' : result.generatedBy === 'ai' ? 'by AI' : 'using the built-in scheduler'} 🎉
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {result.tasksCreated} study tasks were added to your calendar.
          </p>

          {result.deadlineWarnings?.length > 0 && (
            <div className="mt-4 space-y-2">
              {result.deadlineWarnings.map((w) => (
                <div
                  key={w.subject}
                  className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 px-3 py-2"
                >
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400">{w.warning}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => navigate('/')} className="btn-primary">
              Go to dashboard
            </button>
            <button onClick={() => navigate('/timeline')} className="btn-secondary">
              View timeline
            </button>
          </div>
        </div>
      )}

      <PlannerLifecycle />
    </div>
  );
}
