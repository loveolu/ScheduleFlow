"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar as CalendarIcon,
  Download,
  BarChart3,
  Users,
  XCircle,
  UserX,
  TrendingUp,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverviewData {
  totalBookings: number;
  confirmedCount: number;
  cancelledCount: number;
  noShowCount: number;
  pendingCount: number;
  cancellationRate: number;
  noShowRate: number;
  uniqueInvitees: number;
}

interface TimeSeriesPoint {
  date: string;
  count: number;
}

interface PopularEventType {
  eventTypeId: string;
  title: string;
  color: string;
  count: number;
}

interface HeatmapCell {
  dayOfWeek: number;
  hour: number;
  count: number;
}

type RangePreset = "7d" | "30d" | "90d" | "custom";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildParams(from: Date, to: Date, extra?: Record<string, string>) {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    ...extra,
  });
  return params.toString();
}

function fetcher<T>(url: string): Promise<T> {
  return fetch(url).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Request failed");
    }
    return res.json() as Promise<T>;
  });
}

function pickInterval(from: Date, to: Date): "day" | "week" | "month" {
  const diff = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 31) return "day";
  if (diff <= 120) return "week";
  return "month";
}

// ---------------------------------------------------------------------------
// Date Range Picker (inline buttons + optional custom range)
// ---------------------------------------------------------------------------

