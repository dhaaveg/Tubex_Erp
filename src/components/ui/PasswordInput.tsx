'use client';

import React, { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  leftIcon?: React.ReactNode;
  containerClassName?: string;
  defaultVisible?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className = '',
      containerClassName = '',
      leftIcon,
      defaultVisible = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(defaultVisible);

    return (
      <div className={`relative rounded-lg shadow-sm ${containerClassName}`}>
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          disabled={disabled}
          className={`block w-full py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
            leftIcon ? 'pl-9' : 'pl-3'
          } pr-10 ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          disabled={disabled}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 focus:text-slate-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4 text-slate-400 hover:text-slate-200" aria-hidden="true" />
          ) : (
            <Eye className="w-4 h-4 text-slate-400 hover:text-slate-200" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
