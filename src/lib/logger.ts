type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, message: string, metadata?: Record<string, unknown>) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

export const logger = {
  info(message: string, metadata?: Record<string, unknown>) {
    write("info", message, metadata);
  },
  warn(message: string, metadata?: Record<string, unknown>) {
    write("warn", message, metadata);
  },
  error(message: string, metadata?: Record<string, unknown>) {
    write("error", message, metadata);
  },
};
