import { bench, describe } from "vitest"
import { Schema } from "effect"

// ====================================================================
// Schema Benchmarks — vitest bench
// ====================================================================

// ====================================================================
// Primitives
// ====================================================================
describe("Schema primitives", () => {
  const decodeString = Schema.decodeUnknownExit(Schema.String)
  const decodeNumber = Schema.decodeUnknownExit(Schema.Number)
  const goodStr = "hello"
  const goodNum = 42
  const bad = true

  bench("String (good)", () => {
    decodeString(goodStr)
  })
  bench("String (bad)", () => {
    decodeString(bad)
  })
  bench("Number (good)", () => {
    decodeNumber(goodNum)
  })
  bench("Number (bad)", () => {
    decodeNumber(bad)
  })
})

// ====================================================================
// Struct (object)
// ====================================================================
describe("Schema Struct", () => {
  const schema1 = Schema.Struct({ a: Schema.String })
  const decode1 = Schema.decodeUnknownExit(schema1)
  const good1 = { a: "hello" }
  const bad1 = { a: 1 }

  bench("Struct({a: String}) good", () => {
    decode1(good1)
  })
  bench("Struct({a: String}) bad", () => {
    decode1(bad1)
  })

  const schema3 = Schema.Struct({
    name: Schema.String,
    age: Schema.Number,
    active: Schema.Boolean
  })
  const decode3 = Schema.decodeUnknownExit(schema3)
  const good3 = { name: "Alice", age: 30, active: true }
  const bad3 = { name: "Alice", age: "30", active: true }

  bench("Struct({name,age,active}) good", () => {
    decode3(good3)
  })
  bench("Struct({name,age,active}) bad", () => {
    decode3(bad3)
  })
})

// ====================================================================
// Array
// ====================================================================
describe("Schema Array", () => {
  const schema = Schema.Array(Schema.String)
  const decode = Schema.decodeUnknownExit(schema)
  const good2 = ["a", "b"]
  const good10 = Array.from({ length: 10 }, (_, i) => `item${i}`)
  const bad = ["a", 1]

  bench("Array(String) 2 items good", () => {
    decode(good2)
  })
  bench("Array(String) 10 items good", () => {
    decode(good10)
  })
  bench("Array(String) bad", () => {
    decode(bad)
  })
})

// ====================================================================
// Filter (check)
// ====================================================================
describe("Schema Filter", () => {
  const schema = Schema.String.check(Schema.isNonEmpty())
  const decode = Schema.decodeUnknownExit(schema)
  const good = "a"
  const bad = ""

  bench("String.check(isNonEmpty) good", () => {
    decode(good)
  })
  bench("String.check(isNonEmpty) bad", () => {
    decode(bad)
  })
})

// ====================================================================
// Tagged Union
// ====================================================================
describe("Schema TaggedUnion", () => {
  const schema = Schema.Union([
    Schema.Struct({ _tag: Schema.Literal("A"), value: Schema.String }),
    Schema.Struct({ _tag: Schema.Literal("B"), value: Schema.Number })
  ])
  const decode = Schema.decodeUnknownExit(schema)
  const goodA = { _tag: "A" as const, value: "hello" }
  const goodB = { _tag: "B" as const, value: 42 }
  const bad = { _tag: "C", value: "x" }

  bench("Union(A|B) match A good", () => {
    decode(goodA)
  })
  bench("Union(A|B) match B good", () => {
    decode(goodB)
  })
  bench("Union(A|B) bad", () => {
    decode(bad)
  })
})

// ====================================================================
// Transformation
// ====================================================================
describe("Schema Transformation", () => {
  const schema = Schema.NumberFromString
  const decode = Schema.decodeUnknownExit(schema)
  const good = "123"
  const bad = "abc"

  bench("NumberFromString good", () => {
    decode(good)
  })
  bench("NumberFromString bad", () => {
    decode(bad)
  })
})
