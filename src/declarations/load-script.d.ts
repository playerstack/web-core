declare module 'load-script' {
  function loadScript(url: string, callback: (err: Error | null) => void): void;
  export = loadScript;
}
