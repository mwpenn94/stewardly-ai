/**
 * FormFieldError — inline validation error display for form fields.
 * Shows a red error message below the field with an icon.
 *
 * Pass 68 — C6 Error Handling improvement.
 *
 * Usage:
 *   <Input ... />
 *   <FormFieldError error={errors.email} />
 */
import { AlertCircle } from "lucide-react";

interface FormFieldErrorProps {
  /** Error message to display. If falsy, renders nothing. */
  error?: string | null;
  /** Optional id for aria-describedby linkage */
  id?: string;
}

export function FormFieldError({ error, id }: FormFieldErrorProps) {
  if (!error) return null;

  return (
    <p
      id={id}
      role="alert"
      className="flex items-center gap-1 mt-1 text-xs text-destructive"
    >
      <AlertCircle className="h-3 w-3 shrink-0" />
      {error}
    </p>
  );
}

export default FormFieldError;
