import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Wand2, AlertCircle, CheckCircle2, RefreshCw, Copy, Check } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface WebsiteAnalysis {
  appName: string;
  appDescription: string;
  primaryColor: string;
  isAppReady: boolean;
  issues: string[];
  suggestions: string[];
}

interface AppNameSuggestion {
  name: string;
  reason: string;
}

interface EnhancedDescription {
  enhanced: string;
  alternates: string[];
}

// Check if AI is available
export function useAIStatus() {
  return useQuery({
    queryKey: ["/api/ai/status"],
    queryFn: async () => {
      const res = await fetch("/api/ai/status");
      return res.json() as Promise<{ available: boolean }>;
    },
    staleTime: 60000,
  });
}

// Website Analyzer Component
interface WebsiteAnalyzerProps {
  url: string;
  onAnalysisComplete?: (analysis: WebsiteAnalysis) => void;
}

export function WebsiteAnalyzer({ url, onAnalysisComplete }: WebsiteAnalyzerProps) {
  const { toast } = useToast();
  const { data: aiStatus } = useAIStatus();

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/analyze-website", { url });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Analysis failed");
      }
      return res.json() as Promise<WebsiteAnalysis>;
    },
    onSuccess: (data) => {
      onAnalysisComplete?.(data);
    },
    onError: (err: Error) => {
      toast({
        title: "Analysis failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (!aiStatus?.available) return null;

  const isValidUrl = url.includes(".") && url.startsWith("http");

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => analyzeMutation.mutate()}
        disabled={!isValidUrl || analyzeMutation.isPending}
        className="gap-2 border-cyan-500/50 hover:border-cyan-500 hover:bg-cyan-500/10"
      >
        {analyzeMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 text-cyan-500" />
        )}
        {analyzeMutation.isPending ? "Analyzing..." : "AI Analyze Website"}
      </Button>

      {analyzeMutation.data && (
        <Card className="border-cyan-500/30 bg-cyan-500/5">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">AI Analysis</span>
              {analyzeMutation.data.isAppReady ? (
                <Badge variant="outline" className="border-green-500/50 text-green-500 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> App Ready
                </Badge>
              ) : (
                <Badge variant="outline" className="border-yellow-500/50 text-yellow-500 gap-1">
                  <AlertCircle className="h-3 w-3" /> Issues Found
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Suggested Name:</span>
                <p className="font-medium">{analyzeMutation.data.appName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Primary Color:</span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-4 w-4 rounded border"
                    style={{ backgroundColor: analyzeMutation.data.primaryColor }}
                  />
                  <span className="font-mono text-xs">{analyzeMutation.data.primaryColor}</span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-muted-foreground text-sm">Description:</span>
              <p className="text-sm">{analyzeMutation.data.appDescription}</p>
            </div>

            {analyzeMutation.data.issues.length > 0 && (
              <div>
                <span className="text-muted-foreground text-sm">Issues:</span>
                <ul className="text-sm list-disc list-inside text-yellow-500">
                  {analyzeMutation.data.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {analyzeMutation.data.suggestions.length > 0 && (
              <div>
                <span className="text-muted-foreground text-sm">Suggestions:</span>
                <ul className="text-sm list-disc list-inside text-muted-foreground">
                  {analyzeMutation.data.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// App Name Generator Component
interface AppNameGeneratorProps {
  websiteUrl: string;
  description?: string;
  onSelect?: (name: string) => void;
}

export function AppNameGenerator({ websiteUrl, description, onSelect }: AppNameGeneratorProps) {
  const { toast } = useToast();
  const { data: aiStatus } = useAIStatus();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/generate-names", {
        websiteUrl,
        description,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Generation failed");
      }
      return res.json() as Promise<{ suggestions: AppNameSuggestion[] }>;
    },
    onError: (err: Error) => {
      toast({
        title: "Generation failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (!aiStatus?.available) return null;

  const handleCopy = (name: string, index: number) => {
    navigator.clipboard.writeText(name);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => generateMutation.mutate()}
        disabled={generateMutation.isPending}
        className="gap-2 border-purple-500/50 hover:border-purple-500 hover:bg-purple-500/10"
      >
        {generateMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wand2 className="h-4 w-4 text-purple-500" />
        )}
        {generateMutation.isPending ? "Generating..." : "AI Suggest Names"}
      </Button>

      {generateMutation.data?.suggestions && (
        <div className="flex flex-wrap gap-2">
          {generateMutation.data.suggestions.map((s, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => {
                onSelect?.(s.name);
                handleCopy(s.name, i);
              }}
              className={cn(
                "gap-1.5 text-xs transition-all",
                copiedIndex === i && "border-green-500 bg-green-500/10"
              )}
              title={s.reason}
            >
              {copiedIndex === i ? <Check className="h-3 w-3 text-green-500" /> : <Sparkles className="h-3 w-3" />}
              {s.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// App Description Enhancer Component
interface DescriptionEnhancerProps {
  description: string;
  appName: string;
  onSelect?: (description: string) => void;
}

export function DescriptionEnhancer({ description, appName, onSelect }: DescriptionEnhancerProps) {
  const { toast } = useToast();
  const { data: aiStatus } = useAIStatus();
  const [selected, setSelected] = useState<string | null>(null);

  const enhanceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/enhance-description", {
        description,
        appName,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Enhancement failed");
      }
      return res.json() as Promise<EnhancedDescription>;
    },
    onError: (err: Error) => {
      toast({
        title: "Enhancement failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (!aiStatus?.available) return null;

  const handleSelect = (desc: string) => {
    setSelected(desc);
    onSelect?.(desc);
  };

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => enhanceMutation.mutate()}
        disabled={!description.trim() || enhanceMutation.isPending}
        className="gap-2 border-cyan-500/50 hover:border-cyan-500 hover:bg-cyan-500/10"
      >
        {enhanceMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 text-cyan-500" />
        )}
        {enhanceMutation.isPending ? "Enhancing..." : "AI Enhance"}
      </Button>

      {enhanceMutation.data && (
        <div className="space-y-2">
          <button
            onClick={() => handleSelect(enhanceMutation.data!.enhanced)}
            className={cn(
              "w-full text-left p-2 rounded border text-sm transition-all",
              selected === enhanceMutation.data.enhanced
                ? "border-cyan-500 bg-cyan-500/10"
                : "border-border hover:border-cyan-500/50"
            )}
          >
            <Badge className="mb-1 text-[10px]" variant="secondary">Recommended</Badge>
            <p>{enhanceMutation.data.enhanced}</p>
          </button>
          
          {enhanceMutation.data.alternates.map((alt, i) => (
            <button
              key={i}
              onClick={() => handleSelect(alt)}
              className={cn(
                "w-full text-left p-2 rounded border text-sm transition-all",
                selected === alt
                  ? "border-cyan-500 bg-cyan-500/10"
                  : "border-border hover:border-cyan-500/50"
              )}
            >
              <Badge className="mb-1 text-[10px]" variant="outline">
                {i === 0 ? "Professional" : "Casual"}
              </Badge>
              <p>{alt}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Push Notification Generator Component
interface NotificationGeneratorProps {
  appName: string;
  appDescription?: string;
  onSelect?: (title: string, body: string) => void;
}

export function NotificationGenerator({ appName, appDescription, onSelect }: NotificationGeneratorProps) {
  const { toast } = useToast();
  const { data: aiStatus } = useAIStatus();
  const [context, setContext] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/generate-notifications", {
        appName,
        appDescription,
        context: context || undefined,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Generation failed");
      }
      return res.json() as Promise<{
        suggestions: Array<{ title: string; body: string; purpose: string }>;
      }>;
    },
    onError: (err: Error) => {
      toast({
        title: "Generation failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (!aiStatus?.available) return null;

  const handleSelect = (title: string, body: string, index: number) => {
    setSelected(index);
    onSelect?.(title, body);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Optional: What's the notification for? (e.g., sale, new feature)"
          className="flex-1 text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="gap-2 border-purple-500/50 hover:border-purple-500 hover:bg-purple-500/10 whitespace-nowrap"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4 text-purple-500" />
          )}
          Generate Ideas
        </Button>
      </div>

      {generateMutation.data?.suggestions && (
        <div className="grid gap-2">
          {generateMutation.data.suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSelect(s.title, s.body, i)}
              className={cn(
                "w-full text-left p-3 rounded border transition-all",
                selected === i
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-border hover:border-purple-500/50"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{s.title}</span>
                <Badge variant="outline" className="text-[10px]">{s.purpose}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Build Error Analyzer Component  
interface BuildErrorAnalyzerProps {
  appId: string;
}

export function BuildErrorAnalyzer({ appId }: BuildErrorAnalyzerProps) {
  const { data: aiStatus } = useAIStatus();

  const analysisMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/ai/analyze-error/${appId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Analysis failed");
      }
      return res.json() as Promise<{
        summary: string;
        cause: string;
        solution: string;
        userAction: string;
        isUserFixable: boolean;
      }>;
    },
  });

  if (!aiStatus?.available) return null;

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => analysisMutation.mutate()}
        disabled={analysisMutation.isPending}
        className="gap-2 border-cyan-500/50 hover:border-cyan-500 hover:bg-cyan-500/10"
      >
        {analysisMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 text-cyan-500" />
        )}
        {analysisMutation.isPending ? "Analyzing..." : "AI Analyze Error"}
      </Button>

      {analysisMutation.data && (
        <Card className="border-cyan-500/30 bg-cyan-500/5">
          <CardContent className="pt-4 space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Summary:</span>
              <p className="font-medium">{analysisMutation.data.summary}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Likely Cause:</span>
              <p>{analysisMutation.data.cause}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Solution:</span>
              <p>{analysisMutation.data.solution}</p>
            </div>
            <div className={cn(
              "p-2 rounded",
              analysisMutation.data.isUserFixable ? "bg-green-500/10" : "bg-yellow-500/10"
            )}>
              <span className="font-medium">Next Step: </span>
              {analysisMutation.data.userAction}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
