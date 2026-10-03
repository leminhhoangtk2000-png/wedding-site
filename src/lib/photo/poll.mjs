// One request at a time, hidden-tab pause, jitter and bounded error backoff.
export function startPolling(run, {interval=5000, maxDelay=60000, document: doc=globalThis.document,
  setTimer=setTimeout, clearTimer=clearTimeout, random=Math.random} = {}) {
  let stopped=false, busy=false, terminal=false, timer, errors=0;
  const tick = async () => {
    if (stopped || busy || terminal || doc?.hidden) return;
    busy=true;
    try { terminal=(await run()) === false; errors=0; }
    catch { errors=Math.min(errors+1,4); }
    finally {
      busy=false;
      if (!stopped && !terminal && !doc?.hidden)
        timer=setTimer(tick,Math.min(maxDelay,interval*2**errors)+Math.floor(random()*1000));
    }
  };
  const visibility = () => { clearTimer(timer); if (!doc?.hidden) void tick(); };
  doc?.addEventListener('visibilitychange',visibility);
  void tick();
  return { refresh: () => { terminal=false; clearTimer(timer); return tick(); },
    stop: () => { stopped=true; clearTimer(timer); doc?.removeEventListener('visibilitychange',visibility); } };
}
