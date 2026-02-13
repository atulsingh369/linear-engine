declare module "dotenv" {
  export interface DotenvConfigOptions {
    path?: string;
  }

  export interface DotenvConfigOutput {
    error?: Error;
    parsed?: Record<string, string>;
  }

  export function config(options?: DotenvConfigOptions): DotenvConfigOutput;

  const dotenv: {
    config: typeof config;
  };

  export default dotenv;
}
