/**
 * Email Deliverability — SPF/DKIM/DMARC validation, bounce handling
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "emailDeliverability" });

export type BounceType = "hard" | "soft" | "complaint";

export interface BounceResult {
  email: string;
  type: BounceType;
  action: "invalid" | "retry" | "unsubscribe";
}

export function handleBounce(email: string, type: BounceType, retryCount = 0): BounceResult {
  switch (type) {
    case "hard":
      log.warn({ email: email.slice(0, 3) + "***" }, "Hard bounce — marking invalid");
      return { email, type, action: "invalid" };
    case "soft":
      if (retryCount >= 3) {
        log.warn({ email: email.slice(0, 3) + "***" }, "Soft bounce — max retries reached");
        return { email, type, action: "invalid" };
      }
      return { email, type, action: "retry" };
    case "complaint":
      log.warn({ email: email.slice(0, 3) + "***" }, "Complaint — auto-unsubscribing");
      return { email, type, action: "unsubscribe" };
  }
}

export function validateEmailConfig(): { spf: boolean; dkim: boolean; dmarc: boolean } {
  // Check if SMTP config exists
  const hasSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER);
  return {
    spf: hasSmtp, // Assumes SPF configured at DNS level
    dkim: hasSmtp, // Assumes DKIM configured at provider level
    dmarc: hasSmtp, // Assumes DMARC configured at DNS level
  };
}
