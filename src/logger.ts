/**
 * 统一日志工具
 * 格式化输出每个模块的操作结果，追踪数据流动
 */

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

type LogModule =
  | "DataPrep"
  | "Index"
  | "Retrieval"
  | "Generation"
  | "Main";

const MODULE_COLORS: Record<LogModule, string> = {
  DataPrep: COLORS.cyan,
  Index: COLORS.green,
  Retrieval: COLORS.yellow,
  Generation: COLORS.magenta,
  Main: COLORS.blue,
};

function timestamp(): string {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function formatValue(value: unknown, maxLen = 200): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") {
    return value.length > maxLen ? value.slice(0, maxLen) + "..." : value;
  }
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === "object") {
    const str = JSON.stringify(value, null, 2);
    return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
  }
  return String(value);
}

/** 记录一次操作的输入和输出 */
function logStep(
  module: LogModule,
  action: string,
  data?: Record<string, unknown>,
) {
  const color = MODULE_COLORS[module];
  const line = "─".repeat(50);
  console.log(
    `\n${COLORS.dim}${timestamp()}${COLORS.reset} ${color}[${module}]${COLORS.reset} ${action}`,
  );
  if (data) {
    console.log(`${COLORS.dim}${line}${COLORS.reset}`);
    for (const [key, val] of Object.entries(data)) {
      console.log(`  ${color}${key}:${COLORS.reset} ${formatValue(val)}`);
    }
    console.log(`${COLORS.dim}${line}${COLORS.reset}`);
  }
}

/** 记录一个操作的耗时 */
function startTimer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

export const log = { step: logStep, timer: startTimer };
