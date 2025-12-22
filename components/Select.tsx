import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-2 w-full group">
      {label && (
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1 group-focus-within:text-indigo-400 transition-colors">
          {label}
        </label>
      )}
      <div className="relative">
        <select 
          className={`
            appearance-none w-full bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 text-zinc-100 
            rounded-xl px-4 py-3 text-sm transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 focus:bg-zinc-950
            cursor-pointer pr-10
            ${className}
          `}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-100 py-2">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500 group-focus-within:text-indigo-400 transition-colors">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};