import { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api/axios.js';

const emptyForm = {
  testType: 'full',
  title: '',
  subject: '',
  chapter: '',
  date: new Date().toISOString().slice(0, 10),
  maxMarks: 100,
  marksObtained: '',
  accuracy: '',
  timeTakenMinutes: '',
  rank: '',
  correctAnswers: '',
  wrongAnswers: '',
  unattempted: '',
  weakAreas: '',
  notes: '',
};

const TEST_TYPE_LABELS = { full: 'Full Test', subject: 'Subject Test', chapter: 'Chapter Test' };

export default function TestResults() {
  const [results, setResults] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: resultsData }, { data: analysisData }, { data: subjectsData }] = await Promise.all([
        api.get('/test-results'),
        api.get('/test-results/analysis'),
        api.get('/subjects'),
      ]);
      setResults(resultsData.results);
      setAnalysis(analysisData);
      setSubjects(subjectsData.subjects);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedSubject = subjects.find((s) => s.name === form.subject);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim() || form.marksObtained === '' || !form.maxMarks) {
      setError('Title, max marks and marks obtained are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        testType: form.testType,
        title: form.title.trim(),
        subject: form.subject || undefined,
        chapter: form.chapter || undefined,
        date: form.date,
        maxMarks: Number(form.maxMarks),
        marksObtained: Number(form.marksObtained),
        accuracy: form.accuracy === '' ? undefined : Number(form.accuracy),
        timeTakenMinutes: form.timeTakenMinutes === '' ? undefined : Number(form.timeTakenMinutes),
        rank: form.rank === '' ? undefined : Number(form.rank),
        correctAnswers: form.correctAnswers === '' ? undefined : Number(form.correctAnswers),
        wrongAnswers: form.wrongAnswers === '' ? undefined : Number(form.wrongAnswers),
        unattempted: form.unattempted === '' ? undefined : Number(form.unattempted),
        weakAreas: form.weakAreas
          ? form.weakAreas.split(',').map((w) => w.trim()).filter(Boolean)
          : [],
        notes: form.notes,
      };
      if (editingId) {
        await api.put(`/test-results/${editingId}`, payload);
      } else {
        await api.post('/test-results', payload);
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save test result');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (result) => {
    setEditingId(result.id);
    setForm({
      testType: result.testType || 'full',
      title: result.title || '',
      subject: result.subject || '',
      chapter: result.chapter || '',
      date: result.date ? new Date(result.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      maxMarks: result.maxMarks ?? 100,
      marksObtained: result.marksObtained ?? '',
      accuracy: result.accuracy ?? '',
      timeTakenMinutes: result.timeTakenMinutes ?? '',
      rank: result.rank ?? '',
      correctAnswers: result.correctAnswers ?? '',
      wrongAnswers: result.wrongAnswers ?? '',
      unattempted: result.unattempted ?? '',
      weakAreas: (result.weakAreas || []).join(', '),
      notes: result.notes || '',
    });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this test result?')) return;
    setResults((prev) => prev.filter((r) => r.id !== id));
    if (editingId === id) handleCancelEdit();
    await api.delete(`/test-results/${id}`);
    load();
  };

  const chartData = analysis?.trend?.map((t) => ({
    date: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    Score: t.scorePercent,
    Accuracy: t.accuracy || 0,
  })) || [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mock Test Manager</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Log full, subject, and chapter tests to track your performance over time.
      </p>

      {analysis && analysis.totalTests > 0 && (
        <div className="card mt-6 p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Tests logged</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{analysis.totalTests}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg score</p>
              <p className="text-xl font-bold text-primary-600 dark:text-primary-400">{analysis.averageScorePercent}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg accuracy</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{analysis.averageAccuracy}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Trend</p>
              <p className="text-xl font-bold">
                {analysis.trendDirection === 'improving' && <span className="text-green-600">📈 Improving</span>}
                {analysis.trendDirection === 'declining' && <span className="text-red-500">📉 Declining</span>}
                {analysis.trendDirection === 'steady' && <span className="text-gray-500">➡️ Steady</span>}
              </p>
            </div>
          </div>

          {chartData.length > 1 && (
            <div className="mt-5 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-800" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Score" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Accuracy" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <p className="mt-4 rounded-lg bg-primary-50 dark:bg-primary-950/40 px-3 py-2 text-sm text-primary-700 dark:text-primary-300">
            💡 {analysis.suggestion}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card mt-6 space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">
            {editingId ? 'Edit test result' : 'Log a test result'}
          </h2>
          {editingId && (
            <button type="button" onClick={handleCancelEdit} className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              Cancel edit
            </button>
          )}
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <select className="input" value={form.testType} onChange={(e) => setForm({ ...form, testType: e.target.value })}>
            <option value="full">Full Test</option>
            <option value="subject">Subject Test</option>
            <option value="chapter">Chapter Test</option>
          </select>
          <input
            className="input sm:col-span-2"
            placeholder="Title (e.g. GATE CSE Full Mock #3)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />

          {form.testType !== 'full' && (
            <select className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value, chapter: '' })}>
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          )}
          {form.testType === 'chapter' && (
            <select className="input" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })}>
              <option value="">Select chapter</option>
              {(selectedSubject?.subtopics || []).map((c) => (
                <option key={c._id} value={c.name}>{c.name}</option>
              ))}
            </select>
          )}

          <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          <input type="number" min="0" className="input" placeholder="Max marks" value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: e.target.value })} required />
          <input type="number" min="0" className="input" placeholder="Marks obtained" value={form.marksObtained} onChange={(e) => setForm({ ...form, marksObtained: e.target.value })} required />
          <input type="number" min="0" max="100" className="input" placeholder="Accuracy % (optional)" value={form.accuracy} onChange={(e) => setForm({ ...form, accuracy: e.target.value })} />
          <input type="number" min="0" className="input" placeholder="Time taken (min)" value={form.timeTakenMinutes} onChange={(e) => setForm({ ...form, timeTakenMinutes: e.target.value })} />
          <input type="number" min="1" className="input" placeholder="Rank (optional)" value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} />
          <input type="number" min="0" className="input" placeholder="Correct answers" value={form.correctAnswers} onChange={(e) => setForm({ ...form, correctAnswers: e.target.value })} />
          <input type="number" min="0" className="input" placeholder="Wrong answers" value={form.wrongAnswers} onChange={(e) => setForm({ ...form, wrongAnswers: e.target.value })} />
          <input type="number" min="0" className="input" placeholder="Unattempted" value={form.unattempted} onChange={(e) => setForm({ ...form, unattempted: e.target.value })} />
          <input className="input sm:col-span-3" placeholder="Weak areas (comma separated, e.g. Graphs, DP)" value={form.weakAreas} onChange={(e) => setForm({ ...form, weakAreas: e.target.value })} />
          <textarea className="input sm:col-span-3" placeholder="Notes (optional)" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : editingId ? 'Save changes' : '+ Log test result'}
        </button>
      </form>

      <h2 className="mt-6 text-lg font-bold text-gray-900 dark:text-white">Past tests</h2>
      {loading && <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading...</p>}
      <div className="mt-3 space-y-3">
        {!loading && results.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No tests logged yet.
          </p>
        )}
        {results.map((r) => (
          <div key={r.id} className={`card flex flex-wrap items-center justify-between gap-3 p-4 ${editingId === r.id ? 'ring-2 ring-primary-500' : ''}`}>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {r.title} <span className="ml-2 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">{TEST_TYPE_LABELS[r.testType]}</span>
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {new Date(r.date).toLocaleDateString()}
                {r.subject ? ` · ${r.subject}` : ''}
                {r.chapter ? ` · ${r.chapter}` : ''}
                {r.rank ? ` · Rank ${r.rank}` : ''}
                {r.timeTakenMinutes ? ` · ${r.timeTakenMinutes} min` : ''}
              </p>
              {r.weakAreas?.length > 0 && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Weak: {r.weakAreas.join(', ')}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{r.scorePercent}%</p>
                <p className="text-xs text-gray-400">{r.marksObtained}/{r.maxMarks}{r.accuracy ? ` · ${r.accuracy}% acc.` : ''}</p>
              </div>
              <button onClick={() => handleEdit(r)} className="btn-secondary !px-3 !py-1.5 text-xs">Edit</button>
              <button onClick={() => handleDelete(r.id)} className="btn-danger">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
