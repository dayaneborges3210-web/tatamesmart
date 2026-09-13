import { cn } from "@/lib/cn";

export function TatameLogo({
  title = "TATAMESMART",
  compact,
}: {
  title?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <img src="/logo.svg" alt="" className={cn("shrink-0", compact ? "size-8" : "size-12")} />
      <div className="min-w-0">
        {compact ? (
          <p className="truncate text-sm font-semibold tracking-tight">{title}</p>
        ) : (
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        )}
        {compact ? <p className="text-xs text-muted">TatameSmart</p> : null}
      </div>
    </div>
  );
}
