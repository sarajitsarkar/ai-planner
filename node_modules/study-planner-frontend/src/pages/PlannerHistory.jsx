import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios.js';

export default function PlannerHistory() {
  const [archives, setArchives] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [renamingId, setRenamingId] = useState(null);
  const [renameInput, setRenameInput] = useState('');
  const [busyId, setBusyId] = useState(null); // id currently mid-action, disables its buttons

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/planner/archive');
      setArchives(data.archives);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load planner history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const clearMessages = () => {
    setError('');
    setInfo('');
  };

  const openArchive = async (id) => {
    clearMessages();
    try {
      const { data } = await api.get(`/planner/archive/${id}`);
      setSelected(data.archive);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load archive details');
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startRename = (a) => {
    clearMessages();
    setRenamingId(a._id);
    setRenameInput(a.label || '');
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameInput('');
  };

  const handleRename = async (a) => {
    clearMessages();
    const label = renameInput.trim();
    if (!label) {
      setError('Name cannot be empty.');
      return;
    }
    setBusyId(a._id);
    try {
      const { data } = await api.patch(`/planner/archive/${a._id}/rename`, { label });
      setArchives((prev) => prev.map((x) => (x._id === a._id ? data.archivedPlanner : x)));
      cancelRename();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to rename');
    } finally {
      setBusyId(null);
    }
  };

  const handleDuplicate = async (a) => {
    clearMessages();
    setBusyId(a._id);
    try {
      const { data } = await api.post(`/planner/archive/${a._id}/duplicate`);
      setArchives((prev) => [data.archivedPlanner, ...prev]);
      setInfo(`Duplicated "${a.label}".`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to duplicate');
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = async (a) => {
    clearMessages();
    setBusyId(a._id);
    try {
      const { data } = await api.get(`/planner/archive/${a._id}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(a.label || 'study-plan').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to export');
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (a) => {
    if (
      !confirm(
        `Restore "${a.label}" as your live planner? Your current subjects/tasks will first be archived automatically, then replaced with this snapshot.`
      )
    )
      return;
    clearMessages();
    setBusyId(a._id);
    try {
      const { data } = await api.post(`/planner/archive/${a._id}/restore`, { archiveCurrentFirst: true });
      setInfo(data.message || 'Planner restored.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to restore planner');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteOne = async (a) => {
    if (!confirm(`Permanently delete "${a.label || 'this archived planner'}"? This cannot be undone.`)) return;
    clearMessages();
    setBusyId(a._id);
    try {
      await api.delete(`/planner/archive/${a._id}`);
      setArchives((prev) => prev.filter((x) => x._id !== a._id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(a._id);
        return next;
      });
      if (selected?._id === a._id) setSelected(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.size} selected archived planner(s)? This cannot be undone.`)) return;
    clearMessages();
    try {
      await api.delete('/planner/archive', { data: { ids: Array.from(selectedIds) } });
      setArchives((prev) => prev.filter((x) => !selectedIds.has(x._id)));
      setSelectedIds(new Set());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete selected archives');
    }
  };

  const handleDeleteAll = async () => {
    if (archives.length === 0) return;
    if (!confirm('Permanently delete ALL archived planners? This cannot be undone.')) return;
    clearMessages();
    try {
      await api.delete('/planner/archive/all');
      setArchives([]);
      setSelectedIds(new Set());
      setSelected(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete all archives');
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Planner History</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Snapshots of past planners — subjects, progress, and completed-task history, preserved exactly as they were.
      </p>

      {error && <p className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/50 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
      {info && <p className="mt-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">{info}</p>}
      {loading && <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">Loading...</p>}

      {!loading && archives.length === 0 && (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          No archived planners yet. Use "Archive Planner" on the Planner page to save a snapshot.
        </p>
      )}

      {!loading && archives.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">{selectedIds.size} selected</p>
          <div className="flex gap-2">
            <button onClick={handleDeleteSelected} disabled={selectedIds.size === 0} className="btn-secondary !text-xs disabled:opacity-40">
              Delete selected
            </button>
            <button onClick={handleDeleteAll} className="btn-danger !text-xs">
              Delete all history
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-3">
        {archives.map((a) => (
          <div key={a._id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1.5"
                  checked={selectedIds.has(a._id)}
                  onChange={() => toggleSelected(a._id)}
                />
                <div>
                  {renamingId === a._id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        className="input !py-1 !text-sm"
                        value={renameInput}
                        onChange={(e) => setRenameInput(e.target.value)}
                        autoFocus
                      />
                      <button onClick={() => handleRename(a)} className="btn-secondary !py-1 !px-2 !text-[11px]">
                        Save
                      </button>
                      <button onClick={cancelRename} className="btn-secondary !py-1 !px-2 !text-[11px]">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className="font-semibold text-gray-900 dark:text-white">{a.label || 'Archived planner'}</p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Archived {new Date(a.archivedAt).toLocaleString()} · {a.stats?.totalSubjects ?? 0} subjects ·{' '}
                    {a.stats?.completedTasks ?? 0} completed tasks · {a.stats?.averageCompletionPercent ?? 0}% avg. complete
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button onClick={() => openArchive(a._id)} disabled={busyId === a._id} className="btn-secondary !py-1 !px-2.5 !text-xs">
                View
              </button>
              <button onClick={() => handleRestore(a)} disabled={busyId === a._id} className="btn-secondary !py-1 !px-2.5 !text-xs">
                Restore
              </button>
              <button onClick={() => handleDuplicate(a)} disabled={busyId === a._id} className="btn-secondary !py-1 !px-2.5 !text-xs">
                Duplicate
              </button>
              {renamingId !== a._id && (
                <button onClick={() => startRename(a)} disabled={busyId === a._id} className="btn-secondary !py-1 !px-2.5 !text-xs">
                  Rename
                </button>
              )}
              <button onClick={() => handleExport(a)} disabled={busyId === a._id} className="btn-secondary !py-1 !px-2.5 !text-xs">
                Export
              </button>
              <button onClick={() => handleDeleteOne(a)} disabled={busyId === a._id} className="btn-danger !py-1 !px-2.5 !text-xs">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="mt-6 card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selected.label}</h2>
            <button onClick={() => setSelected(null)} className="btn-secondary !py-1 !px-2.5 !text-xs">
              Close
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Exam: {selected.examName} · {selected.examDate ? new Date(selected.examDate).toLocaleDateString() : '—'} ·{' '}
            {selected.hoursPerDay}h/day
          </p>

          <div className="mt-4">
            <p className="label !mb-2">Subjects at time of archiving</p>
            <div className="space-y-2">
              {selected.subjectsSnapshot.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-sm">
                  <span className="text-gray-800 dark:text-gray-100">{s.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{s.completionPercent}% complete</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="label !mb-2">Completed tasks ({selected.tasksSnapshot.length})</p>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {selected.tasksSnapshot.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-1.5 text-xs">
                  <span className="text-gray-700 dark:text-gray-200">{t.title}</span>
                  <span className="text-gray-400 dark:text-gray-500">{new Date(t.date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
