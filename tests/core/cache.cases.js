/* 本地记录和发布草稿解析 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../../js/core.js");
const { draft, localRecord } = require("../helpers/fixtures.js");

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
