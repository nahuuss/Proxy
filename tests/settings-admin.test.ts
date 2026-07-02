import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGlobalSettingsUpdate,
  canUpdateGlobalSettings,
  parseGlobalSettingsFormData,
  validateGlobalSettingsFormInput,
} from "../src/lib/settings-admin";

function createFormData(entries: Array<[string, string]>): FormData {
  const formData = new FormData();
  for (const [key, value] of entries) {
    formData.set(key, value);
  }
  return formData;
}

test("settings admin parsea valores, defaults y booleanos", () => {
  const input = parseGlobalSettingsFormData(createFormData([
    ["publicHost", " app.example.com "],
    ["authUrl", " https://auth.example.com "],
    ["internalTarget", " http://127.0.0.1:3001 "],
    ["bypassAuth", "on"],
  ]));

  assert.deepEqual(input, {
    publicHost: "app.example.com",
    authUrl: "https://auth.example.com",
    internalTarget: "http://127.0.0.1:3001",
    hbFirstPulse: 20,
    bypassAuth: true,
    memoryResetIntervalMinutes: 30,
  });
});

test("settings admin valida numeros positivos y centraliza permiso de mutacion", () => {
  const invalid = {
    publicHost: "",
    authUrl: "",
    internalTarget: "",
    hbFirstPulse: 0,
    bypassAuth: false,
    memoryResetIntervalMinutes: Number.NaN,
  };

  assert.deepEqual(validateGlobalSettingsFormInput(invalid), [
    "El tiempo de HB Shield debe ser mayor a 0.",
    "El tiempo de reset automatico debe ser mayor a 0.",
  ]);
  assert.equal(canUpdateGlobalSettings({ settingsBypass: true, hasAdminAccess: false }), true);
  assert.equal(canUpdateGlobalSettings({ settingsBypass: false, hasAdminAccess: true }), true);
  assert.equal(canUpdateGlobalSettings({ settingsBypass: false, hasAdminAccess: false }), false);
});

test("settings admin arma el payload persistible sin el id", () => {
  const input = parseGlobalSettingsFormData(createFormData([
    ["publicHost", "proxy.example.com"],
    ["authUrl", "https://auth.example.com"],
    ["internalTarget", "http://127.0.0.1:3001"],
    ["hbFirstPulse", "45"],
    ["memoryResetIntervalMinutes", "60"],
  ]));

  assert.deepEqual(buildGlobalSettingsUpdate(input), {
    publicHost: "proxy.example.com",
    authUrl: "https://auth.example.com",
    internalTarget: "http://127.0.0.1:3001",
    hbFirstPulse: 45,
    bypassAuth: false,
    memoryResetIntervalMinutes: 60,
  });
});
