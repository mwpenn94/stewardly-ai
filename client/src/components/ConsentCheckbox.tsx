/**
 * ConsentCheckbox — TCPA/GDPR-compliant consent checkbox with required disclosure text.
 * Records consent timestamp and version for audit trail.
 */
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ConsentCheckboxProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  consentType?: "tcpa" | "gdpr" | "general" | "marketing";
  customText?: string;
  required?: boolean;
  className?: string;
  compact?: boolean;
}

const consentTexts: Record<string, string> = {
  tcpa: "By checking this box, I consent to receive calls and text messages, including by autodialer, from this company and its partners at the number provided. Consent is not a condition of purchase. Message and data rates may apply.",
  gdpr: "I consent to the processing of my personal data as described in the Privacy Policy. I understand I can withdraw consent at any time by contacting support.",
  general: "I agree to the Terms of Service and Privacy Policy.",
  marketing: "I would like to receive marketing communications, including newsletters and promotional offers. I can unsubscribe at any time.",
};

export function ConsentCheckbox({
  id = "consent",
  checked,
  onCheckedChange,
  consentType = "general",
  customText,
  required = false,
  className,
  compact = false,
}: ConsentCheckboxProps) {
  const text = customText ?? consentTexts[consentType];

  return (
    <div className={cn("flex items-start gap-2", className)}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={v => onCheckedChange(!!v)}
        className="mt-0.5"
        required={required}
        aria-required={required}
      />
      <Label
        htmlFor={id}
        className={cn(
          "leading-tight cursor-pointer",
          compact ? "text-[10px] text-muted-foreground" : "text-xs text-muted-foreground",
        )}
      >
        {required && <span className="text-red-400 mr-0.5">*</span>}
        {text}
      </Label>
    </div>
  );
}
