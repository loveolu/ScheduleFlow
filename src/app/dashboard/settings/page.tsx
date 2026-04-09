"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Loader2, User } from "lucide-react";

interface ProfileData {
  name: string;
  username: string;
  timezone: string;
  bio: string;
}

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
  "Europe/Amsterdam",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Stockholm",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "America/Sao_Paulo",
  "Africa/Johannesburg",
  "Africa/Cairo",
];

function ProfileFormSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-28" />
    </div>
  );
}

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<ProfileData>({
    name: "",
    username: "",
    timezone: "",
    bio: "",
  });

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
  });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? "",
        username: profile.username ?? "",
        timezone: profile.timezone ?? "",
        bio: profile.bio ?? "",
      });
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: async (data: ProfileData) => {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: async () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      await updateSession();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleChange = useCallback(
    (field: keyof ProfileData, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your profile and account preferences.
        </p>
      </div>

      {/* Profile card */}
      <Card className="border-slate-100 shadow-none">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <User className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Profile
              </h2>
              <p className="text-sm text-slate-500">
                Your public-facing information.
              </p>
            </div>
          </div>

          <Separator className="mb-6" />

          {isLoading ? (
            <ProfileFormSkeleton />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="flex items-center">
                  <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                    scheduleflow.com/
                  </span>
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(e) => handleChange("username", e.target.value)}
                    placeholder="username"
                    className="rounded-l-none"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  This is your public booking URL.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={form.timezone}
                  onValueChange={(value) => value && handleChange("timezone", value)}
                >
                  <SelectTrigger id="timezone" className="w-full">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={form.bio}
                  onChange={(e) => handleChange("bio", e.target.value)}
                  placeholder="A brief description for your booking page..."
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-slate-500">
                  Displayed on your public booking page.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white"
                >
                  {mutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save changes
                </Button>
              </div>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
