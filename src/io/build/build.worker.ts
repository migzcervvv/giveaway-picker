import { buildEntrants } from '@/engine';
import type { BuildRequest, BuildResponse } from './protocol';

globalThis.onmessage = ({ data }: MessageEvent<BuildRequest>) => {
  let response: BuildResponse;
  try {
    response = {
      id: data.id,
      ok: true,
      result: buildEntrants(data.names, data),
    };
  } catch (error) {
    response = {
      id: data.id,
      ok: false,
      message:
        error instanceof Error ? error.message : 'Unable to build the list',
    };
  }
  globalThis.postMessage(response);
};
