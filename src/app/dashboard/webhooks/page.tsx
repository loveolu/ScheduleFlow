"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Webhook, Copy, Loader2 } from "lucide-react";

const WEBHOOK_EVENTS = [
  { value: "booking.created", label: "Booking Created" },
  { value: "booking.cancelled", label: "Booking Cancelled" },
  { value: "booking.rescheduled", label: "Booking Rescheduled" },
  { value: "booking.confirmed", label: "Booking Confirmed" },
  { value: "booking.no_show", label: "Booking No-Show" },
];

interface WebhookSub {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  signingSecret?: string;
}

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    url: "",
    events: [] as string[],
  });
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const { data: webhooks = [], isLoading } = useQuery<WebhookSub[]>({
    queryKey: ["webhooks"],
    queryFn: () => fetch("/api/webhooks").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWebhook),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook created!");
      setRevealedSecret(data.signingSecret);
      setShowCreate(false);
      setNewWebhook({ url: "", events: [] });
    },
    onError: () => toast.error("Failed to create webhook"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/webhooks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook deleted");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });

  const toggleEvent = (event: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Webhooks</h1>
          <p className="text-sm text-slate-500">
            Get notified when events happen in your account
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Endpoint URL</Label>
                <Input
                  value={newWebhook.url}
                  onChange={(e) =>
                    setNewWebhook({ ...newWebhook, url: e.target.value })
                  }
                  placeholder="https://your-app.com/webhooks"
                />
              </div>
              <div>
                <Label>Events</Label>
                <div className="space-y-2 mt-2">
                  {WEBHOOK_EVENTS.map((evt) => (
                    <div key={evt.value} className="flex items-center gap-2">
                      <Checkbox
                        checked={newWebhook.events.includes(evt.value)}
                        onCheckedChange={() => toggleEvent(evt.value)}
                      />
                      <span className="text-sm">{evt.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={
                  !newWebhook.url ||
                  newWebhook.events.length === 0 ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                Create Webhook
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Signing secret reveal */}
      {revealedSecret && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardContent className="py-4">
            <p className="text-sm text-yellow-800 font-medium mb-2">
              Save your signing secret — it won&apos;t be shown again:
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-yellow-100 px-3 py-1.5 rounded flex-1 font-mono break-all">
                {revealedSecret}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(revealedSecret);
                  toast.success("Copied!");
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setRevealedSecret(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Webhook className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              No webhooks configured
            </h3>
            <p className="text-sm text-slate-500">
              Add a webhook to receive real-time notifications.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono text-slate-700 truncate">
                        {webhook.url}
                      </code>
                      <Badge
                        variant="secondary"
                        className={
                          webhook.isActive
                            ? "bg-green-50 text-green-700 text-xs"
                            : "bg-slate-100 text-slate-500 text-xs"
                        }
                      >
                        {webhook.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.map((evt) => (
                        <Badge key={evt} variant="outline" className="text-xs">
                          {evt}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Switch
                      checked={webhook.isActive}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({
                          id: webhook.id,
                          isActive: checked,
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(webhook.id)}
                    >
                      <Trash2 className="w-4 h-4 text-slate-400" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-slate-50 rounded-xl">
        <h3 className="text-sm font-medium text-slate-900 mb-2">
          Webhook payload format
        </h3>
        <pre className="text-xs bg-slate-100 p-3 rounded-lg overflow-x-auto text-slate-600">
{`{
  "event": "booking.created",
  "data": { "uid": "...", "startTime": "...", ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}

Headers:
  X-ScheduleFlow-Signature: HMAC-SHA256 of body
  X-ScheduleFlow-Timestamp: ISO timestamp`}
        </pre>
      </div>
    </div>
  );
}
