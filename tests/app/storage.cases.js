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

test("写入失败时内存中的十条记录仍受上限保护，编号不会重用", () => {
  const store = new Map();
  store.set = () => { throw new Error("quota exceeded"); };
  const harness = startApp("#/publish", store);
  for (let number = 1; number <= 10; number += 1) {
    harness.context.location.hash = "#/publish";
    harness.rerender();
    harness.events.submit({ target: new harness.MockForm("publish", { ...publishFields(), title: `内存线索${number}` }), preventDefault() {} });
    assert.match(harness.context.location.hash, /^#\/success\//);
  }
  harness.context.location.hash = "#/mine";
  harness.rerender();
  assert.equal((harness.app.innerHTML.match(/class="mine-row"/g) || []).length, 10);
  assert.deepEqual(Array.from(harness.app.innerHTML.matchAll(/data-image-number="(\d+)"/g), match => Number(match[1])).sort((a,b) => a-b), [1,2,3,4,5,6,7,8,9,10]);
  harness.context.location.hash = "#/publish";
  harness.rerender();
  harness.events.submit({ target: new harness.MockForm("publish", publishFields()), preventDefault() {} });
  assert.equal(harness.context.location.hash, "#/publish");
  assert.match(harness.app.innerHTML, /type="submit"[^>]* disabled/);
});

test("删除写入失败时恢复记录与名额，刷新后仍存在并明确提示", () => {
  const { localRecord } = require("../helpers/fixtures.js");
  const item = { ...localRecord("delete-failure"), status: "closed", imageNumber: 5 };
  const key = "shiguang_local_posts_v1";
  const raw = JSON.stringify([item]);
  const store = new Map([[key, raw]]);
  store.set = () => { throw new Error("quota exceeded"); };
  const harness = startApp("#/mine", store);
  const button = new harness.MockButton("delete", item.id);
  harness.events.pointerdown({ target: button, pointerId: 1, button: 0, isPrimary: true, clientX: 0, clientY: 0, preventDefault() {} });
  harness.advanceTime(1000);
  assert.equal(store.get(key), raw);
  assert.match(harness.app.innerHTML, /1 \/ 10/);
  assert.match(harness.app.innerHTML, /data-image-number="5"/);
  assert.match(harness.toast.textContent, /删除未能保存，记录已保留/);
  assert.match(startApp("#/mine", store).app.innerHTML, /data-action="delete"/);
});

test("删除合法记录前备份损坏旧缓存，其他有效记录继续保留", () => {
  const { localRecord } = require("../helpers/fixtures.js");
  const deleted = { ...localRecord("delete-with-recovery"), status: "closed", imageNumber: 1 };
  const kept = { ...localRecord("keep-with-recovery"), imageNumber: 2 };
  const key = "shiguang_local_posts_v1";
  const raw = JSON.stringify([deleted, kept, { invalid: true }]);
  const harness = startApp("#/mine", new Map([[key, raw]]));
  harness.events.pointerdown({ target: new harness.MockButton("delete", deleted.id), pointerId: 1, button: 0, isPrimary: true, preventDefault() {} });
  harness.advanceTime(1000);
  assert.deepEqual(JSON.parse(harness.store.get(key)), [kept]);
  const recovery = [...harness.store.entries()].find(([entry]) => entry.startsWith(`${key}_recovery_`));
  assert.equal(recovery[1], raw);
});
