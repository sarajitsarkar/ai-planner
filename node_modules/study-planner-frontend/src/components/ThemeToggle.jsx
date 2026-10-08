import { useTheme } from '../context/ThemeContext.jsx';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      className="relative inline-flex h-9 w-16 items-center rounded-full bg-gray-200 dark:bg-gray-700 transition-colors"
    >
      <span
        className={`inline-flex h-7 w-7 transform items-center justify-center rounded-full bg-white dark:bg-gray-900 shadow transition-transform ${
          isDark ? 'translate-x-8' : 'translate-x-1'
        }`}
      >
        {isDark ? '🌙' : '☀️'}
      </span>
    </button>
  );
}
