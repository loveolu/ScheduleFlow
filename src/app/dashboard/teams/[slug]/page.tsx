"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Crown,
  Mail,
  MoreHorizontal,
  Plus,
  Shield,
  Trash2,
  User,
  UserMinus,
  Users,
  Calendar,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";

// ---------- Types ----------

interface TeamUser {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  image: string | null;
}

interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  user: TeamUser;
}

interface TeamEventType {
  id: string;
  teamId: string;
  title: string;
  slug: string;
  description: string | null;
  duration: number;
  color: string;
  isActive: boolean;
  requiresConfirmation: boolean;
  createdAt: string;
}

interface TeamDetail {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  plan: string;
  members: TeamMember[];
  eventTypes: TeamEventType[];
  currentUserRole: "OWNER" | "ADMIN" | "MEMBER";
}

// ---------- Helpers ----------

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

const roleBadgeStyle: Record<string, string> = {
  OWNER: "bg-amber-50 text-amber-700 border-0",
  ADMIN: "bg-indigo-50 text-indigo-700 border-0",
  MEMBER: "bg-slate-50 text-slate-600 border-0",
};

// ---------- API calls ----------

async function fetchTeam(slug: string): Promise<TeamDetail> {
  const res = await fetch(`/api/teams/${slug}`);
  if (!res.ok) throw new Error("Failed to fetch team");
  return res.json();
}

async function inviteMember(
  slug: string,
  data: { email: string; role: string }
) {
  const res = await fetch(`/api/teams/${slug}/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to invite member");
  }
  return res.json();
}

async function updateMemberRole(
  slug: string,
  userId: string,
  role: string
) {
  const res = await fetch(`/api/teams/${slug}/members/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to update role");
  }
  return res.json();
}

async function removeMember(slug: string, userId: string) {
  const res = await fetch(`/api/teams/${slug}/members/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to remove member");
  }
  return res.json();
}

async function deleteTeam(slug: string) {
  const res = await fetch(`/api/teams/${slug}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to delete team");
  }
  return res.json();
}

