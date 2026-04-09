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
