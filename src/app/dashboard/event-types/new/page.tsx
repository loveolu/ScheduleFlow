"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
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

export default function NewEventTypePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customDuration, setCustomDuration] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EventTypeFormValues>({
    resolver: zodResolver(eventTypeSchema),
    defaultValues: {
      title: "",
      slug: "",
      description: "",
      duration: 30,
      color: "#6366F1",
      isActive: true,
      requiresConfirmation: false,
      bufferTimeBefore: 0,
      bufferTimeAfter: 0,
      minimumNotice: 60,
      maxAdvanceBooking: 60,
      locations: [],
      questions: [],
      hideEventTypeDetails: false,
    },
  });

  const watchTitle = watch("title");
  const watchDuration = watch("duration");
  const watchColor = watch("color");
  const selectedLocations = watch("locations") ?? [];

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setValue("title", value);
    setValue("slug", slugify(value));
  };

  const handleLocationToggle = (locationType: string) => {
    const current = selectedLocations;
    const exists = current.find((l) => l.type === locationType);
    if (exists) {
      setValue(
        "locations",
        current.filter((l) => l.type !== locationType)
      );
    } else {
      const option = LOCATION_OPTIONS.find((o) => o.value === locationType);
      setValue("locations", [
        ...current,
        { type: locationType, label: option?.label ?? locationType },
      ]);
    }
  };

  const onSubmit = async (data: EventTypeFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create event type");
      }

      toast.success("Event type created successfully");
      router.push("/dashboard/event-types");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create event type"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/event-types">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            New Event Type
          </h1>
          <p className="text-muted-foreground">
            Set up a new scheduling link for others to book time with you
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                    setValue("duration", d);
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
                <span className="text-sm text-muted-foreground">minutes</span>
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
                  onClick={() => setValue("color", color)}
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
                <Label htmlFor="bufferTimeBefore">Buffer before (min)</Label>
                <Input
                  id="bufferTimeBefore"
                  type="number"
                  min={0}
                  {...register("bufferTimeBefore", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bufferTimeAfter">Buffer after (min)</Label>
                <Input
                  id="bufferTimeAfter"
                  type="number"
                  min={0}
                  {...register("bufferTimeAfter", { valueAsNumber: true })}
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

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link href="/dashboard/event-types">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Create Event Type
          </Button>
        </div>
      </form>
    </div>
  );
}
