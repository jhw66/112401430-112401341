/* 物品类别、信息类型与状态名称；同时支持浏览器脚本和 Node.js。 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    const modules = root.ShiguangCoreModules || (root.ShiguangCoreModules = {});
    modules.constants = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CATEGORIES = Object.freeze(["证件卡片", "钥匙", "数码物品", "雨具", "水杯", "书本文具", "其他"]);
  const TYPE_LABELS = Object.freeze({ lost: "寻物", found: "招领" });
  const TYPES = Object.freeze(["lost", "found"]);
  const STATUS_LABELS = Object.freeze({ lost: { open: "寻找中", closed: "已找到" }, found: { open: "招领中", closed: "已归还" } });

  return Object.freeze({ CATEGORIES, TYPE_LABELS, TYPES, STATUS_LABELS });
});
