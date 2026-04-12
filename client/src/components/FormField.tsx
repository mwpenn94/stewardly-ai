/**
 * FormField.tsx — Accessible form input wrapper
 *
 * Build Loop Pass 13 (G37). Before this helper, most forms in the
 * codebase rendered errors in an independent <p> sibling with no
 * programmatic link between the input and the error — screen readers
 * would announce the input's label, the user would start typing,
 * and the error would sit unreferenced in the DOM. WCAG 1.3.1 +
 * WCAG 3.3.1 want the error to be announced on input focus (and
 * re-announced when it changes).
 *
 * This component:
 *   1. Generates a stable id for the input + a parallel id for the
 *      error message
 *   2. Wires `aria-describedby` to the error id when there's an
 *      error, and to the description id when there's a description
 *   3. Adds `aria-invalid="true"` on error
 *   4. Uses `role="alert"` + `aria-live="polite"` on the error slot
 *      so screen readers announce the error message when it appears
 *
 * Usage:
 *   <FormField
 *     label="Email"
 *     description="We'll never share your email"
 *     error={errors.email?.message}
 *   >
 *     {(props) => <Input type="email" {...props} />}
 *   </FormField>
 *
 * The render-prop pattern lets the caller use whatever input
 * primitive they prefer (shadcn Input, plain <input>, textarea) while
 * the ids and aria-* attributes flow automatically.
 */

import { useId, type ReactNode, type InputHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormFieldProps {
  /** Visible label — rendered as <label htmlFor={inputId}>. */
  label: string;
  /** Optional descriptive helper text (linked via aria-describedby). */
  description?: string;
  /** Error message — linked via aria-describedby when present. */
  error?: string;
  /** Optional className for the wrapper. */
  className?: string;
  /** Required indicator — adds a red asterisk + aria-required on the input. */
  required?: boolean;
  /** Render prop receiving id + aria-* props + name for the label wiring. */
  children: (inputProps: {
    id: string;
    name?: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
    "aria-required": boolean | undefined;
  }) => ReactNode;
}

export function FormField({
  label,
  description,
  error,
  className,
  required,
  children,
}: FormFieldProps) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const descId = `${baseId}-desc`;
  const errId = `${baseId}-err`;

  const describedBy = [error ? errId : null, description ? descId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={inputId}
        className={cn(
          "block text-sm font-medium text-foreground",
          required && "after:content-['*'] after:ml-0.5 after:text-destructive",
        )}
      >
        {label}
      </label>

      {children({
        id: inputId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })}

      {description && !error && (
        <p id={descId} className="text-[11px] text-muted-foreground">
          {description}
        </p>
      )}

      {error && (
        <p
          id={errId}
          role="alert"
          aria-live="polite"
          className="flex items-center gap-1 text-[11px] text-destructive"
        >
          <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Convenience type for plain <input> usage — spread the FormField
 * render-prop result directly onto the input element.
 */
export type FormFieldInputProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "aria-describedby" | "aria-invalid" | "aria-required"
>;
