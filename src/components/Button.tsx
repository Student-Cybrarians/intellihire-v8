import { FC } from 'react';

interface ButtonProps {
  variant: 'contained' | 'outlined';
  color: 'primary' | 'secondary' | 'success' | 'danger';
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonProps['variant'], string> = {
  contained: 'background-color: #1976d2; color: white;',
  outlined: 'border: 1px solid #1976d2; color: #1976d2;',
};

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
    ...(color === 'primary' ? ['hover:bg-blue-600'] : color === 'secondary' ? ['hover:bg-gray-300'] : ''),
    ...(disabled ? ['opacity-50 cursor-not-allowed'] : []),
  ].join(' ');

  const style = {
    backgroundColor: colorStyles[color],
    color: '#fff',
    ...(variant === 'contained' && {
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
    }),
    ...(variant === 'outlined' && {
      border: '1px solid currentColor',
      color: 'currentColor',
    }),
  };

  return (
    <button
      className={classNames}
      disabled={disabled}
      onClick={onClick}
      style={style}
    >
      {children}
    </button>
  );
};
