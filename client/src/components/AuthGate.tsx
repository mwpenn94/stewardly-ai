import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogIn, ArrowLeft, Home } from "lucide-react";
import { useLocation } from "wouter";

interface AuthGateProps {
  /** Page title to show in the gate message */
  title: string;
  /** Optional description */
  description?: string;
  /** Icon component to display */
  icon?: React.ReactNode;
}

/**
 * AuthGate — shown when a page requires authentication but the user is not signed in.
 * Provides clear sign-in button AND navigation options (back to chat, home).
 * 
 * NOTE: With the guest session system, this should rarely appear since guests
 * are auto-provisioned. It's a fallback for edge cases where guest provisioning
 * fails or for admin-only pages.
 */
export function AuthGate({ title, description, icon }: AuthGateProps) {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-border/50">
        <CardContent className="p-8 text-center space-y-6">
          {icon && (
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              {icon}
            </div>
          )}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">
              {description || "Sign in to access this feature and save your data."}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              className="w-full gap-2"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={() => navigate("/chat")}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Chat
              </Button>
              <Button
                variant="ghost"
                className="flex-1 gap-1.5"
                onClick={() => navigate("/")}
              >
                <Home className="w-3.5 h-3.5" />
                Home
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
