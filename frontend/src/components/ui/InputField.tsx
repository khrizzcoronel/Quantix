import React, { forwardRef } from 'react';

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string | null;
  icon?: string; // Material Symbol icon name
  rightIcon?: React.ReactNode;
}

const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ error, icon, rightIcon, className = '', id, ...props }, ref) => {
    const hasError = Boolean(error);

    return (
      <div className="relative w-full flex items-center">
        {icon && (
          <span className="material-symbols-outlined absolute left-3.5 text-[18px] text-on-surface-variant/70 pointer-events-none select-none">
            {icon}
          </span>
        )}

        <input
          ref={ref}
          id={id}
          aria-invalid={hasError}
          aria-describedby={hasError && id ? `${id}-error` : undefined}
          className={`w-full py-2.5 rounded-xl text-body-sm font-medium transition-all duration-150 outline-none
            ${icon ? 'pl-10' : 'pl-3.5'}
            ${rightIcon ? 'pr-10' : 'pr-3.5'}
            ${
              hasError
                ? 'bg-error-container/10 border-2 border-error text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-error/20 focus:border-error'
                : 'bg-surface-container-low border border-surface-container-high text-on-surface placeholder:text-on-surface-variant/60 hover:border-outline-variant/60 focus:bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/20'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3.5 flex items-center justify-center">
            {rightIcon}
          </div>
        )}
      </div>
    );
  }
);

InputField.displayName = 'InputField';

export default InputField;
