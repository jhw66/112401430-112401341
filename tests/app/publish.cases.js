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

test("十条发布依次保存一至十号图片，第十一条被拦截并保留草稿", () => {
  const harness = startApp("#/publish");
  for (let number = 1; number <= 10; number += 1) {
    harness.context.location.hash = "#/publish";
    harness.rerender();
    const form = new harness.MockForm("publish", { ...publishFields(), title: `编号线索${number}` });
    harness.events.submit({ target: form, preventDefault() {} });
    assert.match(harness.context.location.hash, /^#\/success\//);
    const stored = JSON.parse(harness.store.get("shiguang_local_posts_v1"));
    assert.equal(stored.length, number);
    assert.equal(stored[0].imageNumber, number);
  }
  const snapshot = harness.store.get("shiguang_local_posts_v1");
  harness.context.location.hash = "#/publish";
  harness.rerender();
  assert.match(harness.app.innerHTML, /10 \/ 10/);
  assert.match(harness.app.innerHTML, /已达到上限/);
  assert.match(harness.app.innerHTML, /type="submit"[^>]* disabled/);
  const fields = { ...publishFields(), title: "第十一条草稿" };
  harness.events.submit({ target: new harness.MockForm("publish", fields), preventDefault() {} });
  assert.equal(harness.context.location.hash, "#/publish");
  assert.equal(harness.store.get("shiguang_local_posts_v1"), snapshot);
  assert.deepEqual(JSON.parse(harness.store.get("shiguang_publish_draft_v1")), fields);
  const refreshed = startApp("#/publish", harness.store);
  assert.match(refreshed.app.innerHTML, /value="第十一条草稿"/);
  assert.match(refreshed.app.innerHTML, /type="submit"[^>]* disabled/);
});

test("结束记录仍占名额，恢复发布页面保持上限提示和编号", async () => {
  const { localRecord } = require("../helpers/fixtures.js");
  const records = Array.from({ length: 10 }, (_, index) => ({ ...localRecord(`closed-${index}`), status: "closed", imageNumber: index + 1 }));
  const raw = JSON.stringify(records);
  const harness = startApp("#/publish", new Map([["shiguang_local_posts_v1", raw]]));
  assert.match(harness.app.innerHTML, /type="submit"[^>]* disabled/);
  harness.events.submit({ target: new harness.MockForm("publish", publishFields()), preventDefault() {} });
  assert.equal(harness.store.get("shiguang_local_posts_v1"), raw);
  await harness.events.click({ target: new harness.MockButton("reopen", records[0].id) });
  assert.match(harness.app.innerHTML, /type="submit"[^>]* disabled/);
  assert.equal(JSON.parse(harness.store.get("shiguang_local_posts_v1"))[0].imageNumber, 1);
});

test("其他标签页达到上限后，旧表单提交不会覆盖记录或产生第十一条", () => {
  const { localRecord } = require("../helpers/fixtures.js");
  const key = "shiguang_local_posts_v1";
  const records = Array.from({ length: 9 }, (_, index) => ({ ...localRecord(`shared-${index}`), imageNumber: index + 1 }));
  const harness = startApp("#/publish", new Map([[key, JSON.stringify(records)]]));
  assert.ok(!harness.app.innerHTML.includes(' disabled'));
  const latest = JSON.stringify([{ ...localRecord("other-tab"), imageNumber: 10 }, ...records]);
  harness.store.set(key, latest);
  const fields = { ...publishFields(), title: "另一页达到上限后的草稿" };
  harness.events.submit({ target: new harness.MockForm("publish", fields), preventDefault() {} });
  assert.equal(harness.context.location.hash, "#/publish");
  assert.equal(harness.store.get(key), latest);
  assert.deepEqual(JSON.parse(harness.store.get("shiguang_publish_draft_v1")), fields);
  assert.match(harness.app.innerHTML, /type="submit"[^>]* disabled/);
  assert.match(harness.toast.textContent, /最多保留 10 条/);
});
