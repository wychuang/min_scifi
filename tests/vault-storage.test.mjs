import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

function loadStorageSchema() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(readFileSync("src/storage-schema.js", "utf8"), context);
  return context.window.MinScifiStorage;
}

const sampleState = {
  projectStatus: "preregistered",
  projectTitle: "夜间屏幕亮度与入睡时长的小样本观察",
  researchQuestion: "睡前一小时平均屏幕亮度是否与入睡时长相关？",
  domain: "行为科学 / 自我量化",
  targetDate: "2026-06-27",
  hypothesis: "如果睡前一小时平均屏幕亮度升高，则当晚入睡时长会增加。",
  expectedResult: "高亮度晚上的入睡时长更长。",
  falsification: "若亮度与入睡时长无正相关，则放弃当前假设。",
  method: "连续 14 天记录屏幕亮度、咖啡因摄入和入睡时长。",
  dailyLog: "今天确认变量记录表。",
  weeklyReview: "下周完成 3 天试记录。",
  outline: "# 夜间屏幕亮度与入睡时长的小样本观察\n\n## 摘要\n...",
  quietMode: true,
  papers: [
    { title: "doi:10.1073/pnas.1418490112", note: "夜间蓝光与睡眠节律相关。" },
    { title: "OSF preregistration examples", note: "参考预注册格式。" }
  ]
};

test("normalizes legacy state for storage adapters", () => {
  const storage = loadStorageSchema();

  const normalized = storage.normalizeState({
    projectStatus: "analysis",
    hypothesis: null,
    quietMode: 1,
    papers: [{ title: 123, note: null }, null]
  });

  assert.equal(normalized.projectStatus, "analysis");
  assert.equal(normalized.hypothesis, "");
  assert.equal(normalized.quietMode, true);
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.papers)), [
    { title: "123", note: "" },
    { title: "", note: "" }
  ]);
});

test("serializes state into an external vault file layout", () => {
  const storage = loadStorageSchema();

  const snapshot = storage.buildVaultSnapshot(sampleState);
  const files = new Map(snapshot.files.map(file => [file.path, file.content]));

  assert.deepEqual([...files.keys()], [
    "project.json",
    "README.md",
    "preregistration/current.md",
    "literature/items.json",
    "literature/items.md",
    "logs/daily.md",
    "logs/weekly.md",
    "writing/preprint-outline.md",
    "sources/README.md"
  ]);

  const project = JSON.parse(files.get("project.json"));
  assert.equal(project.schemaVersion, 1);
  assert.equal(project.app, "min_scifi");
  assert.equal(project.project.title, sampleState.projectTitle);
  assert.equal(project.preregistration.hypothesis, sampleState.hypothesis);
  assert.equal(project.settings.quietMode, true);
  assert.equal(project.literature.length, 2);

  assert.match(files.get("README.md"), /# 夜间屏幕亮度与入睡时长的小样本观察/);
  assert.match(files.get("preregistration/current.md"), /## 可证伪假设/);
  assert.match(files.get("literature/items.md"), /doi:10\.1073\/pnas\.1418490112/);
  assert.match(files.get("logs/daily.md"), /今天确认变量记录表/);
  assert.match(files.get("sources/README.md"), /原始资料/);
});
