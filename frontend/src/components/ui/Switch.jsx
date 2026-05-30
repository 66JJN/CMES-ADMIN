import React from 'react';

/**
 * Reusable presentational Switch component.
 * Fully controlled by checked, onChange, and disabled props.
 * Strictly style-driven without embedded business logic.
 */
export default function Switch({ 
  checked, 
  onChange, 
  disabled, 
  className = '', 
  ...props 
}) {
  return (
    <div 
      className={`switch-minimal ${checked ? "on" : "off"} ${disabled ? "disabled" : ""} ${className}`} 
      onClick={() => !disabled && onChange && onChange(!checked)}
      {...props}
    >
      <div className="switch-dot"></div>
    </div>
  );
}
