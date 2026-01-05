import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = "", hoverEffect = false, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`
        bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-white/50 dark:border-white/5 shadow-sm rounded-2xl
        transition-all duration-300
        ${hoverEffect ? 'hover:shadow-lg hover:-translate-y-1 hover:bg-white/80 dark:hover:bg-slate-800/80 cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};