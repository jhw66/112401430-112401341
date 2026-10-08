/* 字段预处理与发布校验 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../../js/core.js");
const { draft } = require("../helpers/fixtures.js");

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
