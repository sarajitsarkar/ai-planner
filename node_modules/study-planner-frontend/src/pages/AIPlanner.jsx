import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';

const EXAMPLE_PROMPTS = [
  {
    label: 'GATE CSE 2027',
    text: `I am preparing for GATE CSE 2027.
My exam is on February 2027.
I can study 8 hours daily.
Sunday is my revision day.
I want to finish Programming by August.
Data Structures by September.
Algorithms by October.
I want 2 mock tests every month.
After every chapter I want practice questions.
I want weekly revision.
Keep one buffer day every month.
My weakest subject is Digital Logic.
Prioritize Mathematics.
I wake up at 6 AM.
I sleep at 11 PM.`,
  },
  {
    label: 'Quick 3-subject plan',
    text: `Preparing for GATE CSE 2027, exam is on 8 February 2027. I can study 5 hours daily. I want to finish Operating Systems by September, Computer Networks by October, and Database Management Systems by November. My weakest subject is Computer Networks. I want weekly revision on Saturday and 1 mock test every month.`,
  },
  {
    label: 'Custom exam',
    text: `Preparing for my Bank PO exam in November 2026. I can study 3 hours daily. Finish Quantitative Aptitude by August. Reasoning by September. English by September. Prioritize Quantitative Aptitude. I want weekly revision and 2 mock tests every month.`,
  },
];

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}

