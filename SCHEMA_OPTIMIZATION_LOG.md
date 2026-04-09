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
