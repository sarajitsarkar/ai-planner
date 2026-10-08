import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import ProgressRing from '../components/ProgressRing.jsx';
import StatCard from '../components/StatCard.jsx';
import MotivationalQuote from '../components/MotivationalQuote.jsx';
import AISuggestionCard from '../components/AISuggestionCard.jsx';
import TaskItem from '../components/TaskItem.jsx';
import TaskFormModal from '../components/TaskFormModal.jsx';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Dashboard() {
  const { user } = useAuth();
  const clock = useClock();
  const [summary, setSummary] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: summaryData }, { data: subjectsData }] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/subjects'),
      ]);
      setSummary(summaryData);
      setSubjects(subjectsData.subjects);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (task) => {
    setSummary((prev) => ({
      ...prev,
      todaysSchedule: prev.todaysSchedule.map((t) => (t._id === task._id ? { ...t, completed: !t.completed } : t)),
    }));
    await api.patch(`/tasks/${task._id}/complete`);
    load();
  };

  const handleDelete = async (task) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    setSummary((prev) => ({ ...prev, todaysSchedule: prev.todaysSchedule.filter((t) => t._id !== task._id) }));
    await api.delete(`/tasks/${task._id}`);
    load();
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  const handleSubmit = async (form) => {
    try {
      if (editingTask) {
        await api.put(`/tasks/${editingTask._id}`, form);
      } else {
        await api.post('/tasks', { ...form, date: form.date || today });
      }
      setModalOpen(false);
      await load();
      return { ok: true };
    } catch (err) {
      if (err.response?.status === 409) {
        return { ok: false, message: err.response.data.message, conflicts: err.response.data.conflicts };
      }
      return { ok: false, message: err.response?.data?.message || 'Something went wrong' };
    }
  };

  const hasNoPlan = !user?.examDate;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Hi {user?.name?.split(' ')[0]}, here's your mission control 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {clock.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} ·{' '}
            {clock.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
        <Link to="/planner" className="btn-secondary shrink-0">
          Exam setup
        </Link>
      </div>

      {hasNoPlan && (
        <div className="card mt-5 flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            You haven't set up an exam plan yet. Add your exam date and subjects to get started.
          </p>
          <Link to="/planner" className="btn-primary shrink-0">
            Create plan
          </Link>
        </div>
      )}

      {loading && <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">Loading your dashboard...</p>}

      {summary && (
        <>
          {/* --- Top row: countdown + progress ring + streak --- */}
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="card flex flex-col justify-center p-5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {summary.exam?.examName || 'Exam'} countdown
              </p>
              {summary.exam ? (
                <>
                  <p className="mt-1.5 text-3xl font-bold text-primary-600 dark:text-primary-400">
                    {summary.exam.daysRemaining} day{summary.exam.daysRemaining === 1 ? '' : 's'}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    {summary.exam.weeksRemaining} weeks left · {new Date(summary.exam.examDate).toLocaleDateString()} at{' '}
                    {summary.exam.examTime}
                    {summary.exam.targetRank ? ` · Target rank: ${summary.exam.targetRank}` : ''}
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-sm text-gray-400">No exam date set yet.</p>
              )}
            </div>

            <div className="card flex items-center justify-center gap-4 p-5">
              <ProgressRing percent={summary.completionPercent} label="Syllabus complete" size={88} />
            </div>

            <div className="card flex flex-col justify-center p-5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Study streak</p>
              <p className="mt-1.5 text-3xl font-bold text-amber-500">🔥 {summary.streak.current} day{summary.streak.current === 1 ? '' : 's'}</p>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Longest streak: {summary.streak.longest} days</p>
            </div>
          </div>

          {/* --- Study hours + targets --- */}
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Today's study hours" value={`${summary.studyHours.today}h`} sublabel={`${summary.studyHours.todayScheduled}h scheduled`} icon="⏱️" />
            <StatCard label="This week" value={`${summary.studyHours.week}h`} icon="📅" />
            <StatCard label="This month" value={`${summary.studyHours.month}h`} icon="🗓️" />
            <StatCard
              label="Today's target"
              value={`${summary.todaysTargetHours}h`}
              sublabel={summary.requiredDailyStudyTime ? `Need ~${summary.requiredDailyStudyTime}h/day to finish` : undefined}
              icon="🎯"
            />
          </div>

          {/* --- Subject/chapter totals --- */}
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total subjects" value={summary.totals.totalSubjects} icon="📚" />
            <StatCard label="Total chapters" value={summary.totals.totalChapters} icon="📖" />
            <StatCard label="Completed chapters" value={summary.totals.completedChapters} icon="✅" accent="text-green-600 dark:text-green-400" />
            <StatCard label="Remaining chapters" value={summary.totals.remainingChapters} icon="⏳" accent="text-orange-500" />
          </div>

          {/* --- Subject Planning Deadline widgets --- */}
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Deadline progress"
              value={`${summary.deadlineWidgets.deadlineProgress}%`}
              icon="🎯"
            />
            <StatCard
              label="Overdue subjects"
              value={summary.deadlineWidgets.overdueSubjects.length}
              icon="🔴"
              accent={summary.deadlineWidgets.overdueSubjects.length ? 'text-red-600 dark:text-red-400' : undefined}
            />
            <StatCard
              label="Near deadline (≤3d)"
              value={summary.deadlineWidgets.subjectsNearDeadline.length}
              icon="🟡"
              accent={summary.deadlineWidgets.subjectsNearDeadline.length ? 'text-amber-500' : undefined}
            />
            <StatCard
              label="Avg days remaining"
              value={summary.deadlineWidgets.averageDaysRemaining ?? '—'}
              icon="📆"
            />
            <StatCard
              label="Total remaining hours"
              value={`${summary.deadlineWidgets.totalRemainingHours}h`}
              icon="⏱️"
            />
            <StatCard
              label="High risk subjects"
              value={summary.deadlineWidgets.highRiskSubjects.length}
              icon="🚨"
              accent={summary.deadlineWidgets.highRiskSubjects.length ? 'text-red-600 dark:text-red-400' : undefined}
            />
          </div>

          {(summary.deadlineWidgets.overdueSubjects.length > 0 ||
            summary.deadlineWidgets.subjectsNearDeadline.length > 0 ||
            summary.deadlineWidgets.highRiskSubjects.length > 0 ||
            summary.deadlineWidgets.nextSubjectDeadline ||
            summary.deadlineWidgets.todaysDeadlineTasks.length > 0) && (
            <div className="card mt-4 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Deadline watch</h2>
                <Link to="/timeline" className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                  View timeline
                </Link>
              </div>

              {summary.deadlineWidgets.nextSubjectDeadline && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Next deadline: <span className="font-semibold text-gray-700 dark:text-gray-200">{summary.deadlineWidgets.nextSubjectDeadline.name}</span>{' '}
                  on {new Date(summary.deadlineWidgets.nextSubjectDeadline.deadline).toLocaleDateString()} (
                  {summary.deadlineWidgets.nextSubjectDeadline.remainingDays} days left)
                </p>
              )}

              {summary.deadlineWidgets.overdueSubjects.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400">🔴 Overdue</p>
                  <div className="mt-1.5 space-y-1.5">
                    {summary.deadlineWidgets.overdueSubjects.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-200">{s.name}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {s.remainingHours}h left · was due {new Date(s.deadline).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.deadlineWidgets.subjectsNearDeadline.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">🟡 Near deadline</p>
                  <div className="mt-1.5 space-y-1.5">
                    {summary.deadlineWidgets.subjectsNearDeadline.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-200">{s.name}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          Due {new Date(s.deadline).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.deadlineWidgets.highRiskSubjects.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400">🚨 High risk</p>
                  <div className="mt-1.5 space-y-1.5">
                    {summary.deadlineWidgets.highRiskSubjects.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-200">{s.name}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          Risk {s.deadlineRiskScore} · needs {s.requiredDailyHours ?? '∞'}h/day
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.deadlineWidgets.todaysDeadlineTasks.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Today's deadline tasks</p>
                  <div className="mt-1.5 space-y-1.5">
                    {summary.deadlineWidgets.todaysDeadlineTasks.map((t) => (
                      <div key={t._id} className="text-sm text-gray-700 dark:text-gray-200">
                        {t.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- Quote + AI suggestion --- */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <MotivationalQuote quote={summary.quote} loading={false} />
            <AISuggestionCard suggestion={summary.aiSuggestion} loading={false} />
          </div>

          {/* --- Pending subjects + upcoming revisions --- */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Pending subjects</h2>
                <Link to="/subjects" className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                  View all
                </Link>
              </div>
              <div className="mt-3 space-y-2.5">
                {summary.pendingSubjects.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">All subjects complete — great work!</p>
                )}
                {summary.pendingSubjects.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{s.completionPercent}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Upcoming revisions</h2>
                <Link to="/subjects" className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                  Manage
                </Link>
              </div>
              <div className="mt-3 space-y-2.5">
                {summary.upcomingRevisions.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    No revisions scheduled yet — complete a chapter to auto-generate its revision trail.
                  </p>
                )}
                {summary.upcomingRevisions.map((r) => (
                  <div key={r._id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-gray-700 dark:text-gray-200">{r.title}</span>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      {r.revisionStage ? ` · ${r.revisionStage}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* --- Today's schedule --- */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Today's schedule</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/schedule" className="btn-secondary !px-3 !py-1.5 text-sm">
                Full-day scheduler
              </Link>
              <button onClick={handleAdd} className="btn-primary !px-3 !py-1.5 text-sm">
                + Add session
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {summary.todaysSchedule.length === 0 && (
              <p className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Nothing scheduled for today yet.
              </p>
            )}
            {summary.todaysSchedule.map((task) => (
              <TaskItem key={task._id} task={task} onToggle={handleToggle} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>

          <TaskFormModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSubmit={handleSubmit}
            initialTask={editingTask}
            subjects={subjects}
          />
        </>
      )}
    </div>
  );
}
