import { describe, expect, it } from "vitest";
import { centsToMoney, moneyToCents } from "./trading";

describe("TradeCoin monetary rules", () => {
  it("converts prices to cents without floating-point drift", () => {
    expect(moneyToCents("490")).toBe(BigInt(49000));
    expect(moneyToCents("490.5")).toBe(BigInt(49050));
    expect(centsToMoney(BigInt(49050))).toBe("490.50");
  });

  it("preserves exact two-decimal settlement totals", () => {
    expect(centsToMoney(moneyToCents("490.25") * BigInt(10))).toBe("4902.50");
  });

  it("rejects zero, negative, and malformed prices", () => {
    expect(() => moneyToCents("0")).toThrow("greater than zero");
    expect(() => moneyToCents("-10")).toThrow("positive amount");
    expect(() => moneyToCents("10.999")).toThrow("up to 2 decimals");
  });
});

describe("Price-time matching examples", () => {
  it("crosses when the buy price is greater than or equal to the sell price", () => {
    expect(moneyToCents("500") >= moneyToCents("490")).toBe(true);
    expect(moneyToCents("489.99") >= moneyToCents("490")).toBe(false);
  });

  it("uses the resting order price for execution", () => {
    const restingSell = moneyToCents("490");
    const incomingBuy = moneyToCents("500");
    expect(centsToMoney(restingSell)).toBe("490.00");
    expect(centsToMoney(incomingBuy)).toBe("500.00");
  });
});
