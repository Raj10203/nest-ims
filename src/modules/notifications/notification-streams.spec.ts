import { EventEmitter } from 'node:events';
import { NotificationStreams, sseEvent } from './notification-streams.js';

class FakeResponse extends EventEmitter {
  socket = { destroyed: false, setNoDelay: vi.fn() };
  writableLength = 0;
  writeHead = vi.fn();
  write = vi.fn();
  end = vi.fn(() => this.emit('close'));
  destroy = vi.fn(() => this.emit('close'));
}

async function setup() {
  let setupChannel: (channel: unknown) => Promise<void> = async () => {};
  const wrapper = {
    publish: vi.fn().mockResolvedValue(true),
    bindQueue: vi.fn().mockResolvedValue(undefined),
    unbindQueue: vi.fn().mockResolvedValue(undefined),
  };
  const rabbit = {
    createChannel: (setupFn: typeof setupChannel) => {
      setupChannel = setupFn;
      return wrapper;
    },
  };
  let consumer: (message: unknown) => void = () => {};
  const raw = {
    assertExchange: vi.fn(),
    assertQueue: vi.fn().mockResolvedValue({ queue: 'amq.gen-1' }),
    consume: vi.fn((_queue, onMessage) => {
      consumer = onMessage;
    }),
    bindQueue: vi.fn(),
  };
  const streams = new NotificationStreams(rabbit as any);
  await setupChannel(raw);
  const deliver = (userId: number, frame: string) =>
    consumer({
      fields: { routingKey: `user.${userId}` },
      content: Buffer.from(frame),
    });
  const open = (userId: number, expiresAt = Date.now() + 60_000) => {
    const res = new FakeResponse();
    streams.open(userId, res as any, expiresAt, 'first');
    return res;
  };
  return { streams, wrapper, raw, deliver, open };
}

describe('NotificationStreams', () => {
  afterEach(() => vi.useRealTimers());

  it('formats one event per frame, with the id only when given', () => {
    expect(sseEvent('ready', { unreadCount: 2 })).toBe(
      'event: ready\ndata: {"unreadCount":2}\n\n',
    );
    expect(sseEvent('notification', { a: 1 }, 5)).toBe(
      'id: 5\nevent: notification\ndata: {"a":1}\n\n',
    );
  });

  it('opens with event-stream headers, the retry delay and the first frame', async () => {
    const { open } = await setup();
    const res = open(7);
    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'X-Accel-Buffering': 'no',
      }),
    );
    expect(res.write).toHaveBeenCalledWith('retry: 5000\n\nfirst');
  });

  it("binds a user's routing key once, and unbinds after their last stream", async () => {
    const { open, wrapper } = await setup();
    const tab1 = open(7);
    const tab2 = open(7);
    expect(wrapper.bindQueue).toHaveBeenCalledTimes(1);
    expect(wrapper.bindQueue).toHaveBeenCalledWith(
      'amq.gen-1',
      'notifications',
      'user.7',
    );
    tab1.emit('close');
    expect(wrapper.unbindQueue).not.toHaveBeenCalled();
    tab2.emit('close');
    expect(wrapper.unbindQueue).toHaveBeenCalledWith(
      'amq.gen-1',
      'notifications',
      'user.7',
    );
  });

  it("delivers a message to every stream of that user and nobody else's", async () => {
    const { open, deliver } = await setup();
    const [tab1, tab2, other] = [open(7), open(7), open(8)];
    deliver(7, 'event: x\n\n');
    for (const res of [tab1, tab2]) {
      expect(res.write).toHaveBeenLastCalledWith(Buffer.from('event: x\n\n'));
    }
    expect(other.write).toHaveBeenCalledTimes(1);
  });

  it('binds the users already connected after a reconnect', async () => {
    const { streams, open, raw } = await setup();
    open(7);
    await (streams as any).setup(raw);
    expect(raw.bindQueue).toHaveBeenCalledWith(
      'amq.gen-1',
      'notifications',
      'user.7',
    );
  });

  it('cuts off a client that does not keep up instead of buffering', async () => {
    const { open, deliver } = await setup();
    const res = open(7);
    res.writableLength = 1024 * 1024;
    deliver(7, 'event: x\n\n');
    expect(res.destroy).toHaveBeenCalled();
  });

  it('keeps at most five streams per user, closing the oldest', async () => {
    const { open } = await setup();
    const tabs = Array.from({ length: 6 }, () => open(7));
    expect(tabs[0].end).toHaveBeenCalled();
    expect(tabs[1].end).not.toHaveBeenCalled();
  });

  it('ends the stream when the access token expires', async () => {
    vi.useFakeTimers();
    const { open } = await setup();
    const res = open(7, Date.now() + 1000);
    vi.advanceTimersByTime(999);
    expect(res.end).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(res.end).toHaveBeenCalled();
  });

  it('ends every stream on shutdown', async () => {
    const { streams, open } = await setup();
    const [a, b] = [open(7), open(8)];
    streams.beforeApplicationShutdown();
    expect(a.end).toHaveBeenCalled();
    expect(b.end).toHaveBeenCalled();
  });
});
