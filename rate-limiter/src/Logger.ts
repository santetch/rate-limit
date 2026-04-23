export interface Logger {
  info(message: string, ...meta: any[]): void;
  warn(message: string, ...meta: any[]): void;
  error(message: string, ...meta: any[]): void;
}

export class ConsoleLogger implements Logger {
  info(message: string, ...meta: any[]): void {
    console.log(`[INFO] ${message}`, ...meta);
  }
  warn(message: string, ...meta: any[]): void {
    console.warn(`[WARN] ${message}`, ...meta);
  }
  error(message: string, ...meta: any[]): void {
    console.error(`[ERROR] ${message}`, ...meta);
  }
}

export class NoOpLogger implements Logger {
  info(): void {}
  warn(): void {}
  error(): void {}
}
