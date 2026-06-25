import { cn } from "@/lib/utils";

interface SkeletonLoaderProps {
  className?: string;
  count?: number;
}

export function SkeletonLoader({ className, count = 1 }: SkeletonLoaderProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800",
            className
          )}
        />
      ))}
    </>
  );
}
