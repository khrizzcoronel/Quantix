import Icon from './Icon';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: string;
  iconColor?: 'primary' | 'secondary' | 'tertiary' | 'error';
  delta?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  footer?: {
    label: string;
    value: string;
  };
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  icon,
  iconColor = 'primary',
  delta,
  footer,
  className = '',
}) => {
  const colorMap = {
    primary: {
      icon: 'text-primary',
      bg: 'bg-primary-fixed/20',
      blob: 'bg-primary/5',
    },
    secondary: {
      icon: 'text-secondary',
      bg: 'bg-secondary-fixed/50',
      blob: 'bg-secondary/5',
    },
    tertiary: {
      icon: 'text-tertiary',
      bg: 'bg-tertiary-fixed/40',
      blob: 'bg-tertiary/5',
    },
    error: {
      icon: 'text-error',
      bg: 'bg-error-container',
      blob: 'bg-error/5',
    },
  };

  const conf = colorMap[iconColor] || colorMap.primary;

  return (
    <div
      className={`p-6 rounded-3xl bg-surface-container-lowest shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all ${className}`}
    >
      <div
        className={`absolute -right-8 -top-8 w-32 h-32 rounded-full ${conf.blob} pointer-events-none group-hover:scale-125 transition-transform duration-500`}
      />

      <div className="flex items-center justify-between">
        <span className="font-label-caps text-label-caps uppercase text-outline tracking-wider font-bold">
          {title}
        </span>
        <span className={`p-2.5 rounded-2xl ${conf.bg} ${conf.icon} flex items-center justify-center`}>
          <Icon name={icon} size="lg" />
        </span>
      </div>

      <div className="mt-4 flex flex-col">
        <span className="font-label-numeric-lg text-headline-xl text-on-surface tracking-tight font-bold">
          {value}
        </span>
        {delta && (
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-label-numeric-md text-body-sm font-semibold ${
                delta.isPositive !== false
                  ? 'bg-primary-fixed text-on-primary-fixed-variant'
                  : 'bg-error-container text-on-error-container'
              }`}
            >
              <Icon
                name={delta.isPositive !== false ? 'trending_up' : 'trending_down'}
                size="xs"
              />
              {delta.value}
            </span>
            {delta.label && (
              <span className="text-body-sm text-outline font-normal">{delta.label}</span>
            )}
          </div>
        )}
      </div>

      {footer && (
        <div className="mt-4 pt-3 border-t border-surface-container-high/60 flex items-center justify-between text-body-sm">
          <span className="text-outline">{footer.label}</span>
          <span className="font-title-md text-on-surface font-semibold">{footer.value}</span>
        </div>
      )}
    </div>
  );
};

export default KpiCard;
