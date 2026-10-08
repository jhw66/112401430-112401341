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
test("旧手机号联系方式仍显示和复制，详情转义历史联系方式", () => {
  const { localRecord } = require("../helpers/fixtures.js");
  const { phone, ...legacy } = localRecord("legacy-contact");
  for (const contact of ["13800138000", '"><img src=x onerror=alert(1)>']) {
    const item = { ...legacy, contact };
    const { app } = startApp(`#/detail/${item.id}`, new Map([["shiguang_local_posts_v1", JSON.stringify([item])]]));
    assert.match(app.innerHTML, /复制联系方式/);
    assert.ok(!app.innerHTML.includes('class="contact-label">邮箱'));
    assert.ok(!app.innerHTML.includes("<img src=x"));
    assert.ok(!app.innerHTML.includes("部分本地记录格式异常"));
  }
});

test("个人线索在首页、搜索、我的发布和详情使用相同编号配图，示例保留图标", () => {
  const { localRecord } = require("../helpers/fixtures.js");
  const item = { ...localRecord("visual-check"), imageNumber: 7, createdAt: "2099-01-01T00:00:00.000Z" };
  const store = new Map([["shiguang_local_posts_v1", JSON.stringify([item])]]);
  for (const route of ["#/home", "#/search", "#/mine", "#/detail/visual-check"]) {
    const { app } = startApp(route, store);
    assert.match(app.innerHTML, /data-image-number="7"/);
    assert.match(app.innerHTML, /src="assets\/images\/post-07.png"/);
    assert.match(app.innerHTML, /装饰角色，并非物品实拍/);
  }
  const sample = startApp("#/detail/sample-card", store);
  assert.ok(!sample.app.innerHTML.includes("post-07.png"));
  assert.match(sample.app.innerHTML, /演示信息/);
});

test("一至十号配图都对应本地可用且不同的静态 PNG", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const { localRecord } = require("../helpers/fixtures.js");
  const records = Array.from({ length: 10 }, (_, index) => ({ ...localRecord(`asset-${index}`), imageNumber: index + 1 }));
  const { app } = startApp("#/mine", new Map([["shiguang_local_posts_v1", JSON.stringify(records)]]));
  const sources = Array.from(app.innerHTML.matchAll(/<img src="([^"]+)"/g), match => match[1]);
  assert.equal(sources.length, 10);
  const images = sources.map(source => fs.readFileSync(path.resolve(__dirname, "../..", source)));
  assert.equal(new Set(images.map(data => data.toString("base64"))).size, 10);
  for (const data of images) {
    assert.deepEqual([...data.subarray(0,8)], [137,80,78,71,13,10,26,10]);
    assert.equal(data.readUInt32BE(16), 16);
    assert.equal(data.readUInt32BE(20), 16);
    assert.ok(!data.includes(Buffer.from("acTL")));
  }
});
