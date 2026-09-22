import { Client } from "pg";
import { EventEmitter } from "node:events";
import { EVENT_CHANNEL, type EventPayload } from "./types.js";

export class EventListener extends EventEmitter {
  private client: Client | null = null;
  private reconnectAttempts = 0;
  private connectPromise: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private createClient = () => new Client({ connectionString: process.env.DATABASE_URL })) { super(); }

  start(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    this.stopped = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.connectPromise = this.connect().catch(error => {
      this.scheduleReconnect();
      throw error;
    });
    return this.connectPromise;
  }

  private async connect() {
    const client = this.createClient();
    this.client = client;
    client.on("notification", msg => {
      if (msg.channel !== EVENT_CHANNEL || !msg.payload) return;
      try { this.emit("event", JSON.parse(msg.payload) as EventPayload); }
      catch { console.error("[events] invalid notification"); }
    });
    client.on("error", () => { if (this.client === client) this.scheduleReconnect(); });
    client.on("end", () => { if (this.client === client) this.scheduleReconnect(); });
    await client.connect();
    await client.query(`LISTEN ${EVENT_CHANNEL}`);
    this.reconnectAttempts = 0;
  }

  private scheduleReconnect() {
    if (this.stopped || this.timer) return;
    const client = this.client;
    this.client = null;
    // Keep the error listener installed until the socket is fully closed.
    if (client) void client.end().catch(() => {});
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts++, 30_000);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connectPromise = null;
      void this.start().catch(() => console.error("[events] reconnect failed; retry scheduled"));
    }, delay);
    this.timer.unref();
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const client = this.client;
    this.client = null;
    this.connectPromise = null;
    if (client) await client.end().catch(() => {});
  }
}
export const eventListener = new EventListener();
