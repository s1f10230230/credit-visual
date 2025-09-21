import { ReactNode } from 'react';

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverScale?: boolean;
  fadeIn?: boolean;
  delay?: number;
}

export function AnimatedCard({ 
  children, 
  className = '', 
  onClick, 
  hoverScale = true,
  fadeIn = true,
  delay = 0
}: AnimatedCardProps) {
  const baseClasses = 'card transition-all duration-300';
  const hoverClasses = hoverScale ? 'hover:scale-[1.02] hover:shadow-lg' : '';
  const clickClasses = onClick ? 'cursor-pointer active:scale-[0.98]' : '';
  const fadeClasses = fadeIn ? 'animate-fade-in' : '';
  
  const style = delay > 0 ? { animationDelay: `${delay}ms` } : {};

  return (
    <div 
      className={`${baseClasses} ${hoverClasses} ${clickClasses} ${fadeClasses} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}

export function AnimatedButton({ 
  children, 
  className = '', 
  onClick,
  loading = false,
  ...props 
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  loading?: boolean;
  [key: string]: any;
}) {
  return (
    <button 
      className={`btn transition-all duration-200 hover:scale-105 active:scale-95 ${loading ? 'animate-pulse' : ''} ${className}`}
      onClick={onClick}
      disabled={loading}
      {...props}
    >
      {loading ? (
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
          <span>処理中...</span>
        </div>
      ) : children}
    </button>
  );
}

export function FadeInUp({ 
  children, 
  delay = 0,
  duration = 500 
}: { 
  children: ReactNode; 
  delay?: number;
  duration?: number;
}) {
  const style = {
    animationDelay: `${delay}ms`,
    animationDuration: `${duration}ms`
  };

  return (
    <div 
      className="animate-fade-in-up opacity-0"
      style={style}
    >
      {children}
    </div>
  );
}

export function SlideInLeft({ 
  children, 
  delay = 0 
}: { 
  children: ReactNode; 
  delay?: number;
}) {
  const style = delay > 0 ? { animationDelay: `${delay}ms` } : {};

  return (
    <div 
      className="animate-slide-in-left"
      style={style}
    >
      {children}
    </div>
  );
}