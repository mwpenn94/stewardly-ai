/**
 * TypingIndicator.tsx — Manus-quality AI thinking status with shimmer dots
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex items-center gap-3 px-4 py-3 max-w-sm"
    >
      <div className="relative flex items-center justify-center w-7 h-7">
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/15"
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute inset-[3px] rounded-full bg-primary/10"
          animate={{ scale: [1.2, 1, 1.2] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        />
        <Icon className="w-3.5 h-3.5 text-primary relative z-10" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-foreground/80 font-medium">
          {status ?? "Steward is thinking\u2026"}
        </span>
        <div className="flex gap-1">
          <motion.span
            className="w-1 h-1 rounded-full bg-primary/60"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
          />
          <motion.span
            className="w-1 h-1 rounded-full bg-primary/60"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
          />
          <motion.span
            className="w-1 h-1 rounded-full bg-primary/60"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
          />
        </div>
      </div>
    </motion.div>
  );
}
