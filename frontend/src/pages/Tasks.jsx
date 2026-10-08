import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios.js';
import TaskItem from '../components/TaskItem.jsx';
import TaskFormModal from '../components/TaskFormModal.jsx';
import { getSessionMeta } from '../utils/sessionMeta.js';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filter, setFilter] = useState('all'); // all | pending | completed
  const [typeFilter, setTypeFilter] = useState('all');

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, subjectsRes] = await Promise.all([api.get('/tasks'), api.get('/subjects')]);
      setTasks(tasksRes.data.tasks);
      setSubjects(subjectsRes.data.subjects);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleToggle = async (task) => {
    setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, completed: !t.completed } : t)));
    await api.patch(`/tasks/${task._id}/complete`);
  };

  const handleDelete = async (task) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    setTasks((prev) => prev.filter((t) => t._id !== task._id));
    await api.delete(`/tasks/${task._id}`);
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
        const { data } = await api.put(`/tasks/${editingTask._id}`, form);
        setTasks((prev) => prev.map((t) => (t._id === editingTask._id ? data.task : t)));
      } else {
        const { data } = await api.post('/tasks', form);
        setTasks((prev) => [...prev, data.task, ...(data.notesSession ? [data.notesSession] : [])]);
      }
      setModalOpen(false);
      return { ok: true };
    } catch (err) {
      if (err.response?.status === 409) {
        return { ok: false, message: err.response.data.message, conflicts: err.response.data.conflicts };
      }
      return { ok: false, message: err.response?.data?.message || 'Something went wrong' };
    }
  };

  const filtered = tasks.filter((t) => {
    if (filter === 'pending' && t.completed) return false;
    if (filter === 'completed' && !t.completed) return false;
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    return true;
  });

  const typeOptions = ['all', 'study', 'notes', 'practice', 'revision', 'mock_exam', 'custom'];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Sessions & Tasks</h1>
        <button onClick={handleAdd} className="btn-primary">
          + Add session
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {['all', 'pending', 'completed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {typeOptions.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              typeFilter === t
                ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                : 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {t === 'all' ? 'All types' : `${getSessionMeta(t).icon} ${getSessionMeta(t).label}`}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading sessions...</p>}
        {!loading && filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No sessions here yet. Add one, or generate an AI plan from the Planner page.
          </p>
        )}
        {filtered.map((task) => (
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
    </div>
  );
}
