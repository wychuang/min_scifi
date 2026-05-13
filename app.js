const storageKey = "min-scifi-ir-workbench";

const fields = [
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
  "quietMode"
];

const defaultState = {
  projectStatus: "draft",
  projectTitle: "",
  researchQuestion: "",
  domain: "",
  targetDate: "",
  hypothesis: "",
  expectedResult: "",
  falsification: "",
  method: "",
  dailyLog: "",
  outline: "",
  weeklyReview: "",
  quietMode: false,
  papers: []
};

const rules = [
  {
    title: "可证伪性",
    test: data => hasAny(data.hypothesis, ["如果", "则", "会", "显著", "相关", "高于", "低于"]) && data.falsification.length >= 18,
    warn: data => data.hypothesis.length >= 20,
    green: "假设和否证条件已经能被检验。",
    yellow: "假设有雏形，但需要写清什么结果会推翻它。",
    red: "目前更像愿望或主题，先改写成可观察变量之间的关系。"
  },
  {
    title: "方法完整度",
    test: data => hasAny(data.method, ["样本", "数据", "变量", "统计", "实验", "访谈", "观测"]) && data.method.length >= 45,
    warn: data => data.method.length >= 20,
    green: "方法里已经出现数据、变量或分析路径。",
    yellow: "方法还偏粗，需要补样本来源、变量和分析方式。",
    red: "缺少方法描述，先不要进入写作阶段。"
  },
  {
    title: "资源现实性",
    test: data => data.targetDate && daysUntil(data.targetDate) >= 14 && daysUntil(data.targetDate) <= 365,
    warn: data => Boolean(data.targetDate),
    green: "目标日期适合一个小研究的推进节奏。",
    yellow: "目标日期存在，但周期可能过短或过长。",
    red: "请先设一个 2 周到 12 个月内的目标日期。"
  },
  {
    title: "红区预警",
    test: data => !hasAny(fullText(data), ["永动机", "推翻相对论", "推翻热力学", "大一统", "颠覆物理", "无需能量"]),
    warn: data => !hasAny(fullText(data), ["推翻", "颠覆", "革命性"]),
    green: "没有明显触碰高风险伪科学表达。",
    yellow: "存在宏大表述，建议收敛到可复现实验或可观测数据。",
    red: "包含典型红区词。请先转为可复现数据问题，而不是直接承诺颠覆理论。"
  },
  {
    title: "文献锚点",
    test: data => data.papers.filter(paper => paper.title.trim()).length >= 3,
    warn: data => data.papers.filter(paper => paper.title.trim()).length >= 1,
    green: "已有基础文献锚点，可以开始写综述地图。",
    yellow: "至少有一条文献，但还不足以判断是否重复造轮子。",
    red: "请先加入 3 条相关文献、DOI 或 arXiv ID。"
  }
];

let state = loadState();

document.addEventListener("DOMContentLoaded", () => {
  bindFields();
  renderPapers();
  renderAll();

  document.getElementById("runCheck").addEventListener("click", renderAll);
  document.getElementById("addPaper").addEventListener("click", () => {
    state.papers.push({ title: "", note: "" });
    saveState();
    renderPapers();
    renderAll();
  });
  document.getElementById("buildOutline").addEventListener("click", buildOutline);
  document.getElementById("loadExample").addEventListener("click", loadExample);
  document.getElementById("exportJson").addEventListener("click", exportJson);
});

function bindFields() {
  fields.forEach(id => {
    const element = document.getElementById(id);
    if (!element) return;

    if (element.type === "checkbox") {
      element.checked = Boolean(state[id]);
      element.addEventListener("change", () => {
        state[id] = element.checked;
        saveState();
        renderAll();
      });
      return;
    }

    element.value = state[id] || "";
    element.addEventListener("input", () => {
      state[id] = element.value;
      saveState();
      renderAll();
    });
  });
}

