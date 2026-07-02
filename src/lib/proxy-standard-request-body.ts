import http from "http";

export interface ForwardProxyRequestBodyInput {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  proxyReq: http.ClientRequest;
  maxBodyBytes: number;
  captureChunks?: Buffer[];
  onMetric: (bytes: number) => void;
  clearHeartbeatTimers: () => void;
}

export function forwardProxyRequestBody(input: ForwardProxyRequestBodyInput) {
  let requestBodyBytes = 0;

  input.req.on("data", (chunk: Buffer) => {
    requestBodyBytes += chunk.length;
    input.onMetric(chunk.length);

    if (input.captureChunks) {
      input.captureChunks.push(chunk);
    }

    if (requestBodyBytes > input.maxBodyBytes) {
      input.req.unpipe(input.proxyReq);
      input.proxyReq.destroy();
      input.clearHeartbeatTimers();
      if (!input.res.headersSent) {
        input.res.writeHead(413);
        input.res.end("Request Entity Too Large");
      }
      input.req.resume();
    }
  });

  input.req.pipe(input.proxyReq);
}
