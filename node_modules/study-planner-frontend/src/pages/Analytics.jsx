import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import api from '../api/axios.js';
import StatCard from '../components/StatCard.jsx';

const REVISION_COLORS = { completed: '#10b981', upcoming: '#6366f1', missed: '#ef4444' };

function Heatmap({ data }) {
  // data: [{date, minutes}] for the last ~90 days, oldest first.
  const max = Math.max(1, ...data.map((d) => d.minutes));
  const colorFor = (minutes) => {
    if (minutes === 0) return 'bg-gray-100 dark:bg-gray-800';
    const ratio = minutes / max;
    if (ratio > 0.75) return 'bg-primary-600';
    if (ratio > 0.5) return 'bg-primary-500';
    if (ratio > 0.25) return 'bg-primary-400';
    return 'bg-primary-200 dark:bg-primary-900';
  };

  // Group into weeks (columns of 7)
  const weeks = [];
  for (let i = 0; i < data.length; i += 7) weeks.push(data.slice(i, i + 7));

  return (
    <div className="flex gap-1 overflow-x-auto pb-2">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((d) => (
            <div key={d.date} title={`${d.date}: ${Math.round((d.minutes / 60) * 10) / 10}h`} className={`h-3 w-3 rounded-sm ${colorFor(d.minutes)}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: overview } = await api.get('/analytics/overview');
      setData(overview);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading analytics...</p>
      </div>
    );
  }

  const revisionPieData = [
    { name: 'Completed', value: data.revisionStatus.completed, key: 'completed' },
    { name: 'Upcoming', value: data.revisionStatus.upcoming, key: 'upcoming' },
    { name: 'Missed', value: data.revisionStatus.missed, key: 'missed' },
  ].filter((d) => d.value > 0);

  const testChartData = data.testPerformance.map((t) => ({
    date: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    Score: t.scorePercent,
    Accuracy: t.accuracy,
  }));

  // Merge actual (last 30 days) + ideal (today -> furthest deadline) burndown
  // series into one date-keyed array recharts can plot as two lines.
  const burndownByDate = {};
  (data.burndown?.actual || []).forEach((p) => {
    burndownByDate[p.date] = { date: p.date, Actual: p.remainingHours };
  });
  (data.burndown?.ideal || []).forEach((p) => {
    burndownByDate[p.date] = { ...(burndownByDate[p.date] || { date: p.date }), Ideal: p.remainingHours };
  });
  const burndownChartData = Object.values(burndownByDate)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((p) => ({ ...p, date: new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">A full picture of your study time, progress, and performance.</p>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Chapters done" value={`${data.chapterProgress.completed}/${data.chapterProgress.total}`} icon="📖" />
        <StatCard label="Revisions completed" value={data.revisionStatus.completed} icon="🔁" accent="text-green-600 dark:text-green-400" />
        <StatCard label="Revisions missed" value={data.revisionStatus.missed} icon="⚠️" accent="text-red-500" />
        <StatCard label="Current streak" value={`${data.studyStreak.current}d`} sublabel={`Best: ${data.studyStreak.longest}d`} icon="🔥" accent="text-amber-500" />
      </div>

      {/* Daily / Weekly / Monthly study time */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Daily study time (30d)</h2>
          <div className="mt-3 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dailyStudyTime}>
                <XAxis dataKey="date" hide />
                <YAxis fontSize={10} width={28} />
                <Tooltip />
                <Bar dataKey="hours" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Weekly study time (8w)</h2>
          <div className="mt-3 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weeklyStudyTime}>
                <XAxis dataKey="week" hide />
                <YAxis fontSize={10} width={28} />
                <Tooltip />
                <Bar dataKey="hours" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Monthly study time (6mo)</h2>
          <div className="mt-3 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyStudyTime}>
                <XAxis dataKey="month" fontSize={10} />
                <YAxis fontSize={10} width={28} />
                <Tooltip />
                <Bar dataKey="hours" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Subject progress + revision status */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Subject progress</h2>
          <div className="mt-3 space-y-2.5">
            {data.subjectProgress.length === 0 && <p className="text-xs text-gray-400">No subjects yet.</p>}
            {data.subjectProgress.map((s) => (
              <div key={s.name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </span>
                  <span className="text-gray-400">{s.completedChapters}/{s.totalChapters}</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-full rounded-full" style={{ width: `${s.completionPercent}%`, backgroundColor: s.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Revision status</h2>
          {revisionPieData.length === 0 ? (
            <p className="mt-3 text-xs text-gray-400">No revisions scheduled yet.</p>
          ) : (
            <div className="mt-2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={revisionPieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                    {revisionPieData.map((entry) => (
                      <Cell key={entry.key} fill={REVISION_COLORS[entry.key]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* --- Subject Planning Deadline analytics --- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Deadline progress</h2>
          {data.deadlineProgress.length === 0 ? (
            <p className="mt-3 text-xs text-gray-400">No subjects with deadlines yet.</p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {data.deadlineProgress.map((s) => (
                <div key={s.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                    <span className="text-gray-400">
                      {s.completionPercent}% · {s.deadline ? new Date(s.deadline).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${s.completionPercent}%`,
                        backgroundColor: { early: '#10b981', on_track: '#10b981', behind: '#f59e0b', critical: '#ef4444', completed: '#10b981' }[s.status] || '#6366f1',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Deadline risk score</h2>
          {data.deadlineRisk.length === 0 ? (
            <p className="mt-3 text-xs text-gray-400">No subjects yet.</p>
          ) : (
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.deadlineRisk} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" domain={[0, 100]} fontSize={10} />
                  <YAxis type="category" dataKey="name" fontSize={10} width={90} />
                  <Tooltip />
                  <Bar dataKey="riskScore" radius={[0, 3, 3, 0]}>
                    {data.deadlineRisk.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.riskScore >= 70 ? '#ef4444' : entry.riskScore >= 40 ? '#f59e0b' : '#10b981'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Subject completion forecast</h2>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Days early (−) or late (+) vs. each deadline</p>
          {data.subjectCompletionForecast.length === 0 ? (
            <p className="mt-3 text-xs text-gray-400">No forecast data yet.</p>
          ) : (
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.subjectCompletionForecast}>
                  <XAxis dataKey="name" fontSize={9} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis fontSize={10} width={28} />
                  <Tooltip />
                  <Bar dataKey="offsetDays" radius={[3, 3, 0, 0]}>
                    {data.subjectCompletionForecast.map((entry) => (
                      <Cell key={entry.name} fill={entry.offsetDays > 0 ? '#ef4444' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Study load until deadline</h2>
          {data.studyLoadUntilDeadline.length === 0 ? (
            <p className="mt-3 text-xs text-gray-400">Nothing remaining — you're all caught up!</p>
          ) : (
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.studyLoadUntilDeadline}>
                  <XAxis dataKey="name" fontSize={9} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis fontSize={10} width={28} />
                  <Tooltip />
                  <Bar dataKey="remainingHours" name="Remaining hours" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 card p-5">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Burndown chart</h2>
        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Total remaining study hours across all subjects — actual vs. ideal pace</p>
        {burndownChartData.length === 0 ? (
          <p className="mt-3 text-xs text-gray-400">Not enough data yet.</p>
        ) : (
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={burndownChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-800" />
                <XAxis dataKey="date" fontSize={10} />
                <YAxis fontSize={10} width={32} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Actual" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="Ideal" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Test performance */}
      <div className="mt-4 card p-5">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Test performance</h2>
        {testChartData.length < 2 ? (
          <p className="mt-3 text-xs text-gray-400">Log at least two tests in Mock Test Manager to see a trend line.</p>
        ) : (
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={testChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-800" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Score" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Accuracy" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Productivity heatmap */}
      <div className="mt-4 card p-5">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Productivity heatmap (90 days)</h2>
        <div className="mt-3">
          <Heatmap data={data.productivityHeatmap} />
        </div>
      </div>
    </div>
  );
}
