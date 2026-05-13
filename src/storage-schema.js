(function attachStorageSchema(global) {
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
    "quietMode",
    "vaultPathHint"
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
    vaultPathHint: "",
    papers: []
  };

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

  function buildVaultSnapshot(rawState) {
    const state = normalizeState(rawState);
    const project = buildProjectJson(state);
    const files = [
      jsonFile("project.json", project),
      textFile("README.md", buildVaultReadme(state)),
      textFile("preregistration/current.md", buildPreregistrationMarkdown(state)),
      jsonFile("literature/items.json", state.papers),
      textFile("literature/items.md", buildLiteratureMarkdown(state)),
      textFile("logs/daily.md", buildDailyLogMarkdown(state)),
      textFile("logs/weekly.md", buildWeeklyReviewMarkdown(state)),
      textFile("writing/preprint-outline.md", state.outline || "# 预印本骨架\n\n尚未生成。"),
      textFile("sources/README.md", buildSourcesReadme())
    ];

    return { state, files };
  }

  function buildProjectJson(state) {
    return {
      schemaVersion: 1,
      app: "min_scifi",
      project: {
        status: state.projectStatus,
        title: state.projectTitle,
        question: state.researchQuestion,
        domain: state.domain,
        targetDate: state.targetDate
      },
      preregistration: {
        hypothesis: state.hypothesis,
        expectedResult: state.expectedResult,
        falsification: state.falsification,
        method: state.method
      },
      literature: state.papers,
      logs: {
        daily: state.dailyLog,
        weekly: state.weeklyReview
      },
      writing: {
        outline: state.outline
      },
      settings: {
        quietMode: state.quietMode,
        vaultPathHint: state.vaultPathHint
      }
    };
  }

  function buildVaultReadme(state) {
    const title = state.projectTitle || "未命名研究";
    return [
      `# ${title}`,
      "",
      "这是一个 min_scifi 外部资料库。",
      "",
      "## 研究问题",
      state.researchQuestion || "尚未填写。",
      "",
      "## 目录",
      "",
      "- `project.json`: 机器可读的项目快照。",
      "- `preregistration/current.md`: 当前预注册内容。",
      "- `literature/`: 文献与证据笔记。",
      "- `logs/`: 日志与复盘。",
      "- `writing/`: 预印本写作材料。",
      "- `sources/`: 原始资料。应用只创建说明文件，不会改写你的资料。",
      "",
      "你可以用 Obsidian、文本编辑器、脚本或其他研究工具直接处理这个文件夹。"
    ].join("\n");
  }

  function buildPreregistrationMarkdown(state) {
    return [
      "# 当前预注册",
      "",
      "## 可证伪假设",
      state.hypothesis || "尚未填写。",
      "",
      "## 预期结果",
      state.expectedResult || "尚未填写。",
      "",
      "## 否证条件",
      state.falsification || "尚未填写。",
      "",
      "## 方法与数据",
      state.method || "尚未填写。"
    ].join("\n");
  }

  function buildLiteratureMarkdown(state) {
    const papers = state.papers.filter(paper => paper.title.trim() || paper.note.trim());
    if (!papers.length) {
      return "# 文献与证据\n\n尚未添加文献。";
    }

    return [
      "# 文献与证据",
      "",
      ...papers.flatMap((paper, index) => [
        `## ${index + 1}. ${paper.title || "未命名文献"}`,
        "",
        paper.note || "尚未填写笔记。",
        ""
      ])
    ].join("\n").trimEnd();
  }

  function buildDailyLogMarkdown(state) {
    return ["# 研究日志", "", state.dailyLog || "尚未记录。"].join("\n");
  }

  function buildWeeklyReviewMarkdown(state) {
    return ["# 每周复盘", "", state.weeklyReview || "尚未复盘。"].join("\n");
  }

  function buildSourcesReadme() {
    return [
      "# 原始资料",
      "",
      "把 PDF、CSV、图片、实验记录、Zotero 导出或其他原始资料放在这里。",
      "",
      "min_scifi 不会删除或改写这个目录里的未知文件。"
    ].join("\n");
  }

  function jsonFile(path, value) {
    return {
      path,
      content: `${JSON.stringify(value, null, 2)}\n`,
      type: "application/json"
    };
  }

  function textFile(path, content) {
    return {
      path,
      content: `${String(content).replace(/\s+$/u, "")}\n`,
      type: "text/markdown"
    };
  }

  global.MinScifiStorage = {
    storageKey,
    fields,
    createDefaultState,
    normalizeState,
    normalizePaper,
    buildVaultSnapshot,
    buildProjectJson
  };
})(window);
