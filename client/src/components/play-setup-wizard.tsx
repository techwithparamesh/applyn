import { useMemo, useState, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, ExternalLink, RefreshCw } from "lucide-react";

type PlayStatus = {
  connected: boolean;
  connectedAt: string | null;
};

type PlayValidate = {
  ok: boolean;
  scopes?: string[];
  message?: string;
  details?: string;
};

async function fetchPlayStatus(): Promise<PlayStatus> {
  const res = await fetch("/api/auth/google/play/status", { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load Play status (${res.status})`);
  return res.json();
}

async function fetchPlayValidate(): Promise<PlayValidate> {
  const res = await fetch("/api/auth/google/play/validate", { credentials: "include" });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, message: data?.message || `Validate failed (${res.status})`, details: data?.details };
  }
  return data;
}

function StepRow(props: { title: string; description: string; done: boolean; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex items-start gap-3">
        {props.done ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground mt-0.5" />
        )}
        <div>
          <div className="font-medium text-white">{props.title}</div>
          <div className="text-sm text-muted-foreground">{props.description}</div>
        </div>
      </div>
      {props.action ? <div className="shrink-0">{props.action}</div> : null}
    </div>
  );
}

export function PlaySetupWizard(props: { appId: string }) {
  const [manualDone, setManualDone] = useState<{ s1: boolean; s2: boolean; s3: boolean }>({
    s1: false,
    s2: false,
    s3: false,
  });

  const statusQuery = useQuery({
    queryKey: ["play-status"],
    queryFn: fetchPlayStatus,
  });

  const validateQuery = useQuery({
    queryKey: ["play-validate"],
    queryFn: fetchPlayValidate,
    enabled: false,
  });

  const connected = !!statusQuery.data?.connected;
  const validated = !!validateQuery.data?.ok;

  const steps = useMemo(
    () => [
      { id: "s1", title: "Step 1: Create Play Developer Account", done: manualDone.s1 },
      { id: "s2", title: "Step 2: Create Google Cloud Project", done: manualDone.s2 },
      { id: "s3", title: "Step 3: Enable Android Publisher API", done: manualDone.s3 },
      { id: "s4", title: "Step 4: Connect via OAuth", done: connected },
      { id: "s5", title: "Step 5: Verify Connection", done: validated },
    ],
    [manualDone, connected, validated],
  );

  const completed = steps.filter((s) => s.done).length;
  const percent = Math.round((completed / steps.length) * 100);

  const connectUrl = `/auth/google/play?returnTo=${encodeURIComponent(`/apps/${props.appId}/publish`)}`;

  return (
    <Card className="border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between gap-2">
          <span>Play Setup Wizard</span>
          {connected ? <Badge className="bg-emerald-500/20 text-emerald-200">Connected</Badge> : <Badge variant="secondary">Not connected</Badge>}
        </CardTitle>
        <CardDescription>
          Connect your Google Play Developer account so we can publish using the Android Publisher API.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">Progress</div>
            <div className="text-sm text-muted-foreground">{percent}%</div>
          </div>
          <Progress value={percent} />
        </div>

        <StepRow
          title="Step 1: Create Play Developer Account"
          description="Enroll in Google Play Console (one-time)."
          done={manualDone.s1}
          action={
            <Button
              variant={manualDone.s1 ? "secondary" : "outline"}
              className="border-white/10"
              onClick={() => setManualDone((p) => ({ ...p, s1: !p.s1 }))}
            >
              {manualDone.s1 ? "Mark incomplete" : "Mark complete"}
            </Button>
          }
        />

        <StepRow
          title="Step 2: Create Google Cloud Project"
          description="Use the same org as Play Console if possible."
          done={manualDone.s2}
          action={
            <Button
              variant={manualDone.s2 ? "secondary" : "outline"}
              className="border-white/10"
              onClick={() => setManualDone((p) => ({ ...p, s2: !p.s2 }))}
            >
              {manualDone.s2 ? "Mark incomplete" : "Mark complete"}
            </Button>
          }
        />

        <StepRow
          title="Step 3: Enable Android Publisher API"
          description="Enable in Google Cloud → APIs & Services."
          done={manualDone.s3}
          action={
            <Button
              variant={manualDone.s3 ? "secondary" : "outline"}
              className="border-white/10"
              onClick={() => setManualDone((p) => ({ ...p, s3: !p.s3 }))}
            >
              {manualDone.s3 ? "Mark incomplete" : "Mark complete"}
            </Button>
          }
        />

        <StepRow
          title="Step 4: Connect via OAuth"
          description="Authorize AndroidPublisher access (refresh token stored encrypted)."
          done={connected}
          action={
            <div className="flex gap-2">
              <Button variant="outline" className="border-white/10" asChild>
                <a href={connectUrl}>
                  Connect <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button
                variant="outline"
                className="border-white/10"
                onClick={() => void statusQuery.refetch()}
                disabled={statusQuery.isFetching}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          }
        />

        <StepRow
          title="Step 5: Verify Connection"
          description="Checks token scope includes androidpublisher."
          done={validated}
          action={
            <Button
              variant="outline"
              className="border-white/10"
              onClick={() => void validateQuery.refetch()}
              disabled={!connected || validateQuery.isFetching}
            >
              {validateQuery.isFetching ? "Verifying…" : "Verify"}
            </Button>
          }
        />

        {validateQuery.data && !validateQuery.data.ok ? (
          <div className="mt-3 text-sm text-red-300">
            {validateQuery.data.message || "Validation failed"}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
