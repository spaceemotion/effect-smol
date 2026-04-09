---
"effect": patch
---

Internal performance optimizations:
- Added dedicated `map` primitive (OnMapProto) that avoids intermediate flatMap + succeed allocation
- Optimized `as`, `asVoid`, and `tap` to use the new map primitive
- Inlined `shouldYield` check and cached `tracerContext` in the run loop
- Removed unnecessary `f.length` wrapper closures in `flatMap` and `matchCauseEffect`
- Pre-computed sync context in `runSyncExitWith` to avoid per-call allocations
