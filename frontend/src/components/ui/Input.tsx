import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-3 py-2 bg-white border rounded-md text-sm text-gray-900 placeholder-gray-400 
            transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500
            ${error ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : 'border-gray-200 hover:border-gray-300'}
            disabled:bg-gray-50 disabled:text-gray-500 ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