function renderAll() {
  const results = rules.map(rule => evaluate(rule, state));
  const score = results.reduce((sum, item) => sum + item.points, 0);
  document.getElementById("score").textContent = `${score}/100`;
  renderSignals(results);
  renderReview(results);
  renderStateList();
  renderWeeklyPrompt(results);
}

function renderSignals(results) {
  const stack = document.getElementById("signalStack");
  stack.innerHTML = "";
  results.slice(0, 3).forEach(result => {
    const item = document.createElement("div");
    item.className = "signal";
    item.innerHTML = `<strong><span class="dot ${result.level}"></span>${result.title}</strong><span>${result.message}</span>`;
    stack.appendChild(item);
  });
}

function renderReview(results) {
  const grid = document.getElementById("reviewGrid");
  grid.innerHTML = "";
  results.forEach(result => {
    const card = document.createElement("article");
    card.className = "review-card";
    card.innerHTML = `<strong><span class="dot ${result.level}"></span>${result.title}</strong><p>${result.message}</p><p>${result.next}</p>`;
    grid.appendChild(card);
  });

  const weakest = results.find(result => result.level === "red") || results.find(result => result.level === "yellow") || results[0];
  const badge = document.getElementById("reviewLevel");
  badge.className = `badge ${weakest.level}`;
  badge.textContent = weakest.level === "green" ? "可推进" : weakest.level === "yellow" ? "需补强" : "先暂停";
}

function renderStateList() {
  const status = state.projectStatus || "draft";
  document.querySelectorAll("#stateList li").forEach(item => {
    item.classList.toggle("active", item.dataset.state === status);
  });
}

function renderWeeklyPrompt(results) {
  const box = document.getElementById("weeklyPrompt");
  if (state.quietMode) {
    box.textContent = "安静模式已开启。系统只保存复盘，不主动给心理提示。";
    return;
  }

  const red = results.find(result => result.level === "red");
  if (red) {
    box.textContent = `本周只做一个 25 分钟小动作：补强「${red.title}」。不用证明整个项目，只把下一步写到足够具体。`;
    return;
  }

  box.textContent = "本周复盘建议：写下一个已完成证据、一个仍不确定的问题、一个下周最小实验。";
}

function renderPapers() {
  const list = document.getElementById("paperList");
  const template = document.getElementById("paperTemplate");
  list.innerHTML = "";

  if (!state.papers.length) {
    state.papers.push({ title: "", note: "" });
  }

  state.papers.forEach((paper, index) => {
    const node = template.content.cloneNode(true);
    const item = node.querySelector(".paper-item");
    const title = node.querySelector('[data-field="title"]');
    const note = node.querySelector('[data-field="note"]');
    const remove = node.querySelector('[data-action="remove"]');

    title.value = paper.title;
    note.value = paper.note;

    title.addEventListener("input", () => {
      state.papers[index].title = title.value;
      saveState();
      renderAll();
    });
    note.addEventListener("input", () => {
      state.papers[index].note = note.value;
      saveState();
    });
    remove.addEventListener("click", () => {
      state.papers.splice(index, 1);
      saveState();
      renderPapers();
      renderAll();
    });

    list.appendChild(item);
  });
}

function buildOutline() {
  const title = state.projectTitle || "未命名研究";
  const question = state.researchQuestion || "待明确研究问题";
  const hypothesis = state.hypothesis || "待补充可证伪假设";
  const method = state.method || "待补充方法与数据";
  const papers = state.papers.filter(paper => paper.title.trim()).map(paper => `- ${paper.title}`).join("\n") || "- 待加入关键文献";

  state.outline = [
    `# ${title}`,
    "",
    "## 摘要",
    `本研究关注：${question}`,
    "",
    "## 1. 引言",
    "- 问题背景",
    "- 为什么这个问题值得做一个小而可检验的研究",
    "",
    "## 2. 相关工作",
    papers,
    "",
    "## 3. 预注册假设",
    hypothesis,
    "",
    "## 4. 方法",
    method,
    "",
    "## 5. 结果",
    "- 只填写真实观察或分析结果，不编造显著性和引用",
    "",
    "## 6. 讨论",
    "- 假设是否被支持",
    "- 局限性",
    "- 下一步最小研究"
  ].join("\n");

  document.getElementById("outline").value = state.outline;
  saveState();
}

