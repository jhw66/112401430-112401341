/* 发布成功：新记录与后续操作 */
(function (root) {
  "use strict";

  const modules = root.ShiguangAppModules || (root.ShiguangAppModules = {});
  modules.pages = modules.pages || {};
  modules.pages.success = function ({ store, ui, router, renderDetail }) {
    const { warningHtml, escapeHtml } = ui;
    const { detailPath } = router;

    function renderSuccess(id) {
      const item = store.localRecords.find(record => record.id === id);
      if (!item) return renderDetail(id);
      return `${warningHtml()}${store.draftWarning ? `<p class="storage-warning" role="alert">${escapeHtml(store.draftWarning)}</p>` : ""}<section class="success-panel"><div class="success-icon" aria-hidden="true">✓</div><span class="eyebrow section-eyebrow">发布成功</span><h1>你的线索已经记录下来</h1><p>“${escapeHtml(item.title)}”已加入信息列表。找到物品或完成归还后，记得到“我的发布”更新状态。</p><div class="success-actions"><a class="button button-primary" href="#${detailPath(item.id, "/mine")}">查看信息详情</a><a class="button button-secondary" href="#/mine">前往我的发布</a></div><a href="#/home" class="text-link">返回首页 <span aria-hidden="true">→</span></a></section>`;
    }

    return renderSuccess;
  };
})(window);
