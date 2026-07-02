import test from "node:test";
import assert from "node:assert/strict";
import { hasConnectorRuntimeConfigChanged } from "../src/lib/connector-runtime";

test("runtime detecta cambios de productConfig aunque el resto del conector no cambie", () => {
  const previous = {
    targetUrl: "https://backend.example.com",
    publicHost: "core.example.com",
    port: 8080,
    connectorType: "core" as const,
    productConfig: {
      core: {
        xhrKeepAlivePaths: ["/api/process"],
      },
    },
  };

  const next = {
    ...previous,
    productConfig: {
      core: {
        xhrKeepAlivePaths: ["/api/process", "/api/report"],
      },
    },
  };

  assert.equal(hasConnectorRuntimeConfigChanged(previous, next), true);
});

test("runtime detecta cambios legacy hbForceUrls que afectan la ejecucion", () => {
  const previous = {
    targetUrl: "https://backend.example.com",
    publicHost: "bank.example.com",
    port: 8081,
    connectorType: "bank" as const,
    hbForceUrls: ["/legacy/upload"],
  };

  const next = {
    ...previous,
    hbForceUrls: ["/legacy/upload", "/legacy/report"],
  };

  assert.equal(hasConnectorRuntimeConfigChanged(previous, next), true);
});

test("runtime ignora el orden de claves internas al comparar config equivalente", () => {
  const previous = {
    targetUrl: "https://backend.example.com",
    publicHost: "crm.example.com",
    port: 8082,
    connectorType: "dynamics-crm" as const,
    productConfig: {
      "dynamics-crm": {
        loginPathHints: ["login"],
        backgroundJobPaths: ["/jobs"],
      },
    },
  };

  const next = {
    ...previous,
    productConfig: {
      "dynamics-crm": {
        backgroundJobPaths: ["/jobs"],
        loginPathHints: ["login"],
      },
    },
  };

  assert.equal(hasConnectorRuntimeConfigChanged(previous, next), false);
});
