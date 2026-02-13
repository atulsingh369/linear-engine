declare module "@hono/node-server" {
  export interface ServeOptions {
    fetch: (request: Request) => Response | Promise<Response>;
    port: number;
  }

  export interface ServerInfo {
    port: number;
  }

  export function serve(
    options: ServeOptions,
    listeningListener?: (info: ServerInfo) => void
  ): void;
}
