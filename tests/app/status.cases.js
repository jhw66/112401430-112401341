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

const postKey = "shiguang_local_posts_v1";
function deletionHarness(route = "detail", records = null) {
  const { localRecord } = require("../helpers/fixtures.js");
  const item = { ...localRecord("hold-target"), status: "closed", imageNumber: 4 };
  const values = records || [item];
  const harness = startApp(route === "mine" ? "#/mine" : `#/detail/${item.id}`, new Map([[postKey, JSON.stringify(values)]]));
  return { ...harness, item, button: new harness.MockButton("delete", item.id) };
}
function pointerEvent(target, fields = {}) {
  return { target, pointerId: 1, button: 0, isPrimary: true, clientX: 10, clientY: 10, preventDefault() {}, ...fields };
}

test("详情和我的发布仅为已结束的个人线索显示长按删除，保留撤销入口", () => {
  const { localRecord } = require("../helpers/fixtures.js");
  const open = localRecord("open-post");
  const closed = { ...localRecord("closed-post"), status: "closed" };
  const store = new Map([[postKey, JSON.stringify([open, closed])]]);
  assert.ok(!startApp("#/detail/open-post", store).app.innerHTML.includes('data-action="delete"'));
  assert.ok(!startApp("#/detail/sample-keys", store).app.innerHTML.includes('data-action="delete"'));
  for (const route of ["#/mine", "#/detail/closed-post"]) {
    const html = startApp(route, store).app.innerHTML;
    assert.equal((html.match(/data-action="delete"/g) || []).length, 1);
    assert.match(html, /data-action="reopen"/);
    assert.match(html, /删除后不可恢复/);
    assert.match(html, /长按1秒删除/);
  }
});

test("普通点击不会删除记录，只提示长按操作", async () => {
  const harness = deletionHarness();
  const before = harness.store.get(postKey);
  await harness.events.click({ target: harness.button, preventDefault() {} });
  harness.advanceTime(2000);
  assert.equal(harness.store.get(postKey), before);
  assert.match(harness.toast.textContent, /按住删除按钮1秒/);
});

test("按住999毫秒不删除，达到1秒仅删除一次，详情返回管理页并持久保存", () => {
  const harness = deletionHarness();
  harness.events.pointerdown(pointerEvent(harness.button));
  assert.equal(harness.button.getAttribute("data-holding"), "true");
  harness.advanceTime(999);
  assert.equal(JSON.parse(harness.store.get(postKey)).length, 1);
  harness.advanceTime(1);
  assert.deepEqual(JSON.parse(harness.store.get(postKey)), []);
  assert.equal(harness.context.location.hash, "#/mine");
  assert.equal(harness.button.getAttribute("data-holding"), null);
  harness.rerender();
  assert.match(harness.app.innerHTML, /还没有发布过信息/);
  assert.match(startApp("#/mine", harness.store).app.innerHTML, /还没有发布过信息/);
  harness.events.pointerup(pointerEvent(harness.button));
  harness.advanceTime(1000);
  assert.match(harness.toast.textContent, /线索已删除/);
});

test("提前松手会取消进度，下一次长按从零开始", () => {
  const harness = deletionHarness("mine");
  harness.events.pointerdown(pointerEvent(harness.button));
  harness.advanceTime(900);
  harness.events.pointerup(pointerEvent(harness.button));
  assert.equal(harness.button.getAttribute("data-holding"), null);
  harness.events.pointerdown(pointerEvent(harness.button));
  harness.advanceTime(999);
  assert.equal(JSON.parse(harness.store.get(postKey)).length, 1);
  harness.advanceTime(1);
  assert.deepEqual(JSON.parse(harness.store.get(postKey)), []);
  assert.equal(harness.context.location.hash, "#/mine");
});

test("指针取消、移出、失焦、滚动、切换页面和隐藏窗口均取消长按", () => {
  const cancellations = [
    harness => harness.events.pointercancel(pointerEvent(harness.button)),
    harness => harness.events.pointerout(pointerEvent(harness.button, { relatedTarget: null })),
    harness => harness.events.focusout({ target: harness.button, relatedTarget: null }),
    harness => harness.events.scroll({}),
    harness => harness.windowEvents.blur(),
    harness => { harness.context.location.hash = "#/home"; harness.rerender(); },
    harness => { harness.context.document.hidden = true; harness.events.visibilitychange(); }
  ];
  for (const cancel of cancellations) {
    const harness = deletionHarness();
    const before = harness.store.get(postKey);
    harness.events.pointerdown(pointerEvent(harness.button));
    harness.advanceTime(500);
    cancel(harness);
    harness.advanceTime(1500);
    assert.equal(harness.store.get(postKey), before);
    assert.equal(harness.button.getAttribute("data-holding"), null);
  }
});

