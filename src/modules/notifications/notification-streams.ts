import { BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import type { Response } from 'express';
import { RabbitMqConnection } from '../jobs/rabbitmq.connection.js';

const EXCHANGE = 'notifications';
const ROUTING_PREFIX = 'user.';
// Under the idle timeout of common proxies (nginx: 60 s).
const HEARTBEAT_MS = 25_000;
const RETRY_MS = 5_000;
const MAX_STREAMS_PER_USER = 5;
const MAX_BUFFERED_BYTES = 64 * 1024;

export function sseEvent(event: string, data: unknown, id?: number): string {
  const idLine = id ? `id: ${id}\n` : '';
  return `${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

interface Stream {
  res: Response;
  expiry: NodeJS.Timeout;
}

// The open notification streams of this API instance. Every instance gets its
// own queue on the `notifications` exchange, bound only to the users connected
// to it, so an event is serialized once and reaches only the instances that
// hold one of the user's streams.
@Injectable()
export class NotificationStreams implements BeforeApplicationShutdown {
  private readonly logger = new Logger(NotificationStreams.name);
  private readonly streams = new Map<number, Set<Stream>>();
  private readonly channel: ChannelWrapper;
  // Server-named, so a new one after each reconnect; null in between.
  private queue: string | null = null;
  private readonly heartbeat = setInterval(
    () => this.ping(),
    HEARTBEAT_MS,
  ).unref();

  constructor(rabbit: RabbitMqConnection) {
    this.channel = rabbit.createChannel((channel) => this.setup(channel));
  }

  // Not persistent: a user with no stream open gets it from the list or the
  // Last-Event-ID replay instead.
  async publish(userId: number, frame: string): Promise<void> {
    await this.channel.publish(
      EXCHANGE,
      ROUTING_PREFIX + userId,
      Buffer.from(frame),
      { persistent: false, timeout: 5000 },
    );
  }

  // Ends at the access token's expiry: EventSource reconnects, and the new
  // request goes through JwtAuthGuard again (a deactivated user is refused).
  open(userId: number, res: Response, expiresAt: number, first: string): void {
    if (!res.socket || res.socket.destroyed) return;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // nginx would buffer the stream otherwise.
      'X-Accel-Buffering': 'no',
    });
    res.socket.setNoDelay(true);
    res.write(`retry: ${RETRY_MS}\n\n${first}`);

    const stream: Stream = {
      res,
      expiry: setTimeout(() => res.end(), Math.max(0, expiresAt - Date.now())),
    };
    let streams = this.streams.get(userId);
    if (!streams) {
      streams = new Set();
      this.streams.set(userId, streams);
      this.binding('bindQueue', userId);
    }
    streams.add(stream);
    res.on('close', () => this.close(userId, stream));
    // The oldest is most likely a tab that is gone without closing.
    if (streams.size > MAX_STREAMS_PER_USER) {
      const [oldest] = streams;
      oldest.res.end();
    }
  }

  beforeApplicationShutdown(): void {
    clearInterval(this.heartbeat);
    for (const streams of this.streams.values()) {
      for (const { res } of streams) res.end();
    }
  }

  private async setup(channel: ConfirmChannel): Promise<void> {
    this.queue = null;
    await channel.assertExchange(EXCHANGE, 'direct', { durable: true });
    const { queue } = await channel.assertQueue('', {
      exclusive: true,
      durable: false,
    });
    await channel.consume(
      queue,
      (message) => {
        if (message) this.deliver(message);
      },
      { noAck: true },
    );
    this.queue = queue;
    for (const userId of this.streams.keys()) {
      await channel.bindQueue(queue, EXCHANGE, ROUTING_PREFIX + userId);
    }
  }

  private deliver(message: ConsumeMessage): void {
    const userId = Number(
      message.fields.routingKey.slice(ROUTING_PREFIX.length),
    );
    for (const stream of this.streams.get(userId) ?? []) {
      this.write(stream, message.content);
    }
  }

  private ping(): void {
    for (const streams of this.streams.values()) {
      for (const stream of streams) this.write(stream, ': ping\n\n');
    }
  }

  // A client this far behind is cut off rather than buffered for; it replays
  // what it missed from Last-Event-ID when it reconnects.
  private write(stream: Stream, chunk: string | Buffer): void {
    if (stream.res.writableLength > MAX_BUFFERED_BYTES) {
      stream.res.destroy();
      return;
    }
    stream.res.write(chunk);
  }

  private close(userId: number, stream: Stream): void {
    clearTimeout(stream.expiry);
    const streams = this.streams.get(userId);
    if (!streams?.delete(stream) || streams.size) return;
    this.streams.delete(userId);
    this.binding('unbindQueue', userId);
  }

  // Until the channel is set up, setup() binds every connected user itself.
  private binding(method: 'bindQueue' | 'unbindQueue', userId: number): void {
    if (!this.queue) return;
    this.channel[method](this.queue, EXCHANGE, ROUTING_PREFIX + userId).catch(
      (err: Error) => this.logger.warn(`${method} failed: ${err.message}`),
    );
  }
}