function loadExample() {
  state = {
    projectStatus: "preregistered",
    projectTitle: "夜间屏幕亮度与入睡时长的小样本观察",
    researchQuestion: "在 14 天自我观察中，睡前一小时平均屏幕亮度是否与入睡时长相关？",
    domain: "行为科学 / 自我量化",
    targetDate: nextDate(45),
    hypothesis: "如果睡前一小时平均屏幕亮度升高，则当晚入睡时长会增加；如果相关系数接近 0 或方向相反，则当前假设未被支持。",
    expectedResult: "预期高亮度晚上的入睡时长更长，差异至少达到 10 分钟。",
    falsification: "若 14 天数据中亮度与入睡时长无正相关，或控制咖啡因后关系消失，则放弃当前假设。",
    method: "连续 14 天记录睡前一小时屏幕亮度、咖啡因摄入、运动量和入睡时长。使用散点图和 Spearman 相关做探索性分析。",
    dailyLog: "今天确认变量记录表，先从可持续记录开始。",
    weeklyReview: "",
    quietMode: false,
    papers: [
      { title: "doi:10.1073/pnas.1418490112", note: "夜间蓝光与睡眠节律相关。" },
      { title: "PubMed keyword: screen brightness sleep onset", note: "需要继续检索相似自我量化研究。" },
      { title: "OSF preregistration examples", note: "参考预注册格式。" }
    ],
    outline: ""
  };
  saveState();
  window.location.reload();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "independent-research-project.json";
  link.click();
  URL.revokeObjectURL(url);
}

function evaluate(rule, data) {
  if (rule.test(data)) {
    return { title: rule.title, level: "green", points: 20, message: rule.green, next: "下一步：保持记录，并把依据写进日志。" };
  }
  if (rule.warn(data)) {
    return { title: rule.title, level: "yellow", points: 10, message: rule.yellow, next: "下一步：补一条具体变量、边界或证据来源。" };
  }
  return { title: rule.title, level: "red", points: 0, message: rule.red, next: "下一步：先暂停扩写，完成这个字段再继续。" };
}

function loadState() {
  try {
    const saved = localStorage.getItem(storageKey);
    return normalizeState(saved ? JSON.parse(saved) : {});
  } catch {
    return createDefaultState();
  }
}

function createDefaultState() {
  return { ...defaultState, papers: [] };
}

function normalizeState(savedState) {
  const normalized = createDefaultState();
  if (!savedState || typeof savedState !== "object") {
    return normalized;
  }

  fields.forEach(field => {
    if (field === "quietMode") {
      normalized[field] = Boolean(savedState[field]);
      return;
    }

    if (savedState[field] !== undefined && savedState[field] !== null) {
      normalized[field] = String(savedState[field]);
    }
  });

  normalized.papers = Array.isArray(savedState.papers)
    ? savedState.papers.map(normalizePaper)
    : [];

  return normalized;
}

function normalizePaper(paper) {
  if (!paper || typeof paper !== "object") {
    return { title: "", note: "" };
  }

  return {
    title: String(paper.title || ""),
    note: String(paper.note || "")
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function fullText(data) {
  return fields.map(field => String(data[field] || "")).join("\n");
}

function hasAny(text, words) {
  return words.some(word => String(text || "").includes(word));
}

function daysUntil(dateString) {
  const target = new Date(dateString);
  if (Number.isNaN(target.getTime())) return 0;
  return Math.ceil((target - new Date()) / 86400000);
}

function nextDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
