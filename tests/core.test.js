"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../js/core.js");

const NOW = new Date(2026, 8, 29, 12, 0, 0);
const draft = () => ({
  type: "found", title: " 蓝色校园卡 ", category: "证件卡片",
  place: " 图书馆二楼 ", date: "2026-09-28",
  description: "在二楼自习区捡到一张蓝色校园卡。", contact: " finder@example.edu "
});
const localRecord = (id = "local-1") => core.createRecord(draft(), { id, now: NOW });

test("预处理会去掉字段两端空白，同时保留描述换行", () => {
  const value = core.normalizeDraft({ ...draft(), title: "  蓝色   校园卡  ", description: " 第一行  内容\n第二行 " });
  assert.equal(value.title, "蓝色 校园卡");
  assert.equal(value.description, "第一行 内容\n第二行");
});

test("完整有效的信息能够通过校验", () => {
  assert.deepEqual(core.validateDraft(draft(), "2026-09-29"), {});
});

test("空表单对所有必填字段给出错误", () => {
  assert.deepEqual(Object.keys(core.validateDraft({}, "2026-09-29")).sort(),
    ["type", "title", "category", "place", "date", "description", "contact"].sort());
});

test("日历上不存在的日期不能发布", () => {
  assert.equal(core.validCalendarDate("2026-02-30"), false);
  assert.ok(core.validateDraft({ ...draft(), date: "2026-02-30" }, "2026-09-29").date);
});

test("晚于今天的日期不能发布", () => {
  assert.ok(core.validateDraft({ ...draft(), date: "2026-09-30" }, "2026-09-29").date);
});

test("名称长度边界：2 字允许，超过 40 字拒绝", () => {
  assert.equal(core.validateDraft({ ...draft(), title: "钥匙" }, "2026-09-29").title, undefined);
  assert.ok(core.validateDraft({ ...draft(), title: "物".repeat(41) }, "2026-09-29").title);
});

test("无效类别、过短描述和联系方式分别报错", () => {
  const errors = core.validateDraft({ ...draft(), category: "未知类别", description: "太短", contact: "abc" }, "2026-09-29");
  assert.ok(errors.category && errors.description && errors.contact);
});

test("联系邮箱需有有效格式，长度不能超过 100 个字符", () => {
  assert.equal(core.validateDraft({ ...draft(), contact: "classmate@example.edu" }, "2026-09-29").contact, undefined);
  for (const contact of ["13800138000", "name@", "name@example.edu extra", `${"a".repeat(90)}@example.edu`]) {
    assert.ok(core.validateDraft({ ...draft(), contact }, "2026-09-29").contact, contact);
  }
});

test("创建记录自动设为本机发布且状态为进行中", () => {
  const item = localRecord();
  assert.equal(item.id, "local-1");
  assert.equal(item.title, "蓝色校园卡");
  assert.equal(item.owner, "local");
  assert.equal(item.status, "open");
  assert.equal(item.createdAt, NOW.toISOString());
});

test("创建记录会拒绝不合格字段和危险编号", () => {
  assert.throws(() => core.createRecord({ ...draft(), title: "" }, { id: "ok", now: NOW }), { code: "VALIDATION" });
  assert.throws(() => core.createRecord(draft(), { id: 'bad" onmouseover="x', now: NOW }), { code: "INVALID_ID" });
});

test("关键词可匹配名称、地点、类别和描述，英文不区分大小写", () => {
  const item = localRecord();
  for (const keyword of ["校园卡", "图书馆", "证件", "自习区", "FINDER"]) {
    const expected = keyword === "FINDER" ? 0 : 1; // 联系方式不参与公开搜索
    assert.equal(core.filterRecords([item], { keyword }).length, expected);
  }
});

test("类型、类别和状态筛选可以组合", () => {
  const records = [localRecord(), ...core.SAMPLE_RECORDS];
  const result = core.filterRecords(records, { type: "found", category: "证件卡片", status: "open" });
  assert.equal(result.length, 2);
  assert.ok(result.every(item => item.type === "found" && item.category === "证件卡片" && item.status === "open"));
});

test("地点缺省、为空或纯空白时保持原有筛选结果", () => {
  const records = [localRecord(), ...core.SAMPLE_RECORDS];
  for (const place of [undefined, null, "", " \t\n "]) {
    const result = core.filterRecords(records, { keyword: "校园卡", status: "open", place });
    assert.deepEqual(result.map(item => item.id), ["local-1", "sample-card"]);
  }
});

