"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Clock, CalendarX, Loader2 } from "lucide-react";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface Schedule {
  day: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface Availability {
  id: string;
  name: string;
  isDefault: boolean;
  schedules: Schedule[];
}

interface Override {
  id: string;
  date: string;
  isBlocked: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

const DEFAULT_SCHEDULES: Schedule[] = DAYS.map((_, i) => ({
  day: i,
  startTime: "09:00",
  endTime: "17:00",
  isActive: i >= 1 && i <= 5, // Monday-Friday
}));

export default function AvailabilityPage() {
  const queryClient = useQueryClient();
  const [editingSchedules, setEditingSchedules] = useState<Schedule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [newOverride, setNewOverride] = useState({
    date: "",
    isBlocked: true,
    startTime: "",
    endTime: "",
    reason: "",
  });

  const { data: availabilities = [], isLoading } = useQuery<Availability[]>({
    queryKey: ["availability"],
    queryFn: () => fetch("/api/availability").then((r) => r.json()),
  });

  const { data: overrides = [] } = useQuery<Override[]>({
    queryKey: ["overrides"],
    queryFn: () => fetch("/api/availability/overrides").then((r) => r.json()),
  });

  const saveAvailability = useMutation({
    mutationFn: async (data: { id?: string; name: string; isDefault: boolean; schedules: Schedule[] }) => {
      if (data.id) {
        return fetch("/api/availability", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }).then((r) => r.json());
      }
      return fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability"] });
      toast.success("Availability saved");
      setEditingId(null);
    },
    onError: () => toast.error("Failed to save availability"),
  });

  const addOverride = useMutation({
    mutationFn: (data: typeof newOverride) =>
      fetch("/api/availability/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overrides"] });
      toast.success("Override added");
      setShowOverrideDialog(false);
      setNewOverride({ date: "", isBlocked: true, startTime: "", endTime: "", reason: "" });
    },
  });

  const deleteOverride = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/availability/overrides/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overrides"] });
      toast.success("Override removed");
    },
  });

  const startEditing = (avail: Availability) => {
    setEditingId(avail.id);
    setEditingSchedules([...avail.schedules] as Schedule[]);
  };

  const createNew = () => {
    setEditingId("new");
    setEditingSchedules([...DEFAULT_SCHEDULES]);
  };

  useEffect(() => {
    if (availabilities.length === 0 && !isLoading) {
      // Auto-create default availability
      saveAvailability.mutate({
        name: "Working Hours",
        isDefault: true,
        schedules: DEFAULT_SCHEDULES,
      });
    }
  }, [availabilities, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Availability</h1>
          <p className="text-sm text-slate-500">
            Set your weekly hours and date overrides
          </p>
        </div>
        <Button onClick={createNew} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Schedule
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Schedules */}
          {availabilities.map((avail) => (
            <Card key={avail.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{avail.name}</CardTitle>
                    {avail.isDefault && (
                      <Badge variant="secondary" className="text-xs">
                        Default
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEditing(avail)}
                  >
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(avail.schedules as Schedule[]).map((s) => (
                    <div
                      key={s.day}
                      className="flex items-center justify-between text-sm"
                    >
                      <span
                        className={`w-24 ${s.isActive ? "text-slate-900" : "text-slate-400"}`}
                      >
                        {DAYS[s.day]}
                      </span>
                      {s.isActive ? (
                        <span className="text-slate-600">
                          {s.startTime} - {s.endTime}
                        </span>
                      ) : (
                        <span className="text-slate-400">Unavailable</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Edit modal */}
          {editingId && (
            <Card className="border-indigo-200 shadow-md">
              <CardHeader>
                <CardTitle className="text-base">
                  {editingId === "new" ? "New Schedule" : "Edit Schedule"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingSchedules.map((s, idx) => (
                  <div key={s.day} className="flex items-center gap-4">
                    <Switch
                      checked={s.isActive}
                      onCheckedChange={(checked) => {
                        const updated = [...editingSchedules];
                        updated[idx] = { ...s, isActive: checked };
                        setEditingSchedules(updated);
                      }}
                    />
                    <span className="w-24 text-sm font-medium">{DAYS[s.day]}</span>
                    {s.isActive ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={s.startTime}
                          onChange={(e) => {
                            const updated = [...editingSchedules];
                            updated[idx] = { ...s, startTime: e.target.value };
                            setEditingSchedules(updated);
                          }}
                          className="w-32"
                        />
                        <span className="text-slate-400">-</span>
                        <Input
                          type="time"
                          value={s.endTime}
                          onChange={(e) => {
                            const updated = [...editingSchedules];
                            updated[idx] = { ...s, endTime: e.target.value };
                            setEditingSchedules(updated);
                          }}
                          className="w-32"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">Unavailable</span>
                    )}
                  </div>
                ))}

                <Separator />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      const payload = {
                        ...(editingId !== "new" ? { id: editingId } : {}),
                        name:
                          editingId !== "new"
                            ? availabilities.find((a) => a.id === editingId)?.name || "Schedule"
                            : "New Schedule",
                        isDefault: availabilities.length === 0,
                        schedules: editingSchedules,
                      };
                      saveAvailability.mutate(payload);
                    }}
                    disabled={saveAvailability.isPending}
                  >
                    {saveAvailability.isPending && (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Date Overrides */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarX className="w-4 h-4 text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Date Overrides
                </h2>
              </div>
              <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
                <DialogTrigger>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Override
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Date Override</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={newOverride.date}
                        onChange={(e) =>
                          setNewOverride({ ...newOverride, date: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={newOverride.isBlocked}
                        onCheckedChange={(checked) =>
                          setNewOverride({ ...newOverride, isBlocked: checked })
                        }
                      />
                      <Label>Block entire day</Label>
                    </div>
                    {!newOverride.isBlocked && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Label>Start time</Label>
                          <Input
                            type="time"
                            value={newOverride.startTime}
                            onChange={(e) =>
                              setNewOverride({
                                ...newOverride,
                                startTime: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="flex-1">
                          <Label>End time</Label>
                          <Input
                            type="time"
                            value={newOverride.endTime}
                            onChange={(e) =>
                              setNewOverride({
                                ...newOverride,
                                endTime: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    )}
                    <div>
                      <Label>Reason (optional)</Label>
                      <Input
                        value={newOverride.reason}
                        onChange={(e) =>
                          setNewOverride({ ...newOverride, reason: e.target.value })
                        }
                        placeholder="e.g., Holiday, Vacation"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => addOverride.mutate(newOverride)}
                      disabled={!newOverride.date || addOverride.isPending}
                    >
                      Add Override
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {overrides.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-slate-400">
                  No date overrides. Add one to block specific dates or set
                  custom hours.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {overrides.map((o) => (
                  <Card key={o.id}>
                    <CardContent className="py-3 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">{o.date}</span>
                        {o.isBlocked ? (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            Blocked
                          </Badge>
                        ) : (
                          <span className="text-sm text-slate-500 ml-2">
                            {o.startTime} - {o.endTime}
                          </span>
                        )}
                        {o.reason && (
                          <span className="text-xs text-slate-400 ml-2">
                            ({o.reason})
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteOverride.mutate(o.id)}
                      >
                        <Trash2 className="w-4 h-4 text-slate-400" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
