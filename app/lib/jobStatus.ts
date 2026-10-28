export const JOB_STATUS_LABEL: Record<string, string> = {
  todo: "To Do",
  up_next: "Up Next",
  active: "In Progress",   // legacy
  in_progress: "In Progress",
  blocked: "Blocked",
  testing: "Testing",
  done: "Done",
  archived: "Archived",
};

export const JOB_STATUS_EMOJI: Record<string, string> = {
  todo: "📋",
  up_next: "🔜",
  active: "⚙️",
  in_progress: "⚙️",
  blocked: "🚫",
  testing: "🔍",
  done: "✅",
  archived: "📦",
};

export const JOB_STATUS_COLOR: Record<string, string> = {
  todo: "bg-gray-700 text-gray-200",
  up_next: "bg-blue-900 text-blue-400",
  active: "bg-amber-900 text-amber-400",
  in_progress: "bg-amber-900 text-amber-400",
  blocked: "bg-red-900 text-red-400",
  testing: "bg-purple-900 text-purple-400",
  done: "bg-emerald-900 text-emerald-400",
  archived: "bg-gray-800 text-gray-500",
};

// Non-done statuses (shown on home page)
export const ACTIVE_STATUSES = ["todo", "up_next", "active", "in_progress", "blocked", "testing"];

// Options for status picker (excludes legacy 'active')
export const JOB_STATUS_OPTIONS = ["todo", "up_next", "in_progress", "blocked", "testing", "done", "archived"] as const;
