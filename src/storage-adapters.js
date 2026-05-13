(function attachStorageAdapters(global) {
  const storage = global.MinScifiStorage;

  if (!storage) {
    throw new Error("MinScifiStorage must be loaded before storage adapters.");
  }

  async function chooseBrowserVaultDirectory() {
    if (!global.showDirectoryPicker) {
      throw new Error("当前浏览器不支持目录授权。请使用 Chrome/Edge，或启动本地后端模式。");
    }

    return global.showDirectoryPicker({ mode: "readwrite" });
  }

  async function saveToBrowserVault(directoryHandle, rawState) {
    if (!directoryHandle) {
      throw new Error("请先连接资料库目录。");
    }

    const snapshot = storage.buildVaultSnapshot(rawState);
    await writeVaultFiles(directoryHandle, snapshot.files);

    return {
      mode: "browser-vault",
      vaultName: directoryHandle.name || "已授权目录",
      fileCount: snapshot.files.length
    };
  }

  async function writeVaultFiles(rootDirectory, files) {
    for (const file of files) {
      await writeTextFile(rootDirectory, file.path, file.content);
    }
  }

  async function writeTextFile(rootDirectory, path, content) {
    const parts = path.split("/").filter(Boolean);
    const fileName = parts.pop();
    let directory = rootDirectory;

    for (const part of parts) {
      directory = await directory.getDirectoryHandle(part, { create: true });
    }

    const fileHandle = await directory.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async function getBackendConfig(fetchImpl = global.fetch) {
    const response = await fetchImpl("/api/vault/config");
    return readJsonResponse(response, "读取本地资料库配置失败。");
  }

  async function configureBackendVault(vaultPath, fetchImpl = global.fetch) {
    const response = await fetchImpl("/api/vault/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultPath })
    });

    return readJsonResponse(response, "设置本地资料库路径失败。");
  }

  async function saveToBackendVault(rawState, fetchImpl = global.fetch) {
    const state = storage.normalizeState(rawState);
    const response = await fetchImpl("/api/vault/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    });
    const result = await readJsonResponse(response, "写入本地资料库失败。");

    return {
      mode: "backend-vault",
      ...result
    };
  }

  async function readJsonResponse(response, fallbackMessage) {
    if (!response || !response.ok) {
      throw new Error(fallbackMessage);
    }

    return response.json();
  }

  global.MinScifiAdapters = {
    chooseBrowserVaultDirectory,
    saveToBrowserVault,
    writeVaultFiles,
    writeTextFile,
    getBackendConfig,
    configureBackendVault,
    saveToBackendVault
  };
})(window);
