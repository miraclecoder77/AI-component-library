import { forwardRef } from "react";
import styles from "./Button.module.css";

type Variant = "solid" | "soft" | "outline" | "ghost";
type Size = "sm" | "md";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "solid", size = "md", className, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={[styles.button, styles[variant], styles[size], className]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
    );
  },
);
