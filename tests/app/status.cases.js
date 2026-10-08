/* 结束、撤销结束、联系方式和地点筛选完整流程 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../../js/core.js");
const { publishFields } = require("../helpers/fixtures.js");
const { startApp, searchResultIds } = require("../helpers/app-harness.js");

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
test("结束信息隐藏邮箱和手机号，撤销并刷新后两者恢复", async () => {
  const { localRecord } = require("../helpers/fixtures.js");
  const item = { ...localRecord("both-contacts"), phone: "13800138000" };
  const harness = startApp(`#/detail/${item.id}`, new Map([["shiguang_local_posts_v1", JSON.stringify([item])]]));
  await harness.events.click({ target: new harness.MockButton("close", item.id) });
  const closed = startApp(`#/detail/${item.id}`, harness.store);
  assert.ok(!closed.app.innerHTML.includes(item.contact));
  assert.ok(!closed.app.innerHTML.includes(item.phone));
  assert.ok(!closed.app.innerHTML.includes('data-action="copy"'));
  await closed.events.click({ target: new closed.MockButton("reopen", item.id) });
  const reopened = startApp(`#/detail/${item.id}`, harness.store);
  assert.match(reopened.app.innerHTML, /复制邮箱/);
  assert.match(reopened.app.innerHTML, /复制手机号/);
  assert.ok(reopened.app.innerHTML.includes(item.contact));
  assert.ok(reopened.app.innerHTML.includes(item.phone));
});
