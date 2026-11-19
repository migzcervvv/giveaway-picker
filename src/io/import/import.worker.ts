import { createParser } from './parser';
import type { Request, Response } from './protocol';

const parse = createParser();
self.onmessage = ({ data }: MessageEvent<Request>) => {
  let response: Response;
  try { response = { id: data.id, value: parse(data) }; }
  catch (error) {
    response = { id: data.id, error: error instanceof Error ? error.message : 'Import failed.' };
  }
  self.postMessage(response);
};
