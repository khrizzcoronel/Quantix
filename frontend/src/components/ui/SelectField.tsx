import React, { forwardRef } from 'react';

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string | null;
  icon?: string; // Material Symbol icon name
}

const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ error, icon, className = '', id, children, ...props }, ref) => {
    const hasError = Boolean(error);

    return (
      <div className="relative w-full flex items-center">
        {icon && (
          <span className="material-symbols-outlined absolute left-3.5 text-[18px] text-on-surface-variant/70 pointer-events-none select-none z-10">
            {icon}
          </span>
        )}

        <select
          ref={ref}
          id={id}
          aria-invalid={hasError}
          aria-describedby={hasError && id ? `${id}-error` : undefined}
          className={`w-full py-2.5 pr-10 rounded-xl text-body-sm font-medium transition-all duration-150 outline-none appearance-none cursor-pointer
            ${icon ? 'pl-10' : 'pl-3.5'}
            ${
              hasError
                ? 'bg-error-container/10 border-2 border-error text-on-surface focus:ring-2 focus:ring-error/20 focus:border-error'
                : 'bg-surface-container-low border border-surface-container-high text-on-surface hover:border-outline-variant/60 focus:bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/20'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        >
          {children}
        </select>

        <span className="material-symbols-outlined absolute right-3 text-[18px] text-on-surface-variant/70 pointer-events-none select-none">
          expand_more
        </span>
      </div>
    );
  }
);

SelectField.displayName = 'SelectField';

export default SelectField;
