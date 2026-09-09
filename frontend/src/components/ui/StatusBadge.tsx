export type StatusVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'tertiary'
  | 'strategic';

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  dot?: boolean;
  pulse?: boolean;
  icon?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  dot = true,
  pulse = false,
  icon,
  className = '',
}) => {
  const variantStyles: Record<StatusVariant, { bg: string; text: string; dotColor: string }> = {
    success: {
      bg: 'bg-primary-fixed/30',
      text: 'text-on-primary-fixed-variant',
      dotColor: 'bg-primary',
    },
    warning: {
      bg: 'bg-amber-100',
      text: 'text-amber-800',
      dotColor: 'bg-amber-500',
    },
    error: {
      bg: 'bg-error-container',
      text: 'text-on-error-container',
      dotColor: 'bg-error',
    },
    info: {
      bg: 'bg-secondary-fixed',
      text: 'text-on-secondary-fixed-variant',
      dotColor: 'bg-secondary',
    },
    neutral: {
      bg: 'bg-surface-container',
      text: 'text-on-surface-variant',
      dotColor: 'bg-outline',
    },
    tertiary: {
      bg: 'bg-tertiary-fixed',
      text: 'text-on-tertiary-fixed',
      dotColor: 'bg-tertiary',
    },
    strategic: {
      bg: 'bg-tertiary-fixed',
      text: 'text-on-tertiary-fixed',
      dotColor: 'bg-tertiary',
    },
  };

  const current = variantStyles[variant] || variantStyles.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-caps text-label-caps font-bold uppercase tracking-wider ${current.bg} ${current.text} ${className}`}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${current.dotColor}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${current.dotColor}`} />
        </span>
      )}
      {icon && <span className="material-symbols-outlined text-[14px]">{icon}</span>}
      <span>{label}</span>
    </span>
  );
};

export default StatusBadge;
