/* 信息详情：物品信息、联系方式与状态操作 */
(function (root) {
  "use strict";

  const modules = root.ShiguangAppModules || (root.ShiguangAppModules = {});
  modules.pages = modules.pages || {};
  modules.pages.detail = function ({ core, store, ui, router }) {
    const { warningHtml, escapeHtml, icons, typePill, statusPill, dateLabel, publishedDateLabel } = ui;
    const { detailReturn } = router;

    function renderDetail(id, params = new URLSearchParams()) {
      const returnRoute = detailReturn(params);
      const item = store.allRecords().find(record => record.id === id);
      if (!item) return `<section class="empty-state standalone-empty"><span aria-hidden="true">?</span><h1>没有找到这条信息</h1><p>它可能已不在当前浏览器中。</p><a href="#${escapeHtml(returnRoute.path)}" class="button button-primary">${returnRoute.label}</a></section>`;
      const owned = item.owner === "local";
      return `${warningHtml()}<div class="detail-back"><a href="#${escapeHtml(returnRoute.path)}"><span aria-hidden="true">←</span> ${returnRoute.label}</a></div><article class="detail-layout">
        <section class="detail-main"><div class="detail-heading"><div class="detail-icon" aria-hidden="true">${icons[item.category] || "✦"}</div><div class="detail-heading-copy"><div class="detail-pills">${typePill(item)}${statusPill(item)}${item.owner === "sample" ? '<span class="sample-pill">演示信息</span>' : ""}</div><h1>${escapeHtml(item.title)}</h1><p>发布于 ${publishedDateLabel(item.createdAt)}</p></div></div>
          <div class="detail-divider"></div><h2>物品信息</h2><dl class="detail-facts"><div><dt>物品类别</dt><dd>${escapeHtml(item.category)}</dd></div><div><dt>${item.type === "lost" ? "遗失地点" : "拾取地点"}</dt><dd>${escapeHtml(item.place)}</dd></div><div><dt>${item.type === "lost" ? "遗失日期" : "拾取日期"}</dt><dd>${dateLabel(item.date)}</dd></div><div><dt>当前状态</dt><dd>${core.STATUS_LABELS[item.type][item.status]}</dd></div></dl>
          <div class="detail-description"><h2>详细描述</h2><p>${escapeHtml(item.description)}</p></div>
          ${owned ? `<div class="owner-action"><div><strong>${item.status === "open" ? `物品已经${item.type === "lost" ? "找到" : "归还"}了吗？` : "刚才标记错了吗？"}</strong><p>${item.status === "open" ? "结束后记录仍保留，联系方式会隐藏；误操作可撤销结束。" : "撤销后恢复为进行中，联系方式将重新显示。"}</p></div><button class="button button-secondary" type="button" data-action="${item.status === "open" ? "close" : "reopen"}" data-id="${escapeHtml(item.id)}">${item.status === "open" ? `标记为${item.type === "lost" ? "已找到" : "已归还"}` : "撤销结束"}</button></div>` : ""}
        </section>
        <aside class="detail-aside">${item.status === "open" ? `<div class="contact-card"><span class="eyebrow">联系发布者</span><h2>有线索？联系 Ta</h2><p>联系前请先核对物品特征，避免误领。</p><div class="contact-value">${escapeHtml(item.contact)}</div><button class="button button-primary copy-button" type="button" data-action="copy" data-contact="${escapeHtml(item.contact)}">复制联系方式</button>${item.owner === "sample" ? '<small>此条为演示信息，联系方式不是实际联系人。</small>' : ""}</div>` : '<div class="contact-card contact-closed"><span class="eyebrow">信息已结束</span><h2>物品已有结果</h2><p>发布者已更新状态，无需再联系。联系方式已隐藏，避免重复询问。</p></div>'}<div class="privacy-card"><strong>安全提醒</strong><p>认领时先核对物品特征；不要向陌生人提供密码、验证码或完整证件号。</p></div></aside>
      </article>`;
    }

    return renderDetail;
  };
})(window);
