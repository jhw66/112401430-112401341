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
  const windowHandlers = {};
  const timers = new Map();
  let timerId = 0;
  let clock = 0;
  function advanceTime(milliseconds) {
    const end = clock + milliseconds;
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a,b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      const [id, timer] = next;
      clock = timer.at;
      timers.delete(id);
      timer.callback();
    }
    clock = end;
  }
  const app = { innerHTML: "" };
  const toast = { textContent: "", hidden: true, classList: { toggle() {} } };
  const nav = Array.from({ length: 4 }, (_, i) => ({
    dataset: { nav: ["home", "search", "publish", "mine"][i] },
    setAttribute() {}, removeAttribute() {}
  }));
  class MockElement {
    constructor() { this.attributes = new Map(); this.isConnected = true; }
    focus() {}
    setAttribute(name,value) { this.attributes.set(name,value); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    closest() { return null; }
    contains(element) { return element === this; }
  }
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
      this.disabled = false;
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
    window: { ShiguangCore: coreOverride, addEventListener: (name, fn) => {
      (windowHandlers[name] || (windowHandlers[name] = [])).push(fn);
      windowEvents[name] = event => windowHandlers[name].forEach(handler => handler(event));
    }, scrollTo() {} },
    document: {
      title: "", hidden: false, querySelector: selector => selector === "#app" ? app : toast,
      querySelectorAll: () => nav,
      addEventListener: (name, fn) => { events[name] = fn; }
    },
    location,
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) },
    HTMLFormElement: MockForm, HTMLButtonElement: MockButton, HTMLSelectElement: MockSelect,
    HTMLElement: MockElement, FormData: MockFormData, URLSearchParams,
    setTimeout: (callback, delay = 0) => {
      const id = ++timerId;
      timers.set(id, { callback, at: clock + delay });
      return id;
    },
    clearTimeout: id => timers.delete(id), console
  };
  Object.assign(context, context.window);
  context.window = context;
  const sandbox = vm.createContext(context);
  for (const script of scripts) {
    vm.runInContext(script.source, sandbox, { filename: script.filename });
    if (script.filename === "js/core.js" && coreOverride) sandbox.ShiguangCore = coreOverride;
  }
  return { app, toast, context, events, windowEvents, store, MockForm, MockButton, MockSelect, advanceTime, rerender: () => windowEvents.hashchange() };
}

function searchResultIds(app) {
  return Array.from(app.innerHTML.matchAll(/href="#\/detail\/([^?"]+)\?/g), match => match[1]);
}

module.exports = { startApp, searchResultIds };
