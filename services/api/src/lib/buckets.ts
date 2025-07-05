export const STEP_LADDER = [
  1, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21_600, 43_200, 86_400,
] as const;

export function chooseStep(windowSeconds: number, maxPoints: number): number | null {
  if (windowSeconds <= 0 || maxPoints <= 0) {
    return null;
  }

  const required = windowSeconds / maxPoints;
  if (required <= STEP_LADDER[0]) {
    return null;
  }

  for (const step of STEP_LADDER) {
    if (step >= required) {
      return step;
    }
  }

  return STEP_LADDER[STEP_LADDER.length - 1] as number;
}

export function snapStep(requested: number): number {
  for (const step of STEP_LADDER) {
    if (step >= requested) {
      return step;
    }
  }
  return STEP_LADDER[STEP_LADDER.length - 1] as number;
}

export function expectedBuckets(windowSeconds: number, stepSeconds: number): number {
  if (stepSeconds <= 0) {
    return 0;
  }
  return Math.ceil(windowSeconds / stepSeconds);
}
