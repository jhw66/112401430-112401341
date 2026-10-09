/* 详情返回、筛选保留与安全入口 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../../js/core.js");
const { publishFields } = require("../helpers/fixtures.js");
const { startApp, searchResultIds } = require("../helpers/app-harness.js");

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
