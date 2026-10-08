// Central place for how each session type looks across the app, so
// Dashboard, Tasks, and the new Daily Schedule page all stay visually
// consistent (requirement 9: different colors/icons per session type).
export const SESSION_TYPES = {
  study: {
    label: 'Study',
    icon: '📖',
    badge: 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300',
    dot: 'bg-primary-500',
  },
  notes: {
    label: 'Notes',
    icon: '📝',
    badge: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  practice: {
    label: 'Practice',
    icon: '✏️',
    badge: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  revision: {
    label: 'Revision',
    icon: '🔁',
    badge: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    dot: 'bg-purple-500',
  },
  mock_exam: {
    label: 'Mock Exam',
    icon: '🧪',
    badge: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
  },
  custom: {
    label: 'Custom Task',
    icon: '📌',
    badge: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
    dot: 'bg-gray-500',
  },
};

export const getSessionMeta = (type) => SESSION_TYPES[type] || SESSION_TYPES.study;

export const STATUS_LABELS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export const STATUS_COLORS = {
  not_started: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  in_progress: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  completed: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300',
};

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
