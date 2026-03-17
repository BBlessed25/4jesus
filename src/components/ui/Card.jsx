import { cn } from "../../lib/utils";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-amber-200/80 bg-amber-50/95 shadow-soft",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return (
    <div
      className={cn("border-b border-amber-200/80 px-6 py-4", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }) {
  return <div className={cn("p-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-t border-amber-200/80 px-6 py-4",
        className
      )}
      {...props}
    />
  );
}
