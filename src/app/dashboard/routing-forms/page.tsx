"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch, Plus, ExternalLink, Copy } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function RoutingFormsPage() {
  const { data: forms = [], isLoading } = useQuery({
    queryKey: ["routing-forms"],
    queryFn: () => fetch("/api/routing-forms").then((r) => r.json()),
  });

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/route/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Routing Forms</h1>
          <p className="text-sm text-slate-500">
            Qualify invitees and route them to the right event type
          </p>
        </div>
        <Button size="sm">
          <Link href="/dashboard/routing-forms/new">
            <Plus className="w-4 h-4 mr-2" />
            New Form
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : forms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GitBranch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              No routing forms yet
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Create a routing form to qualify invitees before they book.
            </p>
            <Button size="sm">
              <Link href="/dashboard/routing-forms/new">Create your first form</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {forms.map((form: { id: string; title: string; slug: string; fields: unknown[] }) => (
            <Card key={form.id}>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-900">{form.title}</h3>
                  <p className="text-xs text-slate-500">
                    {(form.fields as unknown[]).length} question(s)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyLink(form.slug)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Link href={`/route/${form.slug}`} target="_blank">
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
