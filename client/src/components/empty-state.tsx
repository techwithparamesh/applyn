import type React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

export function EmptyState({ icon: Icon, title, description, className, children }: EmptyStateProps) {
  return (
    <div className={cn("text-center p-12 md:p-16", className)}>
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06]">
        <Icon className="h-7 w-7 text-slate-400" aria-hidden="true" />
      </div>
      <div className="text-lg font-semibold text-white tracking-tight">{title}</div>
      {description ? (
        <div className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">{description}</div>
      ) : null}
      {children ? <div className="mt-7">{children}</div> : null}
    </div>
  );
}
