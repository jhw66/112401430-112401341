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
  assert.deepEqual(parsed.records, [{ ...item, imageNumber: 1 }]);
  assert.equal(parsed.invalid, true);
});

test("旧版已保存的非邮箱联系方式仍可读取，避免升级时丢失记录", () => {
  const { phone, ...legacyRecord } = localRecord();
  const oldRecord = { ...legacyRecord, contact: "13800138000" };
  assert.deepEqual(core.parseLocalRecords(JSON.stringify([oldRecord])).records, [{ ...oldRecord, imageNumber: 1 }]);
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
test("旧邮箱联系方式保持原样并补配图，新增手机号字段异常的记录被跳过", () => {
  const { phone, ...oldRecord } = localRecord("legacy-email");
  const valid = { ...localRecord("new-phone"), contact: "", phone: "13800138000" };
  const invalid = { ...valid, id: "bad-phone", phone: ["13800138000"] };
  const parsed = core.parseLocalRecords(JSON.stringify([oldRecord, valid, invalid]));
  assert.deepEqual(parsed, { records: [{ ...oldRecord, imageNumber: 1 }, { ...valid, imageNumber: 2 }], invalid: true });
});

test("旧草稿补充空手机号，新草稿保留未完成手机号并拒绝危险类型", () => {
  const { phone, ...oldDraft } = draft();
  assert.deepEqual(core.parsePublishDraft(JSON.stringify(oldDraft)), { draft: { ...oldDraft, phone: "" }, invalid: false });
  const incomplete = { ...draft(), contact: "name@", phone: "13" };
  assert.deepEqual(core.parsePublishDraft(JSON.stringify(incomplete)), { draft: incomplete, invalid: false });
  for (const phone of [null, {}, [], "138001380000"]) {
    assert.deepEqual(core.parsePublishDraft(JSON.stringify({ ...draft(), phone })), { draft: null, invalid: true });
  }
});

test("旧记录按发布时间补配图，保留已有编号且缓存重读后保持稳定", () => {
  const newer = { ...localRecord("newer"), createdAt: "2026-09-29T03:00:00.000Z" };
  const older = { ...localRecord("older"), createdAt: "2026-09-28T03:00:00.000Z" };
  const fixed = { ...localRecord("fixed"), imageNumber: 2 };
  const raw = JSON.stringify([newer, fixed, older]);
  const parsed = core.parseLocalRecords(raw);
  assert.equal(parsed.invalid, false);
  assert.deepEqual(parsed.records.map(item => item.imageNumber), [3, 2, 1]);
  assert.deepEqual(core.parseLocalRecords(JSON.stringify(parsed.records)), parsed);
  assert.equal(newer.imageNumber, undefined);
  assert.equal(older.imageNumber, undefined);
});

test("旧缓存超过十条时保留全部记录并阻止新增，重复配图可补号", () => {
  const old = Array.from({ length: 12 }, (_, index) => ({ ...localRecord(`legacy-${index}`), createdAt: new Date(2026, 8, index + 1).toISOString() }));
  const parsed = core.parseLocalRecords(JSON.stringify(old));
  assert.equal(parsed.invalid, false);
  assert.equal(parsed.records.length, 12);
  assert.deepEqual(parsed.records.slice(0, 10).map(item => item.imageNumber), [1,2,3,4,5,6,7,8,9,10]);
  assert.throws(() => core.addLocalRecord(parsed.records, localRecord("extra")), { code: "POST_LIMIT" });
  assert.deepEqual(core.parseLocalRecords(JSON.stringify(parsed.records)), parsed);
  const repeated = core.parseLocalRecords(JSON.stringify([{ ...old[0], imageNumber: 3 }, { ...old[1], imageNumber: 3 }]));
  assert.deepEqual(repeated.records.map(item => item.imageNumber), [3, 1]);
});

test("非法配图编号被跳过，旧记录其余字段仍完整保留", () => {
  const item = localRecord("legacy");
  const parsed = core.parseLocalRecords(JSON.stringify([item, { ...item, id: "bad-image", imageNumber: '" onerror="alert(1)' }]));
  assert.deepEqual(parsed, { records: [{ ...item, imageNumber: 1 }], invalid: true });
});
