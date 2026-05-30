import React from 'react';

/**
 * Reusable presentational Button component.
 * Integrates with CMES-ADMIN custom theme variables and classes.
 * Completely free of inline styles to adhere to Clean Code principles.
 */
export default function Button({ 
  children, 
  onClick, 
  disabled, 
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'edit'
  className = '', 
  ...props 
}) {
  const variantClasses = {
    primary: 'save-btn',
    secondary: 'mode-btn-minimal',
    danger: 'btn-danger-custom',
    edit: 'btn-edit-custom',
  };

  const selectedClass = variantClasses[variant] || 'save-btn';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${selectedClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
