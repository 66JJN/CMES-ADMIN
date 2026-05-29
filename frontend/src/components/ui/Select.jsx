import React from 'react';

/**
 * Reusable Select Dropdown UI component.
 * Integrates clean styling for filters and date-preset selectors.
 */
export default function Select({ 
  value, 
  onChange, 
  options = [], 
  className = '', 
  ...props 
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`income-date-input ${className}`}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled} hidden={opt.hidden}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
