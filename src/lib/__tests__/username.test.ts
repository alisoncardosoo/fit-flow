import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

import { suggestUsername, validateUsernameFormat } from "@/lib/username";

describe("validateUsernameFormat", () => {
  it("normaliza e valida username válido", () => {
    expect(validateUsernameFormat("  Joao_123 ")).toEqual({ ok: true, value: "joao_123" });
  });

  it("rejeita username curto", () => {
    expect(validateUsernameFormat("ab")).toEqual({ ok: false, reason: "Mínimo 3 caracteres." });
  });

  it("rejeita caracteres inválidos", () => {
    expect(validateUsernameFormat("joao-123")).toEqual({
      ok: false,
      reason: "Use apenas letras minúsculas, números, '_' ou '.'.",
    });
  });
});

describe("suggestUsername", () => {
  it("remove acentos e símbolos", () => {
    expect(suggestUsername("João Silva!!!")).toBe("joaosilva");
  });

  it("gera fallback quando seed não tem caracteres válidos", () => {
    const value = suggestUsername("@@");
    expect(value).toMatch(/^atleta\d{4}$/);
  });
});
