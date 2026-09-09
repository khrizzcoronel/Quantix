export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
  icon?: string;
  badge?: string | number;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`flex items-center gap-1 p-1 bg-surface-container-low rounded-full overflow-x-auto ${className}`}
    >
      {options.map((opt) => {
        const isActive = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`flex items-center gap-1.5 rounded-full font-title-md transition-all whitespace-nowrap ${
              size === 'sm' ? 'px-3 py-1 text-body-sm' : 'px-4 py-1.5 text-body-md'
            } ${
              isActive
                ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            {opt.icon && (
              <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
            )}
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={`px-1.5 py-0.2 rounded-full font-label-caps text-[10px] ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-bold'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
