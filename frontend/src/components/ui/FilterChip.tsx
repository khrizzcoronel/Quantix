interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number | string;
  colorDot?: string;
  icon?: string;
  className?: string;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  active,
  onClick,
  count,
  colorDot,
  icon,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 px-4 rounded-full font-title-md text-body-sm flex items-center gap-2 transition-transform active:scale-95 shrink-0 select-none ${
        active
          ? 'bg-on-surface text-surface shadow-sm font-semibold'
          : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
      } ${className}`}
    >
      {colorDot && <span className={`w-2 h-2 rounded-full ${colorDot}`} />}
      {icon && <span className="material-symbols-outlined text-[16px]">{icon}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`px-2 py-0.5 rounded-full font-label-caps text-label-caps font-bold ${
            active
              ? 'bg-surface/20 text-surface'
              : 'bg-surface-container-highest text-on-surface'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};

export default FilterChip;
