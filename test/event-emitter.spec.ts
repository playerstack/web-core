import { EventEmitter } from '@event-emitter';

type TestEvents = {
  hello: (name: string) => void;
  count: (n: number) => void;
  empty: () => void;
};

describe('EventEmitter', () => {
  let emitter: EventEmitter<TestEvents>;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  it('calls handler when event is emitted', () => {
    const handler = jest.fn();
    emitter.on('hello', handler);
    emitter.emit('hello', 'world');
    expect(handler).toHaveBeenCalledWith('world');
  });

  it('supports multiple handlers for same event', () => {
    const h1 = jest.fn();
    const h2 = jest.fn();
    emitter.on('hello', h1);
    emitter.on('hello', h2);
    emitter.emit('hello', 'test');
    expect(h1).toHaveBeenCalledWith('test');
    expect(h2).toHaveBeenCalledWith('test');
  });

  it('removes handler with off()', () => {
    const handler = jest.fn();
    emitter.on('hello', handler);
    emitter.off('hello', handler);
    emitter.emit('hello', 'test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('once() fires handler only once', () => {
    const handler = jest.fn();
    emitter.once('count', handler);
    emitter.emit('count', 1);
    emitter.emit('count', 2);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
  });

  it('removeAllListeners() clears all', () => {
    const h1 = jest.fn();
    const h2 = jest.fn();
    emitter.on('hello', h1);
    emitter.on('count', h2);
    emitter.removeAllListeners();
    emitter.emit('hello', 'x');
    emitter.emit('count', 5);
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('removeAllListeners(event) clears only that event', () => {
    const h1 = jest.fn();
    const h2 = jest.fn();
    emitter.on('hello', h1);
    emitter.on('count', h2);
    emitter.removeAllListeners('hello');
    emitter.emit('hello', 'x');
    emitter.emit('count', 5);
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledWith(5);
  });

  it('does not throw if emitting with no listeners', () => {
    expect(() => emitter.emit('empty')).not.toThrow();
  });

  it('catches errors in handlers without stopping other handlers', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    const h1 = jest.fn(() => { throw new Error('oops'); });
    const h2 = jest.fn();
    emitter.on('empty', h1);
    emitter.on('empty', h2);
    emitter.emit('empty');
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
