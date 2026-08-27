import loadScript from 'load-script';

/**
 * Get a global SDK object from window.
 */
export function getGlobal(key: string): unknown {
  if (typeof window === 'undefined') return null;

  if ((window as any)[key]) {
    return (window as any)[key];
  }
  if ((window as any).exports && (window as any).exports[key]) {
    return (window as any).exports[key];
  }
  if ((window as any).module?.exports?.[key]) {
    return (window as any).module.exports[key];
  }
  return null;
}

/**
 * Pending SDK load requests, grouped by URL.
 */
const requests: Record<string, Array<{ resolve: (sdk: unknown) => void; reject: (err: unknown) => void }> | null> = {};

/**
 * Load an external SDK from CDN, or return it if already loaded.
 * Deduplicates concurrent requests to the same URL.
 */
export function getSDK(
  url: string,
  sdkGlobal: string,
  sdkReady: string | null = null,
  isLoaded: ((sdk: unknown) => boolean) | null = () => true,
  fetchScript: typeof loadScript = loadScript,
): Promise<unknown> {
  const existingGlobal = getGlobal(sdkGlobal);
  if (existingGlobal && isLoaded && isLoaded(existingGlobal)) {
    return Promise.resolve(existingGlobal);
  }

  return new Promise((resolve, reject) => {
    if (requests[url]) {
      requests[url]!.push({ resolve, reject });
      return;
    }
    requests[url] = [{ resolve, reject }];

    const onLoaded = (sdk: unknown) => {
      requests[url]!.forEach((request) => request.resolve(sdk));
      requests[url] = null;
    };

    if (sdkReady) {
      const previousOnReady = (window as any)[sdkReady];
      (window as any)[sdkReady] = function () {
        if (previousOnReady) previousOnReady();
        onLoaded(getGlobal(sdkGlobal));
      };
    }

    fetchScript(url, (err: Error | null) => {
      if (err) {
        requests[url]!.forEach((request) => request.reject(err));
        requests[url] = null;
      } else if (!sdkReady) {
        onLoaded(getGlobal(sdkGlobal));
      }
    });
  });
}