test("只填写地点时可按地点包含匹配，无需通用关键词", () => {
  const records = [localRecord(), ...core.SAMPLE_RECORDS];
  const result = core.filterRecords(records, { place: "图书馆" });
  assert.deepEqual(result.map(item => item.id), ["local-1", "sample-card"]);
});

test("地点不命中时返回空结果", () => {
  assert.deepEqual(core.filterRecords([localRecord(), ...core.SAMPLE_RECORDS], { place: "校外车站" }), []);
});

test("地点条件会清理空白，并且英文不区分大小写", () => {
  const item = core.createRecord({ ...draft(), place: "Teaching Building A" }, { id: "english-place", now: NOW });
  for (const place of ["  TEACHING   BUILDING\n", "bUiLdInG a"]) {
    assert.deepEqual(core.filterRecords([item], { place }).map(record => record.id), ["english-place"]);
  }
  assert.deepEqual(core.filterRecords([item], { place: "Teaching Building B" }), []);
});

test("地点只匹配 place，名称或描述含地点词不能误命中", () => {
  const titleOnly = { ...localRecord("title-only"), place: "第一食堂", title: "图书馆校园卡" };
  const descriptionOnly = { ...localRecord("description-only"), place: "第一食堂", description: "失主可能在图书馆上课，请描述卡片特征。" };
  const records = [titleOnly, descriptionOnly];
  assert.deepEqual(core.filterRecords(records, { keyword: "图书馆" }).map(item => item.id), ["description-only", "title-only"]);
  assert.deepEqual(core.filterRecords(records, { place: "图书馆" }), []);
});

test("地点、关键词、类型、类别和状态必须同时满足", () => {
  const matching = localRecord("matching");
  const records = [
    matching,
    { ...matching, id: "wrong-place", place: "第一食堂" },
    { ...matching, id: "wrong-keyword", title: "黑色钱包", description: "一只黑色皮质钱包，认领时请描述物品特征。" },
    { ...matching, id: "wrong-type", type: "lost" },
    { ...matching, id: "wrong-category", category: "其他" },
    { ...matching, id: "wrong-status", status: "closed" }
  ];
  const result = core.filterRecords(records, {
    place: "图书馆", keyword: "校园卡", type: "found", category: "证件卡片", status: "open"
  });
  assert.deepEqual(result.map(item => item.id), ["matching"]);
});

test("地点可与全部类型、类别和状态组合", () => {
  const result = core.filterRecords(core.SAMPLE_RECORDS, { place: "教学楼", type: "all", category: "all", status: "all" });
  assert.deepEqual(result.map(item => item.id), ["sample-keys", "sample-bottle"]);
});

test("地点筛选保持时间与编号排序，不修改输入数组、记录或条件", () => {
  const records = [
    { ...localRecord("earlier"), createdAt: "2026-09-27T01:00:00.000Z" },
    localRecord("b"),
    { ...localRecord("excluded"), place: "第一食堂", createdAt: "2026-09-30T01:00:00.000Z" },
    localRecord("a")
  ];
  const original = records.map(item => ({ ...item }));
  const input = Object.freeze(records.map(item => Object.freeze(item)));
  const filters = Object.freeze({ place: " 图书馆 " });
  assert.deepEqual(core.filterRecords(input, filters).map(item => item.id), ["a", "b", "earlier"]);
  assert.deepEqual(input, original);
  assert.deepEqual(filters, { place: " 图书馆 " });
});

test("列表按发布时间倒序且不会改变传入数组", () => {
  const earlier = { ...localRecord("earlier"), createdAt: "2026-09-27T01:00:00.000Z" };
  const later = { ...localRecord("later"), createdAt: "2026-09-29T01:00:00.000Z" };
  const input = [earlier, later];
  assert.deepEqual(core.filterRecords(input).map(item => item.id), ["later", "earlier"]);
  assert.deepEqual(input.map(item => item.id), ["earlier", "later"]);
});

test("发布者可以结束自己的信息，原记录保持不变", () => {
  const original = [localRecord()];
  const updated = core.markClosed(original, "local-1");
  assert.equal(updated[0].status, "closed");
  assert.equal(original[0].status, "open");
});

test("不能修改演示信息或其他发布者的信息", () => {
  assert.throws(() => core.markClosed([...core.SAMPLE_RECORDS], "sample-card"), { code: "FORBIDDEN" });
  assert.throws(() => core.markClosed([localRecord()], "local-1", "someone-else"), { code: "FORBIDDEN" });
});

