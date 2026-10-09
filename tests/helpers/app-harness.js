/* 模拟浏览器：按 index.html 的真实脚本顺序创建独立 DOM、事件和存储环境。 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "../..");
const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const scripts = Array.from(html.matchAll(/<script src="([^"]+)" defer><\/script>/g), match => ({
  filename: match[1],
  source: fs.readFileSync(path.join(projectRoot, match[1]), "utf8")
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

function searchResultIds(app) {
  return Array.from(app.innerHTML.matchAll(/href="#\/detail\/([^?"]+)\?/g), match => match[1]);
}

module.exports = { startApp, searchResultIds };
