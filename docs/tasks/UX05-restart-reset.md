---
id: UX05
status: done
depends_on: [UX04]
---

# UX05 — Restart, cancel and reset safely (depends on UX04)

**User experience:** Controls accessible while a draw or presentation is in progress via a privacy-safe operator pathway; avoid forcing the host to mark every pending winner before restarting.

- **Replay Reveal** may alternatively be implemented in UX07. It *never* selects new winners or appends a new draw; replay only already-disclosed names on the current page, never covertly disclose future ones.
- **Restart Round:** explicit confirmation with clear warning; **persist an auditable CANCELLED/VOIDED event for the most recent active draw** before releasing its unawarded/pending/standby spots; preserve that original draw and its names in read-only History/export with an obvious canceled status. Then return to setup using the same roster, allowing a **new separately saved** secure draw. Do not overwrite the existing draw or delete it. A cancelled draw is not an unresolved draw.
- **Eligibility policy for a cancelled round:** selected-but-not-awarded pending/promoted/standby entrants are eligible again; previously **CALLED** entrants remain excluded per the existing removeCalled preference; **NO_SHOW** entrants remain excluded per D-006. This distinction is required even if the round had already processed some winners. Cancellation of a completed round is **not** a generic re-roll button.
- **Reset Session:** accessible even if draws are unresolved. Confirmation offers **Keep roster** or **Clear roster**. Cancel/close any unresolved current-session draws by persisted auditable events before detaching them, then reset the in-memory session, disclosure/pagination/progress and appropriate counts. **History remains intact.** Keeping the roster starts a fresh independent session; explicitly warn that earlier awarded people can be eligible again because past draw IDs must not be correlated to a new pool (D-020). Clearing roster empties input as well. Preserve imported comma-in-name semantics if keeping/rebuilding the roster. Do not silently reset the archived history or erase entries.
- UI cancel/reset confirmations must be **on a non-public restricted control surface**, not expose future winners, backups, raw list or unfiltered `drawFlow.announcement` on the projected stage. Standby optional within UX05 if required for safe controls; do the normal UI in UX07.
- Engine: add typed CANCELLED event (or equivalently explicit immutable status) through pure engine + store + repository log, update `deriveState` and `eligiblePool`, `hasUnresolvedDraw`, export/archive presentation. Keep original slot order, SHA/hash, event history and reproducibility. Do not make cancellation equivalent to deleting a record.
- Correct write order and generation checks: do not detach or start replacement until cancellation persistence succeeds; retry safely after failed writes, and avoid stale UI callbacks/timers re-attaching a cancelled draw. Only latest active draw can Restart Round; reset may process multiple open draws; if partial failure, preserve retriable state and show a safe generic error.
- Test: restart before any reveal, after six of seven revealed, during active shuffle, after called/no-show & backup promotion, multiple open draws, persistence failure, concurrent clicks, reset keep/clear, full archive JSON/CSV/XLSX, reload, fairness/no-duplicate eligibility and no leaked selected names. No unrelated data migrations, backend or network.
- Ensure normal "Next round" existing behavior and historic records still work.
