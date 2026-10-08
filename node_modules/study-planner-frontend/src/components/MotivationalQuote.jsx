export default function MotivationalQuote({ quote, loading }) {
  return (
    <div className="card bg-gradient-to-br from-primary-600 to-primary-700 p-5 text-white">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary-100">
        Today's motivation
      </p>
      <p className="mt-2 text-lg font-medium leading-snug">
        {loading ? 'Loading a bit of inspiration...' : `"${quote}"`}
      </p>
    </div>
  );
}
