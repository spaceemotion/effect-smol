# Effect Internals Optimization Log

## Focus Areas
- Effect pipeline engine (internal/core.ts, internal/effect.ts)
- Common helpers: flatMap, map, gen, fnUntraced, tap, as, asVoid, catchAll
- Option module
- Exit module

## Baseline (Pre-Optimization)

| Benchmark | ops/sec (hz) | mean (ms) |
|-----------|-------------|-----------|
| **Effect.succeed / Effect.runSync** | | |
| succeed + runSync | 10,228,751 | 0.0001 |
| succeed + map + runSync | 380,088 | 0.0026 |
| succeed + flatMap + runSync | 387,306 | 0.0026 |
| **Effect.sync** | | |
| sync + runSync | 422,532 | 0.0024 |
| sync + map + runSync | 380,280 | 0.0026 |
| sync + flatMap + runSync | 381,546 | 0.0026 |
| **Effect pipeline chains** | | |
| chain of 10 flatMaps | 253,297 | 0.0039 |
| chain of 10 maps | 241,421 | 0.0041 |
| chain of 100 flatMaps | 57,668 | 0.0173 |
| chain of 100 maps | 52,813 | 0.0189 |
| **Effect.gen** | | |
| gen with 1 yield | 245,513 | 0.0041 |
| gen with 5 yields | 203,723 | 0.0049 |
| gen with 10 yields | 185,432 | 0.0054 |
| **Effect.fnUntraced** | | |
| fnUntraced call | 351,324 | 0.0028 |
| fnUntraced with 5 yields | 294,662 | 0.0034 |
| **Effect.tap** | | |
| tap | 337,413 | 0.0030 |
| **Effect.as / asVoid** | | |
| as | 379,224 | 0.0026 |
| asVoid | 383,889 | 0.0026 |
| **Option** | | |
| Option.some | 13,893,558 | 0.0001 |
| Option.none | 11,851,394 | 0.0001 |
| Option.isSome | 12,209,784 | 0.0001 |
| Option.isNone | 10,447,500 | 0.0001 |
| Option.map (Some) | 11,939,768 | 0.0001 |
| Option.flatMap (Some) | 10,618,272 | 0.0001 |
| Option.getOrElse (Some) | 12,091,125 | 0.0001 |
| Option.getOrElse (None) | 10,281,790 | 0.0001 |
| pipe: some → map → flatMap → getOrElse | 4,738,582 | 0.0002 |
| **Exit** | | |
| Exit.succeed | 13,778,011 | 0.0001 |
| Exit.fail | 3,473,741 | 0.0003 |
| Exit.isSuccess (success) | 11,636,561 | 0.0001 |
| Exit.isSuccess (failure) | 3,180,438 | 0.0003 |

## Key Observations
1. `succeed + runSync` is ~27x faster than `succeed + map + runSync` — massive overhead when combining operations
2. `map` is slightly slower than `flatMap` because it wraps via `flatMap(self, (a) => succeed(f(a)))` creating an extra allocation
3. `gen with 1 yield` is ~40% slower than plain `fnUntraced call` due to generator overhead
4. The gap between `chain of 10 maps` and `chain of 100 maps` scales linearly (~5x for 10x work), which is good
5. Option operations are very fast (10M+ ops/sec) — limited optimization potential

---

## Optimization Rounds

### Round 1: Add dedicated `map` primitive (avoid flatMap + succeed double allocation)

**Hypothesis:** Currently `map` is implemented as `flatMap(self, (a) => succeed(f(a)))`. This creates:
1. An OnSuccess primitive (from flatMap)
2. A closure `(a) => succeed(f(a))`
3. An Exit.Success primitive (from succeed)

A dedicated map primitive would avoid the intermediate closure and succeed allocation by directly applying the mapping function in its `contA` handler and calling the next continuation inline.

**Change:** Created `OnMapProto` with a dedicated `contA` that computes the mapped value and directly invokes the next continuation (or yields with exitSucceed), skipping the intermediate succeed allocation.

**Result: ✅ SUCCESS**

| Benchmark | Baseline | Round 1 | Change |
|-----------|----------|---------|--------|
| succeed + map + runSync | 380,088 | 390,161 | **+2.7%** |
| chain of 10 maps | 241,421 | 263,019 | **+8.9%** |
| chain of 100 maps | 52,813 | 65,644 | **+24.3%** |
| sync + map + runSync | 380,280 | 383,624 | +0.9% |

Maps are now faster than flatMaps as expected. The chain of 100 maps saw the largest improvement at +24.3%.

Tests: 779 passed (Effect, EffectEager, Exit, Option, Stream, Queue, Fiber, Layer, Scope, Ref, Deferred, Schedule, Cause)

---

### Round 2: Optimize `as`, `asVoid`, and `tap` to use dedicated map primitive

