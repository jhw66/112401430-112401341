"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../js/core.js");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const scripts = Array.from(html.matchAll(/<script src="([^"]+)" defer><\/script>/g), match => ({
  filename: match[1],
  source: fs.readFileSync(path.join(__dirname, "..", match[1]), "utf8")
}));

function startApp(initialHash = "#/home", store = new Map(), coreOverride = null) {
  const events = {};
  const windowEvents = {};
  const app = { innerHTML: "" };
  const toast = { textContent: "", hidden: true, classList: { toggle() {} } };
  const nav = Array.from({ length: 4 }, (_, i) => ({
    dataset: { nav: ["home", "search", "publish", "mine"][i] },
    setAttribute() {}, removeAttribute() {}
  }));
  class MockElement { focus() {} setAttribute() {} removeAttribute() {} closest() { return null; } }
  class MockForm extends MockElement {
    constructor(kind, fields) {
      super();
      this.dataset = { form: kind };
      this.fields = fields;
      this.elements = { namedItem: name => Object.assign(new MockElement(), { value: fields[name] }) };
    }
    querySelector() { return { textContent: "" }; }
    querySelectorAll() { return []; }
    closest(selector) { return selector === `form[data-form="${this.dataset.form}"]` ? this : null; }
  }
  class MockButton extends MockElement {
    constructor(action, id) {
      super();
      this.dataset = { action, id };
    }
    closest() { return this; }
  }
  class MockSelect extends MockElement {
    constructor(form) { super(); this.form = form; }
    closest(selector) { return this.form.closest(selector); }
  }
  class MockFormData {
    constructor(form) { this.fields = form.fields; }
    entries() { return Object.entries(this.fields)[Symbol.iterator](); }
    get(name) { return this.fields[name] ?? null; }
  }
  let hash = initialHash;
  const location = {
    get hash() { return hash; },
    set hash(value) { hash = value.startsWith("#") ? value : `#${value}`; }
  };
  const context = {
    window: { ShiguangCore: coreOverride, addEventListener: (name, fn) => { windowEvents[name] = fn; }, scrollTo() {} },
    document: {
      title: "", querySelector: selector => selector === "#app" ? app : toast,
      querySelectorAll: () => nav,
      addEventListener: (name, fn) => { events[name] = fn; }
    },
    location,
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) },
    HTMLFormElement: MockForm, HTMLButtonElement: MockButton, HTMLSelectElement: MockSelect,
    HTMLElement: MockElement, FormData: MockFormData, URLSearchParams,
    setTimeout: () => 1, clearTimeout() {}, console
  };
  Object.assign(context, context.window);
  context.window = context;
  const sandbox = vm.createContext(context);
  for (const script of scripts) {
    vm.runInContext(script.source, sandbox, { filename: script.filename });
    if (script.filename === "js/core.js" && coreOverride) sandbox.ShiguangCore = coreOverride;
  }
  return { app, toast, context, events, windowEvents, store, MockForm, MockButton, MockSelect, rerender: () => windowEvents.hashchange() };
}

test("首页显示示例记录、搜索框和发布入口", () => {
  const { app } = startApp();
  assert.match(app.innerHTML, /蓝色校园卡/);
  assert.match(app.innerHTML, /搜索物品名称/);
  assert.match(app.innerHTML, /我想发布信息/);
});

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

test("详情返回保留全部五项筛选，地点中的 URL 保留字符可往返", () => {
  const place = '图书馆 A&B ? "东侧" <楼> #1 +';
  const item = core.createRecord({ ...publishFields(), place }, { id: "place-return" });
  const store = new Map([["shiguang_local_posts_v1", JSON.stringify([item])]]);
  const query = new URLSearchParams({ keyword: "验收水杯", place, type: "found", category: "水杯", status: "open" });
  const harness = startApp("#/search?" + query, store);
  assert.match(harness.app.innerHTML, /找到 1 条信息/);
  const card = harness.app.innerHTML.match(/href="([^"]+)" aria-label="查看验收水杯详情"/)[1];
  harness.context.location.hash = card;
  harness.rerender();
  const back = harness.app.innerHTML.match(/class="detail-back"><a href="([^"]+)"/)[1].replaceAll("&amp;", "&");
  assert.equal(back, "#/search?" + query);
  harness.context.location.hash = back;
  harness.rerender();
  assert.equal(new URLSearchParams(back.split("?")[1]).get("place"), place);
  assert.match(harness.app.innerHTML, /找到 1 条信息/);
  assert.ok(harness.app.innerHTML.includes('value="图书馆 A&amp;B ? &quot;东侧&quot; &lt;楼&gt; #1 +"'));
  assert.match(harness.app.innerHTML, /value="found" selected/);
  assert.match(harness.app.innerHTML, /value="水杯" selected/);
  assert.match(harness.app.innerHTML, /value="open" selected/);
});

