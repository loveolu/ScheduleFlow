"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2, Unplug } from "lucide-react";

interface IntegrationInfo {
  type: string;
  connected: boolean;
  connectedAt?: string;
  metadata?: Record<string, unknown>;
}

const INTEGRATIONS = [
  {
    type: "GOOGLE",
    name: "Google Calendar",
    description: "Read busy times and create calendar events automatically when bookings are made.",
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
        <rect x="3" y="3" width="9" height="9" fill="#EA4335" />
        <rect x="12" y="12" width="9" height="9" fill="#34A853" />
        <rect x="3" y="12" width="9" height="9" fill="#FBBC05" />
        <rect x="8" y="8" width="8" height="8" fill="white" />
        <path d="M12 8v4l2.5 2.5" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    connectUrl: "/api/integrations/google/connect",
  },
  {
    type: "OUTLOOK",
    name: "Outlook Calendar",
    description: "Sync with Microsoft Outlook to check availability and create events.",
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2" fill="#0078D4" />
        <path d="M7 8h10M7 12h10M7 16h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    connectUrl: "/api/integrations/outlook/connect",
  },
  {
    type: "ZOOM",
    name: "Zoom",
    description: "Automatically create Zoom meetings for bookings and include the link in confirmations.",
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2" fill="#2D8CFF" />
        <path d="M6 9.5v5a1 1 0 001 1h6a1 1 0 001-1v-5a1 1 0 00-1-1H7a1 1 0 00-1 1z" fill="white" />
        <path d="M14 10.5l3.5-2v7l-3.5-2" fill="white" />
      </svg>
    ),
    connectUrl: "/api/integrations/zoom/connect",
  },
];

export default function IntegrationsPage() {
  const queryClient = useQueryClient();

  const { data: connected = [], isLoading } = useQuery<IntegrationInfo[]>({
    queryKey: ["integrations"],
    queryFn: async () => {
      const res = await fetch("/api/integrations");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (type: string) => {
      const res = await fetch(`/api/integrations/${type}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integration disconnected");
    },
    onError: () => toast.error("Failed to disconnect integration"),
  });

  const isConnected = (type: string) =>
    connected.some((c) => c.type === type && c.connected);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="text-sm text-slate-500">
          Connect your calendar and conferencing tools
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {INTEGRATIONS.map((integration) => {
            const connectedInfo = connected.find(
              (c) => c.type === integration.type
            );
            const active = connectedInfo?.connected;

            return (
              <Card key={integration.type} className="overflow-hidden">
                <CardContent className="py-5">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0">{integration.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900">
                          {integration.name}
                        </h3>
                        {active && (
                          <Badge
                            variant="secondary"
                            className="bg-green-50 text-green-700 text-xs"
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Connected
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {integration.description}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {active ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            disconnectMutation.mutate(integration.type)
                          }
                          disabled={disconnectMutation.isPending}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          {disconnectMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <Unplug className="w-4 h-4 mr-1" />
                          )}
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            window.location.href = integration.connectUrl;
                          }}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-8 p-4 bg-slate-50 rounded-xl">
        <h3 className="text-sm font-medium text-slate-900 mb-1">
          How integrations work
        </h3>
        <ul className="text-sm text-slate-500 space-y-1">
          <li>
            &bull; <strong>Calendar integrations</strong> check your connected
            calendars for busy times to prevent double-bookings.
          </li>
          <li>
            &bull; <strong>Zoom</strong> automatically creates a unique meeting
            link for each booking.
          </li>
          <li>
            &bull; Confirmed bookings are added to your connected calendar
            automatically.
          </li>
          <li>
            &bull; Cancelling a booking removes it from your calendar too.
          </li>
        </ul>
      </div>
    </div>
  );
}
