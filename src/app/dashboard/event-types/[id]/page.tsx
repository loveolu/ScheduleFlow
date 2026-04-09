"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Info,
} from "lucide-react";
import Link from "next/link";
import { eventTypeSchema } from "@/lib/validations";
import { z } from "zod";

type EventTypeFormValues = z.input<typeof eventTypeSchema>;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const DURATION_PRESETS = [15, 30, 45, 60];

const PRESET_COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#14B8A6",
  "#06B6D4",
  "#3B82F6",
];

const LOCATION_OPTIONS = [
  { value: "zoom", label: "Zoom" },
  { value: "google_meet", label: "Google Meet" },
  { value: "phone", label: "Phone Call" },
  { value: "in_person", label: "In-Person" },
  { value: "custom", label: "Custom" },
];

const QUESTION_TYPES = [
  { value: "text", label: "Short Text" },
  { value: "textarea", label: "Long Text" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "phone", label: "Phone Number" },
  { value: "email", label: "Email" },
] as const;

interface EventType {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration: number;
  color: string;
  isActive: boolean;
  requiresConfirmation: boolean;
  maxInvitees: number;
  bufferTimeBefore: number;
  bufferTimeAfter: number;
  minimumNotice: number;
  maxAdvanceBooking: number;
  maxBookingsPerDay: number | null;
  collectPayment: boolean;
  price: number | null;
  currency: string;
  locations: { type: string; value?: string; label?: string }[];
  questions: {
    id: string;
    type: "text" | "textarea" | "select" | "checkbox" | "phone" | "email";
    label: string;
    required: boolean;
    options?: string[];
    placeholder?: string;
  }[];
  redirectUrl: string | null;
  hideEventTypeDetails: boolean;
}

async function fetchEventType(id: string): Promise<EventType> {
  const res = await fetch(`/api/event-types/${id}`);
  if (!res.ok) throw new Error("Failed to fetch event type");
  return res.json();
}

