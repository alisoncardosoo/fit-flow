import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, eqMock, updateMock, fromMock } = vi.hoisted(() => {
  const rpcMock = vi.fn();
  const eqMock = vi.fn();
  const updateMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ update: updateMock }));
  return { rpcMock, eqMock, updateMock, fromMock };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
  },
}));

import { isUsernameAvailable, setUsername, suggestUsername, validateUsernameFormat } from "@/lib/username";

beforeEach(() => {
  vi.clearAllMocks();
});

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

  it("rejeita username longo", () => {
    expect(validateUsernameFormat("a".repeat(21))).toEqual({ ok: false, reason: "Máximo 20 caracteres." });
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

describe("isUsernameAvailable", () => {
  it("retorna true quando rpc responde truthy", async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null });
    await expect(isUsernameAvailable("joao")).resolves.toBe(true);
  });

  it("lança erro quando rpc falha", async () => {
    const error = new Error("rpc error");
    rpcMock.mockResolvedValueOnce({ data: null, error });
    await expect(isUsernameAvailable("joao")).rejects.toThrow("rpc error");
  });
});

describe("setUsername", () => {
  it("valida formato antes de salvar", async () => {
    await expect(setUsername("u1", "ab")).rejects.toThrow("Mínimo 3 caracteres.");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("normaliza e salva username no perfil", async () => {
    eqMock.mockResolvedValueOnce({ error: null });
    await expect(setUsername("u1", "  Joao_123 ")).resolves.toBeUndefined();
    expect(fromMock).toHaveBeenCalledWith("profiles");
    expect(updateMock).toHaveBeenCalledWith({ username: "joao_123" });
    expect(eqMock).toHaveBeenCalledWith("user_id", "u1");
  });

  it("mapeia erro de conflito para mensagem amigável", async () => {
    eqMock.mockResolvedValueOnce({ error: { code: "23505" } });
    await expect(setUsername("u1", "joao_123")).rejects.toThrow("Esse @ já está em uso.");
  });
});
