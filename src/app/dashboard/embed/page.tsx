"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Code,
  Copy,
  Check,
  Monitor,
  MessageSquare,
  Eye,
  Palette,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface EventType {
  id: string;
  title: string;
  slug: string;
  duration: number;
  color: string;
  isActive: boolean;
}

async function fetchEventTypes(): Promise<EventType[]> {
  const res = await fetch("/api/event-types");
  if (!res.ok) throw new Error("Failed to fetch event types");
  return res.json();
}

export default function EmbedPage() {
  const { data: session } = useSession();
  const username = (session?.user as Record<string, unknown>)?.username as string | undefined ?? session?.user?.id;

  const { data: eventTypes, isLoading } = useQuery({
    queryKey: ["eventTypes"],
    queryFn: fetchEventTypes,
  });

  const activeEventTypes = useMemo(
    () => eventTypes?.filter((et) => et.isActive) ?? [],
    [eventTypes]
  );

  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [embedType, setEmbedType] = useState<"inline" | "popup">("inline");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [hideHeader, setHideHeader] = useState(false);
  const [buttonText, setButtonText] = useState("Book Now");
  const [copied, setCopied] = useState(false);

  const selectedEvent = activeEventTypes.find((et) => et.id === selectedEventId);

  // Auto-select first event when loaded
  const firstId = activeEventTypes[0]?.id;
  if (firstId && !selectedEventId && !isLoading) {
    setSelectedEventId(firstId);
  }

  const embedUrl = useMemo(() => {
    if (!selectedEvent || !username) return "";
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams();
    if (hideHeader) params.set("hideHeader", "1");
    if (primaryColor !== "#6366f1") params.set("color", primaryColor.replace("#", ""));
    const qs = params.toString();
    return `${base}/embed/${username}/${selectedEvent.slug}${qs ? "?" + qs : ""}`;
  }, [selectedEvent, username, hideHeader, primaryColor]);

  const inlineCode = useMemo(() => {
    if (!embedUrl) return "";
    return `<iframe\n  src="${embedUrl}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  style="border: none; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"\n></iframe>`;
  }, [embedUrl]);

  const popupCode = useMemo(() => {
    if (!embedUrl) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `<script\n  src="${origin}/embed.js"\n  data-scheduleflow-url="${embedUrl}"\n  data-scheduleflow-color="${primaryColor}"\n  data-scheduleflow-text="${buttonText}"\n></script>`;
  }, [embedUrl, primaryColor, buttonText]);

  const currentCode = embedType === "inline" ? inlineCode : popupCode;

  function handleCopy() {
    if (!currentCode) return;
    navigator.clipboard.writeText(currentCode).then(() => {
      setCopied(true);
      toast.success("Embed code copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Embed Widget</h1>
        <p className="text-muted-foreground">
          Add a booking widget to your website in seconds
        </p>
      </div>

      <Separator />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Configuration panel */}
        <div className="space-y-5">
          {/* Event type selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Code className="size-4 text-indigo-500" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Event type */}
              <div className="space-y-2">
                <Label>Event Type</Label>
                {isLoading ? (
                  <Skeleton className="h-8 w-full" />
                ) : activeEventTypes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active event types. Create one first.
                  </p>
                ) : (
                  <Select
                    value={selectedEventId}
                    onValueChange={(v) => {
                      if (v !== null) setSelectedEventId(v);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an event type" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeEventTypes.map((et) => (
                        <SelectItem key={et.id} value={et.id}>
                          <span
                            className="inline-block size-2.5 rounded-full mr-2 shrink-0"
                            style={{ backgroundColor: et.color }}
                          />
                          {et.title}
                          <span className="ml-1.5 text-muted-foreground">
                            ({et.duration}m)
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Embed type */}
              <div className="space-y-2">
                <Label>Embed Type</Label>
                <Tabs
                  value={embedType}
                  onValueChange={(v) => setEmbedType(v as "inline" | "popup")}
                >
                  <TabsList>
                    <TabsTrigger value="inline">
                      <Monitor className="size-3.5 mr-1.5" />
                      Inline
                    </TabsTrigger>
                    <TabsTrigger value="popup">
                      <MessageSquare className="size-3.5 mr-1.5" />
                      Popup
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-xs text-muted-foreground">
                  {embedType === "inline"
                    ? "Embeds directly into your page using an iframe."
                    : "Adds a floating button that opens the booking form in a modal."}
                </p>
              </div>

              <Separator />

              {/* Customization */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Palette className="size-3.5 text-indigo-500" />
                  Customize
                </Label>

                <div className="space-y-2">
                  <Label htmlFor="color" className="text-xs text-muted-foreground">
                    Primary Color
                  </Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      id="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-8 w-28 font-mono text-xs"
                      maxLength={7}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="hide-header"
                    className="text-xs text-muted-foreground"
                  >
                    Hide Header
                  </Label>
                  <Switch
                    id="hide-header"
                    checked={hideHeader}
                    onCheckedChange={setHideHeader}
                  />
                </div>

                {embedType === "popup" && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="btn-text"
                      className="text-xs text-muted-foreground"
                    >
                      Button Text
                    </Label>
                    <Input
                      id="btn-text"
                      value={buttonText}
                      onChange={(e) => setButtonText(e.target.value)}
                      className="h-8"
                      maxLength={30}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview & code panel */}
        <div className="space-y-5">
          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Eye className="size-4 text-indigo-500" />
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedEvent ? (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 py-20 text-sm text-muted-foreground">
                  Select an event type to preview
                </div>
              ) : embedType === "inline" ? (
                <div className="relative overflow-hidden rounded-lg border border-slate-200">
                  <iframe
                    src={embedUrl}
                    className="h-[440px] w-full border-none"
                    title="Embed preview"
                  />
                </div>
              ) : (
                <div className="relative flex items-end justify-end rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-6 min-h-[200px]">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">
                      Your website content
                    </p>
                  </div>
                  <button
                    className="relative z-10 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => toast.info("This is a preview of the floating button")}
                  >
                    {buttonText}
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <Code className="size-4 text-indigo-500" />
                  Embed Code
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!currentCode}
                  className="h-7 gap-1.5 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="size-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      Copy
                    </>
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentCode ? (
                <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-300">
                  <code>{currentCode}</code>
                </pre>
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 py-12 text-sm text-muted-foreground">
                  Select an event type to generate code
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
