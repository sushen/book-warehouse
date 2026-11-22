const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const context = { Intl };
vm.createContext(context);
vm.runInContext(
  fs.readFileSync("protected-offer.js", "utf8").replaceAll("export ", "") +
    "\nglobalThis.actions=offerActions;",
  context,
);
test("unlicensed readers receive preview and buy, never full read/download actions", () => {
  assert.equal(
    JSON.stringify(context.actions(false, 6, true)),
    JSON.stringify(["preview", "buy"]),
  );
  assert.equal(
    JSON.stringify(context.actions(false, 0, true)),
    JSON.stringify(["buy"]),
  );
});
test("licensed readers receive full read and only policy-permitted download", () => {
  assert.equal(
    JSON.stringify(context.actions(true, 6, true)),
    JSON.stringify(["preview", "read", "download"]),
  );
  assert.equal(
    JSON.stringify(context.actions(true, 6, false)),
    JSON.stringify(["preview", "read"]),
  );
});
