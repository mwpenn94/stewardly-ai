/**
 * TypingIndicator.tsx — Contextual AI thinking status
 */
import { motion } from "framer-motion";
import { Brain, Shield, Calculator } from "lucide-react";

const FOCUS_ICONS: Record<string, any> = {
  financial: Calculator, insurance: Shield, estate: Shield,
  "premium-finance": Calculator, general: Brain,
};

interface Props {
  status?: string;
  focusMode?: string;
}

export default function TypingIndicator({ status, focusMode }: Props) {
  const Icon = FOCUS_ICONS[focusMode ?? "general"] ?? Brain;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }} className="flex items-center gap-2.5 px-4 py-2.5 max-w-xs">
      <div className="relative flex items-center justify-center w-6 h-6">
        <motion.div className="absolute inset-0 rounded-full bg-primary/20"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
        <Icon className="w-3.5 h-3.5 text-primary relative z-10" />
      </div>
      <span className="text-sm text-muted-foreground">{status ?? "Steward is thinking…"}</span>
    </motion.div>
  );
}
