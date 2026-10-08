/* 搜索表单、地点筛选、URL 回填、转义与结果 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../../js/core.js");
const { publishFields } = require("../helpers/fixtures.js");
const { startApp, searchResultIds } = require("../helpers/app-harness.js");

test("搜索路由渲染真实关键词结果，不把关键词当 HTML 执行", () => {
  const { app } = startApp("#/search?keyword=%E6%A0%A1%E5%9B%AD%E5%8D%A1");
  assert.match(app.innerHTML, /找到 1 条信息/);
  assert.match(app.innerHTML, /蓝色校园卡/);
  const malicious = startApp("#/search?keyword=%3Cscript%3E");
  assert.ok(malicious.app.innerHTML.includes("&lt;script&gt;"));
  assert.ok(!malicious.app.innerHTML.includes("<script>"));
});

test("首页搜索表单可导航到结果页，组合筛选可提交", () => {
  const harness = startApp();
  const homeForm = new harness.MockForm("hero-search", { keyword: "校园卡" });
  harness.events.submit({ target: homeForm, preventDefault() {} });
  assert.equal(harness.context.location.hash, "#/search?keyword=%E6%A0%A1%E5%9B%AD%E5%8D%A1");
  harness.rerender();
  assert.match(harness.app.innerHTML, /找到 1 条信息/);

  const searchForm = new harness.MockForm("search", {
    keyword: "校园卡", type: "found", category: "证件卡片", status: "open"
  });
  harness.events.submit({ target: searchForm, preventDefault() {} });
  harness.rerender();
  assert.match(harness.app.innerHTML, /找到 1 条信息/);
  assert.match(harness.context.location.hash, /type=found/);
  assert.match(harness.context.location.hash, /status=open/);
});

test("地点输入已启用，仅填写地点提交会规范化 URL 并筛选结果", () => {
  const harness = startApp("#/search");
  const placeInput = harness.app.innerHTML.match(/<input id="search-place"[^>]*>/)[0];
  assert.ok(!placeInput.includes("disabled"));
  assert.ok(!harness.app.innerHTML.includes("地点筛选暂未开放"));
  const form = new harness.MockForm("search", { place: "  图书馆  ", type: "all", category: "all", status: "all" });
  harness.events.submit({ target: form, preventDefault() {} });
  assert.equal(harness.context.location.hash, "#/search?" + new URLSearchParams({ place: "图书馆" }));
  harness.rerender();
  assert.match(harness.app.innerHTML, /找到 1 条信息/);
  assert.match(harness.app.innerHTML, /蓝色校园卡/);
  assert.match(harness.app.innerHTML, /id="search-place"[^>]*value="图书馆"/);
  assert.ok(!harness.app.innerHTML.includes("黑色折叠伞"));
});

test("搜索提交同时携带关键词、地点、类型、类别和状态", () => {
  const harness = startApp("#/search");
  const filters = { keyword: "校园卡", place: "图书馆", type: "found", category: "证件卡片", status: "open" };
  const form = new harness.MockForm("search", filters);
  harness.events.submit({ target: form, preventDefault() {} });
  const params = new URLSearchParams(harness.context.location.hash.split("?")[1]);
  assert.deepEqual(Object.fromEntries(params), filters);
  harness.rerender();
  assert.match(harness.app.innerHTML, /找到 1 条信息/);
  form.fields.place = "食堂";
  harness.events.submit({ target: form, preventDefault() {} });
  harness.rerender();
  assert.match(harness.app.innerHTML, /找到 0 条信息/);
  assert.match(harness.app.innerHTML, /暂时没有匹配的信息/);
});

test("空白地点不写入 URL，保持全部信息且回填为空", () => {
  const harness = startApp("#/search");
  const form = new harness.MockForm("search", {
    keyword: "", place: " \t\r\n ", type: "all", category: "all", status: "all"
  });
  harness.events.submit({ target: form, preventDefault() {} });
  assert.equal(harness.context.location.hash, "#/search");
  harness.rerender();
  assert.match(harness.app.innerHTML, /找到 5 条信息/);
  assert.match(harness.app.innerHTML, /id="search-place"[^>]*value=""/);
});

test("下拉框变化读取当前表单，保留尚未提交的地点及其他条件", () => {
  const harness = startApp("#/search");
  const form = new harness.MockForm("search", {
    keyword: "水杯", place: " 教学楼 ", type: "found", category: "水杯", status: "open"
  });
  harness.events.change({ target: new harness.MockSelect(form) });
  const params = new URLSearchParams(harness.context.location.hash.split("?")[1]);
  assert.deepEqual(Object.fromEntries(params), {
    keyword: "水杯", place: "教学楼", type: "found", category: "水杯", status: "open"
  });
  harness.rerender();
  assert.match(harness.app.innerHTML, /找到 1 条信息/);
  assert.match(harness.app.innerHTML, /浅蓝色水杯/);
  assert.match(harness.app.innerHTML, /id="search-place"[^>]*value="教学楼"/);
});

test("直接打开搜索链接与重启页面时恢复五项筛选及结果", () => {
  const query = new URLSearchParams({ keyword: "校园卡", place: "图书馆", type: "found", category: "证件卡片", status: "open" });
  const initial = startApp("#/search?" + query);
  const refreshed = startApp(initial.context.location.hash, initial.store);
  for (const { app } of [initial, refreshed]) {
    assert.match(app.innerHTML, /id="search-keyword"[^>]*value="校园卡"/);
    assert.match(app.innerHTML, /id="search-place"[^>]*value="图书馆"/);
    assert.match(app.innerHTML, /value="found" selected/);
    assert.match(app.innerHTML, /value="证件卡片" selected/);
    assert.match(app.innerHTML, /value="open" selected/);
    assert.match(app.innerHTML, /找到 1 条信息/);
  }
});

test("清除筛选链接同时清空地点和其他条件，恢复全部信息", () => {
  const query = new URLSearchParams({ keyword: "校园卡", place: "图书馆", type: "found", category: "证件卡片", status: "open" });
  const harness = startApp("#/search?" + query);
  const reset = harness.app.innerHTML.match(/href="([^"]+)" class="filter-reset"/)[1];
  assert.equal(reset, "#/search");
  harness.context.location.hash = reset;
  harness.rerender();
  assert.match(harness.app.innerHTML, /id="search-keyword"[^>]*value=""/);
  assert.match(harness.app.innerHTML, /id="search-place"[^>]*value=""/);
  for (const name of ["type", "category", "status"]) {
    assert.ok(harness.app.innerHTML.includes('<select name="' + name + '"><option value="all" selected>'));
  }
  assert.match(harness.app.innerHTML, /找到 5 条信息/);
});

test("URL 中地点的 HTML 特殊字符会转义，不注入输入框或页面", () => {
  const place = '<script>alert("place")</script>&\'楼';
  const { app } = startApp("#/search?" + new URLSearchParams({ place }));
  assert.ok(app.innerHTML.includes('value="&lt;script&gt;alert(&quot;place&quot;)&lt;/script&gt;&amp;&#39;楼"'));
  assert.ok(!app.innerHTML.includes("<script>"));
  assert.match(app.innerHTML, /找到 0 条信息/);
});

test("地点筛选贯通表单和页面，逐项排除名称、描述与组合条件的干扰记录", () => {
  const matching = core.createRecord({
    ...publishFields(), title: "验收标记水杯", place: "North Library 2"
  }, { id: "scope-match" });
  const records = [
    matching,
    { ...matching, id: "scope-title", place: "第一食堂", title: "Library 验收标记水杯" },
    { ...matching, id: "scope-description", place: "东区操场", description: "在 Library 附近发现验收标记，请先核对外观特征。" },
    { ...matching, id: "scope-type", type: "lost" },
    { ...matching, id: "scope-category", category: "数码物品" },
    { ...matching, id: "scope-status", status: "closed" },
    { ...matching, id: "scope-keyword", title: "其他保温杯" }
  ];
  const store = new Map([["shiguang_local_posts_v1", JSON.stringify(records)]]);
  const placeOnly = ["scope-match", "scope-type", "scope-category", "scope-status", "scope-keyword"];
  const combined = { keyword: "验收标记", type: "found", category: "水杯", status: "open" };
  const cases = [
    { filters: { place: "library" }, expected: placeOnly },
    { filters: { place: "  NORTH \t LIBRARY  " }, expected: placeOnly },
    { filters: { ...combined, place: "LIBRARY" }, expected: ["scope-match"] },
    { filters: { ...combined, place: "" }, expected: ["scope-match", "scope-title", "scope-description"] },
    { filters: { ...combined, place: "不存在的车站" }, expected: [] }
  ];
  const harness = startApp("#/search", store);
  for (const { filters, expected } of cases) {
    const form = new harness.MockForm("search", { keyword: "", type: "all", category: "all", status: "all", ...filters });
    harness.events.submit({ target: form, preventDefault() {} });
    harness.rerender();
    assert.deepEqual(searchResultIds(harness.app).sort(), [...expected].sort(), JSON.stringify(filters));
    assert.ok(harness.app.innerHTML.includes("找到 " + expected.length + " 条信息"));
  }
});

test("地点筛选合并本机与示例记录，按发布时间排序且不改写缓存", () => {
  const recent = core.createRecord({
    ...publishFields(), title: "较新验收水杯"
  }, { id: "recent-place", now: new Date("2026-09-29T09:00:00Z") });
  const older = core.createRecord({
    ...publishFields(), date: "2026-09-20", title: "较早验收水杯"
  }, { id: "older-place", now: new Date("2026-09-20T09:00:00Z") });
  const raw = JSON.stringify([older, recent]);
  const store = new Map([["shiguang_local_posts_v1", raw]]);
  const { app } = startApp("#/search?" + new URLSearchParams({ place: "图书馆" }), store);
  assert.deepEqual(searchResultIds(app), ["recent-place", "sample-card", "older-place"]);
  assert.equal(store.get("shiguang_local_posts_v1"), raw);
});

test("异常类型、类别和状态回退到全部，详情返回仍保留合法地点", () => {
  const query = new URLSearchParams({ place: " 图书馆 ", type: "invalid", category: "invalid", status: "invalid" });
  const harness = startApp("#/search?" + query);
  assert.deepEqual(searchResultIds(harness.app), ["sample-card"]);
  for (const name of ["type", "category", "status"]) {
    assert.ok(harness.app.innerHTML.includes('<select name="' + name + '"><option value="all" selected>'));
  }
  const card = harness.app.innerHTML.match(/href="([^"]+)" aria-label="查看蓝色校园卡详情"/)[1];
  harness.context.location.hash = card;
  harness.rerender();
  const back = harness.app.innerHTML.match(/class="detail-back"><a href="([^"]+)"/)[1].replaceAll("&amp;", "&");
  assert.equal(back, "#/search?" + new URLSearchParams({ place: "图书馆" }));
});
