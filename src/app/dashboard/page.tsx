import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { BookingStatus } from "@/generated/prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Clock,
  XCircle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

function StatCardSkeleton() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-12" />
        </div>
      </div>
    </Card>
  );
}

function BookingListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-lg border border-slate-100">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

async function StatsCards({ userId }: { userId: string }) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [totalThisMonth, upcomingCount, cancelledCount] = await Promise.all([
    db.booking.count({
      where: {
        userId,
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
    }),
    db.booking.count({
      where: {
        userId,
        startTime: { gte: now },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
      },
    }),
    db.booking.count({
      where: {
        userId,
        status: BookingStatus.CANCELLED,
        updatedAt: { gte: startOfMonth, lte: endOfMonth },
      },
    }),
  ]);

  const stats = [
    {
      label: "Bookings this month",
      value: totalThisMonth,
      icon: TrendingUp,
      color: "text-indigo-500",
      bg: "bg-indigo-50",
    },
    {
      label: "Upcoming",
      value: upcomingCount,
      icon: Calendar,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
    {
      label: "Cancelled",
      value: cancelledCount,
      icon: XCircle,
      color: "text-rose-500",
      bg: "bg-rose-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="p-6 border-slate-100 shadow-none">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}
              >
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">
                  {stat.label}
                </p>
                <p className="text-2xl font-semibold text-slate-900 tracking-tight">
                  {stat.value}
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

async function UpcomingBookings({ userId }: { userId: string }) {
  const now = new Date();

  const bookings = await db.booking.findMany({
    where: {
      userId,
      startTime: { gte: now },
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
    },
    orderBy: { startTime: "asc" },
    take: 5,
    include: {
      eventType: { select: { title: true, duration: true, color: true } },
    },
  });

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 mb-3">
          <Calendar className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-900">No upcoming bookings</p>
        <p className="text-sm text-slate-500 mt-1">
          Share your booking link to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {bookings.map((booking) => {
        const start = new Date(booking.startTime);
        const dateStr = start.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const timeStr = start.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

        return (
          <div
            key={booking.id}
            className="flex items-center gap-4 rounded-lg border border-slate-100 p-4 transition-colors hover:bg-slate-50"
          >
            <div
              className="h-10 w-1 rounded-full shrink-0"
              style={{ backgroundColor: booking.eventType.color }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {booking.eventType.title} with {booking.inviteeName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock className="h-3 w-3 text-slate-400" />
                <p className="text-xs text-slate-500">
                  {dateStr} at {timeStr} &middot; {booking.eventType.duration}min
                </p>
              </div>
            </div>
            <Badge
              variant={
                booking.status === BookingStatus.CONFIRMED
                  ? "secondary"
                  : "outline"
              }
              className={
                booking.status === BookingStatus.CONFIRMED
                  ? "bg-emerald-50 text-emerald-700 border-0"
                  : ""
              }
            >
              {booking.status === BookingStatus.CONFIRMED
                ? "Confirmed"
                : "Pending"}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Here is what is happening with your schedule.
        </p>
      </div>

      {/* Stats */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        }
      >
        <StatsCards userId={userId} />
      </Suspense>

      {/* Upcoming Bookings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Upcoming bookings
          </h2>
          <Link
            href="/dashboard/bookings"
            className="flex items-center gap-1 text-sm font-medium text-indigo-500 hover:text-indigo-600 transition-colors"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <Card className="border-slate-100 shadow-none overflow-hidden">
          <div className="p-4">
            <Suspense fallback={<BookingListSkeleton />}>
              <UpcomingBookings userId={userId} />
            </Suspense>
          </div>
        </Card>
      </div>
    </div>
  );
}
