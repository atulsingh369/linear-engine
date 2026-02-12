export type DiffResult = {
  hasChanges: boolean;
  summary: string[];
};

export function diffObjects(_previous: unknown, _next: unknown): DiffResult {
  return {
    hasChanges: false,
    summary: []
  };
}
