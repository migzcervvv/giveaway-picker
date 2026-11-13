export type Entrant = { id: string; name: string; key: string };

export interface RandomSource {
  nextUint32(): number;
}

export type DrawConfig = { winners: number; backups: number };

export type DrawResult = { winners: Entrant[]; backups: Entrant[] };

export type BuildStats = {
  rawCount: number;
  blankDropped: number;
  duplicatesRemoved: number;
  finalCount: number;
};

export type BuildResult = {
  entrants: Entrant[];
  stats: BuildStats;
  duplicates: { name: string; count: number }[];
};
