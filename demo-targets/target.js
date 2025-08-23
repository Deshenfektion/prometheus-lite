import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8080);
const NAME = process.env.TARGET_NAME ?? 'demo-target';
const BASE_LATENCY_MS = Number(process.env.BASE_LATENCY_MS ?? 40);
const JITTER_MS = Number(process.env.JITTER_MS ?? 20);
const FAILURE_RATE = Number(process.env.FAILURE_RATE ?? 0);
const SPIKE_RATE = Number(process.env.SPIKE_RATE ?? 0.01);
const SPIKE_FACTOR = Number(process.env.SPIKE_FACTOR ?? 8);
const BASE_CPU = Number(process.env.BASE_CPU ?? 30);
const BASE_MEMORY = Number(process.env.BASE_MEMORY ?? 50);
const BASE_RPS = Number(process.env.BASE_RPS ?? 100);

const startedAt = Date.now();
let served = 0;

function wave(periodSeconds, amplitude) {
  const elapsed = (Date.now() - startedAt) / 1000;
  return Math.sin((elapsed / periodSeconds) * Math.PI * 2) * amplitude;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function nextLatency() {
  const spiking = Math.random() < SPIKE_RATE;
  const jitter = (Math.random() - 0.5) * JITTER_MS;
  const base = BASE_LATENCY_MS + wave(120, JITTER_MS) + jitter;
  return Math.max(1, spiking ? base * SPIKE_FACTOR : base);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const server = createServer(async (request, response) => {
  if (request.url !== '/health') {
    response.writeHead(404).end();
    return;
  }

  served += 1;
  await sleep(nextLatency());

  if (Math.random() < FAILURE_RATE) {
    response.writeHead(503, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'unhealthy', service: NAME }));
    return;
  }

  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(
    JSON.stringify({
      status: 'ok',
      service: NAME,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      metrics: {
        cpu_percent: Number(clamp(BASE_CPU + wave(180, 12) + Math.random() * 4, 0, 100).toFixed(2)),
        memory_percent: Number(
          clamp(BASE_MEMORY + wave(600, 6) + Math.random() * 2, 0, 100).toFixed(2),
        ),
        requests_per_second: Number(
          clamp(BASE_RPS + wave(240, BASE_RPS * 0.3), 0, 1_000_000).toFixed(2),
        ),
      },
      served,
    }),
  );
});

server.listen(PORT, () => {
  process.stdout.write(`${NAME} listening on ${PORT}\n`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
