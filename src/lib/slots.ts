import {
  addMinutes,
  setHours,
  setMinutes,
  isBefore,
  isAfter,
  areIntervalsOverlapping,
  startOfDay,
  format,
  parse,
  getDay,
  addDays,
  isEqual,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export interface ScheduleRule {
  day: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  isActive: boolean;
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface ScheduleOverrideData {
  date: Date;
  isBlocked: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface SlotConfig {
  duration: number; // minutes
  bufferBefore: number; // minutes
  bufferAfter: number; // minutes
  minimumNotice: number; // minutes from now
  maxAdvanceBooking: number; // days
  maxBookingsPerDay: number | null;
  slotInterval?: number; // minutes between slot starts (defaults to duration)
}

export interface GetSlotsParams {
  date: Date; // the date to get slots for (in host timezone)
  hostTimezone: string;
  inviteeTimezone: string;
  schedules: ScheduleRule[];
  overrides: ScheduleOverrideData[];
  existingBookings: BusyInterval[];
  externalBusyTimes: BusyInterval[];
  config: SlotConfig;
  now?: Date; // for testing
}

export interface TimeSlot {
  start: Date; // UTC
  end: Date; // UTC
  startFormatted: string; // in invitee timezone
}

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function setTimeOnDate(date: Date, timeStr: string, timezone: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const zonedDate = toZonedTime(date, timezone);
  const withTime = setMinutes(setHours(startOfDay(zonedDate), hours), minutes);
  return fromZonedTime(withTime, timezone);
}

export function getAvailableSlots(params: GetSlotsParams): TimeSlot[] {
  const {
    date,
    hostTimezone,
    inviteeTimezone,
    schedules,
    overrides,
    existingBookings,
    externalBusyTimes,
    config,
    now = new Date(),
  } = params;

  const {
    duration,
    bufferBefore,
    bufferAfter,
    minimumNotice,
    maxAdvanceBooking,
    maxBookingsPerDay,
    slotInterval = 15,
  } = config;

  // Check if date is within advance booking window
  const maxDate = addDays(now, maxAdvanceBooking);
  if (isAfter(date, maxDate)) {
    return [];
  }

  const dayOfWeek = getDay(toZonedTime(date, hostTimezone));

  // Check for date override
  // The `date` param is already correctly positioned in the host's timezone
  // (converted by the API layer). Override dates from DB are DATE type stored
  // with the raw date in the ISO string.
  const dateStr = toZonedTime(date, hostTimezone)
    .toISOString()
    .split("T")[0];
  const override = overrides.find((o) => {
    const overrideDateStr = o.date.toISOString().split("T")[0];
    return overrideDateStr === dateStr;
  });

  if (override?.isBlocked) {
    return [];
  }

  // Determine available windows for this day
  let windows: { start: Date; end: Date }[] = [];

  if (override && override.startTime && override.endTime) {
    // Use override times
    windows.push({
      start: setTimeOnDate(date, override.startTime, hostTimezone),
      end: setTimeOnDate(date, override.endTime, hostTimezone),
    });
  } else {
    // Use regular schedule
    const daySchedules = schedules.filter(
      (s) => s.day === dayOfWeek && s.isActive
    );

    for (const schedule of daySchedules) {
      windows.push({
        start: setTimeOnDate(date, schedule.startTime, hostTimezone),
        end: setTimeOnDate(date, schedule.endTime, hostTimezone),
      });
    }
  }

  if (windows.length === 0) {
    return [];
  }

  // Combine all busy times
  const allBusyTimes: BusyInterval[] = [
    ...existingBookings.map((b) => ({
      start: addMinutes(b.start, -bufferBefore),
      end: addMinutes(b.end, bufferAfter),
    })),
    ...externalBusyTimes,
  ];

  // Minimum notice cutoff
  const noticeCutoff = addMinutes(now, minimumNotice);

  // Generate slots
  const slots: TimeSlot[] = [];
  let bookingsOnDay = existingBookings.filter((b) => {
    const bookingDate = format(toZonedTime(b.start, hostTimezone), "yyyy-MM-dd");
    return bookingDate === dateStr;
  }).length;

  for (const window of windows) {
    let slotStart = window.start;

    while (
      isBefore(addMinutes(slotStart, duration), window.end) ||
      isEqual(addMinutes(slotStart, duration), window.end)
    ) {
      const slotEnd = addMinutes(slotStart, duration);

      // Check minimum notice
      if (isBefore(slotStart, noticeCutoff)) {
        slotStart = addMinutes(slotStart, slotInterval);
        continue;
      }

      // Check max bookings per day
      if (maxBookingsPerDay !== null && bookingsOnDay >= maxBookingsPerDay) {
        break;
      }

      // Check against busy times (including buffers)
      const slotWithBuffer = {
        start: addMinutes(slotStart, -bufferBefore),
        end: addMinutes(slotEnd, bufferAfter),
      };

      const hasConflict = allBusyTimes.some((busy) =>
        areIntervalsOverlapping(
          { start: slotWithBuffer.start, end: slotWithBuffer.end },
          { start: busy.start, end: busy.end }
        )
      );

      if (!hasConflict) {
        const inviteeStart = toZonedTime(slotStart, inviteeTimezone);
        slots.push({
          start: slotStart,
          end: slotEnd,
          startFormatted: format(inviteeStart, "h:mm a"),
        });
      }

      slotStart = addMinutes(slotStart, slotInterval);
    }
  }

  return slots;
}

/**
 * Get available dates for a month. Returns an array of date strings (YYYY-MM-DD)
 * that have at least one available slot.
 */
export function getAvailableDates(params: {
  year: number;
  month: number; // 0-indexed
  hostTimezone: string;
  inviteeTimezone: string;
  schedules: ScheduleRule[];
  overrides: ScheduleOverrideData[];
  existingBookings: BusyInterval[];
  externalBusyTimes: BusyInterval[];
  config: SlotConfig;
  now?: Date;
}): string[] {
  const { year, month, hostTimezone, ...rest } = params;

  const dates: string[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let current = firstDay;
  while (isBefore(current, addDays(lastDay, 1))) {
    const slots = getAvailableSlots({
      date: current,
      hostTimezone,
      ...rest,
    });

    if (slots.length > 0) {
      dates.push(format(current, "yyyy-MM-dd"));
    }

    current = addDays(current, 1);
  }

  return dates;
}
