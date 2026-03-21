/**
 * Task #42 — Command Palette Service
 * Searchable command registry for keyboard-driven navigation
 */

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  category: "navigation" | "action" | "tool" | "settings" | "help";
  icon?: string;
  route?: string;
  action?: string;
  roles?: string[];
  keywords: string[];
}

const COMMANDS: Command[] = [
  // Navigation
  { id: "nav_chat", label: "Go to Chat", shortcut: "Ctrl+Shift+C", category: "navigation", icon: "MessageSquare", route: "/", keywords: ["chat", "conversation", "home", "talk"] },
  { id: "nav_operations", label: "Go to Operations", shortcut: "Ctrl+Shift+O", category: "navigation", icon: "Settings", route: "/operations", keywords: ["operations", "agents", "compliance", "work"], roles: ["advisor", "manager", "admin"] },
  { id: "nav_intelligence", label: "Go to Intelligence", shortcut: "Ctrl+Shift+I", category: "navigation", icon: "Brain", route: "/intelligence", keywords: ["intelligence", "analytics", "models", "data"], roles: ["advisor", "manager", "admin"] },
  { id: "nav_advisory", label: "Go to Advisory", shortcut: "Ctrl+Shift+A", category: "navigation", icon: "Shield", route: "/advisory", keywords: ["advisory", "products", "cases", "recommendations"] },
  { id: "nav_relationships", label: "Go to Relationships", shortcut: "Ctrl+Shift+R", category: "navigation", icon: "Users", route: "/relationships", keywords: ["relationships", "network", "meetings", "outreach"] },
  { id: "nav_documents", label: "Go to Documents", category: "navigation", icon: "FileText", route: "/documents", keywords: ["documents", "files", "uploads"] },
  { id: "nav_integrations", label: "Go to Integrations", category: "navigation", icon: "Plug", route: "/integrations", keywords: ["integrations", "connect", "api", "plaid"] },
  { id: "nav_suitability", label: "Go to Suitability", category: "navigation", icon: "ClipboardCheck", route: "/suitability", keywords: ["suitability", "assessment", "profile", "risk"] },
  { id: "nav_settings", label: "Go to Settings", shortcut: "Ctrl+,", category: "navigation", icon: "Cog", route: "/settings", keywords: ["settings", "preferences", "config"] },
  { id: "nav_admin", label: "Go to Admin", category: "navigation", icon: "Shield", route: "/admin", keywords: ["admin", "administration"], roles: ["admin"] },
  // Actions
  { id: "act_new_chat", label: "New Conversation", shortcut: "Ctrl+N", category: "action", icon: "Plus", action: "new_chat", keywords: ["new", "conversation", "chat", "start"] },
  { id: "act_upload", label: "Upload Document", shortcut: "Ctrl+U", category: "action", icon: "Upload", action: "upload_document", keywords: ["upload", "document", "file", "import"] },
  { id: "act_export", label: "Export Data", category: "action", icon: "Download", action: "export_data", keywords: ["export", "download", "data", "csv"] },
  { id: "act_voice", label: "Toggle Voice Mode", shortcut: "Ctrl+Shift+V", category: "action", icon: "Mic", action: "toggle_voice", keywords: ["voice", "speak", "microphone", "hands-free"] },
  // Tools
  { id: "tool_calculator", label: "Open Calculator", category: "tool", icon: "Calculator", action: "open_calculator", keywords: ["calculator", "compute", "math", "projection"] },
  { id: "tool_comparator", label: "Compare Products", category: "tool", icon: "GitCompare", action: "compare_products", keywords: ["compare", "products", "side-by-side"] },
  // Settings
  { id: "set_theme", label: "Toggle Theme", shortcut: "Ctrl+Shift+T", category: "settings", icon: "Moon", action: "toggle_theme", keywords: ["theme", "dark", "light", "mode"] },
  { id: "set_focus", label: "Change Focus Mode", category: "settings", icon: "Target", action: "change_focus", keywords: ["focus", "general", "financial", "both"] },
  // Help
  { id: "help_shortcuts", label: "Keyboard Shortcuts", shortcut: "Ctrl+/", category: "help", icon: "Keyboard", action: "show_shortcuts", keywords: ["shortcuts", "keyboard", "help", "keys"] },
  { id: "help_docs", label: "Documentation", category: "help", icon: "Book", route: "/docs", keywords: ["docs", "documentation", "help", "guide"] },
];

export function searchCommands(query: string, userRole = "user"): Command[] {
  const q = query.toLowerCase().trim();
  if (!q) return COMMANDS.filter(c => !c.roles || c.roles.includes(userRole));

  return COMMANDS
    .filter(c => !c.roles || c.roles.includes(userRole))
    .filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.keywords.some(k => k.includes(q)) ||
      (c.shortcut && c.shortcut.toLowerCase().includes(q))
    )
    .sort((a, b) => {
      const aExact = a.label.toLowerCase().startsWith(q) ? 0 : 1;
      const bExact = b.label.toLowerCase().startsWith(q) ? 0 : 1;
      return aExact - bExact;
    });
}

export function getCommandsByCategory(category: string, userRole = "user"): Command[] {
  return COMMANDS.filter(c => c.category === category && (!c.roles || c.roles.includes(userRole)));
}

export function getAllShortcuts(userRole = "user"): Array<{ shortcut: string; label: string }> {
  return COMMANDS
    .filter(c => c.shortcut && (!c.roles || c.roles.includes(userRole)))
    .map(c => ({ shortcut: c.shortcut!, label: c.label }));
}
