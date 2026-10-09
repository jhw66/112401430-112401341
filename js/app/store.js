/* 应用状态与本地存储：记录、草稿、损坏缓存备份及保存失败提示。 */
(function (root) {
  "use strict";

  const modules = root.ShiguangAppModules || (root.ShiguangAppModules = {});
  modules.createStore = function (core) {
    const storageKey = "shiguang_local_posts_v1";
    const draftKey = "shiguang_publish_draft_v1";
    let storageWarning = "";
    let localRecords = [];
    let pendingDraft = null;
    let draftWarning = "";
    let damagedRecordsRaw = null;

    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = core.parseLocalRecords(raw);
      localRecords = parsed.records;
      if (parsed.invalid) {
        damagedRecordsRaw = raw;
        storageWarning = "部分本地记录格式异常，已跳过；原始缓存未被覆盖。";
      }
    } catch {
      storageWarning = "当前浏览器不允许本地存储，新发布的信息仅在本次打开期间保留。";
    }

    try {
      const parsed = core.parsePublishDraft(localStorage.getItem(draftKey));
      pendingDraft = parsed.draft;
      if (parsed.invalid) draftWarning = "旧草稿格式异常，未自动填入表单。";
    } catch {
      draftWarning = "草稿暂存于本次页面中，关闭后无法恢复。";
    }

    function allRecords() {
      return [...localRecords, ...core.SAMPLE_RECORDS];
    }

    function saveLocalRecords() {
      try {
        // 首次写入前备份异常缓存，避免覆盖尚未恢复的旧记录。
        if (damagedRecordsRaw !== null) {
          localStorage.setItem(`${storageKey}_recovery_${Date.now()}`, damagedRecordsRaw);
          damagedRecordsRaw = null;
        }
        localStorage.setItem(storageKey, JSON.stringify(localRecords));
        storageWarning = "";
        return true;
      } catch {
        storageWarning = "本地保存失败；本次打开期间仍可查看记录，但关闭页面后可能丢失。";
        return false;
      }
    }

    function persistPublishDraft(draft) {
      pendingDraft = draft;
      try {
        localStorage.setItem(draftKey, JSON.stringify(pendingDraft));
        draftWarning = "";
      } catch {
        draftWarning = "草稿暂存于本次页面中，关闭后无法恢复。";
      }
    }

    function clearPublishDraft() {
      pendingDraft = null;
      try {
        localStorage.removeItem(draftKey);
        draftWarning = "";
      } catch {
        draftWarning = "信息已发布，但旧草稿未能清除；重新打开时请勿重复发布。";
      }
    }

    function refreshLocalRecords() {
      // 写入前读取其他标签页保存的记录；存储失败时保留当前内存记录。
      if (!storageWarning) {
        try {
          const parsed = core.parseLocalRecords(localStorage.getItem(storageKey));
          if (!parsed.invalid) localRecords = parsed.records;
        } catch { /* 继续使用当前页面的内存记录。 */ }
      }
    }

    function addRecord(item) {
      refreshLocalRecords();
      localRecords = core.addLocalRecord(localRecords, item);
    }

    function deleteRecord(id) {
      refreshLocalRecords();
      const previous = localRecords;
      localRecords = core.deleteRecord(localRecords, id);
      if (!saveLocalRecords()) {
        localRecords = previous;
        throw new Error("删除未能保存，记录已保留，请稍后重试。");
      }
    }

    function updateStatus(id, reopening) {
      refreshLocalRecords();
      localRecords = reopening
        ? core.markReopened(localRecords, id)
        : core.markClosed(localRecords, id);
    }

    return {
      allRecords, saveLocalRecords, persistPublishDraft, clearPublishDraft,
      addRecord, deleteRecord, updateStatus,
      get localRecords() { return localRecords; },
      get publicationLimitReached() { return localRecords.length >= core.MAX_LOCAL_RECORDS; },
      get pendingDraft() { return pendingDraft; },
      get storageWarning() { return storageWarning; },
      get draftWarning() { return draftWarning; }
    };
  };
})(window);
