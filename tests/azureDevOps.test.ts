import { describe, expect, test } from "bun:test";

import {
  ensureArray,
  ensureRecord,
  normalizeAzureDevOpsDates,
} from "../src/types/azureDevOps";

describe("ensureArray", () => {
  test("回傳原陣列", () => {
    expect(ensureArray([1, 2, 3])).toEqual([1, 2, 3]);
  });

  test("非陣列值回傳空陣列", () => {
    expect(ensureArray(undefined)).toEqual([]);
    expect(ensureArray(null)).toEqual([]);
    expect(ensureArray("foo")).toEqual([]);
  });
});

describe("ensureRecord", () => {
  test("回傳原物件", () => {
    expect(ensureRecord({ a: 1 })).toEqual({ a: 1 });
  });

  test("非物件值回傳空物件", () => {
    expect(ensureRecord(undefined)).toEqual({});
    expect(ensureRecord(null)).toEqual({});
    expect(ensureRecord("foo")).toEqual({});
  });
});

describe("normalizeAzureDevOpsDates", () => {
  test("將 Date 轉為 ISO 字串", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    expect(normalizeAzureDevOpsDates(date)).toBe("2026-01-01T00:00:00.000Z");
  });

  test("遞迴處理巢狀物件與陣列中的 Date", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    const input = { createdDate: date, items: [{ closedDate: date }] };
    expect(normalizeAzureDevOpsDates(input)).toEqual({
      createdDate: "2026-01-01T00:00:00.000Z",
      items: [{ closedDate: "2026-01-01T00:00:00.000Z" }],
    });
  });

  test("非 Date / 物件 / 陣列值原樣回傳", () => {
    expect(normalizeAzureDevOpsDates("foo")).toBe("foo");
    expect(normalizeAzureDevOpsDates(42)).toBe(42);
    expect(normalizeAzureDevOpsDates(null)).toBe(null);
  });
});
