/* 记录创建、所有权、状态更新与安全边界 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../../js/core.js");
const { NOW, draft, localRecord } = require("../helpers/fixtures.js");

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

test("发布者可撤销结束，不能撤销别人的信息或重复恢复", () => {
  const closed = [{ ...localRecord(), status: "closed" }];
  assert.equal(core.markReopened(closed, "local-1")[0].status, "open");
  assert.equal(closed[0].status, "closed");
  assert.throws(() => core.markReopened(closed, "local-1", "other"), { code: "FORBIDDEN" });
  assert.throws(() => core.markReopened([localRecord()], "local-1"), { code: "ALREADY_OPEN" });
  assert.throws(() => core.markReopened([], "missing"), { code: "NOT_FOUND" });
});
