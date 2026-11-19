import type { BuildResult } from '@/engine';

export type BuildOptions = { dedupe: boolean; foldDiacritics: boolean };
export type BuildRequest = BuildOptions & { id: number; names: string[] };
export type BuildResponse =
  | { id: number; ok: true; result: BuildResult }
  | { id: number; ok: false; message: string };
