#!/usr/bin/env node

function usage() {
  console.log(`Usage:
  node http_burst.mjs --url <url> [--method GET] [--concurrency 10] [--rounds 1]
                    [--timeout-ms 10000] [--header "Key: Value"]... [--body '{"x":1}']

Examples:
  node http_burst.mjs --url http://localhost:3001/health --concurrency 20 --rounds 5
  node http_burst.mjs --url http://localhost:3001/email-ingestion/run --method POST --header "x-bootstrap-token: dev"
`);
}

function parseArgs(argv) {
  const args = {
    method: "GET",
    concurrency: 10,
    rounds: 1,
    timeoutMs: 10000,
    headers: {},
    body: undefined,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      args.help = true;
      continue;
    }
    if (a === "--url") args.url = argv[++i];
    else if (a === "--method") args.method = String(argv[++i] || "GET").toUpperCase();
    else if (a === "--concurrency") args.concurrency = Number(argv[++i]);
    else if (a === "--rounds") args.rounds = Number(argv[++i]);
    else if (a === "--timeout-ms") args.timeoutMs = Number(argv[++i]);
    else if (a === "--body") args.body = argv[++i];
    else if (a === "--header") {
      const raw = argv[++i] || "";
      const sep = raw.indexOf(":");
      if (sep === -1) throw new Error(`Invalid header format: ${raw}`);
      const key = raw.slice(0, sep).trim();
      const value = raw.slice(sep + 1).trim();
      args.headers[key] = value;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }

  return args;
}

async function callOnce(url, options, timeoutMs) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    return {
      ok: true,
      status: response.status,
      durationMs: Date.now() - started,
      bytes: Buffer.byteLength(text),
      preview: text.slice(0, 200),
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error),
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(String(error?.message || error));
    usage();
    process.exit(1);
  }

  if (args.help || !args.url) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  if (!Number.isFinite(args.concurrency) || args.concurrency < 1) {
    throw new Error("--concurrency must be >= 1");
  }
  if (!Number.isFinite(args.rounds) || args.rounds < 1) {
    throw new Error("--rounds must be >= 1");
  }

  const options = {
    method: args.method,
    headers: args.headers,
    body: args.body,
  };

  const summary = {
    url: args.url,
    method: args.method,
    concurrency: args.concurrency,
    rounds: args.rounds,
    timeoutMs: args.timeoutMs,
    startedAt: new Date().toISOString(),
    totalRequests: 0,
    ok: 0,
    failed: 0,
    statuses: {},
    latenciesMs: [],
    sampleErrors: [],
  };

  for (let round = 1; round <= args.rounds; round++) {
    const promises = [];
    for (let i = 0; i < args.concurrency; i++) {
      promises.push(callOnce(args.url, options, args.timeoutMs));
    }
    const results = await Promise.all(promises);
    for (const r of results) {
      summary.totalRequests += 1;
      summary.latenciesMs.push(r.durationMs);
      if (r.ok) {
        summary.ok += 1;
        summary.statuses[r.status] = (summary.statuses[r.status] || 0) + 1;
      } else {
        summary.failed += 1;
        if (summary.sampleErrors.length < 10) summary.sampleErrors.push(r.error);
      }
    }
    console.log(`[round ${round}/${args.rounds}] done`);
  }

  const sortedLat = [...summary.latenciesMs].sort((a, b) => a - b);
  const pct = (p) => sortedLat[Math.min(sortedLat.length - 1, Math.floor((sortedLat.length - 1) * p))] ?? null;
  const output = {
    ...summary,
    latency: {
      minMs: sortedLat[0] ?? null,
      p50Ms: pct(0.5),
      p95Ms: pct(0.95),
      maxMs: sortedLat[sortedLat.length - 1] ?? null,
      avgMs: sortedLat.length ? Math.round(sortedLat.reduce((a, b) => a + b, 0) / sortedLat.length) : null,
    },
    finishedAt: new Date().toISOString(),
  };

  delete output.latenciesMs;
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(String(error?.stack || error));
  process.exit(1);
});

