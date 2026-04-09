"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Check, Vote } from "lucide-react";
import { format, parseISO } from "date-fns";

interface PollOption {
  date: string;
  startTime: string;
  endTime: string;
}

interface PollVote {
  name: string;
  email: string;
  selectedOptions: number[];
}

interface PollData {
  id: string;
  title: string;
  description: string | null;
  options: PollOption[];
  votes: PollVote[];
  finalized: boolean;
  host: { name: string | null; username: string | null; avatarUrl: string | null };
}

export default function PollVotingPage() {
  const params = useParams<{ pollId: string }>();
  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/polls/${params.pollId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setPoll(data);
      })
      .finally(() => setLoading(false));
  }, [params.pollId]);

  const toggleOption = (index: number) => {
    setSelected((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  const handleVote = async () => {
    if (!name || !email || selected.length === 0) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/polls/${params.pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, selectedOptions: selected }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to submit vote");
        return;
      }

      setSubmitted(true);
      toast.success("Vote submitted!");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Poll not found</p>
      </div>
    );
  }

  const initials = poll.host.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <Avatar className="w-12 h-12 mx-auto mb-2">
            <AvatarImage src={poll.host.avatarUrl || undefined} />
            <AvatarFallback className="bg-indigo-100 text-indigo-600">
              {initials}
            </AvatarFallback>
          </Avatar>
          <CardTitle>{poll.title}</CardTitle>
          {poll.description && (
            <p className="text-sm text-muted-foreground">{poll.description}</p>
          )}
          <p className="text-xs text-slate-400">
            {poll.votes.length} vote(s) so far
          </p>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">
                Vote submitted!
              </h3>
              <p className="text-sm text-slate-500">
                You&apos;ll be notified when the host finalizes the time.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {poll.options.map((option, index) => {
                  const votesForOption = poll.votes.filter((v) =>
                    v.selectedOptions.includes(index)
                  ).length;

                  return (
                    <button
                      key={index}
                      onClick={() => toggleOption(index)}
                      className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all flex items-center justify-between ${
                        selected.includes(index)
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox checked={selected.includes(index)} />
                        <div>
                          <p className="font-medium">
                            {format(parseISO(option.date), "EEE, MMM d")}
                          </p>
                          <p className="text-xs text-slate-500">
                            {option.startTime} - {option.endTime}
                          </p>
                        </div>
                      </div>
                      {votesForOption > 0 && (
                        <span className="text-xs text-slate-400">
                          {votesForOption} vote(s)
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <Label htmlFor="name">Your name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Your email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleVote}
                disabled={
                  !name || !email || selected.length === 0 || submitting
                }
              >
                {submitting && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                <Vote className="w-4 h-4 mr-2" />
                Submit Vote
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
