"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Globe,
  MapPin,
  User,
  Mail,
  FileText,
  CheckCircle,
  XCircle,
  UserX,
  Loader2,
} from "lucide-react";
import Link from "next/link";

export default function BookingDetailPage() {
  const params = useParams<{ uid: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", params.uid],
    queryFn: () =>
      fetch(`/api/bookings/${params.uid}`).then((r) => r.json()),
    enabled: !!params.uid,
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/bookings/${params.uid}/cancel`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", params.uid] });
      toast.success("Booking cancelled");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/bookings/${params.uid}/confirm`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", params.uid] });
      toast.success("Booking confirmed");
    },
  });

  const noShowMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/bookings/${params.uid}/no-show`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", params.uid] });
      toast.success("Marked as no-show");
    },
  });

  const notesMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/bookings/${params.uid}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", params.uid] });
      toast.success("Notes saved");
      setShowNotes(false);
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!booking || booking.error) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Booking not found</p>
      </div>
    );
  }

  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);

  const statusColors: Record<string, string> = {
    CONFIRMED: "bg-green-50 text-green-700",
    PENDING: "bg-yellow-50 text-yellow-700",
    CANCELLED: "bg-red-50 text-red-700",
    NO_SHOW: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="max-w-2xl">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/dashboard/bookings")}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to bookings
      </Button>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {booking.eventType.title}
        </h1>
        <Badge className={statusColors[booking.status] || ""}>
          {booking.status}
        </Badge>
      </div>

      <Card className="mb-6">
        <CardContent className="py-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">Date</p>
                <p className="text-sm font-medium">
                  {format(start, "EEEE, MMMM d, yyyy")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">Time</p>
                <p className="text-sm font-medium">
                  {format(start, "h:mm a")} - {format(end, "h:mm a")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">Invitee</p>
                <p className="text-sm font-medium">{booking.inviteeName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">Email</p>
                <p className="text-sm font-medium">{booking.inviteeEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">Timezone</p>
                <p className="text-sm font-medium">{booking.inviteeTimezone}</p>
              </div>
            </div>
            {booking.location && (
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Location</p>
                  <p className="text-sm font-medium">{booking.location}</p>
                </div>
              </div>
            )}
          </div>

          {booking.meetingUrl && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-slate-400 mb-1">Meeting URL</p>
                <a
                  href={booking.meetingUrl}
                  className="text-sm text-indigo-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {booking.meetingUrl}
                </a>
              </div>
            </>
          )}

          {booking.notes && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-slate-400 mb-1">Notes</p>
                <p className="text-sm text-slate-700">{booking.notes}</p>
              </div>
            </>
          )}

          {booking.cancellationReason && (
            <>
              <Separator />
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-red-400 mb-1">Cancellation reason</p>
                <p className="text-sm text-red-700">{booking.cancellationReason}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        {booking.status === "PENDING" && (
          <Button
            size="sm"
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Confirm
          </Button>
        )}
        {(booking.status === "CONFIRMED" || booking.status === "PENDING") && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
          >
            <XCircle className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        )}
        {booking.status === "CONFIRMED" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => noShowMutation.mutate()}
            disabled={noShowMutation.isPending}
          >
            <UserX className="w-4 h-4 mr-2" />
            No-show
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setNotes(booking.notes || "");
            setShowNotes(true);
          }}
        >
          <FileText className="w-4 h-4 mr-2" />
          {booking.notes ? "Edit notes" : "Add notes"}
        </Button>
      </div>

      {showNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Internal Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes about this booking..."
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => notesMutation.mutate()}
                disabled={notesMutation.isPending}
              >
                {notesMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotes(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
