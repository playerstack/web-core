import { getGlobal, getSDK } from '@utils/sdk';

describe('getGlobal', () => {
  beforeEach(() => {
    delete (window as any).TestSDK;
    delete (window as any).exports;
    delete (window as any).module;
  });

  it('returns null when key not on window', () => {
    expect(getGlobal('NonExistent')).toBeNull();
  });

  it('returns global from window directly', () => {
    (window as any).TestSDK = { version: '1.0' };
    expect(getGlobal('TestSDK')).toEqual({ version: '1.0' });
  });

  it('returns global from window.exports', () => {
    (window as any).exports = { TestSDK: { version: '2.0' } };
    expect(getGlobal('TestSDK')).toEqual({ version: '2.0' });
  });

  it('returns global from window.module.exports', () => {
    (window as any).module = { exports: { TestSDK: { version: '3.0' } } };
    expect(getGlobal('TestSDK')).toEqual({ version: '3.0' });
  });

  it('prefers window[key] over exports[key]', () => {
    (window as any).TestSDK = { version: 'direct' };
    (window as any).exports = { TestSDK: { version: 'exports' } };
    expect(getGlobal('TestSDK')).toEqual({ version: 'direct' });
  });
});

describe('getSDK', () => {
  beforeEach(() => {
    delete (window as any).TestSDK;
    delete (window as any).onTestSDKReady;
  });

  it('resolves immediately if global already exists and isLoaded default', async () => {
    (window as any).TestSDK = { loaded: true };
    const fetchScript = jest.fn();
    const sdk = await getSDK('http://cdn.test/exists.js', 'TestSDK', null, undefined, fetchScript as any);
    expect(sdk).toEqual({ loaded: true });
    expect(fetchScript).not.toHaveBeenCalled();
  });

  it('loads script and resolves with global after load callback', async () => {
    const fetchScript = jest.fn((url: string, cb: (err: Error | null) => void) => {
      (window as any).TestSDK = { fetched: true };
      cb(null);
    });
    const sdk = await getSDK('http://cdn.test/load1.js', 'TestSDK', null, null, fetchScript as any);
    expect(sdk).toEqual({ fetched: true });
  });

  it('rejects when fetchScript returns error', async () => {
    const fetchScript = jest.fn((url: string, cb: (err: Error | null) => void) => {
      cb(new Error('Network failed'));
    });
    await expect(
      getSDK('http://cdn.test/fail1.js', 'TestSDK', null, null, fetchScript as any),
    ).rejects.toThrow('Network failed');
  });

  it('deduplicates concurrent requests to same URL', async () => {
    let loadCallback: ((err: Error | null) => void) | null = null;
    const fetchScript = jest.fn((url: string, cb: (err: Error | null) => void) => {
      loadCallback = cb;
    });

    const p1 = getSDK('http://cdn.test/dedup1.js', 'TestSDK', null, null, fetchScript as any);
    const p2 = getSDK('http://cdn.test/dedup1.js', 'TestSDK', null, null, fetchScript as any);

    expect(fetchScript).toHaveBeenCalledTimes(1);

    (window as any).TestSDK = { deduped: true };
    loadCallback!(null);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ deduped: true });
    expect(r2).toEqual({ deduped: true });
  });

  it('uses sdkReady callback when provided', async () => {
    const fetchScript = jest.fn((url: string, cb: (err: Error | null) => void) => {
      cb(null);
    });

    const promise = getSDK('http://cdn.test/ready1.js', 'TestSDK', 'onTestSDKReady', null, fetchScript as any);

    (window as any).TestSDK = { ready: true };
    (window as any).onTestSDKReady();

    const sdk = await promise;
    expect(sdk).toEqual({ ready: true });
  });

  it('calls previous sdkReady handler if one existed', async () => {
    const previousHandler = jest.fn();
    (window as any).onTestSDKReady = previousHandler;

    const fetchScript = jest.fn((url: string, cb: (err: Error | null) => void) => {
      cb(null);
    });

    const promise = getSDK('http://cdn.test/prev1.js', 'TestSDK', 'onTestSDKReady', null, fetchScript as any);

    (window as any).TestSDK = { v: 1 };
    (window as any).onTestSDKReady();

    await promise;
    expect(previousHandler).toHaveBeenCalled();
  });

  it('does not resolve immediately if isLoaded returns false', async () => {
    (window as any).TestSDK = { loaded: false };
    const fetchScript = jest.fn((url: string, cb: (err: Error | null) => void) => {
      (window as any).TestSDK = { loaded: true };
      cb(null);
    });
    const sdk = await getSDK(
      'http://cdn.test/check1.js',
      'TestSDK',
      null,
      (s: any) => s.loaded === true,
      fetchScript as any,
    );
    expect(sdk).toEqual({ loaded: true });
    expect(fetchScript).toHaveBeenCalled();
  });
});
