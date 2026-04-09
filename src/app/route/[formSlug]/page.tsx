"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, GitBranch } from "lucide-react";

interface FormField {
  id: string;
  label: string;
  type: "select" | "radio";
  options: Array<{
    label: string;
    value: string;
    routeToEventTypeId?: string;
    routeToUrl?: string;
  }>;
}

export default function RoutingFormPage() {
  const params = useParams<{ formSlug: string }>();
  const router = useRouter();
  const [form, setForm] = useState<{
    title: string;
    description?: string;
    fields: FormField[];
    user?: { username: string };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/public/routing-forms/${params.formSlug}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setForm(data);
      })
      .finally(() => setLoading(false));
  }, [params.formSlug]);

  const handleSubmit = () => {
    if (!form) return;

    // Find the route based on the last field's answer
    for (const field of form.fields) {
      const answer = answers[field.id];
      if (answer) {
        const option = field.options.find((o) => o.value === answer);
        if (option?.routeToUrl) {
          router.push(option.routeToUrl);
          return;
        }
        if (option?.routeToEventTypeId && form.user?.username) {
          // Look up the event type slug — for now redirect to the user's profile
          router.push(`/${form.user.username}`);
          return;
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Form not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <GitBranch className="w-6 h-6 text-indigo-600" />
          </div>
          <CardTitle>{form.title}</CardTitle>
          {form.description && (
            <p className="text-sm text-muted-foreground">{form.description}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {form.fields.map((field) => (
            <div key={field.id}>
              <Label className="mb-3 block">{field.label}</Label>
              <div className="space-y-2">
                {field.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      setAnswers({ ...answers, [field.id]: option.value })
                    }
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                      answers[field.id] === option.value
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < form.fields.length}
          >
            Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
