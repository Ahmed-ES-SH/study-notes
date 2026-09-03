import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="font-mono text-xs font-medium text-outline uppercase tracking-wider select-none flex items-center justify-between"
          >
            <span>{label}</span>
          </label>
        )}
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-outline">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full bg-surface-container-low border text-on-surface placeholder:text-outline text-sm rounded px-3 py-2 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
              leftIcon ? "pl-9" : ""
            } ${rightIcon ? "pr-9" : ""} ${
              error
                ? "border-error focus:border-error focus:ring-1 focus:ring-error"
                : "border-outline-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container"
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center text-outline">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <span className="font-mono text-xs text-error">{error}</span>}
        {!error && helperText && (
          <span className="font-mono text-xs text-outline">{helperText}</span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
