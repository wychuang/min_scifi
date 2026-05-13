import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

class FakeClassList {
  constructor() {
    this.names = new Set();
  }

  toggle(name, force) {
    if (force) {
      this.names.add(name);
    } else {
      this.names.delete(name);
    }
  }

  contains(name) {
    return this.names.has(name);
  }
}

class FakeElement {
  constructor(id = "", type = "text") {
    this.id = id;
    this.type = type;
    this.value = "";
    this.checked = false;
    this.textContent = "";
    this.innerHTML = "";
    this.className = "";
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.classList = new FakeClassList();
  }

  addEventListener(event, callback) {
    this.listeners.set(event, callback);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  click() {
    this.listeners.get("click")?.();
  }
}

class FakeTemplateContent {
  cloneNode() {
    const item = new FakeElement();
    const title = new FakeElement();
    const note = new FakeElement();
    const remove = new FakeElement("", "button");

    item.className = "paper-item";

    return {
      querySelector(selector) {
        if (selector === ".paper-item") return item;
        if (selector === '[data-field="title"]') return title;
        if (selector === '[data-field="note"]') return note;
        if (selector === '[data-action="remove"]') return remove;
        return null;
      }
    };
  }
}

function createHarness(storedState) {
  const elements = new Map();
  const callbacks = new Map();
  const storage = new Map();

  if (storedState !== undefined) {
    storage.set("min-scifi-ir-workbench", JSON.stringify(storedState));
  }

  const ids = [
    "projectStatus",
    "projectTitle",
    "researchQuestion",
    "domain",
    "targetDate",
    "hypothesis",
    "expectedResult",
    "falsification",
    "method",
    "dailyLog",
    "outline",
    "weeklyReview",
    "vaultPathHint",
    "backendVaultPath",
    "agentMode",
    "agentMessage",
    "runCheck",
    "addPaper",
    "buildOutline",
    "loadExample",
    "exportJson",
    "connectVault",
    "syncVault",
    "saveBackendPath",
    "sendAgentMessage",
    "score",
    "signalStack",
    "reviewGrid",
    "reviewLevel",
    "weeklyPrompt",
    "paperList",
    "vaultStatus",
    "agentOutput"
  ];

  ids.forEach(id => elements.set(id, new FakeElement(id)));
  elements.set("quietMode", new FakeElement("quietMode", "checkbox"));
  elements.set("paperTemplate", { content: new FakeTemplateContent() });

  const stateItems = ["draft", "preregistered", "collecting", "analysis", "writing", "preprint"].map(state => {
    const item = new FakeElement();
    item.dataset.state = state;
    return item;
  });

  const document = {
    addEventListener(event, callback) {
      callbacks.set(event, callback);
    },
    createElement(tagName) {
      return new FakeElement("", tagName);
    },
    getElementById(id) {
      return elements.get(id) ?? null;
    },
    querySelectorAll(selector) {
      return selector === "#stateList li" ? stateItems : [];
    }
  };

  const context = {
    Blob: class Blob {},
    URL: {
      createObjectURL() {
        return "blob:test";
      },
      revokeObjectURL() {}
    },
    document,
    localStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storage.set(key, value);
      }
    },
    window: {
      location: {
        reload() {}
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(readFileSync("src/storage-schema.js", "utf8"), context);
  vm.runInContext(readFileSync("src/storage-adapters.js", "utf8"), context);
  vm.runInContext(readFileSync("app.js", "utf8"), context);

  return {
    context,
    elements,
    stateItems,
    dispatchDOMContentLoaded() {
      callbacks.get("DOMContentLoaded")?.();
    },
    getStoredState() {
      const saved = storage.get("min-scifi-ir-workbench");
      return saved ? JSON.parse(saved) : null;
    }
  };
}

test("fresh localStorage renders without crashing", () => {
  const harness = createHarness();

  assert.doesNotThrow(() => harness.dispatchDOMContentLoaded());
  assert.equal(harness.elements.get("score").textContent, "20/100");
  assert.equal(harness.elements.get("paperList").children.length, 1);
  assert.equal(harness.stateItems[0].classList.contains("active"), true);
  assert.match(harness.elements.get("vaultStatus").textContent, /浏览器缓存/);
});

test("legacy or malformed stored state is normalized before rendering", () => {
  const harness = createHarness({
    projectStatus: "writing",
    hypothesis: null,
    method: null,
    papers: null
  });

  assert.doesNotThrow(() => harness.dispatchDOMContentLoaded());
  assert.equal(harness.elements.get("score").textContent, "20/100");
  assert.equal(harness.elements.get("paperList").children.length, 1);
  assert.equal(harness.stateItems[4].classList.contains("active"), true);
});

test("project status persists when a select change event fires", () => {
  const harness = createHarness();
  harness.dispatchDOMContentLoaded();

  const projectStatus = harness.elements.get("projectStatus");
  projectStatus.value = "analysis";
  projectStatus.listeners.get("change")?.();

  assert.equal(harness.getStoredState()?.projectStatus, "analysis");
});

test("vault path hint persists as part of decoupled storage settings", () => {
  const harness = createHarness();
  harness.dispatchDOMContentLoaded();

  const vaultPathHint = harness.elements.get("vaultPathHint");
  vaultPathHint.value = "D:\\Research\\min-scifi-vault";
  vaultPathHint.listeners.get("change")?.();

  assert.equal(harness.getStoredState()?.vaultPathHint, "D:\\Research\\min-scifi-vault");
});

test("empty agent message renders a local validation error", async () => {
  const harness = createHarness();
  harness.dispatchDOMContentLoaded();

  harness.elements.get("sendAgentMessage").click();

  assert.match(harness.elements.get("agentOutput").innerHTML, /请先写下/);
});
