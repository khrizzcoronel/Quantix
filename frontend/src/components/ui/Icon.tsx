interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | string;
  fill?: boolean | number;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  fill = false,
  className = '',
  style,
  ...props
}) => {
  const sizeClasses: Record<string, string> = {
    xs: 'text-[14px]',
    sm: 'text-[16px]',
    md: 'text-[20px]',
    lg: 'text-[24px]',
    xl: 'text-[28px]',
    '2xl': 'text-[32px]',
    '3xl': 'text-[40px]',
  };

  const resolvedSizeClass = sizeClasses[size] || (size.startsWith('text-') ? size : `text-[${size}]`);

  return (
    <span
      className={`material-symbols-outlined select-none inline-flex items-center justify-center leading-none ${resolvedSizeClass} ${className}`}
      style={{
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
        ...style,
      }}
      {...props}
    >
      {name}
    </span>
  );
};

export default Icon;
