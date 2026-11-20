import { shuffleRoster, type ShuffleRequest } from './shuffle';
self.onmessage = (event: MessageEvent<ShuffleRequest>) =>
  self.postMessage(shuffleRoster(event.data));
