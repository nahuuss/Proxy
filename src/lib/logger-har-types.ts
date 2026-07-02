import http from "http";

export interface HarEntryParams {
  startTime: number;
  elapsedMs: number;
  req: http.IncomingMessage;
  reqBody?: string | Buffer | null;
  resStatusCode: number;
  resHeaders: Record<string, string | string[] | undefined>;
  resBody?: string | Buffer | null;
  overrideResBodySize?: number;
  username?: string;
}
