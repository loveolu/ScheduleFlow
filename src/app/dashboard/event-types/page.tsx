"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Clock,
  Copy,
  Edit,
  ExternalLink,
  MoreHorizontal,
  Plus,
  Trash2,
  Calendar,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

interface EventType {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration: number;
  color: string;
  isActive: boolean;
  requiresConfirmation: boolean;
  locations: { type: string; value?: string; label?: string }[];
  createdAt: string;
  _count: {
    bookings: number;
  };
}

async function fetchEventTypes(): Promise<EventType[]> {
  const res = await fetch("/api/event-types");
  if (!res.ok) throw new Error("Failed to fetch event types");
  return res.json();
}

async function toggleEventType(id: string) {
  const res = await fetch(`/api/event-types/${id}/toggle`, { method: "PATCH" });
  if (!res.ok) throw new Error("Failed to toggle event type");
  return res.json();
}

async function deleteEventType(id: string) {
  const res = await fetch(`/api/event-types/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete event type");
  return res.json();
}

export default function EventTypesPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: eventTypes, isLoading } = useQuery({
    queryKey: ["eventTypes"],
    queryFn: fetchEventTypes,
  });

  const toggleMutation = useMutation({
    mutationFn: toggleEventType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventTypes"] });
    },
    onError: () => {
      toast.error("Failed to toggle event type");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEventType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventTypes"] });
      toast.success("Event type deleted");
      setDeleteId(null);
    },
    onError: () => {
      toast.error("Failed to delete event type");
    },
  });

  const copyLink = (slug: string) => {
    const username = session?.user?.username ?? session?.user?.id;
    const url = `${window.location.origin}/${username}/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Event Types</h1>
          <p className="text-muted-foreground">
            Create and manage your scheduling links
          </p>
        </div>
        <Link href="/dashboard/event-types/new">
          <Button>
            <Plus className="mr-1.5 size-4" />
            New Event Type
          </Button>
        </Link>
      </div>

      <Separator />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !eventTypes?.length ? (
        <Card className="py-16">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
              <Calendar className="size-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">No event types yet</h3>
            <p className="mb-6 max-w-sm text-muted-foreground">
              Create your first event type to start accepting bookings from
              others.
            </p>
            <Link href="/dashboard/event-types/new">
              <Button>
                <Plus className="mr-1.5 size-4" />
                Create Event Type
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {eventTypes.map((et) => (
            <Card
              key={et.id}
              className={`transition-opacity ${!et.isActive ? "opacity-60" : ""}`}
            >
              <CardContent className="flex items-center gap-4">
                <div
                  className="size-10 shrink-0 rounded-lg"
                  style={{ backgroundColor: et.color }}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/event-types/${et.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {et.title}
                    </Link>
                    <Badge variant={et.isActive ? "default" : "secondary"}>
                      {et.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {et.requiresConfirmation && (
                      <Badge variant="outline">Requires Confirmation</Badge>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {et.duration} min
                    </span>
                    <button
                      onClick={() => copyLink(et.slug)}
                      className="flex items-center gap-1 transition-colors hover:text-foreground"
                    >
                      <Copy className="size-3.5" />
                      /{et.slug}
                    </button>
                    <span>{et._count.bookings} bookings</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={et.isActive}
                    onCheckedChange={() => toggleMutation.mutate(et.id)}
                    size="sm"
                  />

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" />
                      }
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        render={<Link href={`/dashboard/event-types/${et.id}`} />}
                      >
                        <Edit className="mr-2 size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => copyLink(et.slug)}>
                        <Copy className="mr-2 size-4" />
                        Copy Link
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        render={
                          <a
                            href={`/${session?.user?.username ?? session?.user?.id}/${et.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                      >
                        <ExternalLink className="mr-2 size-4" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteId(et.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event Type</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this event type? This action cannot
              be undone and all associated data will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
