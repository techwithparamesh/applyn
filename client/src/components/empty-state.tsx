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
    <div className={cn("text-center p-12", className)}>
      <Icon className="h-10 w-10 text-slate-400 mx-auto mb-4" aria-hidden="true" />
      <div className="text-base font-semibold text-white">{title}</div>
      {description ? <div className="text-sm text-muted-foreground mt-1">{description}</div> : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
