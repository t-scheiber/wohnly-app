#!/usr/bin/env node

const endpoint = process.argv[2] ?? process.env.WOHNLY_API_HEALTH_URL ?? "https://api.wohnly.app/api/health";

try {
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    console.error(`API health check failed: ${response.status} ${response.statusText}`);
    process.exit(1);
  }

  const body = await response.json();
  console.log(`API is healthy at ${endpoint}`);
  console.log(JSON.stringify(body, null, 2));
} catch (error) {
  console.error(`API health check failed for ${endpoint}`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
