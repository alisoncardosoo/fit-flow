import { afterEach, describe, expect, it, vi } from "vitest";
import { inferGoalTrend } from "@/lib/goalTrend";

type GoalWithProgressMock = {
  achieved_at: string | null;
  progress: number;
  created_at: string;
  deadline: string | null;
};

afterEach(() => {
  vi.useRealTimers();
});

describe("inferGoalTrend", () => {
  it("retorna achieved quando a meta já foi conquistada", () => {
    const goal = {
      achieved_at: "2026-05-10T00:00:00.000Z",
      progress: 0.2,
      created_at: "2026-05-01T00:00:00.000Z",
      deadline: null,
    } as GoalWithProgressMock;

    expect(inferGoalTrend(goal as never)).toEqual({
      status: "achieved",
      delta: 0,
      label: "Conquistada",
    });
  });

  it("retorna null quando ainda não há histórico suficiente", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00.000Z"));

    const goal = {
      achieved_at: null,
      progress: 0.1,
      created_at: "2026-05-17T12:00:00.000Z",
      deadline: "2026-06-17T12:00:00.000Z",
    } as GoalWithProgressMock;

    expect(inferGoalTrend(goal as never)).toBeNull();
  });

  it("classifica como improving quando está adiantado da pace esperada", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00.000Z"));

    const goal = {
      achieved_at: null,
      progress: 0.4,
      created_at: "2026-05-08T12:00:00.000Z",
      deadline: "2026-06-07T12:00:00.000Z",
    } as GoalWithProgressMock;

    const trend = inferGoalTrend(goal as never);
    expect(trend?.status).toBe("improving");
    expect((trend?.delta ?? 0) >= 5).toBe(true);
  });

  it("classifica como regressing quando está muito atrás da pace esperada", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00.000Z"));

    const goal = {
      achieved_at: null,
      progress: 0.05,
      created_at: "2026-05-08T12:00:00.000Z",
      deadline: "2026-05-28T12:00:00.000Z",
    } as GoalWithProgressMock;

    const trend = inferGoalTrend(goal as never);
    expect(trend?.status).toBe("regressing");
    expect((trend?.delta ?? 0) <= -10).toBe(true);
  });

  it("classifica como stagnant quando está próximo da pace esperada", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00.000Z"));

    const goal = {
      achieved_at: null,
      progress: 0.2,
      created_at: "2026-05-08T12:00:00.000Z",
      deadline: "2026-06-27T12:00:00.000Z",
    } as GoalWithProgressMock;

    const trend = inferGoalTrend(goal as never);
    expect(trend?.status).toBe("stagnant");
  });
});