test("右键及次要指针不能触发删除，拖动取消且其他指针松手不影响主指针", () => {
  for (const fields of [{ button: 2 }, { isPrimary: false }]) {
    const harness = deletionHarness();
    harness.events.pointerdown(pointerEvent(harness.button, fields));
    harness.advanceTime(1000);
    assert.equal(JSON.parse(harness.store.get(postKey)).length, 1);
  }
  const dragged = deletionHarness();
  dragged.events.pointerdown(pointerEvent(dragged.button));
  dragged.events.pointermove(pointerEvent(dragged.button, { clientX: 25 }));
  dragged.advanceTime(1000);
  assert.equal(JSON.parse(dragged.store.get(postKey)).length, 1);
  const held = deletionHarness();
  held.events.pointerdown(pointerEvent(held.button));
  held.events.pointerup(pointerEvent(held.button, { pointerId: 2 }));
  held.advanceTime(1000);
  assert.deepEqual(JSON.parse(held.store.get(postKey)), []);
});

for (const key of [" ", "Enter"]) {
  test(`键盘按住${key === " " ? "空格" : "回车"}一秒可删除，重复keydown不会重置计时`, () => {
    const harness = deletionHarness("mine");
    harness.events.keydown({ target: harness.button, key, repeat: false, preventDefault() {} });
    harness.advanceTime(600);
    harness.events.keydown({ target: harness.button, key, repeat: true, preventDefault() {} });
    harness.advanceTime(400);
    assert.deepEqual(JSON.parse(harness.store.get(postKey)), []);
    harness.events.keyup({ target: harness.button, key, preventDefault() {} });
    assert.match(harness.toast.textContent, /线索已删除/);
  });
}

test("键盘短按、Esc和窗口失焦均保留记录", () => {
  for (const cancel of [
    harness => harness.events.keyup({ target: harness.button, key: " ", preventDefault() {} }),
    harness => harness.events.keydown({ target: harness.button, key: "Escape" }),
    harness => harness.windowEvents.blur()
  ]) {
    const harness = deletionHarness();
    harness.events.keydown({ target: harness.button, key: " ", repeat: false, preventDefault() {} });
    harness.advanceTime(500);
    cancel(harness);
    harness.advanceTime(1000);
    assert.equal(JSON.parse(harness.store.get(postKey)).length, 1);
  }
});

test("按钮脱离页面或进行中线索的伪造按钮不能删除", () => {
  const detached = deletionHarness();
  detached.events.pointerdown(pointerEvent(detached.button));
  detached.button.isConnected = false;
  detached.advanceTime(1000);
  assert.equal(JSON.parse(detached.store.get(postKey)).length, 1);
  const { localRecord } = require("../helpers/fixtures.js");
  const open = deletionHarness("mine", [localRecord("hold-target")]);
  open.events.pointerdown(pointerEvent(open.button));
  open.advanceTime(1000);
  assert.equal(JSON.parse(open.store.get(postKey)).length, 1);
});

test("从十条中删除后可继续发布，空缺配图复用且其他图片编号不变", () => {
  const { localRecord } = require("../helpers/fixtures.js");
  const records = Array.from({ length: 10 }, (_, index) => ({ ...localRecord(index === 3 ? "hold-target" : `keep-${index}`), status: "closed", imageNumber: index+1 }));
  const harness = deletionHarness("mine", records);
  harness.events.pointerdown(pointerEvent(harness.button));
  harness.advanceTime(1000);
  assert.match(harness.app.innerHTML, /9 \/ 10/);
  harness.context.location.hash = "#/publish";
  harness.rerender();
  assert.ok(!harness.app.innerHTML.includes(' disabled'));
  harness.events.submit({ target: new harness.MockForm("publish", publishFields()), preventDefault() {} });
  const saved = JSON.parse(harness.store.get(postKey));
  assert.equal(saved.length, 10);
  assert.equal(saved[0].imageNumber, 4);
  assert.deepEqual(saved.slice(1).map(item => item.imageNumber), [1,2,3,5,6,7,8,9,10]);
});

test("长按完成时核对其他标签页最新状态，避免删除已恢复记录或覆盖新增线索", () => {
  const reopened = deletionHarness();
  const latest = JSON.stringify([{ ...reopened.item, status: "open" }]);
  reopened.events.pointerdown(pointerEvent(reopened.button));
  reopened.store.set(postKey, latest);
  reopened.advanceTime(1000);
  assert.equal(reopened.store.get(postKey), latest);
  assert.match(reopened.toast.textContent, /请先标记/);
  assert.ok(!reopened.app.innerHTML.includes('data-action="delete"'));
  const withNew = deletionHarness("mine");
  const { localRecord } = require("../helpers/fixtures.js");
  const added = { ...localRecord("new-other-tab"), imageNumber: 6 };
  withNew.events.pointerdown(pointerEvent(withNew.button));
  withNew.store.set(postKey, JSON.stringify([added, withNew.item]));
  withNew.advanceTime(1000);
  assert.deepEqual(JSON.parse(withNew.store.get(postKey)), [added]);
});
