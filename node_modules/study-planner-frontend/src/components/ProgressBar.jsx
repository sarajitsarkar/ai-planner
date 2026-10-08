export default function ProgressBar({ label, percent = 0, sublabel }) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">{clamped}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {sublabel && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sublabel}</p>}
    </div>
  );
}