test("演示详情显示联系方式，但不显示状态修改按钮", () => {
  const { app } = startApp("#/detail/sample-card");
  assert.match(app.innerHTML, /finder@example.edu/);
  assert.match(app.innerHTML, /复制联系方式/);
  assert.ok(!app.innerHTML.includes('data-action="close"'));
});

test("详情中的发布时间按照浏览器本地日期显示", () => {
  const localCore = { ...core, localDate: date => date ? "2026-09-29" : core.localDate() };
  const { app } = startApp("#/detail/sample-card", new Map(), localCore);
  assert.match(app.innerHTML, /发布于 2026\.09\.29/);
});

test("已结束的信息隐藏联系方式，避免重复联系", () => {
  const { app } = startApp("#/detail/sample-keys");
  assert.match(app.innerHTML, /联系方式已隐藏/);
  assert.ok(!app.innerHTML.includes("keys@example.edu"));
  assert.ok(!app.innerHTML.includes('data-action="copy"'));
});

test("发布、查看详情、标记归还的完整本机流程", async () => {
  const harness = startApp("#/publish");
  assert.match(harness.app.innerHTML, /填写物品信息/);
  const form = new harness.MockForm("publish", {
    type: "found", title: "测试水杯", category: "水杯", place: "教学楼三层",
    date: "2026-09-28", description: "测试所用的浅蓝色水杯，杯盖上有一个小图案。", contact: "test@example.edu"
  });
  harness.events.submit({ target: form, preventDefault() {} });
  assert.match(harness.context.location.hash, /^#\/success\//);
  const stored = JSON.parse(harness.store.get("shiguang_local_posts_v1"));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].status, "open");
  harness.rerender();
  assert.match(harness.app.innerHTML, /发布成功/);
  harness.context.location.hash = `#/detail/${stored[0].id}`;
  harness.rerender();
  assert.match(harness.app.innerHTML, /test@example.edu/);
  assert.match(harness.app.innerHTML, /标记为已归还/);
  const button = new harness.MockButton("close", stored[0].id);
  await harness.events.click({ target: button });
  assert.equal(JSON.parse(harness.store.get("shiguang_local_posts_v1"))[0].status, "closed");
  assert.match(harness.app.innerHTML, /已归还/);
  assert.ok(!harness.app.innerHTML.includes("test@example.edu"));
  assert.equal(harness.toast.textContent, "状态已更新，并保存在当前浏览器。");
  const reopened = startApp("#/mine", harness.store);
  assert.match(reopened.app.innerHTML, /测试水杯/);
  assert.match(reopened.app.innerHTML, /已归还/);
});

test("发布表单验证失败时不发布记录，保留草稿且不离开发布页", () => {
  const harness = startApp("#/publish");
  const form = new harness.MockForm("publish", {
    type: "lost", title: "", category: "钥匙", place: "教学楼一层",
    date: "2026-09-28", description: "描述太短", contact: "test@example.edu"
  });
  harness.events.submit({ target: form, preventDefault() {} });
  assert.equal(harness.context.location.hash, "#/publish");
  assert.equal(harness.store.has("shiguang_local_posts_v1"), false);
  assert.equal(JSON.parse(harness.store.get("shiguang_publish_draft_v1")).description, "描述太短");
});

function publishFields() {
  return { type: "found", title: "验收水杯", category: "水杯", place: "图书馆二楼",
    date: "2026-09-28", description: "验收使用的蓝色水杯，杯盖上有白色小图案。", contact: "audit@example.edu" };
}

