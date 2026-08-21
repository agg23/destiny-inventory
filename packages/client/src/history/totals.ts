import { playedSeconds, type HistoryRun } from "../history.ts";

export interface Totals {
  runs: number;
  seconds: number;
  kills: number;
  deaths: number;
}

export const totalsOf = (runs: HistoryRun[]): Totals => ({
  runs: runs.length,
  seconds: playedSeconds(runs),
  kills: runs.reduce((total, one) => total + one.kills, 0),
  deaths: runs.reduce((total, one) => total + one.deaths, 0),
});

export interface Best {
  runs: number;
  cleared: number;
  fastest: number | undefined;
  score: number;
}

export const bestOf = (runs: HistoryRun[]): Best => {
  const times = runs
    .filter((one) => one.completed)
    .map((one) => one.durationSeconds);

  return {
    runs: runs.length,
    cleared: times.length,
    fastest: times.length > 0 ? Math.min(...times) : undefined,
    score: Math.max(...runs.map((one) => one.score), 0),
  };
};
