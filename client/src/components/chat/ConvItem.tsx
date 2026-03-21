import {
  Database, Download, FileText, FolderOpen, GripVertical,
  MessageSquare, MoreHorizontal, Pin, Trash2
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ConvItemProps {
  conv: any;
  conversationId: number | null;
  navigate: (path: string) => void;
  setSidebarOpen: (v: boolean) => void;
  setConversationId: (v: number | null) => void;
  handleDeleteConversation: (id: number) => void;
  togglePinMutation: any;
  moveToFolderMutation: any;
  handleExportConversation?: (id: number, format: "markdown" | "json") => void;
  folders: any[];
  indent?: boolean;
  dragHandle?: React.ReactNode;
}

export function ConvItem({ conv, conversationId, navigate, setSidebarOpen, setConversationId,
  handleDeleteConversation, togglePinMutation, moveToFolderMutation, handleExportConversation, folders, indent, dragHandle }: ConvItemProps) {
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

export function SortableConvItem(props: ConvItemProps & { conv: { id: number } }) {
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