function DateRangePicker({
  preset,
  from,
  to,
  onPresetChange,
  onCustomChange,
}: {
  preset: RangePreset;
  from: Date;
  to: Date;
  onPresetChange: (p: RangePreset) => void;
  onCustomChange: (from: Date, to: Date) => void;
}) {
  const presets: { label: string; value: RangePreset }[] = [
    { label: "Last 7 days", value: "7d" },
    { label: "Last 30 days", value: "30d" },
    { label: "Last 90 days", value: "90d" },
    { label: "Custom", value: "custom" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarIcon className="h-4 w-4 text-slate-400" />
      <div className="flex gap-1">
        {presets.map((p) => (
          <Button
            key={p.value}
            variant={preset === p.value ? "default" : "ghost"}
            size="sm"
            onClick={() => onPresetChange(p.value)}
            className="text-xs"
          >
            {p.label}
          </Button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={format(from, "yyyy-MM-dd")}
            onChange={(e) => {
              const d = new Date(e.target.value);
              if (!isNaN(d.getTime())) onCustomChange(startOfDay(d), to);
            }}
            className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={format(to, "yyyy-MM-dd")}
            onChange={(e) => {
              const d = new Date(e.target.value);
              if (!isNaN(d.getTime())) onCustomChange(from, endOfDay(d));
            }}
            className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
      )}
      {preset !== "custom" && (
        <span className="text-xs text-slate-400 ml-1">
          {format(from, "MMM d")} &ndash; {format(to, "MMM d, yyyy")}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Cards
// ---------------------------------------------------------------------------

function StatCards({ data, isLoading }: { data?: OverviewData; isLoading: boolean }) {
  const stats = [
    {
      label: "Total Bookings",
      value: data?.totalBookings ?? 0,
      icon: TrendingUp,
      color: "text-indigo-500",
      bg: "bg-indigo-50",
    },
    {
      label: "Cancellation Rate",
      value: data ? `${data.cancellationRate}%` : "0%",
      icon: XCircle,
      color: "text-rose-500",
      bg: "bg-rose-50",
    },
    {
      label: "No-show Rate",
      value: data ? `${data.noShowRate}%` : "0%",
      icon: UserX,
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      label: "Unique Invitees",
      value: data?.uniqueInvitees ?? 0,
      icon: Users,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-slate-100 shadow-none">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-14" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="border-slate-100 shadow-none">
            <CardContent className="p-6">
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line Chart (SVG)
// ---------------------------------------------------------------------------

function LineChart({
  data,
  isLoading,
}: {
  data: TimeSeriesPoint[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-slate-400">
        No booking data for this period
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const padding = { top: 20, right: 20, bottom: 40, left: 48 };
  const width = 700;
  const height = 280;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = data.map((d, i) => ({
    x: padding.left + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
    y: padding.top + chartH - (d.count / maxCount) * chartH,
    ...d,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaD =
    pathD +
    ` L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  // Y-axis ticks
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const value = Math.round((maxCount / 4) * i);
    const y = padding.top + chartH - (value / maxCount) * chartH;
    return { value, y };
  });

  // X-axis labels (show a few)
  const labelCount = Math.min(data.length, 7);
  const step = Math.max(1, Math.floor(data.length / labelCount));
  const xLabels = data
    .filter((_, i) => i % step === 0 || i === data.length - 1)
    .map((d, idx, arr) => {
      const originalIdx = data.indexOf(d);
      return {
        label: format(new Date(d.date + "T00:00:00"), "MMM d"),
        x:
          padding.left +
          (data.length === 1
            ? chartW / 2
            : (originalIdx / (data.length - 1)) * chartW),
      };
    });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid lines */}
      {yTicks.map((t) => (
        <line
          key={t.value}
          x1={padding.left}
          y1={t.y}
          x2={width - padding.right}
          y2={t.y}
          stroke="currentColor"
          className="text-slate-100"
          strokeWidth={1}
        />
      ))}

      {/* Y-axis labels */}
      {yTicks.map((t) => (
        <text
          key={`label-${t.value}`}
          x={padding.left - 8}
          y={t.y + 4}
          textAnchor="end"
          className="fill-slate-400"
          fontSize={11}
        >
          {t.value}
        </text>
      ))}

      {/* X-axis labels */}
      {xLabels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={height - 8}
          textAnchor="middle"
          className="fill-slate-400"
          fontSize={11}
        >
          {l.label}
        </text>
      ))}

      {/* Area fill */}
      <path d={areaD} fill="url(#areaGradient)" />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke="#6366F1"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3}
          fill="white"
          stroke="#6366F1"
          strokeWidth={2}
        />
      ))}

      {/* Gradient definition */}
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366F1" stopOpacity={0.15} />
          <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Bar Chart (SVG)
// ---------------------------------------------------------------------------

function BarChart({
  data,
  isLoading,
}: {
  data: PopularEventType[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-slate-400">
        No event type data
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const pct = (item.count / maxCount) * 100;
        return (
          <div key={item.eventTypeId} className="group">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                  {item.title}
                </span>
              </div>
              <span className="text-sm font-semibold text-slate-900 tabular-nums">
                {item.count}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heatmap (CSS Grid)
// ---------------------------------------------------------------------------

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Heatmap({
  data,
  isLoading,
}: {
  data: HeatmapCell[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    );
  }

  // Build lookup map
  const cellMap = new Map<string, number>();
  let maxCount = 0;
  for (const cell of data) {
    const key = `${cell.dayOfWeek}-${cell.hour}`;
    cellMap.set(key, cell.count);
    if (cell.count > maxCount) maxCount = cell.count;
  }

  // Show hours from 6am to 22pm (busiest range), but include all 24 for completeness
  const hours = Array.from({ length: 24 }, (_, i) => i);
  // Only display hours 6-22 for a cleaner view
  const displayHours = hours.filter((h) => h >= 6 && h <= 22);

  function getIntensity(count: number): string {
    if (count === 0 || maxCount === 0) return "bg-slate-50";
    const ratio = count / maxCount;
    if (ratio < 0.2) return "bg-indigo-50";
    if (ratio < 0.4) return "bg-indigo-100";
    if (ratio < 0.6) return "bg-indigo-200";
    if (ratio < 0.8) return "bg-indigo-300";
    return "bg-indigo-500";
  }

  function getTextColor(count: number): string {
    if (count === 0 || maxCount === 0) return "text-slate-300";
    const ratio = count / maxCount;
    if (ratio >= 0.8) return "text-white";
    return "text-slate-600";
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Hour headers */}
        <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `56px repeat(${displayHours.length}, 1fr)` }}>
          <div />
          {displayHours.map((h) => (
            <div
              key={h}
              className="text-center text-[10px] font-medium text-slate-400"
            >
              {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
            </div>
          ))}
        </div>

        {/* Rows for each day */}
        {DAY_LABELS.map((dayLabel, dayIdx) => (
          <div
            key={dayIdx}
            className="grid gap-1 mb-1"
            style={{ gridTemplateColumns: `56px repeat(${displayHours.length}, 1fr)` }}
          >
            <div className="flex items-center text-xs font-medium text-slate-500 pr-2">
              {dayLabel}
            </div>
            {displayHours.map((hour) => {
              const count = cellMap.get(`${dayIdx}-${hour}`) ?? 0;
              return (
                <div
                  key={hour}
                  className={`aspect-square rounded-sm flex items-center justify-center text-[10px] font-medium transition-colors ${getIntensity(count)} ${getTextColor(count)}`}
                  title={`${dayLabel} ${hour}:00 - ${count} booking${count !== 1 ? "s" : ""}`}
                >
                  {count > 0 ? count : ""}
                </div>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-slate-400">
          <span>Less</span>
          <div className="h-3 w-3 rounded-sm bg-slate-50 border border-slate-100" />
          <div className="h-3 w-3 rounded-sm bg-indigo-50" />
          <div className="h-3 w-3 rounded-sm bg-indigo-100" />
          <div className="h-3 w-3 rounded-sm bg-indigo-200" />
          <div className="h-3 w-3 rounded-sm bg-indigo-300" />
          <div className="h-3 w-3 rounded-sm bg-indigo-500" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

function useCSVExport(
  overview: OverviewData | undefined,
  timeSeries: TimeSeriesPoint[] | undefined,
  popularTypes: PopularEventType[] | undefined,
  heatmapData: HeatmapCell[] | undefined,
  from: Date,
  to: Date
) {
  return useCallback(() => {
    const lines: string[] = [];

    lines.push("ScheduleFlow Analytics Export");
    lines.push(`Period: ${format(from, "yyyy-MM-dd")} to ${format(to, "yyyy-MM-dd")}`);
    lines.push("");

    if (overview) {
      lines.push("Overview");
      lines.push("Metric,Value");
      lines.push(`Total Bookings,${overview.totalBookings}`);
      lines.push(`Confirmed,${overview.confirmedCount}`);
      lines.push(`Cancelled,${overview.cancelledCount}`);
      lines.push(`No-shows,${overview.noShowCount}`);
      lines.push(`Pending,${overview.pendingCount}`);
      lines.push(`Cancellation Rate,${overview.cancellationRate}%`);
      lines.push(`No-show Rate,${overview.noShowRate}%`);
      lines.push(`Unique Invitees,${overview.uniqueInvitees}`);
      lines.push("");
    }

    if (timeSeries && timeSeries.length > 0) {
      lines.push("Bookings Over Time");
      lines.push("Date,Count");
      for (const row of timeSeries) {
        lines.push(`${row.date},${row.count}`);
      }
      lines.push("");
    }

    if (popularTypes && popularTypes.length > 0) {
      lines.push("Popular Event Types");
      lines.push("Event Type,Bookings");
      for (const row of popularTypes) {
        lines.push(`"${row.title}",${row.count}`);
      }
      lines.push("");
    }

    if (heatmapData && heatmapData.length > 0) {
      lines.push("Busiest Times");
      lines.push("Day,Hour,Count");
      for (const row of heatmapData) {
        lines.push(`${DAY_LABELS[row.dayOfWeek]},${row.hour}:00,${row.count}`);
      }
    }

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${format(from, "yyyy-MM-dd")}-to-${format(to, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [overview, timeSeries, popularTypes, heatmapData, from, to]);
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const now = new Date();
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [customFrom, setCustomFrom] = useState<Date>(startOfDay(subDays(now, 30)));
  const [customTo, setCustomTo] = useState<Date>(endOfDay(now));

  const { from, to } = useMemo(() => {
    if (preset === "custom") return { from: customFrom, to: customTo };
    const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
    return { from: startOfDay(subDays(now, days)), to: endOfDay(now) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customFrom, customTo]);

  const interval = pickInterval(from, to);

  const handlePresetChange = (p: RangePreset) => {
    setPreset(p);
  };

  const handleCustomChange = (f: Date, t: Date) => {
    setCustomFrom(f);
    setCustomTo(t);
  };

  // ---- Data fetching ----

  const overviewQuery = useQuery({
    queryKey: ["analytics", "overview", from.toISOString(), to.toISOString()],
    queryFn: () =>
      fetcher<OverviewData>(
        `/api/analytics/overview?${buildParams(from, to)}`
      ),
  });

  const timeSeriesQuery = useQuery({
    queryKey: [
      "analytics",
      "bookings-over-time",
      from.toISOString(),
      to.toISOString(),
      interval,
    ],
    queryFn: () =>
      fetcher<TimeSeriesPoint[]>(
        `/api/analytics/bookings-over-time?${buildParams(from, to, { interval })}`
      ),
  });

  const popularTypesQuery = useQuery({
    queryKey: ["analytics", "popular-event-types"],
    queryFn: () =>
      fetcher<PopularEventType[]>(`/api/analytics/popular-event-types`),
  });

  const heatmapQuery = useQuery({
    queryKey: ["analytics", "heatmap", from.toISOString(), to.toISOString()],
    queryFn: () =>
      fetcher<HeatmapCell[]>(
        `/api/analytics/heatmap?${buildParams(from, to)}`
      ),
  });

  const exportCSV = useCSVExport(
    overviewQuery.data,
    timeSeriesQuery.data,
    popularTypesQuery.data,
    heatmapQuery.data,
    from,
    to
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Insights into your booking activity and trends.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Date Range Picker */}
      <DateRangePicker
        preset={preset}
        from={from}
        to={to}
        onPresetChange={handlePresetChange}
        onCustomChange={handleCustomChange}
      />

      {/* Stat Cards */}
      <StatCards data={overviewQuery.data} isLoading={overviewQuery.isLoading} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Bookings over time - takes 2 cols */}
        <Card className="lg:col-span-2 border-slate-100 shadow-none">
          <CardHeader className="border-b border-slate-50 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              Bookings Over Time
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <LineChart
              data={timeSeriesQuery.data ?? []}
              isLoading={timeSeriesQuery.isLoading}
            />
          </CardContent>
        </Card>

        {/* Popular event types - takes 1 col */}
        <Card className="border-slate-100 shadow-none">
          <CardHeader className="border-b border-slate-50 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <BarChart3 className="h-4 w-4 text-indigo-500" />
              Popular Event Types
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <BarChart
              data={popularTypesQuery.data ?? []}
              isLoading={popularTypesQuery.isLoading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card className="border-slate-100 shadow-none">
        <CardHeader className="border-b border-slate-50 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CalendarIcon className="h-4 w-4 text-indigo-500" />
            Busiest Times
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <Heatmap
            data={heatmapQuery.data ?? []}
            isLoading={heatmapQuery.isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
