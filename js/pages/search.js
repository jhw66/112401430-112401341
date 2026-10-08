/* 发现信息：搜索与筛选结果 */
(function (root) {
  "use strict";

  const modules = root.ShiguangAppModules || (root.ShiguangAppModules = {});
  modules.pages = modules.pages || {};
  modules.pages.search = function ({ core, store, ui, router }) {
    const { warningHtml, escapeHtml, option, itemCard } = ui;
    const { searchFilters, searchPath } = router;

    function renderSearch(params) {
      const filters = searchFilters(params);
      const results = core.filterRecords(store.allRecords(), filters);
      return `${warningHtml()}<section class="page-intro"><span class="eyebrow section-eyebrow">发现信息</span><h1>寻找你关心的线索</h1><p>搜索物品名称，也可按地点、类型、类别和状态筛选。</p></section>
        <section class="search-panel" aria-label="搜索和筛选">
          <form data-form="search" role="search">
            <div class="search-input-wrap"><label class="sr-only" for="search-keyword">关键词</label><span aria-hidden="true">⌕</span><input id="search-keyword" name="keyword" type="search" maxlength="60" placeholder="例如：校园卡、图书馆、雨伞" value="${escapeHtml(filters.keyword)}"><button type="submit">搜索</button></div>
            <div class="filter-row">
              <label for="search-place">地点关键词<input id="search-place" name="place" type="text" maxlength="60" placeholder="例如：图书馆、教学楼" value="${escapeHtml(filters.place)}"></label>
              <label>信息类型<select name="type">${option("all", "全部类型", filters.type)}${option("lost", "寻物", filters.type)}${option("found", "招领", filters.type)}</select></label>
              <label>物品类别<select name="category">${option("all", "全部类别", filters.category)}${core.CATEGORIES.map(category => option(category, category, filters.category)).join("")}</select></label>
              <label>信息状态<select name="status">${option("all", "全部状态", filters.status)}${option("open", "进行中", filters.status)}${option("closed", "已结束", filters.status)}</select></label>
              <a href="#/search" class="filter-reset">清除筛选</a></div>
          </form>
        </section>
        <section class="content-section results-section" aria-labelledby="results-title"><div class="section-heading"><div><h2 id="results-title">${filters.keyword ? `“${escapeHtml(filters.keyword)}”的搜索结果` : "全部信息"}</h2><p>找到 ${results.length} 条信息 · 按发布时间排序</p></div></div>
          ${results.length ? `<div class="card-grid">${results.map(item => itemCard(item, searchPath(filters))).join("")}</div>` : `<div class="empty-state"><span aria-hidden="true">⌕</span><h3>暂时没有匹配的信息</h3><p>试试更短的关键词，或清除部分筛选条件。</p><a class="button button-secondary" href="#/search">查看全部信息</a></div>`}
        </section>`;
    }

    return renderSearch;
  };
})(window);
