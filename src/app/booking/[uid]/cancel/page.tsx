"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function CancelBookingPage() {
  const params = useParams<{ uid: string }>();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCancel = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${params.uid}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to cancel booking");
        return;
      }

      toast.success("Booking cancelled");
      router.push(`/booking/${params.uid}`);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 max-w-md w-full p-8">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Cancel Booking</h1>
        <p className="text-sm text-slate-500 mb-6">
          Are you sure you want to cancel this booking? This action cannot be undone.
        </p>

        <div className="mb-6">
          <Label htmlFor="reason">Reason (optional)</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Let the host know why you're cancelling..."
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push(`/booking/${params.uid}`)}
          >
            Keep Booking
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleCancel}
            disabled={submitting}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Cancel Booking
          </Button>
        </div>
      </div>
    </div>
  );
}
