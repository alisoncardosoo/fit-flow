import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("concatena classes simples", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("resolve conflito do tailwind mantendo a última classe", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("ignora valores falsy", () => {
    expect(cn("text-sm", false && "font-bold", undefined, null)).toBe("text-sm");
  });
});
