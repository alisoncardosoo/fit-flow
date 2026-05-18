import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

import { computePeriodRange } from "@/lib/challenges";

afterEach(() => {
  vi.useRealTimers();
});

describe("computePeriodRange", () => {
  it("weekly começa no domingo e termina 7 dias depois", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-13T15:00:00.000Z")); // quarta

    const { starts_at, ends_at } = computePeriodRange("weekly");
    expect(starts_at).toBe("2026-05-10T03:00:00.000Z");
    expect(ends_at).toBe("2026-05-17T03:00:00.000Z");
  });

  it("monthly começa no dia 1 e termina no próximo mês", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T10:00:00.000Z"));

    const { starts_at, ends_at } = computePeriodRange("monthly");
    expect(starts_at).toBe("2026-05-01T03:00:00.000Z");
    expect(ends_at).toBe("2026-06-01T03:00:00.000Z");
  });

  it("custom respeita quantidade de dias", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T10:00:00.000Z"));

    const { starts_at, ends_at } = computePeriodRange("custom", 10);
    expect(starts_at).toBe("2026-05-18T03:00:00.000Z");
    expect(ends_at).toBe("2026-05-28T03:00:00.000Z");
  });
});
