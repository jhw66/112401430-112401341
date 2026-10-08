/* 关键词与地点筛选、组合条件、排序和统计 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../../js/core.js");
const { NOW, draft, localRecord } = require("../helpers/fixtures.js");

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

test("统计会分别计算总数、进行中、寻物和招领", () => {
  assert.deepEqual(core.getStats(core.SAMPLE_RECORDS), { total: 5, open: 4, lost: 2, found: 3 });
});

test("排序比较实际发布时间，包含不同时区格式", () => {
  const earlier = { ...localRecord("early"), createdAt: "2026-09-29T11:00:00+08:00" };
  const later = { ...localRecord("late"), createdAt: "2026-09-29T04:00:00Z" };
  assert.deepEqual(core.filterRecords([earlier, later]).map(item => item.id), ["late", "early"]);
});