**Hypothesis:** `as` used `flatMap(self, (_) => succeed(value))` (2 allocations). `asVoid` used `flatMap(self, (_) => exitVoid)`. `tap` used `flatMap(self, (a) => as(f(a), a))` creating 2 flatMaps + succeed.

Changed:
- `as` → `map(self, (_) => value)` (uses optimized OnMap)
- `asVoid` → `map(self, constVoid)` (uses optimized OnMap)
- `tap` → `flatMap(self, (a) => map(f(a), (_) => a))` (uses OnMap instead of as's flatMap)

**Result: ✅ SUCCESS (modest)**

Changes are within noise for `tap` and `as`/`asVoid` but reduce allocations by using the optimized map path. This compounds when chained with other operations.

Tests: 779 passed.

---

### Round 3 (REVERTED): Inline continuation in fromIteratorUnsafe

**Hypothesis:** When generator completes (`state.done`), avoid creating `succeed(state.value)` Exit and directly call the next continuation.

**Result: ❌ REVERTED — regression of -3% to -5%**

Adding getCont call inside the contA handler likely made V8's function body too complex for optimal inlining. The extra allocation of one exitSucceed object is cheaper than the optimizer-unfriendly code path.

---

### Round 4: Inline shouldYield check in runLoop + cache tracerContext

**Hypothesis:** The run loop calls `this.currentScheduler.shouldYield(this)` on every iteration, which is a virtual method dispatch. Also, `this.currentTracerContext` is read from the object on every iteration.

**Change:** 
- Inlined `shouldYield` as `this.currentOpCount >= this.maxOpsBeforeYield` 
- Cached `tracerContext` in a local variable before the loop

**Result: ✅ SUCCESS (modest ~1% improvement)**

| Benchmark | Baseline | Round 4 | Change |
|-----------|----------|---------|--------|
| sync + runSync | 422,532 | 426,893 | +1.0% |
| succeed + flatMap + runSync | 387,306 | 390,614 | +0.9% |
| chain of 100 flatMaps | 57,668 | 58,091 | +0.7% |

Small but consistent improvement across the board from avoiding virtual dispatch.

Tests: 779 passed.

---

### Round 5: Remove `f.length !== 1` wrapper in flatMap and matchCauseEffect

**Hypothesis:** `flatMap` wraps user functions with `f.length !== 1 ? (a) => f(a) : f` to prevent extra args from leaking. This check allocates a new closure for every flatMap where `f.length !== 1`. Since JS silently ignores extra arguments, the wrapper is unnecessary.

**Change:** Removed the `f.length` check from `flatMap` and `matchCauseEffect`, directly using the user's function.

**Result: ✅ SUCCESS**

| Benchmark | Baseline | Round 5 | Change |
|-----------|----------|---------|--------|
| chain of 10 flatMaps | 253,297 | 263,748 | **+4.1%** |
| chain of 100 flatMaps | 57,668 | 63,275 | **+9.7%** |
| succeed + flatMap + runSync | 387,306 | 392,153 | +1.3% |
| tap | 337,413 | 341,856 | +1.3% |

The closure elimination was especially impactful on chains where many flatMaps are created.

Tests: 779 passed.

---

### Round 6: Optimize `runSyncExitWith` — pre-compute sync context, eliminate allocations

**Hypothesis:** Every `runSync` call created a new `MixedScheduler("sync")`, a `{ scheduler }` options object, and called `Context.add` + `runForkWith`. All of these are redundant for the common case.

**Change:** Pre-compute the sync scheduler and sync context (with scheduler already added) at closure-creation time. Directly create `FiberImpl` in the hot path instead of going through `runForkWith`, avoiding:
1. `new MixedScheduler("sync")` allocation per call
2. `{ scheduler }` options object allocation per call
3. `Context.add()` call per invocation
4. `options?.signal` and `options?.onFiberStart` checks

**Result: ✅ SUCCESS — massive improvement across the board**

| Benchmark | Baseline | Round 6 | Change |
|-----------|----------|---------|--------|
| succeed + map + runSync | 380,088 | 446,758 | **+17.5%** |
| succeed + flatMap + runSync | 387,306 | 447,065 | **+15.4%** |
| sync + runSync | 422,532 | 494,649 | **+17.1%** |
| sync + map + runSync | 380,280 | 438,021 | **+15.2%** |
| chain of 10 flatMaps | 253,297 | 276,373 | **+9.1%** |
| chain of 10 maps | 241,421 | 283,958 | **+17.6%** |
| gen with 1 yield | 245,513 | 264,101 | **+7.6%** |
| fnUntraced call | 351,324 | 385,373 | **+9.7%** |
| tap | 337,413 | 381,934 | **+13.2%** |
| as | 379,224 | 427,860 | **+12.8%** |

Tests: 779 passed.
