import { IntervalRunner } from './intervalRunner.js';
import { alertEngine } from '../services/alertEngine.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export function createAlertScheduler(): IntervalRunner {
  return new IntervalRunner({
    name: 'alert-evaluation',
    intervalMs: env.ALERT_EVALUATION_INTERVAL_SECONDS * 1000,
    runOnStart: true,
    task: async () => {
      const summary = await alertEngine.evaluate();
      if (summary.transitions > 0 || summary.durationMs > 1000) {
        logger.info(summary, 'alert evaluation completed');
      } else {
        logger.debug(summary, 'alert evaluation completed');
      }
    },
  });
}
