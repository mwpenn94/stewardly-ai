import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ChevronDown, ChevronRight, Download, Edit2, FileText, FolderOpen, FolderPlus,
  GripVertical, HelpCircle, MessageSquare, MoreHorizontal, Pin, Plus,
  Search, Settings, Trash2, X, Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  DndContext, closestCenter, type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  minRole: string;
}

interface FolderGroup {
  id: number;
  name: string;
  color: string;
  conversations: any[];
}

interface GroupedConversations {
  pinned: any[];
  folderGroups: FolderGroup[];
  unfiled: any[];
}

interface ChatSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  conversationId: number | null;
  setConversationId: (v: number | null) => void;
  groupedConversations: GroupedConversations;
  expandedFolders: Set<number>;
  toggleFolderExpand: (id: number) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchResults: any;
  onNewConversation: () => void;
  onDeleteConversation: (id: number) => void;
  onExportConversation: (id: number, format: "markdown" | "json") => void;
  togglePinMutation: any;
  moveToFolderMutation: any;
  reorderMutation: any;
  folders: any[];
  sensors: any;
  handleDragEnd: (event: DragEndEvent) => void;
  onOpenFolderDialog: (folder?: { id: number; name: string; color: string }) => void;
  toolsNav: NavItem[];
  adminNav: NavItem[];
  userRole: string;
  hasMinRole: (userRole: string, minRole: string) => boolean;
  isAuthenticated: boolean;
}

