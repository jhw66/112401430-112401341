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
test("只填写手机号也可发布，邮箱允许留空", () => {
  assert.deepEqual(core.validateDraft({ ...draft(), contact: "", phone: "13800138000" }, "2026-09-29"), {});
});

test("邮箱和手机号可同时填写，预处理清理两端空白", () => {
  const input = { ...draft(), phone: " 13800138000 " };
  assert.deepEqual(core.validateDraft(input, "2026-09-29"), {});
  const normalized = core.normalizeDraft(input);
  assert.equal(normalized.contact, "finder@example.edu");
  assert.equal(normalized.phone, "13800138000");
});

test("两种联系方式均为空或只有空白时不能发布", () => {
  for (const contacts of [{ contact: "", phone: "" }, { contact: "   ", phone: "\t" }]) {
    assert.match(core.validateDraft({ ...draft(), ...contacts }, "2026-09-29").contact, /至少填写/);
  }
});

test("手机号拒绝长度、前缀、非数字及非字符串异常", () => {
  for (const phone of ["1380013800", "138001380000", "12800138000", "13800138abc", "+8613800138000",
    "138 00138000", ["13800138000"], 13800138000, null]) {
    assert.ok(core.validateDraft({ ...draft(), phone }, "2026-09-29").phone, String(phone));
  }
});

test("填写一种有效联系方式不能绕过另一项的格式错误", () => {
  assert.ok(core.validateDraft({ ...draft(), contact: "name@", phone: "13800138000" }, "2026-09-29").contact);
  assert.ok(core.validateDraft({ ...draft(), phone: "123" }, "2026-09-29").phone);
  for (const contact of [["name@example.edu"], { toString: () => "name@example.edu" }, null]) {
    assert.ok(core.validateDraft({ ...draft(), contact, phone: "13800138000" }, "2026-09-29").contact);
  }
});
