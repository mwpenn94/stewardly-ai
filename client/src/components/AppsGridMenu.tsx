/**
 * AppsGridMenu — Manus-next style dropdown grid for quick navigation.
 * Shows engine hubs and platform tools in a compact dropdown triggered
 * from the sidebar bottom bar.
 */
import { useMemo } from "react";
import { useLocation } from "wouter";
import {
  Calculator,
  Users,
  BookOpen,
  TrendingUp,
  LayoutGrid,
  Settings,
  Shield,
  Target,
  Layers,
  HelpCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";

interface AppsGridMenuProps {
  onNavigate?: (path: string) => void;
}

export function AppsGridMenu({ onNavigate }: AppsGridMenuProps) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const userRole = user?.role || "user";

  const items = useMemo(() => {
    const all: Array<{ href: string; label: string; Icon: typeof Calculator; color: string }> = [
      { href: "/wealth-engine", label: "Wealth Engine", Icon: Calculator, color: "text-blue-400" },
      { href: "/people/clients", label: "People", Icon: Users, color: "text-purple-400" },
      { href: "/learning", label: "Learning", Icon: BookOpen, color: "text-emerald-400" },
      { href: "/intelligence-hub", label: "Intelligence", Icon: TrendingUp, color: "text-amber-400" },
      { href: "/financial-twin", label: "Financial Twin", Icon: Target, color: "text-cyan-400" },
      { href: "/products", label: "Products", Icon: Layers, color: "text-pink-400" },
    ];
    if (userRole === "admin") {
      all.push(
        { href: "/admin", label: "Admin", Icon: Shield, color: "text-red-400" },
      );
    }
    all.push(
      { href: "/settings/profile", label: "Settings", Icon: Settings, color: "text-muted-foreground" },
      { href: "/help", label: "Help", Icon: HelpCircle, color: "text-muted-foreground" },
    );
    return all;
  }, [userRole]);

  const handleClick = (href: string) => {
    if (onNavigate) {
      onNavigate(href);
    } else {
      navigate(href);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-2 rounded-md text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          title="Apps & Engines"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" className="w-56 max-h-80 overflow-y-auto">
        {items.map((item, i) => (
          <DropdownMenuItem
            key={item.href}
            onClick={() => handleClick(item.href)}
            className={cn(
              "flex items-center gap-2 cursor-pointer",
              location === item.href && "bg-accent"
            )}
          >
            <item.Icon className={cn("w-4 h-4", item.color)} />
            <span>{item.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
