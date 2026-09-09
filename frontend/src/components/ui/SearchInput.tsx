import Icon from './Icon';

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hotkey?: string;
  onClear?: () => void;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  hotkey,
  onClear,
  className = '',
  value,
  ...props
}) => {
  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <div className="absolute left-4 flex items-center pointer-events-none text-primary">
        <Icon name="search" size="md" />
      </div>
      <input
        type="text"
        value={value}
        className="w-full pl-12 pr-28 py-3 bg-surface-container-low rounded-full font-body-md text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:bg-surface-container-lowest focus:shadow-md transition-all duration-200"
        {...props}
      />
      <div className="absolute right-3 flex items-center gap-1.5">
        {Boolean(value) && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <Icon name="close" size="xs" />
          </button>
        )}
        {hotkey && (
          <kbd className="px-2.5 py-1 bg-surface-container-highest text-on-surface font-label-caps text-label-caps rounded-full shadow-xs uppercase">
            {hotkey}
          </kbd>
        )}
      </div>
    </div>
  );
};

export default SearchInput;
