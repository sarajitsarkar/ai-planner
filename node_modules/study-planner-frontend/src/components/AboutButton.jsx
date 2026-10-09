import { useState, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------
// EDIT THIS: fill in your own details. Leave a field as an empty string
// ('') to hide that row automatically — nothing is required.
// ---------------------------------------------------------------------
const DEVELOPER = {
  name: 'SARAJIT SARKAR',
  role: 'Full-Stack Developer',
  instagram: 'ims.sarkar', // without the @
  github: 'sarajitsarkar',
  email: 'sarajitsarkar60530@gmail.com',
  website: 'https://protfolio2-xi.vercel.app/', // e.g. 'https://yourportfolio.com'
};
// ---------------------------------------------------------------------

export default function AboutButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const rows = [
    DEVELOPER.instagram && {
      label: 'Instagram',
      value: `@${DEVELOPER.instagram}`,
      href: `https://instagram.com/${DEVELOPER.instagram}`,
      icon: '📷',
    },
    DEVELOPER.github && {
      label: 'GitHub',
      value: `@${DEVELOPER.github}`,
      href: `https://github.com/${DEVELOPER.github}`,
      icon: '💻',
    },
    DEVELOPER.email && {
      label: 'Email',
      value: DEVELOPER.email,
      href: `mailto:${DEVELOPER.email}`,
      icon: '✉️',
    },
    DEVELOPER.website && {
      label: 'Website',
      value: DEVELOPER.website.replace(/^https?:\/\//, ''),
      href: DEVELOPER.website,
      icon: '🌐',
    },
  ].filter(Boolean);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="About the developer"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        <span className="text-sm font-bold">i</span>
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-lg">
              👤
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{DEVELOPER.name}</p>
              {DEVELOPER.role && (
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{DEVELOPER.role}</p>
              )}
            </div>
          </div>

          {rows.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-gray-100 dark:border-gray-800 pt-3">
              {rows.map((row) => (
                <a
                  key={row.label}
                  href={row.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-600 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span>{row.icon}</span>
                  <span className="truncate">{row.value}</span>
                </a>
              ))}
            </div>
          )}

          <p className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3 text-center text-[10px] text-gray-400 dark:text-gray-500">
            Study Planner · Built with React & Node.js
          </p>
        </div>
      )}
    </div>
  );
}
