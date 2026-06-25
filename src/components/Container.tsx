import { cn } from "@/lib/utils";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-md px-4 sm:max-w-lg sm:px-6 md:max-w-2xl lg:max-w-4xl",
        className
      )}
    >
      {children}
    </div>
  );
}
