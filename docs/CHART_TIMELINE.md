# Chart Timeline: Scrolling Back Through a Run

The simulation charts keep the **whole run** and let you scroll and zoom through
it — during the run and after it ends. Applies to both the built-in Voltage /
Load Demand charts and any custom plots.

---

## What changed

Previously every chart kept a 20-sample rolling buffer and `shift()`ed older
samples off the front. The history wasn't hidden, it was **destroyed** — once a
sample scrolled off there was nothing to scroll back to.

Now the full run is retained and the chart shows a moving window over it.

## Behavior

| Situation | What happens |
| --- | --- |
| Run streaming, untouched | The window stays pinned to the newest samples — looks exactly as before. |
| You pan or zoom mid-run | The view **detaches** from the live edge and stays where you put it, so incoming frames don't yank you forward. |
| You scroll back to the right edge | Re-attaches to live automatically. |
| Detached during a live run | A **● LIVE** button appears in the chart header — one click jumps back. |
| Run ends | The whole run is revealed, ready to scroll. No Live button (there's no live edge to return to). |
| New run starts | History is cleared and the view re-attaches. |

Each chart scrolls independently — moving through Voltage doesn't drag Load
Demand with it.

Controls: mouse wheel to zoom, drag to pan, or use the slider under the axis.

## Under the hood

[`src/hooks/useChartTimeline.js`](../src/hooks/useChartTimeline.js) owns all of
it, and both chart components use it, so their behavior can't drift apart.

- **Retention** — `MAX_HISTORY_POINTS` (3600 samples ≈ 3 hours at a 3 s publish
  period). The buffers are plain number arrays, so even the widest chart costs a
  few hundred kB. `trimHistory()` drops the oldest sample past the cap.
- **The window** — `LIVE_WINDOW_POINTS` (20) matches the old fixed buffer, so a
  running simulation looks unchanged; the history simply sits off-screen to the
  left instead of being thrown away.
- **Follow vs. detached** — a `following` ref, flipped off by any user
  `dataZoom` event and back on when the window's right edge reaches 100%.
  Programmatic zooms set a `selfDriven` flag first so the hook doesn't mistake
  its own scrolling for the user's.
- **Reset between runs** — `startSimulation` emits a `sim-run-start` socket-helper
  event. That's a distinct signal from `sim-state-change: "running"`, which also
  fires on *resume* — resuming a paused run must not wipe its history.
- **No `start`/`end` in the declarative option** — ReactECharts re-applies the
  option on every render (a dark-mode toggle, a resize). Naming the range there
  would snap the user's scroll position back each time.

## Limitations

- **A custom plot created mid-run starts empty.** Plots accumulate from the live
  stream, and there's no central buffer of raw frames to backfill from —
  retaining every measurement of a 9500-node feeder for thousands of frames
  would cost hundreds of MB. Create the plots you want before starting the run.
- **History does not survive loading a new model.** The charts unmount when the
  simulation detaches, which is intended: the data belonged to the old model.
- **Not persisted.** A page reload loses the run.

## Files

| File | Role |
| --- | --- |
| [`src/hooks/useChartTimeline.js`](../src/hooks/useChartTimeline.js) | Retention cap, follow/detach logic, zoom config, run-reset wiring. |
| [`src/components/plots/LiveButton.jsx`](../src/components/plots/LiveButton.jsx) | The "jump back to live" affordance, shared by both chart types. |
| [`src/components/SimulationCharts.jsx`](../src/components/SimulationCharts.jsx) | Built-in Voltage / Load Demand charts. |
| [`src/components/plots/CustomPlot.jsx`](../src/components/plots/CustomPlot.jsx) | User-created per-measurement plots. |
| [`src/socket-client-helper/SocketClientHelper.js`](../src/socket-client-helper/SocketClientHelper.js) | Emits `sim-run-start`. |
