# Schema Optimization Log

## Baseline (vitest bench)

| Benchmark | ops/sec |
|-----------|---------|
| String (good) | 5,229,417 |
| String (bad) | 1,076,565 |
| Number (good) | 4,966,518 |
| Number (bad) | 1,016,506 |
| Struct({a: String}) good | 2,274,438 |
| Struct({a: String}) bad | 385,314 |
| Struct({name,age,active}) good | 1,212,511 |
| Struct({name,age,active}) bad | 450,248 |
| Array(String) 2 items good | 1,812,512 |
| Array(String) 10 items good | 797,384 |
| Array(String) bad | 484,429 |
| String.check(isNonEmpty) good | 2,790,669 |
| String.check(isNonEmpty) bad | 625,745 |
| Union(A|B) match A good | 956,698 |
| Union(A|B) match B good | 923,303 |
| Union(A|B) bad | 624,674 |
| NumberFromString good | 2,358,260 |
| NumberFromString bad | 2,161,225 |

**Comparison context:** According to existing tinybench results:
- Schema object (good): ~186ns = ~5.4M ops/sec
- Valibot object (good): ~57ns = ~17.5M ops/sec 
- Zod object (good): ~41ns = ~24.4M ops/sec
- Schema is ~3-4x slower than Valibot on the happy path

Tests: All 779 pass (confirmed in previous session).

---

### Round 1: Inline Exit check in `run()` + pre-compute parseOptions in `recur()`

**Changes:**
1. In `run()`: Directly check if parser result is an Exit (avoiding `flatMapEager` dual function overhead and extra function call)
2. In `recur()`: Pre-compute `InternalAnnotations.resolve(ast)?.["parseOptions"]` once at memoization time instead of on every invocation

**Result: ✅ SUCCESS**

| Benchmark | Baseline | Round 1 | Change |
|-----------|----------|---------|--------|
| String (good) | 5,229K | 5,878K | **+12.4%** |
| Number (good) | 4,967K | 5,520K | **+11.1%** |
| Array(String) 10 items good | 797K | 958K | **+20.2%** |
| String.check(isNonEmpty) good | 2,791K | 3,263K | **+16.9%** |
| NumberFromString good | 2,358K | 2,633K | **+11.7%** |
| Struct({a: String}) good | 2,274K | 2,485K | **+9.3%** |
| Array(String) 2 items good | 1,813K | 2,004K | **+10.5%** |

Tests: 447 Schema + 228 Effect = 675 passed.

### Round 2: findFirstIssue for checks path + inline Exit in run()

**Changes:**
1. Added `findFirstIssue()` to SchemaAST that returns the first issue without allocating an array
2. Modified checks path in `recur()` to use `findFirstIssue` first, only allocating array when in "all" errors mode and an issue is found

**Result: ✅ SUCCESS (modest improvement)**

| Benchmark | Round 1 | Round 2 | Change |
|-----------|---------|---------|--------|
| String (good) | 5,878K | 6,337K | **+7.8%** |
| Union(A|B) match B good | 950K | 1,045K | **+10.0%** |
| Struct({a: String}) good | 2,485K | 2,539K | +2.2% |
| NumberFromString good | 2,633K | 2,703K | +2.7% |

Tests: 447 Schema passed.

### Round 3: Pre-compute encoding/checks booleans

Minor optimization to avoid re-reading AST properties on each invocation.

**Result: ✅ SUCCESS (modest)**
- String.check(isNonEmpty) good: 3,387K → 3,535K (+4.4%)

---

### Round 4: Fast-path Objects parser (avoid generator for simple structs)

**Changes:**
Created a specialized non-generator parser for Struct schemas with no index signatures. This avoids:
- Generator object creation overhead
- `fromIteratorEagerUnsafe` wrapper
- `iterator.next()` protocol overhead
Falls back to generator for complex cases (errors="all", onExcessProperty="preserve", non-Exit effects).

**Result: ✅ SUCCESS (MAJOR)**

| Benchmark | Round 3 | Round 4 | Change |
|-----------|---------|---------|--------|
| **Struct({a: String}) good** | 2,565K | 3,567K | **+39.1%** |
| **Struct({a: String}) bad** | 403K | 595K | **+47.6%** |
| **Struct({name,age,active}) good** | 1,320K | 1,575K | **+19.3%** |
| **Union(A|B) match A good** | 959K | 1,281K | **+33.6%** |
| **Union(A|B) match B good** | 936K | 1,128K | **+20.5%** |

Tests: 447 Schema passed.

### Round 5: Fast-path Arrays parser (avoid generator for simple Array(T))

**Changes:**
Created specialized non-generator parser for simple `Array(T)` schemas (no tuple elements, single rest type). Pre-allocates output array with `new Array(len)`.

**Result: ✅ SUCCESS (MAJOR)**

| Benchmark | Round 4 | Round 5 | Change |
|-----------|---------|---------|--------|
| **Array(String) 2 items good** | 2,086K | 3,104K | **+48.8%** |
| **Array(String) 10 items good** | 897K | 1,032K | **+15.0%** |
| **Array(String) bad** | 487K | 571K | **+17.2%** |
| Struct({name,age,active}) good | 1,575K | 1,687K | +7.1% |

Tests: 1155 passed.

### Round 6: Optimize asExit + inline checks path

**Changes:**
1. `asExit`: Check if parser result is already an Exit before calling runSyncExit
2. Checks path in `recur()`: Inline Exit check to avoid flatMapEager closure allocation

**Result: ✅ SUCCESS**

| Benchmark | Round 5 | Round 7 | Change |
|-----------|---------|---------|--------|
| String (good) | 5,911K | 6,324K | +7.0% |
| String.check(isNonEmpty) good | 3,535K | 3,689K | +4.4% |
| Union(A|B) match B good | 1,289K | 1,376K | +6.8% |

---

## Cumulative Results (Baseline → Final)

| Benchmark | Baseline | Final | Change |
|-----------|----------|-------|--------|
| **Struct({a: String}) good** | 2,274K | 3,588K | **+57.8%** |
| **Array(String) 2 items good** | 1,813K | 3,121K | **+72.2%** |
| **Union(A|B) match B good** | 923K | 1,376K | **+49.1%** |
| **Struct({name,age,active}) good** | 1,213K | 1,700K | **+40.2%** |
| **Union(A|B) match A good** | 957K | 1,325K | **+38.5%** |
| **Array(String) 10 items good** | 797K | 1,033K | **+29.6%** |
| **String.check(isNonEmpty) good** | 2,791K | 3,689K | **+32.2%** |
| **String (good)** | 5,229K | 6,324K | **+20.9%** |
| **NumberFromString good** | 2,358K | 2,719K | **+15.3%** |
| **Number (good)** | 4,967K | 5,550K | **+11.7%** |

Tests: 1155 passed (Schema + Effect + Stream + SchemaAST + SchemaGetter + toCodec).
