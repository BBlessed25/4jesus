import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory-100 disabled:pointer-events-none disabled:bg-neutral-200 disabled:text-neutral-700",
  {
    variants: {
      variant: {
        primary: "bg-forest-800 text-ivory-50 shadow-md hover:bg-forest-700 active:bg-forest-900",
        secondary:
          "border border-gold-500 bg-ivory-100 text-forest-900 hover:bg-gold-100 active:bg-ivory-200",
        outline:
          "border-2 border-gold-600 bg-transparent text-forest-900 hover:bg-gold-100 active:bg-ivory-200",
        ghost: "text-forest-800 hover:bg-ivory-200 active:bg-gold-100",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

/**
 * @param {{
 *   className?: string,
 *   variant?: "primary" | "secondary" | "outline" | "ghost",
 *   size?: "sm" | "md" | "lg",
 *   [key: string]: any
 * }} props
 */
export function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
