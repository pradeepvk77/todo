import { AsyncLocalStorage } from "node:async_hooks";

export interface StepTiming {
  name: string;
  durationMs: number;
  queryCount: number;
}

export interface PerfRequestContext {
  name: string;
  startTime: number;
  steps: StepTiming[];
  queryCount: number;
  totalQueryDurationMs: number;
}

const perfStorage = new AsyncLocalStorage<PerfRequestContext>();

export const isPerfDebug = process.env.PERF_DEBUG === "1";

export function recordQueryExecution(durationMs: number) {
  if (!isPerfDebug) return;
  const store = perfStorage.getStore();
  if (store) {
    store.queryCount += 1;
    store.totalQueryDurationMs += durationMs;
  }
}

export async function trackStep<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!isPerfDebug) {
    return fn();
  }
  const store = perfStorage.getStore();
  const queriesBefore = store ? store.queryCount : 0;
  const start = performance.now();
  try {
    const result = await fn();
    const durationMs = performance.now() - start;
    const stepQueries = (store ? store.queryCount : 0) - queriesBefore;
    if (store) {
      store.steps.push({ name, durationMs, queryCount: stepQueries });
    }
    console.log(`[PERF STEP] ${name.padEnd(35)} : ${durationMs.toFixed(2).padStart(8)}ms | queries: ${stepQueries}`);
    return result;
  } catch (err) {
    const durationMs = performance.now() - start;
    const stepQueries = (store ? store.queryCount : 0) - queriesBefore;
    console.log(`[PERF STEP ERROR] ${name.padEnd(35)} : ${durationMs.toFixed(2).padStart(8)}ms | queries: ${stepQueries}`);
    throw err;
  }
}

export async function runWithPerfContext<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!isPerfDebug) {
    return fn();
  }
  const context: PerfRequestContext = {
    name,
    startTime: performance.now(),
    steps: [],
    queryCount: 0,
    totalQueryDurationMs: 0,
  };

  return perfStorage.run(context, async () => {
    try {
      const result = await fn();
      const totalDuration = performance.now() - context.startTime;
      console.log(`\n================== [PERF SUMMARY: ${name}] ==================`);
      console.log(`Total Server Execution : ${totalDuration.toFixed(2)}ms`);
      console.log(`Total DB Queries       : ${context.queryCount} (DB cumulative time: ${context.totalQueryDurationMs.toFixed(2)}ms)`);
      console.log("Steps Breakdown:");
      for (const step of context.steps) {
        console.log(`  - ${step.name.padEnd(35)} : ${step.durationMs.toFixed(2).padStart(8)}ms | queries: ${step.queryCount}`);
      }
      console.log(`============================================================\n`);
      return result;
    } catch (err) {
      console.error(`[PERF SUMMARY ERROR: ${name}]`, err);
      throw err;
    }
  });
}
