/* 本地缓存与未完成草稿的安全解析；同时支持浏览器脚本和 Node.js。 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./constants.js"), require("./utils.js"), require("./records.js"));
  } else {
    const modules = root.ShiguangCoreModules || (root.ShiguangCoreModules = {});
    modules.cache = factory(modules.constants, modules.utils, modules.records);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (constants, utils, records) {
  "use strict";

  const { CATEGORIES, TYPES } = constants;
  const { validCalendarDate } = utils;
  const { isRecord, assignRecordImages } = records;

  function parseLocalRecords(raw) {
    if (raw == null || raw === "") return { records: [], invalid: false };
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return { records: [], invalid: true };
      const records = data.filter(item => isRecord(item) && item.owner === "local" && !item.id.startsWith("sample-"));
      const ids = new Set();
      const unique = records.filter(item => {
        if (ids.has(item.id)) return false;
        ids.add(item.id);
        return true;
      });
      return { records: assignRecordImages(unique), invalid: unique.length !== data.length };
    } catch {
      return { records: [], invalid: true };
    }
  }

  function parsePublishDraft(raw) {
    if (raw == null || raw === "") return { draft: null, invalid: false };
    try {
      const data = JSON.parse(raw);
      const limits = { type: 5, title: 40, category: 10, place: 60, date: 10, description: 500, contact: 100, phone: 11 };
      if (!data || typeof data !== "object" || Array.isArray(data)) return { draft: null, invalid: true };
      const draft = {};
      for (const [field, limit] of Object.entries(limits)) {
        const value = field === "phone" && data[field] === undefined ? "" : data[field];
        if (typeof value !== "string" || value.length > limit) return { draft: null, invalid: true };
        draft[field] = value;
      }
      if (!TYPES.includes(draft.type) || (draft.category && !CATEGORIES.includes(draft.category)) ||
          (draft.date && !validCalendarDate(draft.date))) return { draft: null, invalid: true };
      return { draft, invalid: false };
    } catch {
      return { draft: null, invalid: true };
    }
  }

  return Object.freeze({ parseLocalRecords, parsePublishDraft });
});
