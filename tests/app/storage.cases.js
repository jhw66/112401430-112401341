/* 缓存备份与本地存储读写失败 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../../js/core.js");
const { publishFields } = require("../helpers/fixtures.js");
const { startApp, searchResultIds } = require("../helpers/app-harness.js");

test("异常旧记录在新发布写入前备份，合法旧记录继续保留", () => {
  const key = "shiguang_local_posts_v1";
  const original = JSON.stringify([core.createRecord(publishFields(), { id: "old-cup" }), { bad: true }]);
  const harness = startApp("#/publish", new Map([[key, original]]));
  harness.events.submit({ target: new harness.MockForm("publish", publishFields()), preventDefault() {} });
  const recovery = [...harness.store.entries()].find(([entry]) => entry.startsWith(`${key}_recovery_`));
  assert.equal(recovery[1], original);
  assert.equal(JSON.parse(harness.store.get(key)).length, 2);
});

test("本地写入失败时记录和草稿仍可在当前页面内使用，并明确提示", () => {
  const store = new Map();
  store.set = () => { throw new Error("quota exceeded"); };
  const harness = startApp("#/publish", store);
  const form = new harness.MockForm("publish", publishFields());
  harness.events.input({ target: form });
  harness.context.location.hash = "#/home";
  harness.rerender();
  harness.context.location.hash = "#/publish";
  harness.rerender();
  assert.match(harness.app.innerHTML, /value="验收水杯"/);
  assert.match(harness.app.innerHTML, /关闭后无法恢复/);
  harness.events.submit({ target: form, preventDefault() {} });
  harness.rerender();
  assert.match(harness.app.innerHTML, /本地保存失败/);
  assert.match(harness.app.innerHTML, /发布成功/);
});

test("本地存储读取受限时仍可用地点筛选示例记录并展示存储提醒", () => {
  const store = new Map();
  store.get = () => { throw new Error("storage unavailable"); };
  const harness = startApp("#/search?" + new URLSearchParams({ place: "教学楼" }), store);
  assert.match(harness.app.innerHTML, /当前浏览器不允许本地存储/);
  assert.deepEqual(searchResultIds(harness.app), ["sample-keys", "sample-bottle"]);
  harness.events.submit({
    target: new harness.MockForm("search", { place: "图书馆", type: "all", category: "all", status: "all" }),
    preventDefault() {}
  });
  harness.rerender();
  assert.deepEqual(searchResultIds(harness.app), ["sample-card"]);
  assert.match(harness.app.innerHTML, /id="search-place"[^>]*value="图书馆"/);
});
