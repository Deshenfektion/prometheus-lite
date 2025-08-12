import { logger } from '../lib/logger.js';

export interface IntervalRunnerOptions {
  name: string;
  intervalMs: number;
  task: () => Promise<void>;
  runOnStart?: boolean;
}

export class IntervalRunner {
  private readonly options: IntervalRunnerOptions;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private skipped = 0;

  constructor(options: IntervalRunnerOptions) {
    this.options = options;
  }

  private async tick(): Promise<void> {
    if (this.running) {
      this.skipped += 1;
      logger.warn(
        { runner: this.options.name, skipped: this.skipped },
        'previous run still in flight, skipping tick',
      );
      return;
    }

    this.running = true;
    try {
      await this.options.task();
    } catch (error) {
      logger.error({ err: error, runner: this.options.name }, 'scheduled task failed');
    } finally {
      this.running = false;
    }
  }

  start(): void {
    if (this.timer !== null) {
      return;
    }

    logger.info(
      { runner: this.options.name, intervalMs: this.options.intervalMs },
      'scheduler started',
    );

    this.timer = setInterval(() => {
      void this.tick();
    }, this.options.intervalMs);
    this.timer.unref();

    if (this.options.runOnStart === true) {
      void this.tick();
    }
  }

  async stop(): Promise<void> {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }

    while (this.running) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    logger.info({ runner: this.options.name }, 'scheduler stopped');
  }

  get isRunning(): boolean {
    return this.running;
  }
}
