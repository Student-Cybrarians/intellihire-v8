import { FC } from 'react';

interface ButtonProps {
  variant: 'contained' | 'outlined';
  color: 'primary' | 'secondary' | 'success' | 'danger';
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const colorStyles: Record<ButtonProps['color'], string> = {
  primary: '#1976d2',
  secondary: '#607d8b',
  success: '#4caf50',
  danger: '#f44336',
};

export const Button: FC<ButtonProps> = ({
  variant,
  color,
  disabled,
  onClick,
  children,
}) => {
  const classNames = [
    'px-4 py-2 rounded-md font-medium text-sm',
    ...(variant === 'contained' ? ['hover:bg-blue-600'] : ['hover:bg-gray-200']),
    ...(variant === 'outlined' ? ['hover:border-blue-600'] : []),
    ...(color === 'primary'
      ? ['hover:bg-blue-600']
      : color === 'secondary'
        ? ['hover:bg-gray-300']
        : color === 'success'
          ? ['hover:bg-green-600']
          : ['hover:bg-red-600']),
    ...(disabled ? ['opacity-50 cursor-not-allowed'] : []),
  ].join(' ');

  const style = {
    backgroundColor: variant === 'outlined' ? 'transparent' : colorStyles[color],
    color: variant === 'outlined' ? colorStyles[color] : '#fff',
    border: variant === 'outlined' ? `1px solid ${colorStyles[color]}` : 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };

  return (
    <button
      className={classNames}
      disabled={disabled}
      onClick={onClick}
      style={style}
      type="button"
    >
      {children}
    </button>
  );
};