export default function AIPlanner() {
  const { updateUser } = useAuth();
  const navigate = useNavigate();

  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef(null);

  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null); // { userFields, subjects, mockPlan, revisionPlan, warnings, ... }
  const [saveResult, setSaveResult] = useState(null);

  const [chatMessage, setChatMessage] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) finalTranscript += `${event.results[i][0].transcript} `;
      }
      if (finalTranscript) {
        setText((prev) => `${prev}${prev && !prev.endsWith('\n') ? ' ' : ''}${finalTranscript.trim()}. `);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setError('');
      recognitionRef.current.start();
      setListening(true);
    }
  };

  const runGenerate = async (overrideText) => {
    const promptText = (overrideText ?? text).trim();
    if (!promptText) {
      setError('Please describe your study plan first (type or use the microphone).');
      return;
    }
    setError('');
    setSaveResult(null);
    setGenerating(true);
    try {
      const { data } = await api.post('/ai-planner/generate', { text: promptText });
      setPreview(data.preview);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not generate a plan from that text.');
      setPreview(null);
    } finally {
      setGenerating(false);
    }
  };

  const updatePreviewField = (field, value) => {
    setPreview((prev) => ({ ...prev, userFields: { ...prev.userFields, [field]: value } }));
  };

  const updateSubjectField = (idx, field, value) => {
    setPreview((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  };

  const removeSubject = (idx) => {
    setPreview((prev) => ({ ...prev, subjects: prev.subjects.filter((_, i) => i !== idx) }));
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setConfirming(true);
    setError('');
    try {
      const payload = {
        userFields: preview.userFields,
        subjects: preview.subjects,
        mockPlan: preview.mockPlan,
        revisionPlan: preview.revisionPlan,
      };
      const { data } = await api.post('/ai-planner/confirm', payload);
      setSaveResult(data);
      if (data.user) updateUser(data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save this plan.');
    } finally {
      setConfirming(false);
    }
  };

  const sendChat = async () => {
    const message = chatMessage.trim();
    if (!message) return;
    setChatLog((prev) => [...prev, { role: 'user', text: message }]);
    setChatMessage('');
    setChatLoading(true);
    try {
      const { data } = await api.post('/ai-planner/chat', { message });
      setChatLog((prev) => [...prev, { role: 'ai', text: data.reply }]);
    } catch (err) {
      setChatLog((prev) => [...prev, { role: 'ai', text: err.response?.data?.message || 'Something went wrong.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span>✨</span> AI Planner
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Type or speak your study plan in plain language — the AI reads it and automatically builds your
          Subjects, Schedule, Timeline, Revision, and Mock Tests. Nothing is saved until you review and confirm.
        </p>
      </div>

      {/* Entry screen */}
      <div className="card p-5 space-y-4">
        <div>
          <label className="label" htmlFor="ai-planner-text">Describe your study plan</label>
          <textarea
            id="ai-planner-text"
            className="input min-h-[160px] resize-y"
            placeholder={'e.g. "I am preparing for GATE CSE 2027. My exam is on February 2027. I can study 8 hours daily. I want to finish Data Structures by September..."'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleListening}
            disabled={!speechSupported}
            className={listening ? 'btn-primary !bg-red-600 hover:!bg-red-700' : 'btn-secondary'}
            title={speechSupported ? 'Tap to speak your plan' : 'Voice input is not supported in this browser'}
          >
            {listening ? '⏹ Stop listening' : '🎤 Speak your plan'}
          </button>
          <button type="button" onClick={() => runGenerate()} disabled={generating} className="btn-primary">
            {generating ? 'Thinking…' : '🪄 Generate Plan'}
          </button>
          {preview && (
            <button type="button" onClick={() => runGenerate()} disabled={generating} className="btn-secondary">
              🔁 Regenerate
            </button>
          )}
          {text && (
            <button type="button" onClick={() => setText('')} className="btn-secondary">
              Clear
            </button>
          )}
        </div>
        {!speechSupported && (
          <p className="text-xs text-gray-400">
            Voice input isn't supported in this browser — try Chrome/Edge, or just type your plan above.
          </p>
        )}

        <div>
          <p className="label mb-2">Or try an example</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex.label}
                type="button"
                className="rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                onClick={() => setText(ex.text)}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      {generating && (
        <div className="card p-8 flex flex-col items-center gap-3 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Reading your plan and mapping it to subjects, deadlines, and a daily schedule…</p>
        </div>
      )}

      {/* Preview / Edit mode */}
      {preview && !generating && (
        <div className="card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Preview — review before saving</h2>
            <span className="text-xs rounded-full bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 px-2.5 py-1 font-medium">
              Nothing saved yet
            </span>
          </div>

          {preview.warnings?.length > 0 && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3.5 py-3 space-y-1">
              {preview.warnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-700 dark:text-amber-300">⚠ {w}</p>
              ))}
            </div>
          )}

          {/* Global fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Exam name</label>
              <input
                className="input"
                value={preview.userFields.examName || ''}
                onChange={(e) => updatePreviewField('examName', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Exam date</label>
              <input
                type="date"
                className="input"
                value={fmtDate(preview.userFields.examDate)}
                onChange={(e) => updatePreviewField('examDate', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Hours per day</label>
              <input
                type="number"
                min="0.5"
                max="16"
                step="0.5"
                className="input"
                value={preview.userFields.hoursPerDay || ''}
                onChange={(e) => updatePreviewField('hoursPerDay', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Weekly off day</label>
              <select
                className="input"
                value={preview.userFields.weeklyOffDay ?? ''}
                onChange={(e) => updatePreviewField('weeklyOffDay', e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">None</option>
                {DAY_LABELS.map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Subjects table */}
          <div>
            <p className="label mb-2">Subjects the AI detected</p>
            <div className="space-y-2">
              {preview.subjects.map((s, idx) => (
                <div key={`${s.name}-${idx}`} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 grid grid-cols-1 sm:grid-cols-6 gap-2 items-center">
                  <div className="sm:col-span-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.name}</p>
                    <p className="text-xs text-gray-400">
                      {s.isNewSubject ? '🆕 will be created' : '♻️ will update existing'}
                      {s.matchedPreset ? ' · GATE preset chapters' : ` · ${s.subtopics?.length || 1} chapter(s)`}
                      {s.weak && ' · weak subject'}
                      {s.prioritized && ' · prioritized'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Priority</label>
                    <input
                      type="number" min="1" max="5" className="input !py-1.5"
                      value={s.priority}
                      onChange={(e) => updateSubjectField(idx, 'priority', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Difficulty</label>
                    <input
                      type="number" min="1" max="5" className="input !py-1.5"
                      value={s.difficulty}
                      onChange={(e) => updateSubjectField(idx, 'difficulty', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Deadline</label>
                    <input
                      type="date" className="input !py-1.5"
                      value={fmtDate(s.completionDeadline)}
                      onChange={(e) => updateSubjectField(idx, 'completionDeadline', e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => removeSubject(idx)} className="btn-danger">Remove</button>
                  </div>
                </div>
              ))}
              {preview.subjects.length === 0 && (
                <p className="text-sm text-gray-400">No subjects left — add at least one before saving.</p>
              )}
            </div>
          </div>

          {/* Mock / revision summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
              <p className="font-medium text-gray-700 dark:text-gray-200">🧪 Mock tests</p>
              {preview.mockPlan ? (
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  ~{preview.mockPlan.perMonth}/month requested —{' '}
                  {preview.mockPlan.approach === 'weekly_recurring'
                    ? `a weekly "Full Syllabus" mock will be scheduled on ${DAY_LABELS[preview.mockPlan.dayOfWeek]}s.`
                    : 'lower-frequency mocks are placed automatically in the pre-exam mock phase.'}
                </p>
              ) : (
                <p className="text-gray-400 mt-1">Not mentioned — the pre-exam mock phase still applies automatically.</p>
              )}
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
              <p className="font-medium text-gray-700 dark:text-gray-200">🔁 Weekly revision</p>
              {preview.revisionPlan ? (
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Every {DAY_LABELS[preview.revisionPlan.dayOfWeek]} at {preview.revisionPlan.startTime}, per subject.
                </p>
              ) : (
                <p className="text-gray-400 mt-1">Not requested — deadline-based revision top-ups still apply.</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" onClick={handleConfirm} disabled={confirming || preview.subjects.length === 0} className="btn-primary">
              {confirming ? 'Saving…' : '✅ Save Plan'}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="btn-secondary">
              ✏️ Edit prompt instead
            </button>
          </div>
        </div>
      )}

      {/* Confirmation / result */}
      {saveResult && (
        <div className="card p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">🎉 Plan saved and synced</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{saveResult.message}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <StatChip label="Subjects created" value={saveResult.subjectsCreated} />
            <StatChip label="Subjects updated" value={saveResult.subjectsUpdated} />
            <StatChip label="Tasks scheduled" value={saveResult.rebalance?.tasksCreated ?? 0} />
            <StatChip label="Revision plans" value={saveResult.revisionPlansCreated} />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button className="btn-primary" onClick={() => navigate('/')}>Go to Dashboard</button>
            <button className="btn-secondary" onClick={() => navigate('/timeline')}>View Timeline</button>
            <button className="btn-secondary" onClick={() => navigate('/subjects')}>View Subjects</button>
          </div>

          {/* AI Chat Assistant */}
          <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-800">
            <p className="label">💬 Ask your AI study mentor</p>
            <div className="space-y-2 max-h-56 overflow-y-auto mb-2">
              {chatLog.map((m, i) => (
                <div key={i} className={`text-sm rounded-xl px-3 py-2 max-w-[85%] ${m.role === 'user' ? 'bg-primary-600 text-white ml-auto' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>
                  {m.text}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder={`e.g. "I'm tired today" or "reduce today's workload"`}
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              />
              <button className="btn-secondary" onClick={sendChat} disabled={chatLoading}>
                {chatLoading ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
      <p className="text-xl font-bold text-primary-600 dark:text-primary-400">{value ?? 0}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
