import React from 'react';

export interface FormFieldProps {
  label?: string;
  required?: boolean;
  error?: string | null;
  warning?: string | null;
  hint?: string;
  id?: string;
  className?: string;
  children: React.ReactNode;
}

export default function FormField({
  label,
  required = false,
  error,
  warning,
  hint,
  id,
  className = '',
  children,
}: FormFieldProps) {
  return (
    <div className={`flex flex-col space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={id}
            className="font-label-caps text-xs font-bold text-on-surface-variant flex items-center gap-1 uppercase tracking-wider"
          >
            <span>{label}</span>
            {required && (
              <span className="text-error font-bold" title="Campo obligatorio">
                *
              </span>
            )}
          </label>
        </div>
      )}

      {/* Input container */}
      <div className="relative w-full">
        {children}
      </div>

      {/* Error message */}
      {error ? (
        <div
          role="alert"
          id={id ? `${id}-error` : undefined}
          className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <span className="material-symbols-outlined text-[15px] shrink-0">error</span>
          <span className="leading-tight">{error}</span>
        </div>
      ) : warning ? (
        /* Warning message */
        <div
          role="status"
          className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <span className="material-symbols-outlined text-[15px] shrink-0">warning</span>
          <span className="leading-tight">{warning}</span>
        </div>
      ) : hint ? (
        /* Hint / Help text */
        <p className="text-on-surface-variant/70 text-[11px] leading-relaxed mt-0.5">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
