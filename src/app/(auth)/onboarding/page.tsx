"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  usernameSchema,
  eventTypeSchema,
  type EventTypeInput,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckIcon,
  ChevronRightIcon,
  Loader2Icon,
  UserIcon,
  CalendarIcon,
  SparklesIcon,
} from "lucide-react";

const STEPS = [
  { id: 1, label: "Profile", icon: UserIcon },
  { id: 2, label: "Availability", icon: CalendarIcon },
  { id: 3, label: "Event Type", icon: SparklesIcon },
] as const;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

// -- Step 1 schema --
const profileStepSchema = z.object({
  username: usernameSchema,
  timezone: z.string().min(1, "Please select a timezone"),
});
type ProfileStepInput = z.infer<typeof profileStepSchema>;

// -- Step 3 schema (subset of eventTypeSchema) --
const quickEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  slug: z
    .string()
    .min(1, "URL slug is required")
    .max(100)
    .regex(
      /^[a-z0-9-]+$/,
      "Only lowercase letters, numbers, and hyphens allowed"
    ),
  duration: z.number().int().min(5).max(480),
});
type QuickEventInput = z.infer<typeof quickEventSchema>;

type AvailabilityDay = {
  day: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const [currentStep, setCurrentStep] = useState(1);

  // -- Step 1: Profile --
  const [profileLoading, setProfileLoading] = useState(false);
  const detectedTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );
  const profileForm = useForm<ProfileStepInput>({
    resolver: zodResolver(profileStepSchema),
    defaultValues: {
      username: "",
      timezone: detectedTimezone || "America/New_York",
    },
  });

  // -- Step 2: Availability --
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [schedule, setSchedule] = useState<AvailabilityDay[]>(
    DAY_LABELS.map((_, i) => ({
      day: i,
      startTime: "09:00",
      endTime: "17:00",
      isActive: i >= 1 && i <= 5,
    }))
  );

  // -- Step 3: Event Type --
  const [eventLoading, setEventLoading] = useState(false);
  const eventForm = useForm<QuickEventInput>({
    resolver: zodResolver(quickEventSchema),
    defaultValues: {
      title: "30 Minute Meeting",
      slug: "30min",
      duration: 30,
    },
  });

  function toggleDay(dayIndex: number) {
    setSchedule((prev) =>
      prev.map((d) =>
        d.day === dayIndex ? { ...d, isActive: !d.isActive } : d
      )
    );
  }

  function updateTime(
    dayIndex: number,
    field: "startTime" | "endTime",
    value: string
  ) {
    setSchedule((prev) =>
      prev.map((d) => (d.day === dayIndex ? { ...d, [field]: value } : d))
    );
  }

  function generateSlug(title: string) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100);
  }

  async function handleProfileSubmit(data: ProfileStepInput) {
    setProfileLoading(true);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: session?.user?.name || "User",
          username: data.username,
          timezone: data.timezone,
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        if (body.error?.includes("username")) {
          profileForm.setError("username", {
            message: "This username is already taken",
          });
        } else {
          toast.error(body.error || "Failed to update profile");
        }
        return;
      }

      await updateSession();
      toast.success("Profile updated!");
      setCurrentStep(2);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleAvailabilitySubmit() {
    setAvailabilityLoading(true);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availability: {
            name: "Working Hours",
            isDefault: true,
            schedules: schedule.filter((s) => s.isActive),
          },
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        toast.error(body.error || "Failed to save availability");
        return;
      }

      toast.success("Availability saved!");
      setCurrentStep(3);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setAvailabilityLoading(false);
    }
  }

  async function handleEventSubmit(data: QuickEventInput) {
    setEventLoading(true);
    try {
      const response = await fetch("/api/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          slug: data.slug,
          duration: data.duration,
          color: "#6366F1",
          isActive: true,
          requiresConfirmation: false,
          maxInvitees: 1,
          bufferTimeBefore: 0,
          bufferTimeAfter: 0,
          minimumNotice: 60,
          maxAdvanceBooking: 60,
          locations: [],
          questions: [],
        } satisfies Partial<EventTypeInput>),
      });

      if (!response.ok) {
        const body = await response.json();
        toast.error(body.error || "Failed to create event type");
        return;
      }

      toast.success("You're all set! Redirecting to your dashboard...");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setEventLoading(false);
    }
  }

  function handleSkip() {
    toast.success("You can always set this up later in settings.");
    router.push("/dashboard");
    router.refresh();
  }

  const timezoneOptions = useMemo(() => {
    const options = [...COMMON_TIMEZONES];
    if (detectedTimezone && !options.includes(detectedTimezone)) {
      options.unshift(detectedTimezone);
    }
    return options;
  }, [detectedTimezone]);

  return (
    <div className="w-full max-w-lg">
      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;

          return (
            <div key={step.id} className="flex items-center gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                  isCompleted
                    ? "border-indigo-500 bg-indigo-500 text-white"
                    : isCurrent
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-400"
                      : "border-white/20 bg-white/5 text-slate-500"
                }`}
              >
                {isCompleted ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={`hidden text-sm sm:block ${
                  isCurrent
                    ? "font-medium text-white"
                    : isCompleted
                      ? "text-indigo-400"
                      : "text-slate-500"
                }`}
              >
                {step.label}
              </span>
              {index < STEPS.length - 1 && (
                <ChevronRightIcon className="mx-1 h-4 w-4 text-slate-600" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Profile */}
      {currentStep === 1 && (
        <Card className="border-white/10 bg-white/5 text-white backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">
              Set up your profile
            </CardTitle>
            <CardDescription className="text-slate-400">
              Choose a unique username and your timezone
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={profileForm.handleSubmit(handleProfileSubmit)}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300">
                  Username
                </Label>
                <div className="flex items-center gap-0">
                  <span className="flex h-10 items-center rounded-l-lg border border-r-0 border-white/10 bg-white/10 px-3 text-sm text-slate-400">
                    scheduleflow.com/
                  </span>
                  <Input
                    id="username"
                    placeholder="janedoe"
                    autoComplete="username"
                    disabled={profileLoading}
                    className="h-10 rounded-l-none border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/25"
                    {...profileForm.register("username")}
                  />
                </div>
                {profileForm.formState.errors.username && (
                  <p className="text-xs text-red-400">
                    {profileForm.formState.errors.username.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone" className="text-slate-300">
                  Timezone
                </Label>
                <select
                  id="timezone"
                  disabled={profileLoading}
                  className="flex h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition-colors focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                  {...profileForm.register("timezone")}
                >
                  {timezoneOptions.map((tz) => (
                    <option key={tz} value={tz} className="bg-slate-900">
                      {tz.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                {profileForm.formState.errors.timezone && (
                  <p className="text-xs text-red-400">
                    {profileForm.formState.errors.timezone.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={profileLoading}
                className="h-10 w-full bg-indigo-500 text-white hover:bg-indigo-600"
              >
                {profileLoading ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRightIcon className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Availability */}
      {currentStep === 2 && (
        <Card className="border-white/10 bg-white/5 text-white backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">
              Set your availability
            </CardTitle>
            <CardDescription className="text-slate-400">
              Define when you're available for meetings. Weekdays 9-5 are
              pre-selected.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {schedule.map((day) => (
                <div
                  key={day.day}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                    day.isActive
                      ? "border-white/10 bg-white/5"
                      : "border-white/5 bg-transparent opacity-50"
                  }`}
                >
                  <Switch
                    checked={day.isActive}
                    onCheckedChange={() => toggleDay(day.day)}
                  />
                  <span className="w-10 text-sm font-medium text-slate-300">
                    {DAY_LABELS[day.day]}
                  </span>
                  {day.isActive ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="time"
                        value={day.startTime}
                        onChange={(e) =>
                          updateTime(day.day, "startTime", e.target.value)
                        }
                        className="h-8 rounded-md border border-white/10 bg-white/5 px-2 text-sm text-white outline-none focus:border-indigo-500"
                      />
                      <span className="text-xs text-slate-500">to</span>
                      <input
                        type="time"
                        value={day.endTime}
                        onChange={(e) =>
                          updateTime(day.day, "endTime", e.target.value)
                        }
                        className="h-8 rounded-md border border-white/10 bg-white/5 px-2 text-sm text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                  ) : (
                    <span className="flex-1 text-sm text-slate-600">
                      Unavailable
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                disabled={availabilityLoading}
                className="h-10 border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                Back
              </Button>
              <Button
                onClick={handleAvailabilitySubmit}
                disabled={availabilityLoading}
                className="h-10 flex-1 bg-indigo-500 text-white hover:bg-indigo-600"
              >
                {availabilityLoading ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRightIcon className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Event Type */}
      {currentStep === 3 && (
        <Card className="border-white/10 bg-white/5 text-white backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">
              Create your first event type
            </CardTitle>
            <CardDescription className="text-slate-400">
              This is the meeting type people will book with you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={eventForm.handleSubmit(handleEventSubmit)}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="title" className="text-slate-300">
                  Event name
                </Label>
                <Input
                  id="title"
                  placeholder="30 Minute Meeting"
                  disabled={eventLoading}
                  className="h-10 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/25"
                  {...eventForm.register("title", {
                    onChange: (e) => {
                      const slug = generateSlug(e.target.value);
                      eventForm.setValue("slug", slug, {
                        shouldValidate: true,
                      });
                    },
                  })}
                />
                {eventForm.formState.errors.title && (
                  <p className="text-xs text-red-400">
                    {eventForm.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug" className="text-slate-300">
                  URL slug
                </Label>
                <div className="flex items-center gap-0">
                  <span className="flex h-10 items-center rounded-l-lg border border-r-0 border-white/10 bg-white/10 px-3 text-sm text-slate-400">
                    /
                  </span>
                  <Input
                    id="slug"
                    placeholder="30min"
                    disabled={eventLoading}
                    className="h-10 rounded-l-none border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/25"
                    {...eventForm.register("slug")}
                  />
                </div>
                {eventForm.formState.errors.slug && (
                  <p className="text-xs text-red-400">
                    {eventForm.formState.errors.slug.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration" className="text-slate-300">
                  Duration (minutes)
                </Label>
                <div className="flex gap-2">
                  {[15, 30, 45, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        eventForm.setValue("duration", d, {
                          shouldValidate: true,
                        })
                      }
                      disabled={eventLoading}
                      className={`flex h-10 flex-1 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                        eventForm.watch("duration") === d
                          ? "border-indigo-500 bg-indigo-500/20 text-indigo-400"
                          : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
                {eventForm.formState.errors.duration && (
                  <p className="text-xs text-red-400">
                    {eventForm.formState.errors.duration.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  disabled={eventLoading}
                  className="h-10 border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={eventLoading}
                  className="h-10 flex-1 bg-indigo-500 text-white hover:bg-indigo-600"
                >
                  {eventLoading ? (
                    <>
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Finish setup
                      <CheckIcon className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              <button
                type="button"
                onClick={handleSkip}
                disabled={eventLoading}
                className="w-full text-center text-sm text-slate-500 transition-colors hover:text-slate-300"
              >
                Skip for now
              </button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