export function ChatSidebar({
  sidebarOpen,
  setSidebarOpen,
  sidebarCollapsed,
  setSidebarCollapsed,
  conversationId,
  setConversationId,
  groupedConversations,
  expandedFolders,
  toggleFolderExpand,
  searchOpen,
  setSearchOpen,
  searchQuery,
  setSearchQuery,
  searchResults,
  onNewConversation,
  onDeleteConversation,
  onExportConversation,
  togglePinMutation,
  moveToFolderMutation,
  reorderMutation,
  folders,
  sensors,
  handleDragEnd,
  onOpenFolderDialog,
  toolsNav,
  adminNav,
  userRole,
  hasMinRole,
  isAuthenticated,
}: ChatSidebarProps) {
  const [, navigate] = useLocation();
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:relative z-50 md:z-auto h-full bg-card border-r border-border flex flex-col transition-all duration-200 ${sidebarCollapsed ? "w-14" : "w-64"}`}>
        {/* Header */}
        <div className="p-3 flex items-center gap-2 border-b border-border">
          {!sidebarCollapsed && (
            <>
              <Button variant="outline" size="sm" className="flex-1 justify-start gap-2 text-xs h-8" onClick={onNewConversation}>
                <Plus className="w-3.5 h-3.5" /> New Chat
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(""); }}>
                <Search className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          {sidebarCollapsed && (
            <Button variant="ghost" size="icon" className="h-8 w-8 mx-auto" onClick={onNewConversation}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Search */}
        {searchOpen && !sidebarCollapsed && (
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                data-search-input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="h-8 pl-8 pr-8 text-xs"
                autoFocus
              />
              {searchQuery && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearchQuery("")}>
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            {searchQuery && searchResults?.data && (
              <div className="mt-1 max-h-48 overflow-y-auto">
                {searchResults.data.map((r: any) => (
                  <button
                    key={r.id}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-secondary/50 rounded-md truncate"
                    onClick={() => { setConversationId(r.id); navigate(`/chat/${r.id}`); setSearchOpen(false); setSearchQuery(""); setSidebarOpen(false); }}
                  >
                    {r.title || "Untitled"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Conversation list */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto py-1.5">
            {/* Pinned */}
            {groupedConversations.pinned.length > 0 && (
              <div className="mb-1">
                <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Pinned</div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={groupedConversations.pinned.map((c: any) => c.id)} strategy={verticalListSortingStrategy}>
                    {groupedConversations.pinned.map((conv: any) => (
                      <SortableConvItem
                        key={conv.id}
                        conv={conv}
                        conversationId={conversationId}
                        navigate={navigate}
                        setSidebarOpen={setSidebarOpen}
                        setConversationId={setConversationId}
                        handleDeleteConversation={onDeleteConversation}
                        togglePinMutation={togglePinMutation}
                        moveToFolderMutation={moveToFolderMutation}
                        handleExportConversation={onExportConversation}
                        folders={folders}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* Folders */}
            {groupedConversations.folderGroups.map(fg => (
              <div key={fg.id} className="mb-1">
                <button
                  className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs hover:bg-secondary/30 transition-colors group"
                  onClick={() => toggleFolderExpand(fg.id)}
                >
                  {expandedFolders.has(fg.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <FolderOpen className="w-3.5 h-3.5" style={{ color: fg.color }} />
                  <span className="truncate flex-1 text-left">{fg.name}</span>
                  <span className="text-[10px] text-muted-foreground/50">{fg.conversations.length}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-0.5"
                    onClick={(e) => { e.stopPropagation(); onOpenFolderDialog({ id: fg.id, name: fg.name, color: fg.color }); }}
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </button>
                {expandedFolders.has(fg.id) && fg.conversations.map((conv: any) => (
                  <ConvItem
                    key={conv.id}
                    conv={conv}
                    conversationId={conversationId}
                    navigate={navigate}
                    setSidebarOpen={setSidebarOpen}
                    setConversationId={setConversationId}
                    handleDeleteConversation={onDeleteConversation}
                    togglePinMutation={togglePinMutation}
                    moveToFolderMutation={moveToFolderMutation}
                    handleExportConversation={onExportConversation}
                    folders={folders}
                    indent
                  />
                ))}
              </div>
            ))}

            {/* Unfiled */}
            {groupedConversations.unfiled.length > 0 && (
              <div>
                {(groupedConversations.pinned.length > 0 || groupedConversations.folderGroups.length > 0) && (
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Recent</div>
                )}
                {groupedConversations.unfiled.map((conv: any) => (
                  <ConvItem
                    key={conv.id}
                    conv={conv}
                    conversationId={conversationId}
                    navigate={navigate}
                    setSidebarOpen={setSidebarOpen}
                    setConversationId={setConversationId}
                    handleDeleteConversation={onDeleteConversation}
                    togglePinMutation={togglePinMutation}
                    moveToFolderMutation={moveToFolderMutation}
                    handleExportConversation={onExportConversation}
                    folders={folders}
                  />
                ))}
              </div>
            )}

            {/* Create folder button */}
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors mt-1"
              onClick={() => onOpenFolderDialog()}
            >
              <FolderPlus className="w-3.5 h-3.5" /> New Folder
            </button>
          </div>
        )}

        {/* Nav links */}
        {!sidebarCollapsed && (
          <div className="border-t border-border py-2 px-2 space-y-0.5 max-h-[40vh] overflow-y-auto">
            {/* Tools section */}
            <button
              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 rounded-md transition-colors"
              onClick={() => setToolsExpanded(!toolsExpanded)}
            >
              {toolsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span className="font-medium">Tools & Features</span>
            </button>
            {toolsExpanded && toolsNav.filter(n => hasMinRole(userRole, n.minRole)).map(n => (
              <button
                key={n.href}
                className="flex items-center gap-2 w-full px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 rounded-md transition-colors"
                onClick={() => { navigate(n.href); setSidebarOpen(false); }}
              >
                {n.icon} {n.label}
              </button>
            ))}

            {/* Admin section */}
            {adminNav.some(n => hasMinRole(userRole, n.minRole)) && (
              <>
                <button
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 rounded-md transition-colors"
                  onClick={() => setAdminExpanded(!adminExpanded)}
                >
                  {adminExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span className="font-medium">Admin</span>
                </button>
                {adminExpanded && adminNav.filter(n => hasMinRole(userRole, n.minRole)).map(n => (
                  <button
                    key={n.href}
                    className="flex items-center gap-2 w-full px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 rounded-md transition-colors"
                    onClick={() => { navigate(n.href); setSidebarOpen(false); }}
                  >
                    {n.icon} {n.label}
                  </button>
                ))}
              </>
            )}

            {/* Bottom links */}
            <div className="pt-1 border-t border-border mt-1 space-y-0.5">
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 rounded-md transition-colors"
                onClick={() => { navigate("/settings/profile"); setSidebarOpen(false); }}
              >
                <Settings className="w-3.5 h-3.5" /> Settings
              </button>
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 rounded-md transition-colors"
                onClick={() => { navigate("/help"); setSidebarOpen(false); }}
              >
                <HelpCircle className="w-3.5 h-3.5" /> Help & Guides
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

/* ─── ConvItem: Single conversation row with context menu ─── */
function ConvItem({ conv, conversationId, navigate, setSidebarOpen, setConversationId,
  handleDeleteConversation, togglePinMutation, moveToFolderMutation, handleExportConversation, folders, indent, dragHandle }: {
  conv: any; conversationId: number | null; navigate: (path: string) => void;
  setSidebarOpen: (v: boolean) => void; setConversationId: (v: number | null) => void;
  handleDeleteConversation: (id: number) => void;
  togglePinMutation: any; moveToFolderMutation: any;
  handleExportConversation?: (id: number, format: "markdown" | "json") => void;
  folders: any[]; indent?: boolean; dragHandle?: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <div
        className={`group flex items-center gap-2 ${indent ? "pl-6 pr-3" : "px-3"} py-2 rounded-lg text-sm cursor-pointer transition-colors ${
          conv.id === conversationId ? "bg-accent/10 text-accent" : "hover:bg-secondary/50 text-foreground"
        }`}
        onClick={() => { setConversationId(conv.id); navigate(`/chat/${conv.id}`); setSidebarOpen(false); }}
      >
        {dragHandle}
        {conv.pinned ? <Pin className="w-3.5 h-3.5 shrink-0 text-accent" /> : <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />}
        <span className="truncate flex-1">{conv.title || "New Conversation"}</span>
        <DropdownMenuTrigger asChild>
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => togglePinMutation.mutate({ id: conv.id, pinned: !conv.pinned })}>
          <Pin className="w-3.5 h-3.5 mr-2" /> {conv.pinned ? "Unpin" : "Pin to top"}
        </DropdownMenuItem>
        {folders.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderOpen className="w-3.5 h-3.5 mr-2" /> Move to folder
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {conv.folderId && (
                <DropdownMenuItem onClick={() => moveToFolderMutation.mutate({ id: conv.id, folderId: null })}>
                  Remove from folder
                </DropdownMenuItem>
              )}
              {folders.map((f: any) => (
                <DropdownMenuItem key={f.id} onClick={() => moveToFolderMutation.mutate({ id: conv.id, folderId: f.id })}>
                  <FolderOpen className="w-3 h-3 mr-2" style={{ color: f.color }} /> {f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuSeparator />
        {handleExportConversation && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Download className="w-3.5 h-3.5 mr-2" /> Export
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => handleExportConversation(conv.id, "markdown")}>
                <FileText className="w-3 h-3 mr-2" /> Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportConversation(conv.id, "json")}>
                <Database className="w-3 h-3 mr-2" /> JSON (.json)
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteConversation(conv.id)}>
          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── SortableConvItem: Draggable wrapper for pinned conversations ─── */
function SortableConvItem(props: Parameters<typeof ConvItem>[0] & { conv: { id: number } }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.conv.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <ConvItem
        {...props}
        dragHandle={
          <button {...listeners} className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-60 transition-opacity p-0.5 -ml-1" onClick={(e) => e.stopPropagation()}>
            <GripVertical className="w-3 h-3" />
          </button>
        }
      />
    </div>
  );
}
