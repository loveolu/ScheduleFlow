"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  User,
  Mail,
  MoreHorizontal,
  XCircle,
  CheckCircle,
  UserX,
  Download,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
} from "lucide-react";
import Link from "next/link";

type StatusFilter = "all" | "CONFIRMED" | "PENDING" | "CANCELLED" | "NO_SHOW";

interface Booking {
  id: string;
  uid: string;
  inviteeName: string;
  inviteeEmail: string;
  inviteeTimezone: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  eventType: {
    title: string;
    duration: number;
    color: string;
  };
}

const statusStyles: Record<string, { bg: string; text: string }> = {
  CONFIRMED: { bg: "bg-green-50", text: "text-green-700" },
  PENDING: { bg: "bg-yellow-50", text: "text-yellow-700" },
  CANCELLED: { bg: "bg-red-50", text: "text-red-700" },
  RESCHEDULED: { bg: "bg-blue-50", text: "text-blue-700" },
  NO_SHOW: { bg: "bg-slate-100", text: "text-slate-600" },
};

export default function BookingsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["bookings", statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      return fetch(`/api/bookings?${params}`).then((r) => r.json());
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (uid: string) =>
      fetch(`/api/bookings/${uid}/cancel`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Booking cancelled");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (uid: string) =>
      fetch(`/api/bookings/${uid}/confirm`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Booking confirmed");
    },
  });

  const noShowMutation = useMutation({
    mutationFn: (uid: string) =>
      fetch(`/api/bookings/${uid}/no-show`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Marked as no-show");
    },
  });

  const bookings: Booking[] = data?.bookings || [];
  const pagination = data?.pagination;

  const filteredBookings = search
    ? bookings.filter(
        (b) =>
          b.inviteeName.toLowerCase().includes(search.toLowerCase()) ||
          b.inviteeEmail.toLowerCase().includes(search.toLowerCase()) ||
          b.eventType.title.toLowerCase().includes(search.toLowerCase())
      )
    : bookings;

  const exportCSV = () => {
    const headers = ["Date", "Time", "Event", "Invitee", "Email", "Status"];
    const rows = bookings.map((b) => [
      format(new Date(b.startTime), "yyyy-MM-dd"),
      format(new Date(b.startTime), "HH:mm"),
      b.eventType.title,
      b.inviteeName,
      b.inviteeEmail,
      b.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bookings.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bookings</h1>
          <p className="text-sm text-slate-500">
            Manage all your appointments
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search bookings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "CONFIRMED", "PENDING", "CANCELLED", "NO_SHOW"] as const).map(
            (status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className="text-xs"
              >
                {status === "all" ? "All" : status === "NO_SHOW" ? "No Show" : status.charAt(0) + status.slice(1).toLowerCase()}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Booking list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No bookings found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredBookings.map((booking) => {
            const style = statusStyles[booking.status] || statusStyles.CONFIRMED;
            const start = new Date(booking.startTime);
            const end = new Date(booking.endTime);

            return (
              <Card key={booking.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-1 h-12 rounded-full shrink-0"
                      style={{ backgroundColor: booking.eventType.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/dashboard/bookings/${booking.uid}`}
                          className="font-medium text-sm text-slate-900 hover:text-indigo-600 transition-colors"
                        >
                          {booking.eventType.title}
                        </Link>
                        <Badge className={`text-xs ${style.bg} ${style.text} border-0`}>
                          {booking.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {booking.inviteeName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {booking.inviteeEmail}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">
                        {format(start, "MMM d, yyyy")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {format(start, "h:mm a")} - {format(end, "h:mm a")}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Link href={`/dashboard/bookings/${booking.uid}`}>
                            View details
                          </Link>
                        </DropdownMenuItem>
                        {booking.status === "PENDING" && (
                          <DropdownMenuItem
                            onClick={() => confirmMutation.mutate(booking.uid)}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Confirm
                          </DropdownMenuItem>
                        )}
                        {(booking.status === "CONFIRMED" ||
                          booking.status === "PENDING") && (
                          <DropdownMenuItem
                            onClick={() => cancelMutation.mutate(booking.uid)}
                            className="text-red-600"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Cancel
                          </DropdownMenuItem>
                        )}
                        {booking.status === "CONFIRMED" && (
                          <DropdownMenuItem
                            onClick={() => noShowMutation.mutate(booking.uid)}
                          >
                            <UserX className="w-4 h-4 mr-2" />
                            No-show
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-slate-500">
            Page {page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