async function createTeamEventType(
  slug: string,
  data: { title: string; slug: string; duration: number }
) {
  const res = await fetch(`/api/teams/${slug}/event-types`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to create event type");
  }
  return res.json();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

// ---------- Component ----------

export default function TeamDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const slug = params.slug;

  // Dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("MEMBER");

  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [eventTypeOpen, setEventTypeOpen] = useState(false);
  const [etTitle, setEtTitle] = useState("");
  const [etSlug, setEtSlug] = useState("");
  const [etDuration, setEtDuration] = useState("30");
  const [etSlugTouched, setEtSlugTouched] = useState(false);

  // Query
  const {
    data: team,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["team", slug],
    queryFn: () => fetchTeam(slug),
  });

  // Mutations
  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      inviteMember(slug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team", slug] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Member invited successfully");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("MEMBER");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateMemberRole(slug, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team", slug] });
      toast.success("Role updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(slug, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team", slug] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Member removed");
      setRemoveTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTeam(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Team deleted");
      router.push("/dashboard/teams");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createEventTypeMutation = useMutation({
    mutationFn: (data: { title: string; slug: string; duration: number }) =>
      createTeamEventType(slug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team", slug] });
      toast.success("Event type created");
      setEventTypeOpen(false);
      setEtTitle("");
      setEtSlug("");
      setEtDuration("30");
      setEtSlugTouched(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canManage =
    team?.currentUserRole === "OWNER" || team?.currentUserRole === "ADMIN";
  const isOwner = team?.currentUserRole === "OWNER";

  const handleEtTitleChange = (value: string) => {
    setEtTitle(value);
    if (!etSlugTouched) {
      setEtSlug(slugify(value));
    }
  };

  // ---------- Loading / Error states ----------

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Separator />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Card className="py-16">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
              <Users className="size-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">Team not found</h3>
            <p className="mb-6 max-w-sm text-muted-foreground">
              The team you are looking for does not exist or you do not have
              access.
            </p>
            <Link href="/dashboard/teams">
              <Button variant="outline">
                <ArrowLeft className="mr-1.5 size-4" />
                Back to Teams
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- Sorted members ----------

  const sortedMembers = [...team.members].sort((a, b) => {
    const order = { OWNER: 0, ADMIN: 1, MEMBER: 2 };
    return order[a.role] - order[b.role];
  });

  // ---------- Render ----------

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/teams"
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-lg font-bold text-indigo-600">
            {team.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{team.name}</h1>
            <p className="text-sm text-muted-foreground">/{team.slug}</p>
          </div>
        </div>

        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon" />}
            >
              <Settings className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                Delete Team
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="members">
        <TabsList variant="line">
          <TabsTrigger value="members">
            <Users className="mr-1.5 size-4" />
            Members ({team.members.length})
          </TabsTrigger>
          <TabsTrigger value="event-types">
            <Calendar className="mr-1.5 size-4" />
            Event Types ({team.eventTypes.length})
          </TabsTrigger>
        </TabsList>

        {/* ---------- Members Tab ---------- */}
        <TabsContent value="members" className="mt-6 space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <Button onClick={() => setInviteOpen(true)}>
                <Mail className="mr-1.5 size-4" />
                Invite Member
              </Button>
            </div>
          )}

          {sortedMembers.length === 0 ? (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center text-center">
                <Users className="mb-3 size-8 text-muted-foreground" />
                <p className="text-muted-foreground">No members yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {sortedMembers.map((member) => {
                const RoleIcon = roleIcon[member.role];

                return (
                  <Card
                    key={member.id}
                    className="border-slate-100 shadow-none"
                  >
                    <CardContent className="flex items-center gap-4 py-4">
                      <Avatar>
                        <AvatarImage
                          src={
                            member.user.image ??
                            member.user.avatarUrl ??
                            undefined
                          }
                          alt={member.user.name ?? "Member"}
                        />
                        <AvatarFallback className="bg-slate-100 text-sm text-slate-600">
                          {getInitials(member.user.name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {member.user.name ?? "Unnamed User"}
                        </p>
                        <p className="truncate text-sm text-slate-500">
                          {member.user.email}
                        </p>
                      </div>

                      <Badge
                        variant="secondary"
                        className={roleBadgeStyle[member.role]}
                      >
                        <RoleIcon className="mr-1 size-3" />
                        {roleLabel[member.role]}
                      </Badge>

                      {canManage &&
                        member.userId !== team.members.find((m) => m.role === "OWNER" && team.members.filter((x) => x.role === "OWNER").length === 1)?.userId && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon-sm" />
                              }
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isOwner && member.role !== "OWNER" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      roleMutation.mutate({
                                        userId: member.userId,
                                        role:
                                          member.role === "ADMIN"
                                            ? "MEMBER"
                                            : "ADMIN",
                                      })
                                    }
                                  >
                                    <Shield className="mr-2 size-4" />
                                    {member.role === "ADMIN"
                                      ? "Demote to Member"
                                      : "Promote to Admin"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      roleMutation.mutate({
                                        userId: member.userId,
                                        role: "OWNER",
                                      })
                                    }
                                  >
                                    <Crown className="mr-2 size-4" />
                                    Make Owner
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {canManage &&
                                member.role !== "OWNER" && (
                                  <DropdownMenuItem
                                    onClick={() => setRemoveTarget(member)}
                                    className="text-destructive"
                                  >
                                    <UserMinus className="mr-2 size-4" />
                                    Remove
                                  </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ---------- Event Types Tab ---------- */}
        <TabsContent value="event-types" className="mt-6 space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <Button onClick={() => setEventTypeOpen(true)}>
                <Plus className="mr-1.5 size-4" />
                New Event Type
              </Button>
            </div>
          )}

          {team.eventTypes.length === 0 ? (
            <Card className="py-16">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
                  <Calendar className="size-8 text-muted-foreground" />
                </div>
                <h3 className="mb-1 text-lg font-semibold">
                  No event types yet
                </h3>
                <p className="mb-6 max-w-sm text-muted-foreground">
                  Create your first team event type to start accepting bookings
                  as a team.
                </p>
                {canManage && (
                  <Button onClick={() => setEventTypeOpen(true)}>
                    <Plus className="mr-1.5 size-4" />
                    Create Event Type
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {team.eventTypes.map((et) => (
                <Card
                  key={et.id}
                  className={`border-slate-100 shadow-none transition-opacity ${!et.isActive ? "opacity-60" : ""}`}
                >
                  <CardContent className="flex items-center gap-4 py-4">
                    <div
                      className="size-10 shrink-0 rounded-lg"
                      style={{ backgroundColor: et.color }}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-slate-900">
                          {et.title}
                        </p>
                        <Badge
                          variant={et.isActive ? "default" : "secondary"}
                        >
                          {et.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {et.requiresConfirmation && (
                          <Badge variant="outline">
                            Requires Confirmation
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {et.duration} min
                        </span>
                        <span>/{et.slug}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ---------- Invite Member Dialog ---------- */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          if (!open) {
            setInviteOpen(false);
            setInviteEmail("");
            setInviteRole("MEMBER");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a member</DialogTitle>
            <DialogDescription>
              Add a team member by their email address. They must already have a
              ScheduleFlow account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  inviteEmail.trim() &&
                  inviteMutation.mutate({
                    email: inviteEmail.trim(),
                    role: inviteRole,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(val) => val && setInviteRole(val)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={() =>
                inviteMutation.mutate({
                  email: inviteEmail.trim(),
                  role: inviteRole,
                })
              }
              disabled={!inviteEmail.trim() || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? "Inviting..." : "Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Remove Member Dialog ---------- */}
      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <strong>{removeTarget?.user.name ?? removeTarget?.user.email}</strong>{" "}
              from the team? They will lose access to all team resources.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() =>
                removeTarget && removeMutation.mutate(removeTarget.userId)
              }
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Delete Team Dialog ---------- */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => !open && setDeleteOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete team</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{team.name}</strong>? This
              action cannot be undone. All team event types and member
              associations will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Create Event Type Dialog ---------- */}
      <Dialog
        open={eventTypeOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEventTypeOpen(false);
            setEtTitle("");
            setEtSlug("");
            setEtDuration("30");
            setEtSlugTouched(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create team event type</DialogTitle>
            <DialogDescription>
              Create a new event type for the team. Members will be able to
              accept bookings for this event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="et-title">Title</Label>
              <Input
                id="et-title"
                placeholder="Team Meeting"
                value={etTitle}
                onChange={(e) => handleEtTitleChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-slug">URL slug</Label>
              <Input
                id="et-slug"
                placeholder="team-meeting"
                value={etSlug}
                onChange={(e) => {
                  setEtSlugTouched(true);
                  setEtSlug(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                  );
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-duration">Duration (minutes)</Label>
              <Input
                id="et-duration"
                type="number"
                min={5}
                max={480}
                value={etDuration}
                onChange={(e) => setEtDuration(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={() =>
                createEventTypeMutation.mutate({
                  title: etTitle.trim(),
                  slug: etSlug.trim(),
                  duration: parseInt(etDuration) || 30,
                })
              }
              disabled={
                !etTitle.trim() ||
                !etSlug.trim() ||
                createEventTypeMutation.isPending
              }
            >
              {createEventTypeMutation.isPending
                ? "Creating..."
                : "Create Event Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
