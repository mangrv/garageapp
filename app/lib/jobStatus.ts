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
  up_next: "bg-blue-700 text-blue-100",
  active: "bg-amber-700 text-amber-100",
  in_progress: "bg-amber-700 text-amber-100",
  blocked: "bg-red-700 text-red-100",
  testing: "bg-purple-700 text-purple-100",
  done: "bg-emerald-700 text-emerald-100",
  archived: "bg-gray-800 text-gray-500",
};

// Non-done statuses (shown on home page)
export const ACTIVE_STATUSES = ["todo", "up_next", "active", "in_progress", "blocked", "testing"];

// Options for status picker (excludes legacy 'active')
export const JOB_STATUS_OPTIONS = ["todo", "up_next", "in_progress", "blocked", "testing", "done", "archived"] as const;
