import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  icon,
  className = '',
  disabled,
  ...props 
}) => {
  // Base styles: clear typography, rounded corners, transitions
  const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";
  
  const variants = {
    // Primary: Vibrant, main call to action
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-900/20 px-6 py-3 text-sm tracking-wide",
    // Secondary: Subtler, for secondary actions
    secondary: "bg-zinc-800/80 hover:bg-zinc-700 backdrop-blur-sm text-zinc-100 border border-white/5 rounded-xl px-4 py-2 text-xs font-medium",
    // Ghost: Minimal
    ghost: "bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg px-3 py-2",
    // Danger: Destructive
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl px-4 py-2",
    // Icon: Circular, centered
    icon: "bg-zinc-800/50 hover:bg-zinc-700 text-zinc-100 rounded-full p-3 border border-white/5 backdrop-blur-md"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <>
          {icon && <span className={children ? "mr-2" : ""}>{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};