test("不存在的编号及重复结束状态会分别报错", () => {
  assert.throws(() => core.markClosed([localRecord()], "missing"), { code: "NOT_FOUND" });
  assert.throws(() => core.markClosed([{ ...localRecord(), status: "closed" }], "local-1"), { code: "ALREADY_CLOSED" });
});

test("本地缓存缺失、非法 JSON 和非数组内容都能安全处理", () => {
  assert.deepEqual(core.parseLocalRecords(null), { records: [], invalid: false });
  assert.deepEqual(core.parseLocalRecords("{"), { records: [], invalid: true });
  assert.deepEqual(core.parseLocalRecords("{}"), { records: [], invalid: true });
});

test("本地缓存会剔除伪造的样例、损坏记录和重复编号", () => {
  const item = localRecord();
  const parsed = core.parseLocalRecords(JSON.stringify([item, item, core.SAMPLE_RECORDS[0], { x: 1 }]));
  assert.deepEqual(parsed.records, [item]);
  assert.equal(parsed.invalid, true);
});

test("旧版已保存的非邮箱联系方式仍可读取，避免升级时丢失记录", () => {
  const oldRecord = { ...localRecord(), contact: "13800138000" };
  assert.deepEqual(core.parseLocalRecords(JSON.stringify([oldRecord])).records, [oldRecord]);
});

test("统计会分别计算总数、进行中、寻物和招领", () => {
  assert.deepEqual(core.getStats(core.SAMPLE_RECORDS), { total: 5, open: 4, lost: 2, found: 3 });
});

test("寻物和招领的结束状态使用作业中的名称", () => {
  assert.equal(core.STATUS_LABELS.lost.closed, "已找到");
  assert.equal(core.STATUS_LABELS.found.closed, "已归还");
});

test("原型继承属性、非字符串等非法类型不能创建或从缓存载入", () => {
  for (const type of ["toString", "constructor", "__proto__", "hasOwnProperty", ["found"], null]) {
    assert.ok(core.validateDraft({ ...draft(), type }, "2026-09-29").type);
    assert.throws(() => core.createRecord({ ...draft(), type }, { now: NOW }), { code: "VALIDATION" });
    assert.equal(core.isRecord({ ...localRecord(), type }), false);
    assert.deepEqual(core.parseLocalRecords(JSON.stringify([{ ...localRecord(), type }])), { records: [], invalid: true });
  }
});

test("演示编号保留给演示记录，本机记录不能覆盖演示详情", () => {
  assert.throws(() => core.createRecord(draft(), { id: "sample-card", now: NOW }), { code: "INVALID_ID" });
  assert.equal(core.parseLocalRecords(JSON.stringify([{ ...localRecord(), id: "sample-card" }])).records.length, 0);
});

test("排序比较实际发布时间，包含不同时区格式", () => {
  const earlier = { ...localRecord("early"), createdAt: "2026-09-29T11:00:00+08:00" };
  const later = { ...localRecord("late"), createdAt: "2026-09-29T04:00:00Z" };
  assert.deepEqual(core.filterRecords([earlier, later]).map(item => item.id), ["late", "early"]);
});

test("发布者可撤销结束，不能撤销别人的信息或重复恢复", () => {
  const closed = [{ ...localRecord(), status: "closed" }];
  assert.equal(core.markReopened(closed, "local-1")[0].status, "open");
  assert.equal(closed[0].status, "closed");
  assert.throws(() => core.markReopened(closed, "local-1", "other"), { code: "FORBIDDEN" });
  assert.throws(() => core.markReopened([localRecord()], "local-1"), { code: "ALREADY_OPEN" });
  assert.throws(() => core.markReopened([], "missing"), { code: "NOT_FOUND" });
});

test("未完成草稿允许空字段与非法邮箱，保留换行及两端空白", () => {
  const value = { ...draft(), type: "found", contact: "", description: " 第一行\n 第二行 ", category: "" };
  assert.deepEqual(core.parsePublishDraft(JSON.stringify(value)), { draft: value, invalid: false });
  assert.deepEqual(core.parsePublishDraft(null), { draft: null, invalid: false });
});

test("草稿缓存拒绝损坏 JSON、非对象、危险类型和超长字段", () => {
  for (const raw of ["{", "[]", "null", JSON.stringify({ ...draft(), type: "toString" }),
    JSON.stringify({ ...draft(), title: "物".repeat(41) }), JSON.stringify({ ...draft(), date: "2026-02-30" })]) {
    assert.deepEqual(core.parsePublishDraft(raw), { draft: null, invalid: true });
  }
});
