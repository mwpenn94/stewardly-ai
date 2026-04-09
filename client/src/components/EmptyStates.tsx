/**
 * EmptyStates.tsx — Empty state components for key pages
 */
import { MessageSquare, Users, FileText, UserPlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyConversations() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
        <MessageSquare className="w-5 h-5 text-primary" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">No conversations yet</p>
      <p className="text-xs text-muted-foreground max-w-[200px]">
        Start a conversation and it'll appear here. Your history builds your financial twin.
      </p>
    </div>
  );
}

export function EmptyClients() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Users className="w-6 h-6 text-primary" />
      </div>
      <h3 className="font-heading text-lg font-semibold mb-1">Your client network starts here</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Add your first client to begin building their financial twin. Every conversation
        enriches the AI's understanding of their needs.
      </p>
      <Button size="sm" className="gap-2 cursor-pointer">
        <UserPlus className="w-4 h-4" /> Add First Client
      </Button>
    </div>
  );
}

export function EmptyDocuments() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <FileText className="w-6 h-6 text-primary" />
      </div>
      <h3 className="font-heading text-lg font-semibold mb-1">Your document vault is ready</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Upload policies, proposals, and client documents. Steward can analyze them,
        extract key details, and reference them in conversations.
      </p>
      <Button size="sm" className="gap-2 cursor-pointer">
        <Upload className="w-4 h-4" /> Upload Document
      </Button>
    </div>
  );
}
