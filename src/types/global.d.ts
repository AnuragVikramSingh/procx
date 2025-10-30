// Global type declarations

declare namespace NodeJS {
  interface Timeout {}
  interface Signals {}
  interface MemoryUsage {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  }
  interface CpuUsage {
    user: number;
    system: number;
  }
}
