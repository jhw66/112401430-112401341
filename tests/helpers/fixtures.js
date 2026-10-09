/* 公共测试数据：固定时间、业务草稿、有效记录与页面发布字段。 */
"use strict";

const core = require("../../js/core.js");

const NOW = new Date(2026, 8, 29, 12, 0, 0);
const draft = () => ({
  type: "found", title: " 蓝色校园卡 ", category: "证件卡片",
  place: " 图书馆二楼 ", date: "2026-09-28",
  description: "在二楼自习区捡到一张蓝色校园卡。", contact: " finder@example.edu "
});
const localRecord = (id = "local-1") => core.createRecord(draft(), { id, now: NOW });

function publishFields() {
  return { type: "found", title: "验收水杯", category: "水杯", place: "图书馆二楼",
    date: "2026-09-28", description: "验收使用的蓝色水杯，杯盖上有白色小图案。", contact: "audit@example.edu" };
}

module.exports = { NOW, draft, localRecord, publishFields };
