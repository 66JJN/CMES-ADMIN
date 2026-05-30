import React from 'react';

/**
 * Reusable presentational Card component.
 * Supports multi-layout panels (setting cards vs functions panels)
 * and binds Drag & Drop events seamlessly.
 */
export default function Card({ 
  children, 
  title, 
  type = 'setting', // 'setting' | 'panel'
  draggable, 
  onDragStart, 
  onDragEnd, 
  onDragOver, 
  onDrop,
  className = '',
  ...props 
}) {
  const layoutClasses = {
    setting: 'setting-card-minimal',
    panel: 'functions-panel',
  };

  const isDashboardCard = ['feature-card', 'package-settings-card', 'vip-card'].some(
    (token) => className.includes(token)
  );
  const baseClass = isDashboardCard ? '' : (layoutClasses[type] || 'setting-card-minimal');

  return (
    <div 
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`${baseClass} ${className}`.trim()}
      {...props}
    >
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
}
