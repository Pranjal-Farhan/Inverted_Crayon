import pg from "pg";

/**
 * Keeps the app working while the database is asleep or slow to answer.
 *
 * A managed Postgres that has been idle for a while may be suspended; the first connection after
 * that either takes several seconds (it is waking up) or fails outright. With pg's defaults there is
 * no limit on how long a connection attempt waits, so the visitor's page simply hangs until the
 * platform kills it, and a failed attempt is never repeated. This pool fixes both:
 *
 *  - every connection attempt is limited (DB_CONNECT_TIMEOUT_MS, default 7 s) — it covers the TCP
 *    connect AND the database's startup handshake, so a database that accepts the socket but never
 *    answers is also cut off;
 *  - a failed attempt is retried (DB_CONNECT_ATTEMPTS, default 3 tries, short pauses between) — but
 *    only failures that mean "couldn't get a connection / the database isn't up yet". Those happen
 *    before any SQL is sent, so repeating them can never run a query twice. Wrong passwords, missing
 *    databases and errors inside a query are NOT retried and surface immediately.
 *
 * Worst case a request waits about 3 × 7 s + 1.5 s of pauses; a database that wakes in 1–10 s is
 * absorbed silently, which is what the retry buys.
 */

const intFromEnv = (name: string, fallback: number, min: number, max: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : fallback;
};

export const CONNECT_TIMEOUT_MS = intFromEnv("DB_CONNECT_TIMEOUT_MS", 7000, 500, 60_000);
export const CONNECT_ATTEMPTS = intFromEnv("DB_CONNECT_ATTEMPTS", 3, 1, 6);
/** Pauses before the 2nd, 3rd… attempt. */
const BACKOFF_MS = [500, 1000, 2000, 3000, 4000];

const TRANSIENT_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "57P01", // admin_shutdown: "terminating connection due to administrator command"
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now: "the database system is starting up"
  "53300", // too_many_connections
  "08000",
  "08001",
  "08003",
  "08006",
]);

const TRANSIENT_MESSAGE =
  /timeout exceeded when trying to connect|connection terminated|connection timeout|timeout expired|server closed the connection|terminating connection|database system is (starting up|waking|shutting down)|socket hang up|connect (ECONNREFUSED|ETIMEDOUT)|too many (clients|connections)/i;

/** True for "couldn't get a connection" failures that are worth another try. */
export function isTransientConnectError(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && depth < 3; depth++) {
    const err = e as { code?: unknown; message?: unknown; cause?: unknown };
    if (typeof err.code === "string" && TRANSIENT_CODES.has(err.code)) return true;
    if (typeof err.message === "string" && TRANSIENT_MESSAGE.test(err.message)) return true;
    e = err.cause;
  }
  return false;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type ConnectCallback = (err: Error | undefined, client: pg.PoolClient | undefined, done: (release?: unknown) => void) => void;

/**
 * pg.Pool whose connect() retries transient failures. pool.query() — which Prisma's adapter uses for
 * ordinary queries — and pool.connect() — used for interactive transactions — both go through
 * connect(), so this one override covers every database access.
 */
export class ResilientPool extends pg.Pool {
  connect(): Promise<pg.PoolClient>;
  connect(callback: ConnectCallback): void;
  connect(callback?: ConnectCallback): Promise<pg.PoolClient> | void {
    const acquired = this.acquireWithRetry();
    if (!callback) return acquired;
    acquired.then(
      (client) => callback(undefined, client, (release?: unknown) => client.release(release as Error | boolean | undefined)),
      (err: Error) => callback(err, undefined, () => {}),
    );
  }

  private async acquireWithRetry(): Promise<pg.PoolClient> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt++) {
      try {
        return await super.connect();
      } catch (e) {
        lastError = e;
        if (attempt === CONNECT_ATTEMPTS || !isTransientConnectError(e)) break;
        const wait = BACKOFF_MS[attempt - 1] ?? 4000;
        console.warn(`[db] connection attempt ${attempt}/${CONNECT_ATTEMPTS} failed (${(e as Error).message}); retrying in ${wait} ms`);
        await sleep(wait);
      }
    }
    throw lastError;
  }
}

export function resilientPoolConfig(connectionString: string): pg.PoolConfig {
  return {
    connectionString,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    // Notice a half-dead idle socket (a NAT / pooler that silently dropped it) instead of trusting it.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  };
}
