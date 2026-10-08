/* 记录创建、有效性检查与状态变更；同时支持浏览器脚本和 Node.js。 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./utils.js"), require("./validation.js"), require("./constants.js"));
  } else {
    const modules = root.ShiguangCoreModules || (root.ShiguangCoreModules = {});
    modules.records = factory(modules.utils, modules.validation, modules.constants);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (utils, validation, constants) {
  "use strict";

  const { localDate, validCalendarDate, errorWithCode, makeId } = utils;
  const { normalizeDraft, validateContacts, validateDraft } = validation;
  const { CATEGORIES, TYPES } = constants;

  function createRecord(draft, options = {}) {
    const now = options.now instanceof Date ? options.now : new Date();
    const errors = validateDraft(draft, localDate(now));
    if (Object.keys(errors).length) {
      const error = errorWithCode("VALIDATION", "发布信息未通过校验。");
      error.fields = errors;
      throw error;
    }
    const id = options.id ?? makeId();
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || id.startsWith("sample-")) {
      throw errorWithCode("INVALID_ID", "记录编号格式无效或与演示信息冲突。");
    }
    return {
      id,
      ...normalizeDraft(draft),
      status: "open",
      owner: "local",
      createdAt: now.toISOString()
    };
  }

  function isRecord(item) {
    return !!item && typeof item === "object" &&
      typeof item.id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(item.id) &&
      typeof item.type === "string" && TYPES.includes(item.type) && CATEGORIES.includes(item.category) &&
      ["open", "closed"].includes(item.status) && ["local", "sample"].includes(item.owner) &&
      typeof item.title === "string" && item.title.length >= 2 && item.title.length <= 40 &&
      typeof item.place === "string" && item.place.length >= 2 && item.place.length <= 60 &&
      typeof item.description === "string" && item.description.length >= 10 && item.description.length <= 500 &&
      typeof item.contact === "string" &&
      (item.phone === undefined ? item.contact.length >= 5 && item.contact.length <= 100 :
        Object.keys(validateContacts(item)).length === 0) &&
      validCalendarDate(item.date) && typeof item.createdAt === "string" &&
      !Number.isNaN(Date.parse(item.createdAt));
  }

  function changeStatus(records, id, nextStatus, actor) {
    const index = records.findIndex(item => item.id === id);
    if (index < 0) throw errorWithCode("NOT_FOUND", "信息不存在。");
    const record = records[index];
    if (record.owner !== actor) throw errorWithCode("FORBIDDEN", "只能更新本机发布的信息。");
    if (record.status === nextStatus) {
      throw errorWithCode(nextStatus === "closed" ? "ALREADY_CLOSED" : "ALREADY_OPEN",
        nextStatus === "closed" ? "这条信息已结束。" : "这条信息已经在进行中。");
    }
    return records.map(item => item.id === id ? { ...item, status: nextStatus } : item);
  }

  function markClosed(records, id, actor = "local") {
    return changeStatus(records, id, "closed", actor);
  }

  function markReopened(records, id, actor = "local") {
    return changeStatus(records, id, "open", actor);
  }

  return Object.freeze({ createRecord, isRecord, markClosed, markReopened });
});
