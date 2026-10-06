/* 文本清理、日期、错误与编号工具；同时支持浏览器脚本和 Node.js。 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    const modules = root.ShiguangCoreModules || (root.ShiguangCoreModules = {});
    modules.utils = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function clean(value, multiline = false) {
    const text = String(value ?? "").replace(/\r\n?/g, "\n").trim();
    return multiline ? text.replace(/[ \t]+/g, " ") : text.replace(/\s+/g, " ");
  }

  function localDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function validCalendarDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
  }

  function errorWithCode(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function makeId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  return Object.freeze({ clean, localDate, validCalendarDate, errorWithCode, makeId });
});
