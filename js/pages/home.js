/* 首页：主视觉、统计与最新信息 */
(function (root) {
  "use strict";

  const modules = root.ShiguangAppModules || (root.ShiguangAppModules = {});
  modules.pages = modules.pages || {};
  modules.pages.home = function ({ core, store, ui }) {
    const { warningHtml, itemCard } = ui;

    function renderHome() {
      const records = store.allRecords();
      const stats = core.getStats(records);
      const latest = core.filterRecords(records, { status: "open" }).slice(0, 6);
      return `${warningHtml()}
        <section class="hero" aria-labelledby="hero-title">
          <div class="hero-copy">
            <span class="eyebrow"><span class="eyebrow-line"></span> 在这里，让线索重新相遇</span>
            <h1 id="hero-title">找回遗失的<span>每一份重要</span></h1>
            <p>校园卡、钥匙、雨伞，也许正有人在寻找。把寻物与招领线索整理在一起，方便浏览、搜索和查看联系方式。</p>
            <form class="hero-search" data-form="hero-search" role="search">
              <label class="sr-only" for="hero-keyword">搜索物品名称或地点</label>
              <span aria-hidden="true">⌕</span>
              <input id="hero-keyword" name="keyword" type="search" maxlength="60" placeholder="搜索物品名称、地点或关键词">
              <button type="submit">搜索线索 <span aria-hidden="true">→</span></button>
            </form>
            <div class="hero-actions"><a href="#/publish" class="text-link">我想发布信息 <span aria-hidden="true">↗</span></a><span>无需注册 · 本机保存</span></div>
          </div>
          <div class="hero-art" aria-hidden="true">
            <div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div>
            <div class="art-card art-card-main"><span class="art-icon">▣</span><span><strong>蓝色校园卡</strong><small>图书馆二楼 · 招领中</small></span><span class="art-check">✓</span></div>
            <div class="art-card art-card-side"><span class="art-icon art-umbrella">☂</span><span><strong>黑色折叠伞</strong><small>正在寻找线索...</small></span></div>
            <div class="art-spark spark-one">✦</div><div class="art-spark spark-two">✦</div>
          </div>
        </section>

        <section class="stats-strip" aria-label="当前展示的信息统计">
          <div><strong>${stats.total}</strong><span>条集中展示</span></div>
          <div><strong>${stats.open}</strong><span>条仍在进行</span></div>
          <div><strong>${stats.lost}</strong><span>条寻物信息</span></div>
          <div><strong>${stats.found}</strong><span>条招领信息</span></div>
        </section>

        <section class="content-section" aria-labelledby="latest-title">
          <div class="section-heading"><div><span class="eyebrow section-eyebrow">最新线索</span><h2 id="latest-title">也许你能帮上忙</h2><p>按发布时间展示仍在寻找或招领中的信息。</p></div><a class="section-more" href="#/search">查看全部 <span aria-hidden="true">→</span></a></div>
          <div class="card-grid">${latest.map(item => itemCard(item, "/home")).join("")}</div>
        </section>

        <section class="how-section" aria-labelledby="how-title"><div class="section-heading"><div><span class="eyebrow section-eyebrow">如何使用</span><h2 id="how-title">三步，让物品回家</h2></div></div>
          <div class="how-grid"><div><span>01</span><h3>发布线索</h3><p>填写物品、地点、时间和联系方式。</p></div><div><span>02</span><h3>搜索与联系</h3><p>通过关键词筛选，打开详情联系发布者。</p></div><div><span>03</span><h3>更新状态</h3><p>物品找回后，在“我的发布”结束信息。</p></div></div>
        </section>`;
    }

    return renderHome;
  };
})(window);
