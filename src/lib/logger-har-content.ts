const MAX_BODY_CHAR_LIMIT = 2 * 1024 * 1024;

export function calculateHarHeadersSize(headers: Record<string, string | string[] | undefined>) {
  let total = 0;
  for (const [key, value] of Object.entries(headers)) {
    total += key.length + (value ? String(value).length : 0) + 4;
  }
  return total;
}

export function buildHarRequestPostData(input: {
  headers: Record<string, string | string[] | undefined>;
  body?: string | Buffer | null;
}) {
  let bodySize = 0;
  let postData: { mimeType: string; text: string } | undefined;

  if (input.body) {
    bodySize = Buffer.isBuffer(input.body) ? input.body.length : Buffer.from(input.body).length;
    const contentType = (input.headers["content-type"] || "") as string;
    const isText = /json|xml|urlencoded|text/i.test(contentType);

    if (isText && bodySize <= MAX_BODY_CHAR_LIMIT) {
      postData = {
        mimeType: contentType,
        text: Buffer.isBuffer(input.body) ? input.body.toString("utf8") : input.body,
      };
    }
  }

  return { bodySize, postData };
}

export function buildHarResponseContent(input: {
  headers: Record<string, string | string[] | undefined>;
  body?: string | Buffer | null;
  requestUrl: string;
  overrideBodySize?: number;
}) {
  let bodySize = 0;
  const content: { size: number; mimeType: string; text?: string } = {
    size: 0,
    mimeType: (input.headers["content-type"] || "application/octet-stream") as string,
  };

  if (input.overrideBodySize !== undefined) {
    bodySize = input.overrideBodySize;
    content.size = bodySize;
    return { bodySize, content };
  }

  if (input.body) {
    bodySize = Buffer.isBuffer(input.body) ? input.body.length : Buffer.from(input.body).length;
    content.size = bodySize;

    const contentType = (input.headers["content-type"] || "") as string;
    const isText = /json|javascript|css|html|xml|text/i.test(contentType)
      && !/\.(png|jpg|jpeg|gif|ico|cur|svg)$/i.test(input.requestUrl.split("?")[0]);

    if (isText && bodySize <= MAX_BODY_CHAR_LIMIT) {
      content.text = Buffer.isBuffer(input.body) ? input.body.toString("utf8") : input.body;
    }
  }

  return { bodySize, content };
}
