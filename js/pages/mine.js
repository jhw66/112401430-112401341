/* 我的发布：本机记录与管理入口 */
(function (root) {
  "use strict";

  const modules = root.ShiguangAppModules || (root.ShiguangAppModules = {});
  modules.pages = modules.pages || {};
  modules.pages.mine = function ({ core, store, ui, router }) {
    const { warningHtml, escapeHtml, icons, typePill, statusPill, dateLabel } = ui;
    const { detailPath } = router;

    function renderMine() {
      const mine = core.filterRecords(store.localRecords);
      return `${warningHtml()}<section class="page-intro"><span class="eyebrow section-eyebrow">我的发布</span><h1>管理我发布的线索</h1><p>这里仅显示在当前浏览器发布的信息；无需登录，但不能跨设备同步。</p></section>
        ${mine.length ? `<div class="mine-list">${mine.map(item => `<div class="mine-row"><div class="mine-row-main"><span class="item-icon" aria-hidden="true">${icons[item.category] || "✦"}</span><div><div class="mine-row-pills">${typePill(item)}${statusPill(item)}</div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.place)} · ${dateLabel(item.date)}</p></div></div><div class="mine-row-actions"><a class="button button-quiet" href="#${detailPath(item.id, "/mine")}">查看详情</a><button class="button button-secondary" type="button" data-action="${item.status === "open" ? "close" : "reopen"}" data-id="${escapeHtml(item.id)}">${item.status === "open" ? `标记${item.type === "lost" ? "已找到" : "已归还"}` : "撤销结束"}</button></div></div>`).join("")}</div>` : `<div class="empty-state standalone-empty"><span aria-hidden="true">▣</span><h2>还没有发布过信息</h2><p>发布一条寻物或招领信息后，就可以在这里查看并更新状态。</p><a class="button button-primary" href="#/publish">发布第一条信息</a></div>`}`;
    }

    return renderMine;
  };
})(window);