test("搜索进入详情后，返回链接保留关键词及所有组合筛选", () => {
  const query = new URLSearchParams({ keyword: "校园卡", type: "found", category: "证件卡片", status: "open" });
  const harness = startApp(`#/search?${query}`);
  const card = harness.app.innerHTML.match(/href="([^\"]+)" aria-label="查看蓝色校园卡详情"/)[1];
  harness.context.location.hash = card;
  harness.rerender();
  const back = harness.app.innerHTML.match(/class="detail-back"><a href="([^\"]+)"/)[1].replaceAll("&amp;", "&");
  assert.equal(back, `#/search?${query}`);
  harness.context.location.hash = back;
  harness.rerender();
  assert.match(harness.app.innerHTML, /找到 1 条信息/);
  assert.match(harness.app.innerHTML, /value="open" selected/);
});

test("详情返回只接受应用内入口，不能跳转外部地址", () => {
  for (const returnTo of ["https://example.com", "javascript:alert(1)", "/other"]) {
    const { app } = startApp(`#/detail/sample-card?${new URLSearchParams({ returnTo })}`);
    assert.match(app.innerHTML, /class="detail-back"><a href="#\/search"/);
  }
  assert.match(startApp("#/detail/sample-card?returnTo=%2Fmine").app.innerHTML, /返回我的发布/);
});

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

test("发布成功清除草稿，同一表单重复提交只产生一条记录", () => {
  const harness = startApp("#/publish");
  const form = new harness.MockForm("publish", publishFields());
  harness.events.input({ target: form });
  const event = { target: form, preventDefault() {} };
  harness.events.submit(event);
  harness.events.submit(event);
  assert.equal(JSON.parse(harness.store.get("shiguang_local_posts_v1")).length, 1);
  assert.equal(harness.store.has("shiguang_publish_draft_v1"), false);
  const reopened = startApp("#/publish", harness.store);
  assert.ok(!reopened.app.innerHTML.includes('value="验收水杯"'));
});

test("撤销结束会恢复联系方式并保存，刷新后仍为进行中", async () => {
  const item = { ...core.createRecord(publishFields(), { id: "reopen-cup" }), status: "closed" };
  const store = new Map([["shiguang_local_posts_v1", JSON.stringify([item])]]);
  const harness = startApp(`#/detail/${item.id}`, store);
  assert.match(harness.app.innerHTML, /撤销结束/);
  assert.ok(!harness.app.innerHTML.includes(item.contact));
  await harness.events.click({ target: new harness.MockButton("reopen", item.id) });
  assert.equal(JSON.parse(store.get("shiguang_local_posts_v1"))[0].status, "open");
  assert.match(harness.app.innerHTML, /audit@example.edu/);
  assert.equal(harness.toast.textContent, "已撤销结束，信息恢复为进行中。");
  assert.match(startApp("#/mine", store).app.innerHTML, /招领中/);
});

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

test("本机尚未发布时，我的发布显示明确空状态", () => {
  const { app } = startApp("#/mine");
  assert.match(app.innerHTML, /还没有发布过信息/);
  assert.match(app.innerHTML, /发布第一条信息/);
});

test("寻物信息可在我的发布中标记为已找到", async () => {
  const item = core.createRecord({
    type: "lost", title: "黑色折叠伞", category: "雨具", place: "第一食堂一层",
    date: "2026-09-28", description: "午饭后丢失了一把黑色折叠伞，伞柄带有红色挂绳。",
    contact: "owner@example.edu"
  }, { id: "my-umbrella", now: new Date(2026, 8, 29, 12) });
  const store = new Map([["shiguang_local_posts_v1", JSON.stringify([item])]]);
  const harness = startApp("#/mine", store);
  assert.match(harness.app.innerHTML, /标记已找到/);
  await harness.events.click({ target: new harness.MockButton("close", item.id) });
  assert.match(harness.app.innerHTML, /已找到/);
  assert.equal(JSON.parse(store.get("shiguang_local_posts_v1"))[0].status, "closed");
});

function searchResultIds(app) {
  return Array.from(app.innerHTML.matchAll(/href="#\/detail\/([^?"]+)\?/g), match => match[1]);
}

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

