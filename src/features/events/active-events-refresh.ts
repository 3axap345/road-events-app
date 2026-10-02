interface AppStateSource {
  currentState: string | null;
  addEventListener(event: 'change', listener: (state: string) => void): { remove(): void };
}

/** Initial fetch belongs to useQuery; this owns only foreground refresh. */
export function bindActiveEventsRefresh(appState: AppStateSource, refresh: () => void) {
  let active = appState.currentState === 'active';
  let timer: ReturnType<typeof setInterval> | undefined;
  const schedule = () => { timer = setInterval(refresh, 60_000); };
  if (active) schedule();
  const subscription = appState.addEventListener('change', (state) => {
    const nextActive = state === 'active';
    if (nextActive === active) return;
    active = nextActive;
    clearInterval(timer);
    if (active) {
      refresh();
      schedule();
    }
  });
  return () => { clearInterval(timer); subscription.remove(); };
}
