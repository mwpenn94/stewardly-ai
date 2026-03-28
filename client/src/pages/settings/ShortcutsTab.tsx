/**
 * ShortcutsTab — Settings tab for customizing G-then-X keyboard shortcuts.
 *
 * Users can remap which key maps to which page, add new shortcuts,
 * remove existing ones, and reset everything to defaults.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Keyboard, RotateCcw, Plus, Trash2, AlertTriangle, Check, Info,
} from "lucide-react";
import {
  useCustomShortcuts,
  DEFAULT_SHORTCUTS,
  AVAILABLE_ROUTES,
} from "@/hooks/useCustomShortcuts";

const ALLOWED_KEYS = "abcdefghijklmnopqrstuvwxyz".split("");

export default function ShortcutsTab() {
  const {
    shortcuts,
    isCustomized,
    updateShortcut,
    resetToDefaults,
    addShortcut,
    removeShortcut,
  } = useCustomShortcuts();

  const [newKey, setNewKey] = useState("");
  const [newRoute, setNewRoute] = useState("");

  const usedKeys = new Set(shortcuts.map(s => s.key.toLowerCase()));
  const availableKeys = ALLOWED_KEYS.filter(k => !usedKeys.has(k));

  const handleAdd = () => {
    if (!newKey || !newRoute) {
      toast.error("Select both a key and a page");
      return;
    }
    const routeInfo = AVAILABLE_ROUTES.find(r => r.route === newRoute);
    if (!routeInfo) return;
    addShortcut({ key: newKey.toLowerCase(), route: newRoute, label: routeInfo.label });
    toast.success(`Added shortcut: G then ${newKey.toUpperCase()} → ${routeInfo.label}`);
    setNewKey("");
    setNewRoute("");
  };

  const handleReset = () => {
    resetToDefaults();
    toast.success("Shortcuts reset to defaults");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Keyboard className="w-5 h-5 text-accent" />
          Keyboard Shortcuts
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Customize G-then-X navigation shortcuts. Press <kbd className="px-1 py-0.5 rounded bg-secondary text-xs font-mono">G</kbd> followed by a letter to jump to any page.
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        <Badge variant={isCustomized ? "default" : "outline"} className="text-xs">
          {isCustomized ? "Customized" : "Default"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {shortcuts.length} shortcut{shortcuts.length !== 1 ? "s" : ""} configured
        </span>
        {isCustomized && (
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 ml-auto" onClick={handleReset}>
            <RotateCcw className="w-3 h-3" /> Reset to defaults
          </Button>
        )}
      </div>

      <Separator />

      {/* Current shortcuts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Active Shortcuts</CardTitle>
          <CardDescription className="text-xs">
            Change the target page for any shortcut, or remove shortcuts you don't need.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {shortcuts.map((shortcut, index) => (
            <div
              key={shortcut.key}
              className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-secondary/30 transition-colors group"
            >
              {/* Key display */}
              <div className="flex items-center gap-1.5 shrink-0 w-24">
                <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md bg-secondary/80 border border-border/60 text-[11px] font-mono font-medium">
                  G
                </kbd>
                <span className="text-[10px] text-muted-foreground/50">then</span>
                <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md bg-secondary/80 border border-border/60 text-[11px] font-mono font-medium">
                  {shortcut.key.toUpperCase()}
                </kbd>
              </div>

              {/* Route selector */}
              <Select
                value={shortcut.route}
                onValueChange={(value) => {
                  const routeInfo = AVAILABLE_ROUTES.find(r => r.route === value);
                  if (routeInfo) {
                    updateShortcut(index, { route: value, label: routeInfo.label });
                    toast.success(`Updated: G then ${shortcut.key.toUpperCase()} → ${routeInfo.label}`);
                  }
                }}
              >
                <SelectTrigger className="flex-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ROUTES.map(r => (
                    <SelectItem key={r.route} value={r.route} className="text-xs">
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Remove button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                onClick={() => {
                  removeShortcut(shortcut.key);
                  toast.success(`Removed shortcut: G then ${shortcut.key.toUpperCase()}`);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}

          {shortcuts.length === 0 && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-amber-400" />
              No shortcuts configured. Add one below or reset to defaults.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add new shortcut */}
      {availableKeys.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Add Shortcut</CardTitle>
            <CardDescription className="text-xs">
              Assign an unused key to a page for quick navigation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 shrink-0">
                <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md bg-secondary/80 border border-border/60 text-[11px] font-mono font-medium">
                  G
                </kbd>
                <span className="text-[10px] text-muted-foreground/50">then</span>
              </div>

              <Select value={newKey} onValueChange={setNewKey}>
                <SelectTrigger className="w-20 h-8 text-xs">
                  <SelectValue placeholder="Key" />
                </SelectTrigger>
                <SelectContent>
                  {availableKeys.map(k => (
                    <SelectItem key={k} value={k} className="text-xs font-mono">
                      {k.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-xs text-muted-foreground">→</span>

              <Select value={newRoute} onValueChange={setNewRoute}>
                <SelectTrigger className="flex-1 h-8 text-xs">
                  <SelectValue placeholder="Select page" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ROUTES.map(r => (
                    <SelectItem key={r.route} value={r.route} className="text-xs">
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button size="sm" className="h-8 gap-1" onClick={handleAdd} disabled={!newKey || !newRoute}>
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/20 border border-border/50">
        <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            Press <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">?</kbd> from anywhere to see all shortcuts.
            Press <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">⌘K</kbd> to open the command palette.
          </p>
          <p>
            Custom shortcuts are saved locally in your browser. They will persist across sessions but not across devices.
          </p>
        </div>
      </div>
    </div>
  );
}
