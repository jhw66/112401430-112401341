/* 信息搜索、组合筛选、排序与统计；同时支持浏览器脚本和 Node.js。 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./utils.js"));
  } else {
    const modules = root.ShiguangCoreModules || (root.ShiguangCoreModules = {});
    modules.queries = factory(modules.utils);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (utils) {
  "use strict";

  const { clean } = utils;

  function filterRecords(records, filters = {}) {
    const keyword = clean(filters.keyword).toLocaleLowerCase("zh-CN");
    return records.filter(item => {
      if (filters.type && filters.type !== "all" && item.type !== filters.type) return false;
      if (filters.category && filters.category !== "all" && item.category !== filters.category) return false;
      if (filters.status && filters.status !== "all" && item.status !== filters.status) return false;
      if (!keyword) return true;
      const haystack = [item.title, item.category, item.place, item.description].join(" ").toLocaleLowerCase("zh-CN");
      return haystack.includes(keyword);
    }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
  }

  function getStats(records) {
    return records.reduce((acc, item) => {
      acc.total += 1;
      if (item.status === "open") acc.open += 1;
      if (item.type === "lost") acc.lost += 1;
      if (item.type === "found") acc.found += 1;
      return acc;
    }, { total: 0, open: 0, lost: 0, found: 0 });
  }

  return Object.freeze({ filterRecords, getStats });
});
