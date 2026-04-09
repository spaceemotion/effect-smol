import { bench, describe } from "vitest"
import { exitFail, exitSucceed } from "../src/internal/core.ts"
import { pipe } from "../src/Function.ts"
import {
  as,
  asVoid,
  catchAll,
  exitIsSuccess,
  fail,
  flatMap,
  fnUntraced,
  gen,
  map,
  runSync,
  succeed,
  sync,
  tap
} from "../src/internal/effect.ts"
import * as Option from "../src/Option.ts"
import type * as Effect from "../src/Effect.ts"

// ============================================================================
// Effect Pipeline Benchmarks
// ============================================================================

describe("Effect.succeed / Effect.runSync", () => {
  bench("succeed + runSync", () => {
    runSync(succeed(1))
  })

  bench("succeed + map + runSync", () => {
    runSync(map(succeed(1), (n) => n + 1))
  })

  bench("succeed + flatMap + runSync", () => {
    runSync(flatMap(succeed(1), (n) => succeed(n + 1)))
  })
})

describe("Effect.sync", () => {
  bench("sync + runSync", () => {
    runSync(sync(() => 1))
  })

  bench("sync + map + runSync", () => {
    runSync(map(sync(() => 1), (n) => n + 1))
  })

  bench("sync + flatMap + runSync", () => {
    runSync(flatMap(sync(() => 1), (n) => succeed(n + 1)))
  })
})

describe("Effect pipeline chains", () => {
  bench("chain of 10 flatMaps", () => {
    let eff: Effect.Effect<number> = succeed(0)
    for (let i = 0; i < 10; i++) {
      eff = flatMap(eff, (n) => succeed(n + 1))
    }
    runSync(eff)
  })

  bench("chain of 10 maps", () => {
    let eff: Effect.Effect<number> = succeed(0)
    for (let i = 0; i < 10; i++) {
      eff = map(eff, (n) => n + 1)
    }
    runSync(eff)
  })

  bench("chain of 100 flatMaps", () => {
    let eff: Effect.Effect<number> = succeed(0)
    for (let i = 0; i < 100; i++) {
      eff = flatMap(eff, (n) => succeed(n + 1))
    }
    runSync(eff)
  })

  bench("chain of 100 maps", () => {
    let eff: Effect.Effect<number> = succeed(0)
    for (let i = 0; i < 100; i++) {
      eff = map(eff, (n) => n + 1)
    }
    runSync(eff)
  })
})

describe("Effect.gen", () => {
  bench("gen with 1 yield", () => {
    runSync(
      gen(function*() {
        return yield* succeed(1)
      })
    )
  })

  bench("gen with 5 yields", () => {
    runSync(
      gen(function*() {
        const a = yield* succeed(1)
        const b = yield* succeed(2)
        const c = yield* succeed(3)
        const d = yield* succeed(4)
        const e = yield* succeed(5)
        return a + b + c + d + e
      })
    )
  })

  bench("gen with 10 yields", () => {
    runSync(
      gen(function*() {
        let sum = 0
        for (let i = 0; i < 10; i++) {
          sum += yield* succeed(i)
        }
        return sum
      })
    )
  })
})

describe("Effect.fnUntraced", () => {
  const addOne = fnUntraced(function*(n: number) {
    return yield* succeed(n + 1)
  })

  bench("fnUntraced call", () => {
    runSync(addOne(1))
  })

  const addMany = fnUntraced(function*(n: number) {
    let result = n
    for (let i = 0; i < 5; i++) {
      result = yield* succeed(result + 1)
    }
    return result
  })

  bench("fnUntraced with 5 yields", () => {
    runSync(addMany(0))
  })
})

describe("Effect.tap", () => {
  bench("tap", () => {
    runSync(tap(succeed(1), () => succeed(undefined)))
  })
})

describe("Effect.as / asVoid", () => {
  bench("as", () => {
    runSync(as(succeed(1), 2))
  })

  bench("asVoid", () => {
    runSync(asVoid(succeed(1)))
  })
})

describe("Effect error handling", () => {
  bench("catchAll (no error)", () => {
    runSync(
      catchAll(succeed(1), () => succeed(0))
    )
  })

  bench("catchAll (with error)", () => {
    runSync(
      catchAll(fail("error"), () => succeed(0))
    )
  })
})

// ============================================================================
// Option Benchmarks
// ============================================================================

describe("Option", () => {
  bench("Option.some", () => {
    Option.some(42)
  })

  bench("Option.none", () => {
    Option.none()
  })

  bench("Option.isSome", () => {
    Option.isSome(Option.some(42))
  })

  bench("Option.isNone", () => {
    Option.isNone(Option.none())
  })

  bench("Option.map (Some)", () => {
    Option.map(Option.some(1), (n) => n + 1)
  })

  bench("Option.flatMap (Some)", () => {
    Option.flatMap(Option.some(1), (n) => Option.some(n + 1))
  })

  bench("Option.getOrElse (Some)", () => {
    Option.getOrElse(Option.some(1), () => 0)
  })

  bench("Option.getOrElse (None)", () => {
    Option.getOrElse(Option.none(), () => 0)
  })

  bench("pipe: some -> map -> flatMap -> getOrElse", () => {
    pipe(
      Option.some(1),
      Option.map((n) => n + 1),
      Option.flatMap((n) => n > 0 ? Option.some(n) : Option.none()),
      Option.getOrElse(() => 0)
    )
  })
})

// ============================================================================
// Exit Benchmarks
// ============================================================================

describe("Exit", () => {
  bench("Exit.succeed", () => {
    exitSucceed(1)
  })

  bench("Exit.fail", () => {
    exitFail("error")
  })

  bench("Exit.isSuccess (success)", () => {
    exitIsSuccess(exitSucceed(1))
  })

  bench("Exit.isSuccess (failure)", () => {
    exitIsSuccess(exitFail("error"))
  })
})
