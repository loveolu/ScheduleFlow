"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Users, Crown, Shield, User, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";

interface TeamMember {
  id: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
    image: string | null;
  };
}

interface Team {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  plan: string;
  members: TeamMember[];
  currentUserRole: "OWNER" | "ADMIN" | "MEMBER" | null;
  _count: {
    eventTypes: number;
    members: number;
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function fetchTeams(): Promise<Team[]> {
  const res = await fetch("/api/teams");
  if (!res.ok) throw new Error("Failed to fetch teams");
  return res.json();
}

async function createTeam(data: { name: string; slug: string }) {
  const res = await fetch("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to create team");
  }
  return res.json();
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const roleIcon: Record<string, typeof Crown> = {
  OWNER: Crown,
  ADMIN: Shield,
  MEMBER: User,
};

const roleLabel: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

const roleColor: Record<string, string> = {
  OWNER: "bg-amber-50 text-amber-700 border-0",
  ADMIN: "bg-indigo-50 text-indigo-700 border-0",
  MEMBER: "",
};

export default function TeamsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const { data: teams, isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
  });

  const createMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Team created successfully");
      setCreateOpen(false);
      setTeamName("");
      setTeamSlug("");
      setSlugTouched(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleNameChange = (value: string) => {
    setTeamName(value);
    if (!slugTouched) {
      setTeamSlug(slugify(value));
    }
  };

  const handleCreate = () => {
    if (!teamName.trim() || !teamSlug.trim()) return;
    createMutation.mutate({ name: teamName.trim(), slug: teamSlug.trim() });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
          <p className="text-muted-foreground">
            Collaborate with others on shared scheduling
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          New Team
        </Button>
      </div>

      <Separator />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-8 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : !teams?.length ? (
        <Card className="py-16">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
              <Users className="size-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">No teams yet</h3>
            <p className="mb-6 max-w-sm text-muted-foreground">
              Create a team to collaborate with others and manage shared event
              types and scheduling.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Create Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((team) => {
            const RoleIcon = team.currentUserRole
              ? roleIcon[team.currentUserRole]
              : User;
            const displayMembers = team.members.slice(0, 4);
            const extraCount = team._count.members - displayMembers.length;

            return (
              <Link key={team.id} href={`/dashboard/teams/${team.slug}`}>
                <Card className="h-full border-slate-100 shadow-none transition-all hover:border-indigo-200 hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-4 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-bold text-indigo-600">
                          {team.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-slate-900">
                            {team.name}
                          </h3>
                          <p className="text-sm text-slate-500">/{team.slug}</p>
                        </div>
                      </div>
                      {team.currentUserRole && (
                        <Badge
                          variant="secondary"
                          className={roleColor[team.currentUserRole]}
                        >
                          <RoleIcon className="mr-1 size-3" />
                          {roleLabel[team.currentUserRole]}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="size-3.5" />
                        {team._count.members}{" "}
                        {team._count.members === 1 ? "member" : "members"}
                      </span>
                      <span>
                        {team._count.eventTypes}{" "}
                        {team._count.eventTypes === 1
                          ? "event type"
                          : "event types"}
                      </span>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-2">
                      <AvatarGroup>
                        {displayMembers.map((m) => (
                          <Avatar key={m.id} size="sm">
                            <AvatarImage
                              src={m.user.image ?? m.user.avatarUrl ?? undefined}
                              alt={m.user.name ?? "Member"}
                            />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(m.user.name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {extraCount > 0 && (
                          <AvatarGroupCount className="text-xs">
                            +{extraCount}
                          </AvatarGroupCount>
                        )}
                      </AvatarGroup>

                      <ArrowRight className="size-4 text-slate-400" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Team Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setTeamName("");
            setTeamSlug("");
            setSlugTouched(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a new team</DialogTitle>
            <DialogDescription>
              Teams let you collaborate with others and share event types.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="team-name">Team name</Label>
              <Input
                id="team-name"
                placeholder="My Team"
                value={teamName}
                onChange={(e) => handleNameChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-slug">URL slug</Label>
              <Input
                id="team-slug"
                placeholder="my-team"
                value={teamSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setTeamSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                }}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <p className="text-xs text-muted-foreground">
                scheduleflow.com/team/{teamSlug || "..."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={handleCreate}
              disabled={
                !teamName.trim() ||
                !teamSlug.trim() ||
                createMutation.isPending
              }
            >
              {createMutation.isPending ? "Creating..." : "Create Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
