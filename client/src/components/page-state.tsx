import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function PageState({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-white/[0.06] bg-[#0d1117] rounded-2xl", className)}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {icon ? (
            <div className="h-12 w-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <div className="text-base font-semibold text-white">{title}</div>
            {description ? (
              <div className="text-sm text-muted-foreground mt-1">{description}</div>
            ) : null}
            {children ? <div className="mt-4 flex flex-wrap gap-2">{children}</div> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PageLoading({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-muted-foreground", className)}>
      <div className="h-5 w-5 border-2 border-cyan-500/60 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
