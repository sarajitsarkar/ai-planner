export default function StatCard({ label, value, sublabel, icon, accent = 'text-primary-600 dark:text-primary-400' }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        {icon && <span className="text-lg leading-none">{icon}</span>}
      </div>
      <p className={`mt-1.5 text-2xl font-bold ${accent}`}>{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{sublabel}</p>}
    </div>
  );
}
