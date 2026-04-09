"use client";

import { useState, useEffect } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isBefore, startOfDay, isToday, addMinutes } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Clock, Globe, Check, CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface BookingFlowProps {
  user: {
    name: string;
    username: string;
    avatarUrl: string | null;
    timezone: string;
  };
  eventType: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    duration: number;
    color: string;
    locations: Array<{ type: string; value?: string; label?: string }>;
    questions: Array<{
      id: string;
      type: string;
      label: string;
      required: boolean;
      options?: string[];
      placeholder?: string;
    }>;
    hideEventTypeDetails: boolean;
  };
}

type Step = "calendar" | "time" | "details" | "confirmed";

interface TimeSlot {
  start: string;
  end: string;
  startFormatted: string;
}

export function BookingFlow({ user, eventType }: BookingFlowProps) {
  const [step, setStep] = useState<Step>("calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [inviteeTimezone, setInviteeTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    notes: "",
    responses: {} as Record<string, string>,
  });
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    uid: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  // Fetch slots when date is selected
  useEffect(() => {
    if (!selectedDate) return;

    setLoadingSlots(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    fetch(
      `/api/public/${user.username}/${eventType.slug}/slots?date=${dateStr}&timezone=${inviteeTimezone}`
    )
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots || []);
        setStep("time");
      })
      .catch(() => toast.error("Failed to load available times"))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, inviteeTimezone, user.username, eventType.slug]);

  const handleBooking = async () => {
    if (!selectedSlot) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventTypeId: eventType.id,
          startTime: selectedSlot.start,
          name: formData.name,
          email: formData.email,
          timezone: inviteeTimezone,
          notes: formData.notes || undefined,
          responses:
            Object.keys(formData.responses).length > 0
              ? formData.responses
              : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to create booking");
        return;
      }

      setBookingResult(data);
      setStep("confirmed");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Calendar generation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);
  const today = startOfDay(new Date());

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-16">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr]">
          {/* Left panel - Event info */}
          <div className="border-b md:border-b-0 md:border-r border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Avatar className="w-10 h-10">
                <AvatarImage src={user.avatarUrl || undefined} />
                <AvatarFallback className="bg-indigo-100 text-indigo-600 text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-slate-500">{user.name}</p>
              </div>
            </div>

            <h1 className="text-xl font-bold text-slate-900 mb-2">
              {eventType.title}
            </h1>

            {!eventType.hideEventTypeDetails && eventType.description && (
              <p className="text-sm text-slate-500 mb-4">{eventType.description}</p>
            )}

            <div className="space-y-2 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{eventType.duration} min</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                <span>{inviteeTimezone}</span>
              </div>
              {selectedDate && (
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  <span>{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
                </div>
              )}
              {selectedSlot && (
                <div className="flex items-center gap-2 text-indigo-600 font-medium">
                  <Clock className="w-4 h-4" />
                  <span>{selectedSlot.startFormatted}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right panel - Booking steps */}
          <div className="p-6 min-h-[420px]">
            <AnimatePresence mode="wait">
              {step === "calendar" && (
                <motion.div
                  key="calendar"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-sm font-medium text-slate-900 mb-4">
                    Select a Date
                  </h2>

                  {/* Month navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="font-semibold text-sm">
                      {format(currentMonth, "MMMM yyyy")}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Day headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (day) => (
                        <div
                          key={day}
                          className="text-center text-xs text-slate-400 py-1"
                        >
                          {day}
                        </div>
                      )
                    )}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: startDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {days.map((day) => {
                      const isPast = isBefore(day, today);
                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      const isTodayDate = isToday(day);

                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => !isPast && setSelectedDate(day)}
                          disabled={isPast}
                          className={`
                            aspect-square rounded-lg text-sm font-medium transition-all
                            flex items-center justify-center
                            ${isPast ? "text-slate-300 cursor-not-allowed" : "hover:bg-indigo-50 cursor-pointer"}
                            ${isSelected ? "bg-indigo-600 text-white hover:bg-indigo-700" : ""}
                            ${isTodayDate && !isSelected ? "ring-1 ring-indigo-300" : ""}
                          `}
                        >
                          {format(day, "d")}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {step === "time" && (
                <motion.div
                  key="time"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-medium text-slate-900">
                      {selectedDate && format(selectedDate, "EEEE, MMMM d")}
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedDate(null);
                        setSelectedSlot(null);
                        setStep("calendar");
                      }}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                  </div>

                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="text-center text-slate-400 py-12">
                      No available times for this date.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[350px] overflow-y-auto pr-1">
                      {slots.map((slot) => {
                        const isSelected =
                          selectedSlot?.start === slot.start;
                        return (
                          <button
                            key={slot.start}
                            onClick={() => {
                              setSelectedSlot(slot);
                              setStep("details");
                            }}
                            className={`
                              py-2.5 px-3 rounded-lg text-sm font-medium border transition-all
                              ${
                                isSelected
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                              }
                            `}
                          >
                            {slot.startFormatted}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {step === "details" && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-sm font-medium text-slate-900">
                      Enter Details
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep("time")}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="Your name"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="you@example.com"
                        required
                      />
                    </div>

                    {/* Custom questions */}
                    {eventType.questions.map((q) => (
                      <div key={q.id}>
                        <Label htmlFor={q.id}>
                          {q.label}
                          {q.required && " *"}
                        </Label>
                        {q.type === "textarea" ? (
                          <Textarea
                            id={q.id}
                            value={formData.responses[q.id] || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                responses: {
                                  ...formData.responses,
                                  [q.id]: e.target.value,
                                },
                              })
                            }
                            placeholder={q.placeholder}
                          />
                        ) : (
                          <Input
                            id={q.id}
                            type={q.type === "email" ? "email" : q.type === "phone" ? "tel" : "text"}
                            value={formData.responses[q.id] || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                responses: {
                                  ...formData.responses,
                                  [q.id]: e.target.value,
                                },
                              })
                            }
                            placeholder={q.placeholder}
                          />
                        )}
                      </div>
                    ))}

                    <div>
                      <Label htmlFor="notes">Additional notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        placeholder="Anything you'd like to share ahead of the meeting..."
                        rows={3}
                      />
                    </div>

                    <Button
                      className="w-full bg-indigo-600 hover:bg-indigo-700"
                      disabled={!formData.name || !formData.email || submitting}
                      onClick={handleBooking}
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      {submitting ? "Scheduling..." : "Confirm Booking"}
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === "confirmed" && bookingResult && (
                <motion.div
                  key="confirmed"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">
                    You&apos;re booked!
                  </h2>
                  <p className="text-slate-500 mb-6">
                    A confirmation email has been sent to {formData.email}
                  </p>

                  <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 mb-6">
                    <div className="text-sm">
                      <span className="text-slate-500">What: </span>
                      <span className="font-medium">{eventType.title}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-slate-500">When: </span>
                      <span className="font-medium">
                        {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")} at{" "}
                        {selectedSlot?.startFormatted}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-slate-500">Who: </span>
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2">
                    <Link
                      href={`/booking/${bookingResult.uid}`}
                      className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    >
                      View Booking
                    </Link>
                    <Link
                      href={`/booking/${bookingResult.uid}/cancel`}
                      className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="text-center mt-6">
        <p className="text-xs text-slate-400">
          Powered by{" "}
          <Link href="/" className="text-indigo-500 hover:underline">
            ScheduleFlow
          </Link>
        </p>
      </div>
    </div>
  );
}