for (const type of ["found", "lost"]) {
  test("本机发布" + (type === "found" ? "招领" : "寻物") + "后可按地点查找，结束和撤销后筛选与刷新保持一致", async () => {
    const harness = startApp("#/publish");
    const fields = { ...publishFields(), type, title: "完整流程验收水杯", place: "验收楼三层" };
    harness.events.submit({ target: new harness.MockForm("publish", fields), preventDefault() {} });
    harness.rerender();
    assert.match(harness.app.innerHTML, /发布成功/);
    const record = JSON.parse(harness.store.get("shiguang_local_posts_v1"))[0];
    const filters = { keyword: "完整流程", place: "验收楼", type, category: "水杯", status: "open" };
    const openHash = "#/search?" + new URLSearchParams(filters);
    harness.context.location.hash = openHash;
    harness.rerender();
    assert.deepEqual(searchResultIds(harness.app), [record.id]);
    const card = harness.app.innerHTML.match(/href="([^"]+)" aria-label="查看完整流程验收水杯详情"/)[1];
    harness.context.location.hash = card;
    harness.rerender();
    assert.ok(harness.app.innerHTML.includes("标记为" + (type === "found" ? "已归还" : "已找到")));
    await harness.events.click({ target: new harness.MockButton("close", record.id) });
    assert.match(harness.app.innerHTML, /联系方式已隐藏/);
    assert.ok(!harness.app.innerHTML.includes(fields.contact));
    const back = harness.app.innerHTML.match(/class="detail-back"><a href="([^"]+)"/)[1].replaceAll("&amp;", "&");
    assert.equal(back, openHash);
    harness.context.location.hash = back;
    harness.rerender();
    assert.deepEqual(searchResultIds(harness.app), []);
    assert.match(harness.app.innerHTML, /id="search-place"[^>]*value="验收楼"/);

    const closedHash = "#/search?" + new URLSearchParams({ ...filters, status: "closed" });
    const reopenedPage = startApp(closedHash, harness.store);
    assert.deepEqual(searchResultIds(reopenedPage.app), [record.id]);
    const closedCard = reopenedPage.app.innerHTML.match(/href="([^"]+)" aria-label="查看完整流程验收水杯详情"/)[1];
    reopenedPage.context.location.hash = closedCard;
    reopenedPage.rerender();
    assert.match(reopenedPage.app.innerHTML, /撤销结束/);
    await reopenedPage.events.click({ target: new reopenedPage.MockButton("reopen", record.id) });
    assert.ok(reopenedPage.app.innerHTML.includes(fields.contact));
    const closedBack = reopenedPage.app.innerHTML.match(/class="detail-back"><a href="([^"]+)"/)[1].replaceAll("&amp;", "&");
    assert.equal(closedBack, closedHash);
    reopenedPage.context.location.hash = closedBack;
    reopenedPage.rerender();
    assert.deepEqual(searchResultIds(reopenedPage.app), []);
    const refreshed = startApp(openHash, harness.store);
    assert.deepEqual(searchResultIds(refreshed.app), [record.id]);
    assert.equal(JSON.parse(harness.store.get("shiguang_local_posts_v1"))[0].status, "open");
    assert.match(refreshed.app.innerHTML, /id="search-place"[^>]*value="验收楼"/);
  });
}

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

test("详情记录不存在时，空状态的返回入口仍恢复地点及状态筛选", () => {
  const query = new URLSearchParams({ place: "教学楼", status: "closed" });
  const returnTo = "/search?" + query;
  const harness = startApp("#/detail/missing-place?" + new URLSearchParams({ returnTo }));
  assert.match(harness.app.innerHTML, /没有找到这条信息/);
  const back = harness.app.innerHTML.match(/href="([^"]+)" class="button button-primary"/)[1].replaceAll("&amp;", "&");
  assert.equal(back, "#" + returnTo);
  harness.context.location.hash = back;
  harness.rerender();
  assert.deepEqual(searchResultIds(harness.app), ["sample-keys"]);
  assert.match(harness.app.innerHTML, /id="search-place"[^>]*value="教学楼"/);
  assert.match(harness.app.innerHTML, /value="closed" selected/);
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
