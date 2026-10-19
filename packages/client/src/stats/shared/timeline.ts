import { MINUTE } from "../../core/time.ts";

/** Play this far apart starts a new session */
export const SESSION_GAP = 10 * MINUTE;

// Each collapsed gap takes this share of the width
const BREAK_SHARE = 0.02;

const INTERVALS = [1, 2, 5, 10, 15, 30, 60].map((minutes) => minutes * MINUTE);

const TARGET_BARS = 80;

export interface Session {
  from: number;
  to: number;
}

export interface Break {
  x: number;
  from: number;
  to: number;
}

export interface Timeline {
  /** 0 to 1 across the width, offline time collapsed to a thin break */
  toX: (at: number) => number;
  /** Back from a position to a time, for axis labels */
  toTime: (x: number) => number;
  sessions: Session[];
  breaks: Break[];
}

/** Ranges merged into sessions wherever they sit closer than SESSION_GAP */
export const sessionsOf = (ranges: Session[]): Session[] => {
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const sessions: Session[] = [];

  for (const range of sorted) {
    const last = sessions.at(-1);

    if (last && range.from - last.to <= SESSION_GAP) {
      last.to = Math.max(last.to, range.to);

      continue;
    }

    sessions.push({ ...range });
  }

  return sessions;
};

export const timelineOf = (ranges: Session[]): Timeline => {
  const sessions = sessionsOf(ranges);
  const played = sessions.reduce(
    (total, session) => total + Math.max(1, session.to - session.from),
    0,
  );
  const gaps = Math.max(0, sessions.length - 1);
  const scale = (1 - gaps * BREAK_SHARE) / Math.max(1, played);

  const starts: number[] = [];
  let x = 0;

  for (const session of sessions) {
    starts.push(x);
    x += Math.max(1, session.to - session.from) * scale + BREAK_SHARE;
  }

  const breaks = sessions.slice(1).map((session, index) => ({
    x: starts[index + 1]! - BREAK_SHARE / 2,
    from: sessions[index]!.to,
    to: session.from,
  }));

  const toX = (at: number): number => {
    for (let index = sessions.length - 1; index >= 0; index--) {
      const session = sessions[index]!;

      if (at >= session.from) {
        const into = Math.min(at, session.to) - session.from;

        // Offline time sits on its break
        if (at > session.to && index < sessions.length - 1) {
          return breaks[index]!.x;
        }

        return starts[index]! + into * scale;
      }
    }

    return 0;
  };

  const toTime = (position: number): number => {
    for (let index = sessions.length - 1; index >= 0; index--) {
      if (position >= starts[index]!) {
        const session = sessions[index]!;

        return Math.min(
          session.to,
          session.from + (position - starts[index]!) / scale,
        );
      }
    }

    return sessions[0]?.from ?? 0;
  };

  return { toX, toTime, sessions, breaks };
};

/** The smallest round interval that splits the played time into at most TARGET_BARS */
export const intervalFor = (sessions: Session[]): number => {
  const played = sessions.reduce(
    (total, session) => total + (session.to - session.from),
    0,
  );

  return (
    INTERVALS.find((size) => played / size <= TARGET_BARS) ?? INTERVALS.at(-1)!
  );
};
