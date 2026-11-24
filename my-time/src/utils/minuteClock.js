const MINUTE_MS = 60_000;

export const getDelayUntilNextMinute = (timestamp = Date.now()) => {
  const remainder = ((timestamp % MINUTE_MS) + MINUTE_MS) % MINUTE_MS;
  return remainder === 0 ? MINUTE_MS : MINUTE_MS - remainder;
};

// Agenda cada atualização a partir do relógio real, evitando acumular drift.
export const startMinuteClock = ({
  onTick,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  subscribeAppState,
}) => {
  let timer = null;
  let stopped = false;

  const schedule = () => {
    if (timer !== null) clearTimer(timer);
    timer = setTimer(tick, getDelayUntilNextMinute(now()));
  };

  const tick = () => {
    if (stopped) return;
    onTick(now());
    schedule();
  };

  const appStateSubscription = subscribeAppState?.((state) => {
    if (state === 'active') tick();
  });

  tick();

  return () => {
    stopped = true;
    if (timer !== null) clearTimer(timer);
    appStateSubscription?.remove?.();
  };
};
