import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import AboutButton from './AboutButton.jsx';

const linkClass = ({ isActive }) =>
  `px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
    isActive
      ? 'bg-primary-600 text-white'
      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
  }`;

const NAV_LINKS = [
  { to: '/', end: true, label: 'Dashboard' },
  { to: '/ai-planner', label: '✨ AI Planner' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/subjects', label: 'Subjects' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/planner-history', label: 'History' },
  { to: '/mock-exams', label: 'Mock Exams' },
  { to: '/test-results', label: 'Mock Tests' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/planner', label: 'Planner' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xl">📚</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">Study Planner</span>
        </div>

        {user && (
          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="flex shrink-0 items-center gap-3">
          <AboutButton />
          <ThemeToggle />
          {user && (
            <button onClick={handleLogout} className="btn-secondary !px-3 !py-2 text-sm">
              Log out
            </button>
          )}
        </div>
      </div>

      {user && (
        <nav className="flex lg:hidden items-center gap-1 overflow-x-auto px-4 pb-2">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
