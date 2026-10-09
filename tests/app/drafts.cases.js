/* 草稿保存、恢复及损坏处理 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { publishFields } = require("../helpers/fixtures.js");
const { startApp } = require("../helpers/app-harness.js");

test("发布草稿在输入后保存，切换页面与重启后恢复未完成字段", () => {
  const harness = startApp("#/publish");
  const fields = { ...publishFields(), title: " 草稿水杯 ", contact: "", description: "第一行\n第二行" };
  const form = new harness.MockForm("publish", fields);
  harness.events.input({ target: form });
  assert.deepEqual(JSON.parse(harness.store.get("shiguang_publish_draft_v1")), fields);
  harness.context.location.hash = "#/home";
  harness.rerender();
  harness.context.location.hash = "#/publish";
  harness.rerender();
  assert.match(harness.app.innerHTML, /value=" 草稿水杯 "/);
  assert.match(harness.app.innerHTML, /第一行\n第二行/);
  const reopened = startApp("#/publish", harness.store);
  assert.match(reopened.app.innerHTML, /已恢复上次草稿/);
  assert.match(reopened.app.innerHTML, /value="found" checked/);
});

test("损坏草稿不阻止进入发布页，草稿文本按 HTML 转义", () => {
  const key = "shiguang_publish_draft_v1";
  const invalid = startApp("#/publish", new Map([[key, "{"]]));
  assert.match(invalid.app.innerHTML, /旧草稿格式异常/);
  const fields = { ...publishFields(), title: '<img src=x onerror="alert(1)">', description: "</textarea><script>alert(1)</script>" };
  const { app } = startApp("#/publish", new Map([[key, JSON.stringify(fields)]]));
  assert.match(app.innerHTML, /&lt;img/);
  assert.ok(!app.innerHTML.includes("<script>alert(1)</script>"));
});
