import { Link } from "wouter";
import { Wand2, Eye, Download } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Step = "builder" | "preview" | "publish";

type Tone = "app" | "editor";

const STEP_META: Array<{ key: Step; label: string; icon: any; href: (appId: string) => string }> = [
  { key: "builder", label: "Builder", icon: Wand2, href: (id) => `/apps/${id}/visual-editor` },
  { key: "preview", label: "Preview", icon: Eye, href: (id) => `/apps/${id}/preview` },
  { key: "publish", label: "Publish", icon: Download, href: (id) => `/apps/${id}/publish` },
];

export function AppBuilderStepper({
  appId,
  current,
  tone = "app",
  className,
}: {
  appId: string;
  current: Step;
  tone?: Tone;
  className?: string;
}) {
  const baseButton =
    tone === "editor"
      ? "border-slate-800 bg-slate-950/40 text-slate-100 hover:bg-slate-800/50"
      : "border-white/[0.10] bg-white/[0.03] hover:bg-white/[0.06]";

  const activeButton =
    tone === "editor"
      ? "border-slate-700 bg-slate-800/70 text-white"
      : "bg-white/[0.06]";

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {STEP_META.map((s) => {
        const Icon = s.icon;
        const isActive = current === s.key;
        return (
          <Link key={s.key} href={s.href(appId)}>
            <Button
              asChild
              variant="outline"
              size="sm"
              className={cn("rounded-xl", baseButton, isActive && activeButton)}
            >
              <a aria-current={isActive ? "page" : undefined}>
                <Icon
                  className={cn(
                    "mr-2 h-4 w-4",
                    s.key === "builder" ? "text-cyan-300" : undefined
                  )}
                />
                {s.label}
              </a>
            </Button>
          </Link>
        );
      })}
    </div>
  );
}
