import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(
    /^[a-z0-9-]+$/,
    "Username can only contain lowercase letters, numbers, and hyphens"
  );

export const eventTypeSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  description: z.string().max(500).optional(),
  duration: z.number().int().min(5).max(480).default(30),
  color: z.string().default("#6366F1"),
  isActive: z.boolean().default(true),
  requiresConfirmation: z.boolean().default(false),
  maxInvitees: z.number().int().min(1).default(1),
  bufferTimeBefore: z.number().int().min(0).default(0),
  bufferTimeAfter: z.number().int().min(0).default(0),
  minimumNotice: z.number().int().min(0).default(60),
  maxAdvanceBooking: z.number().int().min(1).default(60),
  maxBookingsPerDay: z.number().int().min(1).nullable().optional(),
  collectPayment: z.boolean().default(false),
  price: z.number().int().min(0).nullable().optional(),
  currency: z.string().default("USD"),
  locations: z
    .array(
      z.object({
        type: z.string(),
        value: z.string().optional(),
        label: z.string().optional(),
      })
    )
    .default([]),
  questions: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["text", "textarea", "select", "checkbox", "phone", "email"]),
        label: z.string(),
        required: z.boolean().default(false),
        options: z.array(z.string()).optional(),
        placeholder: z.string().optional(),
      })
    )
    .default([]),
  redirectUrl: z.string().url().optional().or(z.literal("")),
  hideEventTypeDetails: z.boolean().default(false),
});

export const bookingSchema = z.object({
  eventTypeId: z.string(),
  startTime: z.string().datetime(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  timezone: z.string(),
  notes: z.string().max(500).optional(),
  guests: z
    .array(
      z.object({
        name: z.string(),
        email: z.string().email(),
      })
    )
    .optional(),
  responses: z.record(z.string(), z.unknown()).optional(),
});

export const availabilityScheduleSchema = z.object({
  name: z.string().min(1).max(50),
  isDefault: z.boolean().default(false),
  eventTypeId: z.string().optional(),
  schedules: z.array(
    z.object({
      day: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm format"),
      endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm format"),
      isActive: z.boolean().default(true),
    })
  ),
});

export const scheduleOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
  isBlocked: z.boolean().default(false),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reason: z.string().max(200).optional(),
});

export const profileSchema = z.object({
  name: z.string().min(2).max(50),
  username: usernameSchema,
  timezone: z.string(),
  bio: z.string().max(300).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EventTypeInput = z.infer<typeof eventTypeSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
export type AvailabilityScheduleInput = z.infer<typeof availabilityScheduleSchema>;
export type ScheduleOverrideInput = z.infer<typeof scheduleOverrideSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
