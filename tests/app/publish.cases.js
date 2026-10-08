/* 发布流程、校验失败、清除草稿与重复提交 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { publishFields } = require("../helpers/fixtures.js");
const { startApp } = require("../helpers/app-harness.js");

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
for (const [label, contacts] of [
  ["邮箱", { contact: "audit@example.edu", phone: "" }],
  ["手机号", { contact: "", phone: "13800138000" }],
  ["邮箱和手机号", { contact: "audit@example.edu", phone: "13800138000" }]
]) {
  test(`发布${label}后刷新详情，独立展示并复制所填联系方式`, async () => {
    const harness = startApp("#/publish");
    const form = new harness.MockForm("publish", { ...publishFields(), ...contacts });
    harness.events.submit({ target: form, preventDefault() {} });
    const item = JSON.parse(harness.store.get("shiguang_local_posts_v1"))[0];
    assert.equal(item.contact, contacts.contact);
    assert.equal(item.phone, contacts.phone);
    const detail = startApp(`#/detail/${item.id}`, harness.store);
    const expected = [contacts.contact, contacts.phone].filter(Boolean);
    const buttonValues = Array.from(detail.app.innerHTML.matchAll(/data-action="copy" data-contact="([^"]+)"/g), match => match[1]);
    assert.deepEqual(buttonValues, expected);
    const copied = [];
    detail.context.navigator = { clipboard: { writeText: async value => { copied.push(value); } } };
    for (const value of buttonValues) {
      const button = new detail.MockButton("copy", item.id);
      button.dataset.contact = value;
      await detail.events.click({ target: button });
    }
    assert.deepEqual(copied, expected);
  });
}

test("联系方式缺失或格式错误时保留草稿，不能写入新发布记录", () => {
  for (const contacts of [
    { contact: "", phone: "" },
    { contact: "invalid", phone: "13800138000" },
    { contact: "audit@example.edu", phone: "123" }
  ]) {
    const harness = startApp("#/publish");
    const fields = { ...publishFields(), ...contacts };
    harness.events.submit({ target: new harness.MockForm("publish", fields), preventDefault() {} });
    assert.equal(harness.context.location.hash, "#/publish");
    assert.equal(harness.store.has("shiguang_local_posts_v1"), false);
    assert.deepEqual(JSON.parse(harness.store.get("shiguang_publish_draft_v1")), fields);
  }
});
