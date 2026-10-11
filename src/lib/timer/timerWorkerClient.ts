"use client";

/**
 * Robust Web Worker-based timer scheduler that runs on an independent background thread.
 * Immune to browser background tab throttling.
 */
class TimerWorkerClient {
  private worker: Worker | null = null;
  private fallbackInterval: any = null;
  private tickCallbacks: Set<() => void> = new Set();
  private isRunning: boolean = false;
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initWorker();
      this.initBroadcastChannel();
      this.initVisibilityListener();
    }
  }

  private initWorker() {
    try {
      const workerCode = `
        let timerId = null;
        self.onmessage = function(e) {
          if (e.data && e.data.action === 'start') {
            if (timerId) clearInterval(timerId);
            timerId = setInterval(function() {
              self.postMessage({ type: 'tick', timestamp: Date.now() });
            }, e.data.interval || 1000);
          } else if (e.data && e.data.action === 'stop') {
            if (timerId) {
              clearInterval(timerId);
              timerId = null;
            }
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (e) => {
        if (e.data?.type === 'tick') {
          this.notifyTicks();
        }
      };

      this.worker.onerror = () => {
        // Fallback to setInterval if worker throws an error
        this.setupFallback();
      };
    } catch {
      this.setupFallback();
    }
  }

  private initBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('afaire-timer-sync');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'sync_tick') {
            this.notifyTicks();
          }
        };
      } catch {
        // BroadcastChannel unsupported or blocked
      }
    }
  }

  private initVisibilityListener() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // Immediately notify ticks upon becoming visible to catch up UI timestamps
          this.notifyTicks();
        }
      });
    }
  }

  private setupFallback() {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {}
      this.worker = null;
    }
  }

  public start(intervalMs: number = 1000) {
    if (this.isRunning) return;
    this.isRunning = true;

    if (this.worker) {
      this.worker.postMessage({ action: 'start', interval: intervalMs });
    } else {
      if (this.fallbackInterval) clearInterval(this.fallbackInterval);
      this.fallbackInterval = setInterval(() => {
        this.notifyTicks();
      }, intervalMs);
    }
  }

  public stop() {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.worker) {
      this.worker.postMessage({ action: 'stop' });
    }

    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
  }

  public onTick(cb: () => void): () => void {
    this.tickCallbacks.add(cb);
    return () => {
      this.tickCallbacks.delete(cb);
    };
  }

  public broadcast(type: string, payload?: any) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type, payload, timestamp: Date.now() });
      } catch {}
    }
  }

  private notifyTicks() {
    this.tickCallbacks.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
  }
}

export const timerWorkerClient = new TimerWorkerClient();
