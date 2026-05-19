import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger-ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** icon-only 정사각형 */
  iconOnly?: boolean;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "btn btn-primary",
  secondary: "btn",
  ghost: "btn btn-ghost",
  "danger-ghost": "btn btn-danger-ghost",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "btn--sm",
  md: "",
  lg: "btn--lg",
};

export function Button({
  variant = "secondary",
  size = "md",
  iconOnly = false,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  const cls = [
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    iconOnly ? "btn--icon" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button type={type} className={cls} {...rest} />;
}
