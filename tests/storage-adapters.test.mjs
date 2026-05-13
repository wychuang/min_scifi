import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

function loadAdapters() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(readFileSync("src/storage-schema.js", "utf8"), context);
  vm.runInContext(readFileSync("src/storage-adapters.js", "utf8"), context);
  return context.window.MinScifiAdapters;
}

class FakeFileHandle {
  constructor() {
    this.content = "";
  }

  async createWritable() {
    return {
      write: async content => {
        this.content = content;
      },
      close: async () => {}
    };
  }
}

class FakeDirectoryHandle {
  constructor(name = "vault") {
    this.name = name;
    this.directories = new Map();
    this.files = new Map();
  }

  async getDirectoryHandle(name) {
    if (!this.directories.has(name)) {
      this.directories.set(name, new FakeDirectoryHandle(name));
    }
    return this.directories.get(name);
  }

  async getFileHandle(name) {
    if (!this.files.has(name)) {
      this.files.set(name, new FakeFileHandle());
    }
    return this.files.get(name);
  }

  readFile(path) {
    const parts = path.split("/");
    const fileName = parts.pop();
    const directory = parts.reduce((current, part) => current.directories.get(part), this);
    return directory.files.get(fileName).content;
  }
}

test("writes vault files into nested browser directory handles", async () => {
  const adapters = loadAdapters();
  const root = new FakeDirectoryHandle("research-vault");

  const result = await adapters.saveToBrowserVault(root, {
    projectTitle: "外部资料库测试",
    hypothesis: "如果 X 改变，则 Y 改变。",
    papers: [{ title: "paper a", note: "note a" }]
  });

  assert.equal(result.mode, "browser-vault");
  assert.equal(result.vaultName, "research-vault");
  assert.equal(result.fileCount, 9);
  assert.match(root.readFile("project.json"), /外部资料库测试/);
  assert.match(root.readFile("literature/items.md"), /paper a/);
  assert.match(root.readFile("sources/README.md"), /原始资料/);
});

test("sends normalized state to a local backend vault", async () => {
  const adapters = loadAdapters();
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({ ok: true, vaultPath: "D:\\Research\\vault", fileCount: 9 })
    };
  };

  const result = await adapters.saveToBackendVault({ projectTitle: "后端路径测试" }, fakeFetch);

  assert.equal(result.mode, "backend-vault");
  assert.equal(result.fileCount, 9);
  assert.equal(calls[0].url, "/api/vault/state");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(JSON.parse(calls[0].options.body).projectTitle, "后端路径测试");
});

test("configures the local backend vault path", async () => {
  const adapters = loadAdapters();
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({ ok: true, vaultPath: "D:\\Research\\vault" })
    };
  };

  const result = await adapters.configureBackendVault("D:\\Research\\vault", fakeFetch);

  assert.equal(result.vaultPath, "D:\\Research\\vault");
  assert.equal(calls[0].url, "/api/vault/config");
  assert.equal(JSON.parse(calls[0].options.body).vaultPath, "D:\\Research\\vault");
});
