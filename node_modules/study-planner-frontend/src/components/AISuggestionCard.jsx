export default function AISuggestionCard({ suggestion, loading }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <span className="text-xl">🤖</span>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          AI suggestion
        </p>
      </div>
      {loading ? (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Thinking about your next move...</p>
      ) : suggestion?.subject ? (
        <>
          <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">
            Study {suggestion.subject} next
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{suggestion.reason}</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {suggestion?.reason || 'Add some tasks to get a suggestion.'}
        </p>
      )}
    </div>
  );
}
