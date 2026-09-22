import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { EventListener } from "../src/lib/events/listener.js";

test("event listener retries initial and repeated failures, then reconnects after a disconnect", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let attempts = 0;
  const clients: EventEmitter[] = [];
  const listener = new EventListener(() => {
    const client = new EventEmitter() as any;
    clients.push(client);
    client.connect = async () => { if (++attempts < 3) throw new Error("Temporary connection failure"); };
    client.query = async () => {};
    client.end = async () => { client.emit("end"); };
    return client;
  });
  await assert.rejects(listener.start());
  t.mock.timers.tick(1000);
  await new Promise<void>(resolve => setImmediate(resolve));
  t.mock.timers.tick(2000);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(attempts, 3);
  clients[2].emit("error", new Error("Disconnected"));
  clients[2].emit("error", new Error("Late socket error"));
  t.mock.timers.tick(1000);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(attempts, 4);
  await listener.stop();
  t.mock.timers.tick(30_000);
  assert.equal(attempts, 4);
});
