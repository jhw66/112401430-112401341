"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../js/core.js");

const source = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");

function startApp(initialHash = "#/home", store = new Map(), coreOverride = core) {
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
    HTMLFormElement: MockForm, HTMLButtonElement: MockButton, HTMLSelectElement: class {},
    HTMLElement: MockElement, FormData: MockFormData, URLSearchParams,
    setTimeout: () => 1, clearTimeout() {}, console
  };
  vm.runInNewContext(source, context, { filename: "app.js" });
  return { app, toast, context, events, windowEvents, store, MockForm, MockButton, rerender: () => windowEvents.hashchange() };
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
