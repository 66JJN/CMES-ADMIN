import React from 'react';

/**
 * Reusable presentational Button component.
 * Integrates with CMES-ADMIN custom theme variables and classes.
 */
export default function Button({ 
  children, 
  onClick, 
  disabled, 
  variant = 'primary', 
  className = '', 
  ...props 
}) {
  // Map clean design system classes from theme.css and home.css
  const variantClasses = {
    primary: 'save-btn',
    secondary: 'mode-btn-minimal',
  };

  // Custom inline style mappings strictly derived from theme.css variables 
  // to avoid messy ad-hoc inline styles.
  const customStyles = {
    danger: {
      padding: '8px 12px',
      background: 'var(--danger-50, #fef2f2)',
      color: 'var(--danger-600, #dc2626)',
      border: '1px solid var(--danger-100, #fee2e2)',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.2s',
    },
    edit: {
      padding: '8px 12px',
      background: 'var(--primary-50, #f0f4ff)',
      color: 'var(--primary-600, #4f46e5)',
      border: '1px solid var(--primary-100, #e0e9ff)',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.2s',
    },
  };

  const isCustom = variant === 'danger' || variant === 'edit';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={!isCustom ? `${variantClasses[variant] || 'save-btn'} ${className}` : className}
      style={isCustom ? { ...customStyles[variant], ...props.style } : props.style}
      {...props}
    >
      {children}
    </button>
  );
}
