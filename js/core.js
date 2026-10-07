/* 业务逻辑统一入口；浏览器按 index.html 顺序加载，Node.js 可直接 require 本文件。 */
(function (root, factory) {
  const modules = typeof module !== "undefined" && module.exports ? {
    constants: require("./core/constants.js"),
    utils: require("./core/utils.js"),
    validation: require("./core/validation.js"),
    records: require("./core/records.js"),
    cache: require("./core/cache.js"),
    queries: require("./core/queries.js"),
    samples: require("./core/samples.js")
  } : root.ShiguangCoreModules;
  const api = factory(modules);
  root.ShiguangCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (modules) {
  "use strict";

  const { CATEGORIES, TYPE_LABELS, STATUS_LABELS } = modules.constants;
  const { clean, localDate, validCalendarDate } = modules.utils;
  const { normalizeDraft, validateDraft } = modules.validation;
  const { createRecord, isRecord, markClosed, markReopened } = modules.records;
  const { parseLocalRecords, parsePublishDraft } = modules.cache;
  const { filterRecords, getStats } = modules.queries;
  const { SAMPLE_RECORDS } = modules.samples;

  return Object.freeze({
    CATEGORIES, TYPE_LABELS, STATUS_LABELS, SAMPLE_RECORDS,
    clean, localDate, validCalendarDate, normalizeDraft, validateDraft,
    createRecord, isRecord, parseLocalRecords, parsePublishDraft,
    filterRecords, markClosed, markReopened, getStats
  });
});