async function updateEventType(id: string, data: Partial<EventTypeFormValues>) {
  const res = await fetch(`/api/event-types/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error || "Failed to update event type");
  }
  return res.json();
}

function generateQuestionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function EditEventTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [customDuration, setCustomDuration] = useState(false);

  const { data: eventType, isLoading } = useQuery({
    queryKey: ["eventType", id],
    queryFn: () => fetchEventType(id),
  });

  if (isLoading) {
    return <EditEventTypeSkeleton />;
  }

  if (!eventType) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-muted-foreground">Event type not found.</p>
      </div>
    );
  }

  return (
    <EditEventTypeForm
      eventType={eventType}
      id={id}
      customDuration={customDuration}
      setCustomDuration={setCustomDuration}
    />
  );
}

function EditEventTypeSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-8 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

function EditEventTypeForm({
  eventType,
  id,
  customDuration,
  setCustomDuration,
}: {
  eventType: EventType;
  id: string;
  customDuration: boolean;
  setCustomDuration: (v: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<EventTypeFormValues>({
    resolver: zodResolver(eventTypeSchema),
    defaultValues: {
      title: eventType.title,
      slug: eventType.slug,
      description: eventType.description ?? "",
      duration: eventType.duration,
      color: eventType.color,
      isActive: eventType.isActive,
      requiresConfirmation: eventType.requiresConfirmation,
      maxInvitees: eventType.maxInvitees,
      bufferTimeBefore: eventType.bufferTimeBefore,
      bufferTimeAfter: eventType.bufferTimeAfter,
      minimumNotice: eventType.minimumNotice,
      maxAdvanceBooking: eventType.maxAdvanceBooking,
      maxBookingsPerDay: eventType.maxBookingsPerDay,
      collectPayment: eventType.collectPayment,
      price: eventType.price,
      currency: eventType.currency,
      locations: (eventType.locations as EventType["locations"]) ?? [],
      questions: (eventType.questions as EventType["questions"]) ?? [],
      redirectUrl: eventType.redirectUrl ?? "",
      hideEventTypeDetails: eventType.hideEventTypeDetails,
    },
  });

  const watchDuration = watch("duration");
  const watchColor = watch("color");
  const selectedLocations = watch("locations") ?? [];
  const questions = watch("questions") ?? [];

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setValue("title", value, { shouldDirty: true });
    setValue("slug", slugify(value), { shouldDirty: true });
  };

  const handleLocationToggle = (locationType: string) => {
    const current = selectedLocations;
    const exists = current.find((l) => l.type === locationType);
    if (exists) {
      setValue(
        "locations",
        current.filter((l) => l.type !== locationType),
        { shouldDirty: true }
      );
    } else {
      const option = LOCATION_OPTIONS.find((o) => o.value === locationType);
      setValue(
        "locations",
        [
          ...current,
          { type: locationType, label: option?.label ?? locationType },
        ],
        { shouldDirty: true }
      );
    }
  };

  const addQuestion = () => {
    const newQuestion = {
      id: generateQuestionId(),
      type: "text" as const,
      label: "",
      required: false,
      options: [],
      placeholder: "",
    };
    setValue("questions", [...questions, newQuestion], { shouldDirty: true });
  };

  const removeQuestion = (index: number) => {
    setValue(
      "questions",
      questions.filter((_, i) => i !== index),
      { shouldDirty: true }
    );
  };

  const updateQuestion = (
    index: number,
    field: string,
    value: unknown
  ) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setValue("questions", updated, { shouldDirty: true });
  };

  const onSubmit = async (data: EventTypeFormValues) => {
    setIsSaving(true);
    try {
      await updateEventType(id, data);
      queryClient.invalidateQueries({ queryKey: ["eventType", id] });
      queryClient.invalidateQueries({ queryKey: ["eventTypes"] });
      toast.success("Event type updated successfully");
      router.push("/dashboard/event-types");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update event type"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/event-types">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {eventType.title}
              </h1>
              <Badge variant={eventType.isActive ? "default" : "secondary"}>
                {eventType.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Edit your event type settings
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs defaultValue="setup">
          <TabsList>
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* SETUP TAB */}
          <TabsContent value="setup" className="space-y-6 pt-4">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  The title and URL for your event type
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Quick Chat"
                    {...register("title")}
                    onChange={handleTitleChange}
                  />
                  {errors.title && (
                    <p className="text-sm text-destructive">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug</Label>
                  <Input
                    id="slug"
                    placeholder="quick-chat"
                    {...register("slug")}
                  />
                  {errors.slug && (
                    <p className="text-sm text-destructive">
                      {errors.slug.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="A brief description of this meeting..."
                    {...register("description")}
                  />
                  {errors.description && (
                    <p className="text-sm text-destructive">
                      {errors.description.message}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Duration */}
            <Card>
              <CardHeader>
                <CardTitle>Duration</CardTitle>
                <CardDescription>
                  How long should this meeting be?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((d) => (
                    <Button
                      key={d}
                      type="button"
                      variant={
                        !customDuration && watchDuration === d
                          ? "default"
                          : "outline"
                      }
                      onClick={() => {
                        setCustomDuration(false);
                        setValue("duration", d, { shouldDirty: true });
                      }}
                    >
                      {d} min
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant={customDuration ? "default" : "outline"}
                    onClick={() => setCustomDuration(true)}
                  >
                    Custom
                  </Button>
                </div>

                {customDuration && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={5}
                      max={480}
                      className="w-24"
                      {...register("duration", { valueAsNumber: true })}
                    />
                    <span className="text-sm text-muted-foreground">
                      minutes
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Location */}
            <Card>
              <CardHeader>
                <CardTitle>Location</CardTitle>
                <CardDescription>
                  Where will this meeting take place?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {LOCATION_OPTIONS.map((loc) => (
                    <Button
                      key={loc.value}
                      type="button"
                      variant={
                        selectedLocations.some((l) => l.type === loc.value)
                          ? "default"
                          : "outline"
                      }
                      onClick={() => handleLocationToggle(loc.value)}
                    >
                      {loc.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Appearance */}
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Choose a color for your event type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`size-8 rounded-full transition-all ${
                        watchColor === color
                          ? "ring-2 ring-ring ring-offset-2"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() =>
                        setValue("color", color, { shouldDirty: true })
                      }
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Buffer & Notice */}
            <Card>
              <CardHeader>
                <CardTitle>Scheduling Settings</CardTitle>
                <CardDescription>
                  Buffer times and advance notice requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bufferTimeBefore">
                      Buffer before (min)
                    </Label>
                    <Input
                      id="bufferTimeBefore"
                      type="number"
                      min={0}
                      {...register("bufferTimeBefore", {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bufferTimeAfter">
                      Buffer after (min)
                    </Label>
                    <Input
                      id="bufferTimeAfter"
                      type="number"
                      min={0}
                      {...register("bufferTimeAfter", {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minimumNotice">
                    Minimum notice (minutes)
                  </Label>
                  <Input
                    id="minimumNotice"
                    type="number"
                    min={0}
                    {...register("minimumNotice", { valueAsNumber: true })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum time before the event that someone can book
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Requires Confirmation</Label>
                    <p className="text-xs text-muted-foreground">
                      Bookings must be manually confirmed by you
                    </p>
                  </div>
                  <Controller
                    name="requiresConfirmation"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AVAILABILITY TAB */}
          <TabsContent value="availability" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Availability</CardTitle>
                <CardDescription>
                  Manage when you are available for this event type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                    <Info className="size-6 text-muted-foreground" />
                  </div>
                  <h3 className="mb-1 font-semibold">
                    Availability Settings
                  </h3>
                  <p className="mb-4 max-w-md text-sm text-muted-foreground">
                    This event type uses your default availability schedule. You
                    can configure your availability hours, date overrides, and
                    blocked dates from the Availability settings page.
                  </p>
                  <Link href="/dashboard/availability">
                    <Button variant="outline">Manage Availability</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ADVANCED TAB */}
          <TabsContent value="advanced" className="space-y-6 pt-4">
            {/* Booking Limits */}
            <Card>
              <CardHeader>
                <CardTitle>Booking Limits</CardTitle>
                <CardDescription>
                  Control how many bookings you receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="maxBookingsPerDay">
                    Max bookings per day
                  </Label>
                  <Input
                    id="maxBookingsPerDay"
                    type="number"
                    min={1}
                    placeholder="Unlimited"
                    {...register("maxBookingsPerDay", {
                      setValueAs: (v) =>
                        v === "" || v === null || v === undefined
                          ? null
                          : Number(v),
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for unlimited bookings per day
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Redirect & Display */}
            <Card>
              <CardHeader>
                <CardTitle>After Booking</CardTitle>
                <CardDescription>
                  What happens after someone books this event
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="redirectUrl">Redirect URL</Label>
                  <Input
                    id="redirectUrl"
                    type="url"
                    placeholder="https://example.com/thank-you"
                    {...register("redirectUrl")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Redirect to a custom page after booking confirmation
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Hide Event Type Details</Label>
                    <p className="text-xs text-muted-foreground">
                      Hide description and other details on the booking page
                    </p>
                  </div>
                  <Controller
                    name="hideEventTypeDetails"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Custom Questions */}
            <Card>
              <CardHeader>
                <CardTitle>Custom Questions</CardTitle>
                <CardDescription>
                  Add custom fields to collect information from invitees
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
                    <p className="mb-3 text-sm text-muted-foreground">
                      No custom questions yet
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addQuestion}
                    >
                      <Plus className="mr-1.5 size-3.5" />
                      Add Question
                    </Button>
                  </div>
                ) : (
                  <>
                    {questions.map((question, index) => (
                      <div
                        key={question.id}
                        className="space-y-3 rounded-lg border p-4"
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            Question {index + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeQuestion(index)}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Label</Label>
                            <Input
                              value={question.label}
                              onChange={(e) =>
                                updateQuestion(index, "label", e.target.value)
                              }
                              placeholder="e.g. Company Name"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs">Type</Label>
                            <Select
                              value={question.type}
                              onValueChange={(val) =>
                                updateQuestion(index, "type", val)
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {QUESTION_TYPES.map((qt) => (
                                  <SelectItem key={qt.value} value={qt.value}>
                                    {qt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {question.type === "select" && (
                          <div className="space-y-1.5">
                            <Label className="text-xs">
                              Options (one per line)
                            </Label>
                            <Textarea
                              value={(question.options ?? []).join("\n")}
                              onChange={(e) =>
                                updateQuestion(
                                  index,
                                  "options",
                                  e.target.value
                                    .split("\n")
                                    .filter((o) => o.trim())
                                )
                              }
                              placeholder={"Option 1\nOption 2\nOption 3"}
                              rows={3}
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Controller
                            name={`questions.${index}.required`}
                            control={control}
                            render={({ field }) => (
                              <Switch
                                checked={field.value}
                                onCheckedChange={(checked) =>
                                  updateQuestion(index, "required", checked)
                                }
                                size="sm"
                              />
                            )}
                          />
                          <Label className="text-xs">Required</Label>
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addQuestion}
                    >
                      <Plus className="mr-1.5 size-3.5" />
                      Add Question
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button (always visible) */}
        <div className="mt-6 flex justify-end gap-3">
          <Link href="/dashboard/event-types">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSaving || !isDirty}>
            {isSaving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
