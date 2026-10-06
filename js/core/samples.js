/* 只读演示记录；同时支持浏览器脚本和 Node.js。 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    const modules = root.ShiguangCoreModules || (root.ShiguangCoreModules = {});
    modules.samples = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SAMPLE_RECORDS = Object.freeze([
    {
      id: "sample-card", type: "found", title: "蓝色校园卡", category: "证件卡片",
      place: "图书馆二楼自习区", date: "2026-09-28", description: "捡到一张蓝色校园卡，卡套正面有一枚白色贴纸。认领时请先描述卡片特征。",
      contact: "finder@example.edu", status: "open", owner: "sample", createdAt: "2026-09-28T09:40:00.000Z"
    },
    {
      id: "sample-umbrella", type: "lost", title: "黑色折叠伞", category: "雨具",
      place: "第一食堂一层", date: "2026-09-27", description: "午饭后发现黑色折叠伞不见了，伞柄上有一条红色挂绳。",
      contact: "owner@example.edu", status: "open", owner: "sample", createdAt: "2026-09-27T04:20:00.000Z"
    },
    {
      id: "sample-earbuds", type: "found", title: "无线耳机充电盒", category: "数码物品",
      place: "东区操场看台", date: "2026-09-26", description: "晚间运动后捡到白色耳机充电盒，认领时请说明品牌和外观细节。",
      contact: "sports@example.edu", status: "open", owner: "sample", createdAt: "2026-09-26T12:15:00.000Z"
    },
    {
      id: "sample-keys", type: "lost", title: "宿舍钥匙串", category: "钥匙",
      place: "教学楼 A 区门口", date: "2026-09-25", description: "一个带绿色小挂件的钥匙串，可能在教学楼入口附近掉落。",
      contact: "keys@example.edu", status: "closed", owner: "sample", createdAt: "2026-09-25T08:10:00.000Z"
    },
    {
      id: "sample-bottle", type: "found", title: "浅蓝色水杯", category: "水杯",
      place: "西区教学楼 204", date: "2026-09-24", description: "课后在 204 教室发现浅蓝色水杯，杯盖有卡通图案。",
      contact: "classroom@example.edu", status: "open", owner: "sample", createdAt: "2026-09-24T10:30:00.000Z"
    }
  ]);

  return Object.freeze({ SAMPLE_RECORDS });
});
