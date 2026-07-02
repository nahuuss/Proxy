export interface TrafficEntry {
  type?: "traffic";
  ts: string;
  elapsed: number;
  ttfb?: number;
  user: string;
  conn: string;
  method: string;
  url: string;
  status: number;
  reqSize: number;
  resSize: number;
  ct: string;
  xhr: boolean;
  err: string | null;
  cookies: string[];
  reqHdrs: Record<string, string | string[] | undefined>;
  resHdrs: Record<string, string | string[] | undefined>;
}

export interface DebugEntry {
  type: "debug";
  ts: string;
  user: string;
  conn: string;
  tag: string;
  method?: string;
  path?: string;
  status?: number | string;
  elapsedMs?: number;
  extra?: string;
}

export type LogEntry = TrafficEntry | DebugEntry;

export interface ConnectorFileState {
  fd: number;
  filePath: string;
  currentSize: number;
  chunkNumber: number;
  datePrefix: string;
}
