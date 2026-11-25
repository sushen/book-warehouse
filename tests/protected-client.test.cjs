const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
function clientClass() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(
    fs
      .readFileSync("protected-client.js", "utf8")
      .replace("export class", "class") +
      "\nglobalThis.Client=ProtectedBooksClient;",
    context,
  );
  return context.Client;
}
test('fetch adapter uses its platform receiver rather than the API client instance',async()=>{
 const Client=clientClass();let receiver;
 const client=new Client({origin:'http://local',getUser:()=>null,fetcher:async function(){receiver=this;return {ok:true,json:async()=>({ready:true})};}});
 assert.equal((await client.request('/info')).ready,true);assert.notEqual(receiver,client);
});
test("account switch while obtaining a token prevents sending the old identity", async () => {
  let finish,
    sends = 0,
    current = {
      uid: "first",
      getIdToken: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    };
  const Client = clientClass();
  const client = new Client({
    origin: "http://local",
    getUser: () => current,
    fetcher: async () => {
      sends++;
    },
  });
  const request = client.request("/books");
  current = { uid: "second" };
  finish("fictional-token");
  await assert.rejects(request, /identity-changed/);
  assert.equal(sends, 0);
});
test("account switch while receiving a protected response discards its body", async () => {
  let current = { uid: "first", getIdToken: async () => "fictional-token" };
  const Client = clientClass();
  const client = new Client({
    origin: "http://local",
    getUser: () => current,
    fetcher: async () => ({
      ok: true,
      json: async () => {
        current = { uid: "second" };
        return { licensed: true };
      },
    }),
  });
  await assert.rejects(
    client.request("/books/book/license"),
    /identity-changed/,
  );
});
