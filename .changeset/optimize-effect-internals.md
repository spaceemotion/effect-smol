---
"effect": patch
---

Internal performance optimizations:

**Effect pipeline:**
- Added dedicated `map` primitive (OnMapProto) that avoids intermediate flatMap + succeed allocation
- Optimized `as`, `asVoid`, and `tap` to use the new map primitive
- Inlined `shouldYield` check and cached `tracerContext` in the run loop
- Removed unnecessary `f.length` wrapper closures in `flatMap` and `matchCauseEffect`
- Pre-computed sync context in `runSyncExitWith` to avoid per-call allocations

**Schema parsing:**
- Inlined Exit check in `run()` to avoid `flatMapEager` overhead for sync parsers (+10-20%)
- Pre-computed parse options override in `recur()` memoization (+2-4%)
- Added `findFirstIssue()` to avoid array allocation on the checks happy path
- Created fast-path Objects parser that avoids generator for simple structs (+20-48%)
- Created fast-path Arrays parser that avoids generator for simple Array(T) (+15-49%)
- Optimized `asExit()` to skip `runSyncExit` when result is already an Exit
- Inlined checks path to avoid `flatMapEager` closure allocation for Exit results (+4-6%)
