import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';

// Planner Lifecycle Management panel — drop this into any settings-like page
// (used on the Planner page). All three actions are destructive-ish, so each
// one confirms first and reports back exactly what happened.
export default function PlannerLifecycle() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text }
  const [showNewPlannerModal, setShowNewPlannerModal] = useState(false);
  const [taskAction, setTaskAction] = useState('archive_and_clear');
  const [keepSubjects, setKeepSubjects] = useState(true);
  const [archiveFirst, setArchiveFirst] = useState(true);

  const handleDeleteCompleted = async () => {
    if (!confirm('Delete ALL completed tasks? Upcoming, overdue, locked, and paused tasks are left untouched. This cannot be undone.')) return;
    setBusy('delete');
    setMessage(null);
    try {
      const { data } = await api.delete('/planner/completed-tasks');
      setMessage({ type: 'success', text: `Deleted ${data.deletedCount} completed task(s).` });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete completed tasks' });
    } finally {
      setBusy('');
    }
  };

  const handleArchive = async () => {
    const label = prompt('Name this archive (optional):', '');
    if (label === null) return; // cancelled
    setBusy('archive');
    setMessage(null);
    try {
      await api.post('/planner/archive', { label });
      setMessage({ type: 'success', text: 'Planner archived. View it anytime from Planner History.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to archive planner' });
    } finally {
      setBusy('');
    }
  };

  const handleStartNewPlanner = async () => {
    if (!confirm('Start a brand new planner with these options? This is not reversible except via your archived snapshot.')) return;
    setBusy('new');
    setMessage(null);
    try {
      const { data } = await api.post('/planner/new', { archiveFirst, taskAction, keepSubjects });
      setMessage({
        type: 'success',
        text: `New planner ready (old one ${archiveFirst ? 'archived' : 'not archived'}). Set your exam date & subjects, then generate a fresh schedule.`,
      });
      setShowNewPlannerModal(false);
      if (data.archivedPlanner) {
        // Give the user a quick path to see it.
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to start a new planner' });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="card mt-6 p-5">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">Planner Lifecycle</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Clean up finished work, snapshot your progress, or start completely fresh — without losing history.
      </p>

      {message && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            message.type === 'error'
              ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={handleDeleteCompleted} disabled={busy === 'delete'} className="btn-secondary">
          {busy === 'delete' ? 'Deleting…' : '🗑️ Delete Completed Tasks'}
        </button>
        <button onClick={handleArchive} disabled={busy === 'archive'} className="btn-secondary">
          {busy === 'archive' ? 'Archiving…' : '📦 Archive Planner'}
        </button>
        <button onClick={() => setShowNewPlannerModal(true)} className="btn-secondary">
          🆕 Start New Planner
        </button>
        <button onClick={() => navigate('/planner-history')} className="btn-secondary">
          🕘 Planner History
        </button>
      </div>

      {showNewPlannerModal && (
        <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Start a new planner</p>

          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={archiveFirst} onChange={(e) => setArchiveFirst(e.target.checked)} />
            Archive the current planner first (recommended)
          </label>

          <div>
            <p className="label !mb-1">Existing tasks</p>
            <select className="input max-w-xs" value={taskAction} onChange={(e) => setTaskAction(e.target.value)}>
              <option value="archive_and_clear">Clear all tasks (completed + upcoming)</option>
              <option value="keep">Keep all existing tasks</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={keepSubjects} onChange={(e) => setKeepSubjects(e.target.checked)} />
            Keep my existing subjects (uncheck to start with an empty subject list)
          </label>

          <div className="flex gap-2 pt-1">
            <button onClick={handleStartNewPlanner} disabled={busy === 'new'} className="btn-primary">
              {busy === 'new' ? 'Starting…' : 'Confirm & Start New Planner'}
            </button>
            <button onClick={() => setShowNewPlannerModal(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
