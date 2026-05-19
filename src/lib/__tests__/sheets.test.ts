import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { nextSheetName } from "@/lib/sheets";

describe("nextSheetName", () => {
  it("retorna A quando não há fichas", () => {
    expect(nextSheetName([])).toBe("A");
  });

  it("retorna próxima letra disponível ignorando espaços e case", () => {
    const existing = [{ name: " a " }, { name: "C" }, { name: "b" }];
    expect(nextSheetName(existing)).toBe("D");
  });

  it("retorna fallback quando A..J já estão em uso", () => {
    const existing = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map((name) => ({ name }));
    expect(nextSheetName(existing)).toBe("Ficha 11");
  });
});
