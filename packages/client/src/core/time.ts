export const MINUTE = 60_000;

export const HOUR = 3_600_000;

export const DAY = 86_400_000;

export const WEEK = 7 * DAY;

export const dateTime = (at: number): string =>
  new Date(at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const weekdayTime = (at: number): string =>
  new Date(at).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export const fullDateTime = (at: number): string =>
  new Date(at).toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const shortDay = (at: number): string =>
  new Date(at).toLocaleDateString([], { month: "short", day: "numeric" });

export const dateLabel = (at: number): string =>
  new Date(at).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const dayTitle = (day: string): string =>
  new Date(`${day}T12:00:00`).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const shortTime = (at: number): string =>
  new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const timeWithSeconds = (at: number) =>
  new Date(at).toLocaleTimeString();

export const span = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);

  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};

const pad = (value: number): string => String(value).padStart(2, "0");

/** Run length as m:ss, or h:mm:ss past an hour */
export const duration = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const hours = Math.floor(minutes / 60);

  return hours > 0
    ? `${hours}:${pad(minutes % 60)}:${pad(total % 60)}`
    : `${minutes}:${pad(total % 60)}`;
};

export const ago = (at: number): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const then = new Date(at);
  then.setHours(0, 0, 0, 0);
  // DST makes a calendar day 23 or 25 hours
  const days = Math.round((today.getTime() - then.getTime()) / DAY);

  if (days <= 0) {
    return "today";
  }

  if (days === 1) {
    return "yesterday";
  }

  if (days < 60) {
    return `${days} days ago`;
  }

  if (days < 365) {
    const months = Math.floor(days / 30);

    return months === 1 ? "a month ago" : `${months} months ago`;
  }

  const years = Math.floor(days / 365);

  return years === 1 ? "a year ago" : `${years} years ago`;
};
