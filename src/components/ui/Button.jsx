import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-lg",
  {
    variants: {
      variant: {
        primary:
          "bg-amber-600 text-black hover:bg-amber-500 focus-visible:ring-amber-500 shadow-md",
        secondary:
          "bg-amber-100 text-black hover:bg-amber-200 focus-visible:ring-amber-400 border border-amber-200",
        outline:
          "border-2 border-amber-500 text-black hover:bg-amber-50 focus-visible:ring-amber-500 bg-white",
        ghost:
          "text-black hover:bg-amber-50 focus-visible:ring-amber-400",
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

export function Button({ className, variant, size, ...props }) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
