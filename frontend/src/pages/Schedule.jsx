import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../api/axios.js';
import TaskItem from '../components/TaskItem.jsx';
import TaskFormModal from '../components/TaskFormModal.jsx';
import { getSessionMeta } from '../utils/sessionMeta.js';

const toDateInputValue = (d) => d.toISOString().slice(0, 10);

export default function Schedule() {
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [prefillType, setPrefillType] = useState('study');
  const dragIndex = useRef(null);
  const [draggingId, setDraggingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dayRes, subjectsRes] = await Promise.all([
        api.get('/tasks/day-summary', { params: { date } }),
        api.get('/subjects'),
      ]);
      setSessions(dayRes.data.sessions);
      setSummary(dayRes.data.summary);
      setSubjects(subjectsRes.data.subjects);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshSummary = async () => {
    const { data } = await api.get('/tasks/day-summary', { params: { date } });
    setSessions(data.sessions);
    setSummary(data.summary);
  };

  const handleToggle = async (task) => {
    setSessions((prev) => prev.map((t) => (t._id === task._id ? { ...t, completed: !t.completed } : t)));
    await api.patch(`/tasks/${task._id}/complete`);
    refreshSummary();
  };

  const handleDelete = async (task) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    setSessions((prev) => prev.filter((t) => t._id !== task._id));
    await api.delete(`/tasks/${task._id}`);
    refreshSummary();
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleQuickAdd = (type) => {
    setEditingTask(null);
    setPrefillType(type);
    setModalOpen(true);
  };

  const handleSubmit = async (form) => {
    try {
      if (editingTask) {
        const { data } = await api.put(`/tasks/${editingTask._id}`, form);
        setSessions((prev) => prev.map((t) => (t._id === editingTask._id ? data.task : t)));
      } else {
        await api.post('/tasks', { ...form, date: form.date || date });
      }
      setModalOpen(false);
      await refreshSummary();
      return { ok: true };
    } catch (err) {
      if (err.response?.status === 409) {
        return { ok: false, message: err.response.data.message, conflicts: err.response.data.conflicts };
      }
      return { ok: false, message: err.response?.data?.message || 'Something went wrong' };
    }
  };

  // --- Native HTML5 drag-and-drop reordering ---
  const handleDragStart = (index) => (e) => {
    dragIndex.current = index;
    setDraggingId(sessions[index]._id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index) => (e) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) return;
    setSessions((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex.current, 1);
      next.splice(index, 0, moved);
      dragIndex.current = index;
      return next;
    });
  };

  const handleDrop = async () => {
    const order = sessions.map((s, i) => ({ id: s._id, order: i }));
    await api.patch('/tasks/reorder', { order });
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
    setDraggingId(null);
  };

  const shiftDate = (deltaDays) => {
    const d = new Date(date);
    d.setDate(d.getDate() + deltaDays);
    setDate(toDateInputValue(d));
  };

  const quickAddTypes = ['study', 'notes', 'practice', 'revision', 'custom'];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daily Schedule</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        A fully editable, drag-and-drop daily planner — study, notes, practice, revision, mock exams and custom
        tasks all in one place.
      </p>

      <div className="card mt-5 flex flex-wrap items-center justify-center gap-3 p-4">
        <button onClick={() => shiftDate(-1)} className="btn-secondary !px-3 shrink-0">
          ← Prev
        </button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-auto min-w-0 flex-1 max-w-[180px] text-center" />
        <button onClick={() => shiftDate(1)} className="btn-secondary !px-3 shrink-0">
          Next →
        </button>
      </div>

      {summary && (
        <div className="card mt-4 flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
          <span className="text-gray-600 dark:text-gray-300">
            {Math.round(summary.totalMinutes / 60)}h {summary.totalMinutes % 60}m scheduled
          </span>
          <span
            className={`font-semibold ${
              summary.overCapacity ? 'text-red-600 dark:text-red-400' : 'text-primary-600 dark:text-primary-400'
            }`}
          >
            {summary.overCapacity
              ? `⚠️ Over 24 hours by ${summary.totalMinutes - 1440} min`
              : `${Math.round(summary.freeMinutes / 60)}h ${summary.freeMinutes % 60}m free`}
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {quickAddTypes.map((t) => {
          const meta = getSessionMeta(t);
          return (
            <button key={t} onClick={() => handleQuickAdd(t)} className="btn-secondary !px-3 !py-1.5 text-sm">
              + {meta.icon} {meta.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-2">
        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading schedule...</p>}
        {!loading && sessions.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Nothing scheduled for this day yet — add a session above.
          </p>
        )}
        {sessions.map((task, index) => (
          <div key={task._id} onDrop={handleDrop}>
            <TaskItem
              task={task}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              draggable
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDragEnd={handleDragEnd}
              isDragging={draggingId === task._id}
            />
          </div>
        ))}
      </div>

      <TaskFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        initialTask={editingTask}
        prefill={{ type: prefillType, date }}
        subjects={subjects}
      />
    </div>
  );
}
