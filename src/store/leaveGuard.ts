import { hasUnresolvedDraw, sessionStore } from './session';

export function installLeaveGuard(
  target: EventTarget = window,
  session = sessionStore,
): () => void {
  function warn(event: Event) {
    if (!hasUnresolvedDraw(session.getState().draws)) return;
    event.preventDefault();
    (event as BeforeUnloadEvent).returnValue = true;
  }

  target.addEventListener('beforeunload', warn);
  return () => target.removeEventListener('beforeunload', warn);
}
