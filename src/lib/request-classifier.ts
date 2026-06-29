import http from "http";

export interface ClassifiedRequest {
  isCrmResource: boolean;
  isExplicitStatic: boolean;
  isImage: boolean;
  isStatic: boolean;
  isPostLike: boolean;
  isAjax: boolean;
  isMultipartUpload: boolean;
}

export function classifyRequest(req: http.IncomingMessage, urlPart: string): ClassifiedRequest {
  const isCrmResource = /(_imgs|_static|webresources|icon\.aspx|css\.aspx|js\.aspx|resx\.ashx)/i.test(urlPart);
  const isExplicitStatic =
    /\.(js|css|axd|ashx|png|jpg|jpeg|gif|ico|woff|woff2|svg|svgz|ttf|otf|eot|cur|xaml|xap|map|wasm|mp4)$/.test(
      urlPart,
    );
  const isImage = /\.(png|jpg|jpeg|gif|ico|cur|svg)$/.test(urlPart) || urlPart.includes("icon.aspx");
  const isStatic = isExplicitStatic || isCrmResource;
  const isPostLike = req.method !== "GET" && req.method !== "HEAD";
  const acceptHeader = String(req.headers["accept"] || "").toLowerCase();
  const secFetchMode = String(req.headers["sec-fetch-mode"] || "").toLowerCase();
  const isXhrHeader = !!req.headers["x-requested-with"];
  const isAjax =
    isXhrHeader || (secFetchMode !== "" && secFetchMode !== "navigate") || (acceptHeader !== "" && !acceptHeader.includes("text/html"));
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  const isMultipartUpload = contentType.includes("multipart/form-data");

  return {
    isCrmResource,
    isExplicitStatic,
    isImage,
    isStatic,
    isPostLike,
    isAjax,
    isMultipartUpload,
  };
}

