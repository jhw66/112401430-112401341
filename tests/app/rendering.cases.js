/* 首页、详情与我的发布基础渲染 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../../js/core.js");
const { startApp } = require("../helpers/app-harness.js");

test("首页显示示例记录、搜索框和发布入口", () => {
  const { app } = startApp();
  assert.match(app.innerHTML, /蓝色校园卡/);
  assert.match(app.innerHTML, /搜索物品名称/);
  assert.match(app.innerHTML, /我想发布信息/);
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

test("本机尚未发布时，我的发布显示明确空状态", () => {
  const { app } = startApp("#/mine");
  assert.match(app.innerHTML, /还没有发布过信息/);
  assert.match(app.innerHTML, /发布第一条信息/);
});
