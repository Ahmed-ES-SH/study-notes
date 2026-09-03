import React from "react";

export type BadgeVariant =
  | "default"
  | "primary"
  | "secondary"
  | "tertiary"
  | "outline"
  | "custom";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  color?: string;
  dot?: boolean;
  size?: "sm" | "md";
}

export function Badge({
  children,
  variant = "default",
  color,
  dot = false,
  size = "md",
  className = "",
  style,
  ...props
}: BadgeProps) {
  const sizeStyles = {
    sm: "h-5 px-1.5 text-[11px]",
    md: "h-6 px-2 text-xs",
  }[size];

  const variantStyles = {
    default: "bg-surface-container-high text-on-surface-variant border border-outline-variant/40",
    primary: "bg-primary-container/20 text-primary-container border border-primary-container/40",
    secondary: "bg-secondary-container/20 text-secondary border border-secondary-container/40",
    tertiary: "bg-tertiary-container/20 text-tertiary border border-tertiary-container/40",
    outline: "bg-transparent text-outline border border-outline-variant",
    custom: "border",
  }[variant];

  const customStyle: React.CSSProperties = {
    ...style,
    ...(color && variant === "custom"
      ? {
          backgroundColor: `${color}15`,
          color: color,
          borderColor: `${color}40`,
        }
      : {}),
  };

  return (
    <span
      style={customStyle}
      className={`inline-flex items-center gap-1.5 font-mono font-medium rounded ${sizeStyles} ${variantStyles} select-none ${className}`}
      {...props}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: color || "currentColor" }}
        />
      )}
      <span>{children}</span>
    </span>
  );
}
