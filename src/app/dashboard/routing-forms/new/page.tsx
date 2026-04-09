"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";

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

export default function NewRoutingFormPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FormField[]>([
    {
      id: "q1",
      label: "",
      type: "select",
      options: [
        { label: "", value: "option-1", routeToEventTypeId: "" },
        { label: "", value: "option-2", routeToEventTypeId: "" },
      ],
    },
  ]);

  const { data: eventTypes = [] } = useQuery({
    queryKey: ["event-types"],
    queryFn: () => fetch("/api/event-types").then((r) => r.json()),
  });

  const addField = () => {
    setFields([
      ...fields,
      {
        id: `q${fields.length + 1}`,
        label: "",
        type: "select",
        options: [
          { label: "", value: `option-1`, routeToEventTypeId: "" },
          { label: "", value: `option-2`, routeToEventTypeId: "" },
        ],
      },
    ]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...updates };
    setFields(updated);
  };

  const addOption = (fieldIndex: number) => {
    const updated = [...fields];
    updated[fieldIndex].options.push({
      label: "",
      value: `option-${updated[fieldIndex].options.length + 1}`,
      routeToEventTypeId: "",
    });
    setFields(updated);
  };

  const updateOption = (
    fieldIndex: number,
    optionIndex: number,
    updates: Partial<FormField["options"][0]>
  ) => {
    const updated = [...fields];
    updated[fieldIndex].options[optionIndex] = {
      ...updated[fieldIndex].options[optionIndex],
      ...updates,
    };
    setFields(updated);
  };

  const handleSubmit = async () => {
    if (!title || !slug || fields.length === 0) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/routing-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, slug, description, fields }),
      });

      if (!res.ok) {
        toast.error("Failed to create routing form");
        return;
      }

      toast.success("Routing form created!");
      router.push("/dashboard/routing-forms");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/dashboard/routing-forms")}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        Create Routing Form
      </h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Form Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")
                  );
                }}
                placeholder="How can we help you?"
              />
            </div>
            <div>
              <Label>URL slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="how-can-we-help"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Answer a few questions to find the right meeting type"
              />
            </div>
          </CardContent>
        </Card>

        {fields.map((field, fieldIndex) => (
          <Card key={field.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Question {fieldIndex + 1}
                </CardTitle>
                {fields.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeField(fieldIndex)}
                  >
                    <Trash2 className="w-4 h-4 text-slate-400" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Question text</Label>
                <Input
                  value={field.label}
                  onChange={(e) =>
                    updateField(fieldIndex, { label: e.target.value })
                  }
                  placeholder="Are you a new or existing customer?"
                />
              </div>
              <div>
                <Label>Options</Label>
                <div className="space-y-2 mt-2">
                  {field.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex gap-2">
                      <Input
                        value={option.label}
                        onChange={(e) =>
                          updateOption(fieldIndex, optionIndex, {
                            label: e.target.value,
                            value: e.target.value
                              .toLowerCase()
                              .replace(/\s+/g, "-"),
                          })
                        }
                        placeholder="Option label"
                        className="flex-1"
                      />
                      <Select
                        value={option.routeToEventTypeId || ""}
                        onValueChange={(value) =>
                          value &&
                          updateOption(fieldIndex, optionIndex, {
                            routeToEventTypeId: value,
                          })
                        }
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Route to..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            eventTypes as Array<{
                              id: string;
                              title: string;
                            }>
                          ).map((et) => (
                            <SelectItem key={et.id} value={et.id}>
                              {et.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addOption(fieldIndex)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add option
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button variant="outline" onClick={addField} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Question
        </Button>

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={!title || !slug || fields.length === 0 || submitting}
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Create Routing Form
        </Button>
      </div>
    </div>
  );
}
