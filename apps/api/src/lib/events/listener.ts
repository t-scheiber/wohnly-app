import { Client } from "pg";
import { EventEmitter } from "node:events";
import type { EventPayload } from "./types.js";
import { EVENT_CHANNEL } from "./types.js";

class EventListener extends EventEmitter {
  private client: Client | null = null;
  private reconnectAttempts = 0;
  private connectPromise: Promise<void> | null = null;

  async start(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this._connect();
    return this.connectPromise;
  }

  private async _connect(): Promise<void> {
    this.client = new Client({ connectionString: process.env.DATABASE_URL });
    this.client.on("notification", (msg) => {
      if (msg.channel !== EVENT_CHANNEL || !msg.payload) return;
      try {
        const payload = JSON.parse(msg.payload) as EventPayload;
        this.emit("event", payload);
      } catch (err) {
        console.error("[events] failed to parse notification", err);
      }
    });
    this.client.on("error", (err) => {
      console.error("[events] pg client error; will reconnect", err);
      this._scheduleReconnect();
    });
    this.client.on("end", () => {
      console.warn("[events] pg client ended; reconnecting");
      this._scheduleReconnect();
    });
    await this.client.connect();
    await this.client.query(`LISTEN ${EVENT_CHANNEL}`);
    this.reconnectAttempts = 0;
    console.log("[events] listener connected");
  }

  private _scheduleReconnect() {
    if (this.client) {
      this.client.removeAllListeners();
      this.client = null;
    }
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts += 1;
    setTimeout(() => {
      this.connectPromise = null;
      this.start().catch((err) =>
        console.error("[events] reconnect failed", err),
      );
    }, delay);
  }
}

export const eventListener = new EventListener();
