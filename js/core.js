/* 纯业务逻辑：在浏览器直接运行，也可由 Node.js 内置测试器加载。 */
(function (root, factory) {
  const api = factory();
  root.ShiguangCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CATEGORIES = Object.freeze(["证件卡片", "钥匙", "数码物品", "雨具", "水杯", "书本文具", "其他"]);
  const TYPE_LABELS = Object.freeze({ lost: "寻物", found: "招领" });
  const TYPES = Object.freeze(["lost", "found"]);
  const STATUS_LABELS = Object.freeze({ lost: { open: "寻找中", closed: "已找到" }, found: { open: "招领中", closed: "已归还" } });

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

  function normalizeDraft(draft) {
    return {
      type: clean(draft?.type),
      title: clean(draft?.title),
      category: clean(draft?.category),
      place: clean(draft?.place),
      date: clean(draft?.date),
      description: clean(draft?.description, true),
      contact: clean(draft?.contact)
    };
  }

  function validateDraft(draft, today = localDate()) {
    const item = normalizeDraft(draft);
    const errors = {};
    if (typeof draft?.type !== "string" || !TYPES.includes(item.type)) errors.type = "请选择寻物或招领。";
    if (item.title.length < 2 || item.title.length > 40) errors.title = "物品名称需填写 2–40 个字。";
    if (!CATEGORIES.includes(item.category)) errors.category = "请选择物品类别。";
    if (item.place.length < 2 || item.place.length > 60) errors.place = "地点需填写 2–60 个字。";
    if (!validCalendarDate(item.date) || item.date > today) errors.date = "请选择不晚于今天的有效日期。";
    if (item.description.length < 10 || item.description.length > 500) errors.description = "描述需填写 10–500 个字。";
    if (item.contact.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.contact)) {
      errors.contact = "请填写有效的联系邮箱（不超过 100 个字符）。";
    }
    return errors;
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
      typeof item.contact === "string" && item.contact.length >= 5 && item.contact.length <= 100 &&
      validCalendarDate(item.date) && typeof item.createdAt === "string" &&
      !Number.isNaN(Date.parse(item.createdAt));
  }

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
      return { records: unique, invalid: unique.length !== data.length };
    } catch {
      return { records: [], invalid: true };
    }
  }

  function parsePublishDraft(raw) {
    if (raw == null || raw === "") return { draft: null, invalid: false };
    try {
      const data = JSON.parse(raw);
      const limits = { type: 5, title: 40, category: 10, place: 60, date: 10, description: 500, contact: 100 };
      if (!data || typeof data !== "object" || Array.isArray(data)) return { draft: null, invalid: true };
      const draft = {};
      for (const [field, limit] of Object.entries(limits)) {
        if (typeof data[field] !== "string" || data[field].length > limit) return { draft: null, invalid: true };
        draft[field] = data[field];
      }
      if (!TYPES.includes(draft.type) || (draft.category && !CATEGORIES.includes(draft.category)) ||
          (draft.date && !validCalendarDate(draft.date))) return { draft: null, invalid: true };
      return { draft, invalid: false };
    } catch {
      return { draft: null, invalid: true };
    }
  }

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

  function getStats(records) {
    return records.reduce((acc, item) => {
      acc.total += 1;
      if (item.status === "open") acc.open += 1;
      if (item.type === "lost") acc.lost += 1;
      if (item.type === "found") acc.found += 1;
      return acc;
    }, { total: 0, open: 0, lost: 0, found: 0 });
  }

  const SAMPLE_RECORDS = Object.freeze([
    {
      id: "sample-card", type: "found", title: "蓝色校园卡", category: "证件卡片",
      place: "图书馆二楼自习区", date: "2026-09-28", description: "捡到一张蓝色校园卡，卡套正面有一枚白色贴纸。认领时请先描述卡片特征。",
      contact: "finder@example.edu", status: "open", owner: "sample", createdAt: "2026-09-28T09:40:00.000Z"
    },
    {
      id: "sample-umbrella", type: "lost", title: "黑色折叠伞", category: "雨具",
      place: "第一食堂一层", date: "2026-09-27", description: "午饭后发现黑色折叠伞不见了，伞柄上有一条红色挂绳。",
      contact: "owner@example.edu", status: "open", owner: "sample", createdAt: "2026-09-27T04:20:00.000Z"
    },
    {
      id: "sample-earbuds", type: "found", title: "无线耳机充电盒", category: "数码物品",
      place: "东区操场看台", date: "2026-09-26", description: "晚间运动后捡到白色耳机充电盒，认领时请说明品牌和外观细节。",
      contact: "sports@example.edu", status: "open", owner: "sample", createdAt: "2026-09-26T12:15:00.000Z"
    },
    {
      id: "sample-keys", type: "lost", title: "宿舍钥匙串", category: "钥匙",
      place: "教学楼 A 区门口", date: "2026-09-25", description: "一个带绿色小挂件的钥匙串，可能在教学楼入口附近掉落。",
      contact: "keys@example.edu", status: "closed", owner: "sample", createdAt: "2026-09-25T08:10:00.000Z"
    },
    {
      id: "sample-bottle", type: "found", title: "浅蓝色水杯", category: "水杯",
      place: "西区教学楼 204", date: "2026-09-24", description: "课后在 204 教室发现浅蓝色水杯，杯盖有卡通图案。",
      contact: "classroom@example.edu", status: "open", owner: "sample", createdAt: "2026-09-24T10:30:00.000Z"
    }
  ]);

  return Object.freeze({
    CATEGORIES, TYPE_LABELS, STATUS_LABELS, SAMPLE_RECORDS,
    clean, localDate, validCalendarDate, normalizeDraft, validateDraft,
    createRecord, isRecord, parseLocalRecords, parsePublishDraft, filterRecords, markClosed, markReopened, getStats
  });
});
