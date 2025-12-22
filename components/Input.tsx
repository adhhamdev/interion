import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-2 w-full group">
      {label && (
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1 group-focus-within:text-indigo-400 transition-colors">
          {label}
        </label>
      )}
      <input 
        className={`
          w-full bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 text-zinc-100 
          rounded-xl px-4 py-3 text-sm transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 focus:bg-zinc-950
          placeholder-zinc-600
          ${className}
        `}
        {...props}
      />
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-2 w-full group">
      {label && (
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1 group-focus-within:text-indigo-400 transition-colors">
          {label}
        </label>
      )}
      <textarea 
        className={`
          w-full bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 text-zinc-100 
          rounded-xl px-4 py-3 text-sm transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 focus:bg-zinc-950
          placeholder-zinc-600 resize-none
          ${className}
        `}
        {...props}
      />
    </div>
  );
};