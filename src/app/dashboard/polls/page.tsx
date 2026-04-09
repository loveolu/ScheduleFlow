"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Vote, Copy, ExternalLink, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";

interface PollOption {
  date: string;
  startTime: string;
  endTime: string;
}

interface Poll {
  id: string;
  title: string;
  slug: string;
  options: PollOption[];
  votes: unknown[];
  inviteeEmails: string[];
  createdAt: string;
}

export default function PollsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newPoll, setNewPoll] = useState({
    title: "",
    description: "",
    inviteeEmails: "",
    options: [
      { date: "", startTime: "09:00", endTime: "10:00" },
      { date: "", startTime: "09:00", endTime: "10:00" },
    ],
  });

  const { data: polls = [], isLoading } = useQuery<Poll[]>({
    queryKey: ["polls"],
    queryFn: () => fetch("/api/polls").then((r) => r.json()),
  });

  const createPoll = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newPoll.title,
          description: newPoll.description || undefined,
          options: newPoll.options.filter((o) => o.date),
          inviteeEmails: newPoll.inviteeEmails
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Failed to create poll");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
      toast.success("Poll created!");
      setShowCreate(false);
      setNewPoll({
        title: "",
        description: "",
        inviteeEmails: "",
        options: [
          { date: "", startTime: "09:00", endTime: "10:00" },
          { date: "", startTime: "09:00", endTime: "10:00" },
        ],
      });
    },
    onError: () => toast.error("Failed to create poll"),
  });

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/polls/${id}`);
    toast.success("Link copied!");
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Booking Polls</h1>
          <p className="text-sm text-slate-500">
            Let invitees vote on the best time
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Poll
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Booking Poll</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={newPoll.title}
                  onChange={(e) =>
                    setNewPoll({ ...newPoll, title: e.target.value })
                  }
                  placeholder="Team standup time"
                />
              </div>
              <div>
                <Label>Invitee emails (comma-separated)</Label>
                <Input
                  value={newPoll.inviteeEmails}
                  onChange={(e) =>
                    setNewPoll({ ...newPoll, inviteeEmails: e.target.value })
                  }
                  placeholder="alice@example.com, bob@example.com"
                />
              </div>
              <div>
                <Label>Time options</Label>
                <div className="space-y-2">
                  {newPoll.options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        type="date"
                        value={opt.date}
                        onChange={(e) => {
                          const opts = [...newPoll.options];
                          opts[i] = { ...opt, date: e.target.value };
                          setNewPoll({ ...newPoll, options: opts });
                        }}
                        className="flex-1"
                      />
                      <Input
                        type="time"
                        value={opt.startTime}
                        onChange={(e) => {
                          const opts = [...newPoll.options];
                          opts[i] = { ...opt, startTime: e.target.value };
                          setNewPoll({ ...newPoll, options: opts });
                        }}
                        className="w-28"
                      />
                      <Input
                        type="time"
                        value={opt.endTime}
                        onChange={(e) => {
                          const opts = [...newPoll.options];
                          opts[i] = { ...opt, endTime: e.target.value };
                          setNewPoll({ ...newPoll, options: opts });
                        }}
                        className="w-28"
                      />
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setNewPoll({
                        ...newPoll,
                        options: [
                          ...newPoll.options,
                          { date: "", startTime: "09:00", endTime: "10:00" },
                        ],
                      })
                    }
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add option
                  </Button>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => createPoll.mutate()}
                disabled={!newPoll.title || createPoll.isPending}
              >
                {createPoll.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                Create Poll
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : polls.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Vote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              No polls yet
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Create a poll to let invitees vote on the best meeting time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {polls.map((poll) => (
            <Card key={poll.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-slate-900">{poll.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {poll.options.length} options
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {poll.votes.length} votes
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyLink(poll.id)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Link href={`/polls/${poll.id}`} target="_blank">
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
