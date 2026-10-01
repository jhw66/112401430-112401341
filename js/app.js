/* 页面路由和交互；无需构建工具，直接打开 index.html 即可使用。 */
(function () {
  "use strict";

  const core = window.ShiguangCore;
  const app = document.querySelector("#app");
  const toastElement = document.querySelector("#toast");
  const storageKey = "shiguang_local_posts_v1";
  const draftKey = "shiguang_publish_draft_v1";
  const icons = {
    "证件卡片": "▣", "钥匙": "⚿", "数码物品": "◈", "雨具": "☂",
    "水杯": "◉", "书本文具": "▤", "其他": "✦"
  };
  let toastTimer;
  let storageWarning = "";
  let localRecords = [];
  let pendingDraft = null;
  let draftWarning = "";
  let damagedRecordsRaw = null;

  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = core.parseLocalRecords(raw);
    localRecords = parsed.records;
    if (parsed.invalid) {
      damagedRecordsRaw = raw;
      storageWarning = "部分本地记录格式异常，已跳过；原始缓存未被覆盖。";
    }
  } catch {
    storageWarning = "当前浏览器不允许本地存储，新发布的信息仅在本次打开期间保留。";
  }

  try {
    const parsed = core.parsePublishDraft(localStorage.getItem(draftKey));
    pendingDraft = parsed.draft;
    if (parsed.invalid) draftWarning = "旧草稿格式异常，未自动填入表单。";
  } catch {
    draftWarning = "草稿暂存于本次页面中，关闭后无法恢复。";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function allRecords() {
    return [...localRecords, ...core.SAMPLE_RECORDS];
  }

  function saveLocalRecords() {
    try {
      // 首次写入前备份异常缓存，避免覆盖尚未恢复的旧记录。
      if (damagedRecordsRaw !== null) {
        localStorage.setItem(`${storageKey}_recovery_${Date.now()}`, damagedRecordsRaw);
        damagedRecordsRaw = null;
      }
      localStorage.setItem(storageKey, JSON.stringify(localRecords));
      storageWarning = "";
      return true;
    } catch {
      storageWarning = "本地保存失败；本次打开期间仍可查看记录，但关闭页面后可能丢失。";
      return false;
    }
  }

  function persistPublishDraft(form) {
    pendingDraft = Object.fromEntries(new FormData(form).entries());
    try {
      localStorage.setItem(draftKey, JSON.stringify(pendingDraft));
      draftWarning = "";
    } catch {
      draftWarning = "草稿暂存于本次页面中，关闭后无法恢复。";
    }
    const status = form.querySelector("[data-draft-status]");
    if (status) status.textContent = draftWarning || "草稿已保存在当前浏览器。";
  }

  function clearPublishDraft() {
    pendingDraft = null;
    try {
      localStorage.removeItem(draftKey);
      draftWarning = "";
    } catch {
      draftWarning = "信息已发布，但旧草稿未能清除；重新打开时请勿重复发布。";
    }
  }

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    toastElement.textContent = message;
    toastElement.classList.toggle("toast-error", isError);
    toastElement.hidden = false;
    toastTimer = setTimeout(() => { toastElement.hidden = true; }, 4200);
  }

  function currentRoute() {
    const raw = location.hash.slice(1) || "/home";
    const [path, query = ""] = raw.split("?");
    const segments = path.split("/").filter(Boolean);
    return { page: segments[0] || "home", id: segments[1] || "", params: new URLSearchParams(query) };
  }

  function navigate(path) {
    if (location.hash === `#${path}`) render();
    else location.hash = path;
  }

  function dateLabel(value) {
    return escapeHtml(value.replaceAll("-", "."));
  }

  function publishedDateLabel(value) {
    return dateLabel(core.localDate(new Date(value)));
  }

  function typePill(item) {
    const type = item.type === "lost" ? "lost" : "found";
    return `<span class="type-pill type-${type}">${core.TYPE_LABELS[type]}</span>`;
  }

  function statusPill(item) {
    const status = item.status === "closed" ? "closed" : "open";
    return `<span class="status-pill status-${status}"><span class="status-dot" aria-hidden="true"></span>${core.STATUS_LABELS[item.type][status]}</span>`;
  }

  function detailPath(id, returnTo = "/search") {
    return `/detail/${encodeURIComponent(id)}?${new URLSearchParams({ returnTo })}`;
  }

  function detailReturn(params) {
    const returnTo = params.get("returnTo") || "/search";
    if (returnTo === "/mine") return { path: "/mine", label: "返回我的发布" };
    if (returnTo === "/home") return { path: "/home", label: "返回首页" };
    const queryIndex = returnTo.indexOf("?");
    const path = queryIndex < 0 ? returnTo : returnTo.slice(0, queryIndex);
    if (path === "/search") {
      const query = queryIndex < 0 ? "" : returnTo.slice(queryIndex + 1);
      return { path: searchPath(searchFilters(new URLSearchParams(query))), label: "返回信息列表" };
    }
    return { path: "/search", label: "返回信息列表" };
  }

  function itemCard(item, returnTo = "/search") {
    const href = `#${detailPath(item.id, returnTo)}`;
    return `<a class="item-card ${item.status === "closed" ? "item-card-closed" : ""}" href="${href}" aria-label="查看${escapeHtml(item.title)}详情">
      <div class="card-top"><span class="item-icon" aria-hidden="true">${icons[item.category] || "✦"}</span>${typePill(item)}${statusPill(item)}</div>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="card-description">${escapeHtml(item.description)}</p>
      <div class="card-meta"><span>⌖ ${escapeHtml(item.place)}</span><span>◷ ${dateLabel(item.date)}</span></div>
      <div class="card-bottom"><span>${escapeHtml(item.category)}${item.owner === "sample" ? " · 演示信息" : ""}</span><span class="card-arrow" aria-hidden="true">↗</span></div>
    </a>`;
  }

  function warningHtml() {
    return storageWarning ? `<div class="storage-warning" role="alert">${escapeHtml(storageWarning)}</div>` : "";
  }

  function renderHome() {
    const records = allRecords();
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

  function searchFilters(params) {
    const type = params.get("type") || "all";
    const category = params.get("category") || "all";
    const status = params.get("status") || "all";
    return {
      keyword: core.clean(params.get("keyword") || ""),
      type: ["all", "lost", "found"].includes(type) ? type : "all",
      category: category === "all" || core.CATEGORIES.includes(category) ? category : "all",
      status: ["all", "open", "closed"].includes(status) ? status : "all"
    };
  }

  function option(value, label, selected) {
    return `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
  }

  function searchPath(filters) {
    const params = new URLSearchParams();
    if (filters.keyword) params.set("keyword", core.clean(filters.keyword));
    if (filters.type && filters.type !== "all") params.set("type", filters.type);
    if (filters.category && filters.category !== "all") params.set("category", filters.category);
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    const query = params.toString();
    return `/search${query ? `?${query}` : ""}`;
  }

  function renderSearch(params) {
    const filters = searchFilters(params);
    const results = core.filterRecords(allRecords(), filters);
    return `${warningHtml()}<section class="page-intro"><span class="eyebrow section-eyebrow">发现信息</span><h1>寻找你关心的线索</h1><p>搜索物品名称，也可按类型、类别和状态筛选。</p></section>
      <section class="search-panel" aria-label="搜索和筛选">
        <form data-form="search" role="search">
          <div class="search-input-wrap"><label class="sr-only" for="search-keyword">关键词</label><span aria-hidden="true">⌕</span><input id="search-keyword" name="keyword" type="search" maxlength="60" placeholder="例如：校园卡、图书馆、雨伞" value="${escapeHtml(filters.keyword)}"><button type="submit">搜索</button></div>
          <div class="filter-row"><label>信息类型<select name="type">${option("all", "全部类型", filters.type)}${option("lost", "寻物", filters.type)}${option("found", "招领", filters.type)}</select></label>
            <label>物品类别<select name="category">${option("all", "全部类别", filters.category)}${core.CATEGORIES.map(category => option(category, category, filters.category)).join("")}</select></label>
            <label>信息状态<select name="status">${option("all", "全部状态", filters.status)}${option("open", "进行中", filters.status)}${option("closed", "已结束", filters.status)}</select></label>
            <a href="#/search" class="filter-reset">清除筛选</a></div>
        </form>
      </section>
      <section class="content-section results-section" aria-labelledby="results-title"><div class="section-heading"><div><h2 id="results-title">${filters.keyword ? `“${escapeHtml(filters.keyword)}”的搜索结果` : "全部信息"}</h2><p>找到 ${results.length} 条信息 · 按发布时间排序</p></div></div>
        ${results.length ? `<div class="card-grid">${results.map(item => itemCard(item, searchPath(filters))).join("")}</div>` : `<div class="empty-state"><span aria-hidden="true">⌕</span><h3>暂时没有匹配的信息</h3><p>试试更短的关键词，或清除部分筛选条件。</p><a class="button button-secondary" href="#/search">查看全部信息</a></div>`}
      </section>`;
  }

  function formField(name, label, control, hint = "") {
    return `<div class="form-field" data-field="${name}"><label for="field-${name}">${label}<span class="required" aria-hidden="true"> *</span></label>${control}${hint ? `<small class="field-hint">${hint}</small>` : ""}<span class="field-error" data-error-for="${name}" aria-live="polite"></span></div>`;
  }

  function renderPublish() {
    const today = core.localDate();
    const draft = pendingDraft || { type: "lost", title: "", category: "", place: "", date: today, description: "", contact: "" };
    return `${warningHtml()}<section class="page-intro"><span class="eyebrow section-eyebrow">发布信息</span><h1>记录一条寻物或招领线索</h1><p>只填写必要信息。请勿公开学号、证件号码或其他不必要的个人资料。</p></section>
      <div class="publish-layout"><section class="form-panel" aria-labelledby="publish-heading"><div class="panel-heading"><span class="panel-index">01</span><div><h2 id="publish-heading">填写物品信息</h2><p>带 <span class="required">*</span> 的项目为必填项</p></div></div>
        <form id="publish-form" data-form="publish" novalidate>
          <fieldset class="type-fieldset"><legend>信息类型 <span class="required">*</span></legend><div class="type-switch"><label><input type="radio" name="type" value="lost"${draft.type === "lost" ? " checked" : ""}><span><strong>我丢了物品</strong><small>发布寻物信息</small></span></label><label><input type="radio" name="type" value="found"${draft.type === "found" ? " checked" : ""}><span><strong>我捡到物品</strong><small>发布招领信息</small></span></label></div><span class="field-error" data-error-for="type" aria-live="polite"></span></fieldset>
          <div class="field-grid">
            ${formField("title", "物品名称", `<input id="field-title" name="title" type="text" maxlength="40" placeholder="例如：蓝色校园卡" autocomplete="off" value="${escapeHtml(draft.title)}">`)}
            ${formField("category", "物品类别", `<select id="field-category" name="category"><option value="">请选择类别</option>${core.CATEGORIES.map(category => option(category, category, draft.category)).join("")}</select>`)}
            ${formField("place", "遗失 / 拾取地点", `<input id="field-place" name="place" type="text" maxlength="60" placeholder="例如：图书馆二楼自习区" value="${escapeHtml(draft.place)}">`)}
            ${formField("date", "遗失 / 拾取日期", `<input id="field-date" name="date" type="date" max="${today}" value="${escapeHtml(draft.date)}">`)}
          </div>
          ${formField("description", "物品描述", `<textarea id="field-description" name="description" rows="5" maxlength="500" placeholder="描述颜色、外观特征、可能遗失的位置等；认领时可保留一两个特征用于核对。">${escapeHtml(draft.description)}</textarea>`, "10–500 字；避免填写完整证件号。")}
          ${formField("contact", "联系邮箱", `<input id="field-contact" name="contact" type="email" maxlength="100" placeholder="例如：name@example.edu" autocomplete="email" value="${escapeHtml(draft.contact)}">`, "发布后会在详情页公开，请仅填写愿意公开的邮箱。")}
          <p class="draft-status" data-draft-status role="status">${escapeHtml(draftWarning || (pendingDraft ? "已恢复上次草稿，离开或刷新页面后仍可继续填写。" : "填写内容会自动保存为草稿。"))}</p>
          <div class="form-actions"><button type="submit" class="button button-primary">确认发布 <span aria-hidden="true">→</span></button><a href="#/home" class="button button-quiet">返回首页</a></div>
        </form>
      </section>
      <aside class="publish-aside"><div class="aside-card"><span class="aside-icon" aria-hidden="true">✦</span><h3>一条清晰的信息，更容易被找到</h3><p>物品名称尽量具体，地点和时间尽量准确。联系方式会展示给查看详情的人。</p></div><div class="aside-steps"><h3>发布之后</h3><ol><li>在“我的发布”中查看记录</li><li>失主或拾得者通过详情联系你</li><li>找回或归还后及时更新状态</li></ol></div></aside></div>`;
  }

  function renderDetail(id, params = new URLSearchParams()) {
    const returnRoute = detailReturn(params);
    const item = allRecords().find(record => record.id === id);
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

  function renderSuccess(id) {
    const item = localRecords.find(record => record.id === id);
    if (!item) return renderDetail(id);
    return `${warningHtml()}${draftWarning ? `<p class="storage-warning" role="alert">${escapeHtml(draftWarning)}</p>` : ""}<section class="success-panel"><div class="success-icon" aria-hidden="true">✓</div><span class="eyebrow section-eyebrow">发布成功</span><h1>你的线索已经记录下来</h1><p>“${escapeHtml(item.title)}”已加入信息列表。找到物品或完成归还后，记得到“我的发布”更新状态。</p><div class="success-actions"><a class="button button-primary" href="#${detailPath(item.id, "/mine")}">查看信息详情</a><a class="button button-secondary" href="#/mine">前往我的发布</a></div><a href="#/home" class="text-link">返回首页 <span aria-hidden="true">→</span></a></section>`;
  }

  function renderMine() {
    const mine = core.filterRecords(localRecords);
    return `${warningHtml()}<section class="page-intro"><span class="eyebrow section-eyebrow">我的发布</span><h1>管理我发布的线索</h1><p>这里仅显示在当前浏览器发布的信息；无需登录，但不能跨设备同步。</p></section>
      ${mine.length ? `<div class="mine-list">${mine.map(item => `<div class="mine-row"><div class="mine-row-main"><span class="item-icon" aria-hidden="true">${icons[item.category] || "✦"}</span><div><div class="mine-row-pills">${typePill(item)}${statusPill(item)}</div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.place)} · ${dateLabel(item.date)}</p></div></div><div class="mine-row-actions"><a class="button button-quiet" href="#${detailPath(item.id, "/mine")}">查看详情</a><button class="button button-secondary" type="button" data-action="${item.status === "open" ? "close" : "reopen"}" data-id="${escapeHtml(item.id)}">${item.status === "open" ? `标记${item.type === "lost" ? "已找到" : "已归还"}` : "撤销结束"}</button></div></div>`).join("")}</div>` : `<div class="empty-state standalone-empty"><span aria-hidden="true">▣</span><h2>还没有发布过信息</h2><p>发布一条寻物或招领信息后，就可以在这里查看并更新状态。</p><a class="button button-primary" href="#/publish">发布第一条信息</a></div>`}`;
  }

  function updateNavigation(page) {
    const active = ["search", "publish", "mine"].includes(page) ? page : "home";
    document.querySelectorAll("[data-nav]").forEach(link => {
      if (link.dataset.nav === active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function render() {
    const route = currentRoute();
    let content;
    switch (route.page) {
      case "search": content = renderSearch(route.params); break;
      case "publish": content = renderPublish(); break;
      case "detail": content = renderDetail(route.id, route.params); break;
      case "success": content = renderSuccess(route.id); break;
      case "mine": content = renderMine(); break;
      default: content = renderHome(); break;
    }
    app.innerHTML = content;
    const navPage = route.page === "detail" ? detailReturn(route.params).path.split("?")[0].slice(1) : route.page === "success" ? "publish" : route.page;
    updateNavigation(navPage);
    const pageTitles = { search: "发现信息", publish: "发布信息", detail: "信息详情", success: "发布成功", mine: "我的发布" };
    const title = Object.prototype.hasOwnProperty.call(pageTitles, route.page) ? pageTitles[route.page] : "首页";
    document.title = `${title}｜拾光·校园失物招领`;
  }

  function filtersFromForm(form) {
    const data = new FormData(form);
    return {
      keyword: String(data.get("keyword") || ""),
      type: String(data.get("type") || "all"),
      category: String(data.get("category") || "all"),
      status: String(data.get("status") || "all")
    };
  }

  function showFormErrors(form, errors) {
    form.querySelectorAll("[data-error-for]").forEach(element => { element.textContent = ""; });
    form.querySelectorAll("[aria-invalid]").forEach(element => element.removeAttribute("aria-invalid"));
    for (const [name, message] of Object.entries(errors)) {
      const messageElement = form.querySelector(`[data-error-for="${name}"]`);
      const input = form.elements.namedItem(name);
      if (messageElement) messageElement.textContent = message;
      if (input && input instanceof HTMLElement) input.setAttribute("aria-invalid", "true");
    }
    const first = Object.keys(errors)[0];
    const target = form.elements.namedItem(first);
    if (target && typeof target.focus === "function") target.focus();
  }

  document.addEventListener("submit", event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.dataset.form) return;
    event.preventDefault();
    if (form.dataset.form === "hero-search") {
      navigate(searchPath({ keyword: form.elements.namedItem("keyword").value }));
      return;
    }
    if (form.dataset.form === "search") {
      navigate(searchPath(filtersFromForm(form)));
      return;
    }
    if (form.dataset.form !== "publish" || form.dataset.submitted === "true") return;
    const data = Object.fromEntries(new FormData(form).entries());
    const errors = core.validateDraft(data);
    if (Object.keys(errors).length) {
      persistPublishDraft(form);
      showFormErrors(form, errors);
      showToast("请检查标红的必填信息。", true);
      return;
    }
    const item = core.createRecord(data);
    form.dataset.submitted = "true";
    localRecords = [item, ...localRecords];
    const saved = saveLocalRecords();
    clearPublishDraft();
    navigate(`/success/${encodeURIComponent(item.id)}`);
    if (!saved) showToast("已记录本次发布，但浏览器未能持久保存。", true);
  });

  function saveDraftFromEvent(event) {
    if (!(event.target instanceof HTMLElement)) return;
    const form = event.target.closest('form[data-form="publish"]');
    if (form instanceof HTMLFormElement && form.dataset.submitted !== "true") persistPublishDraft(form);
  }

  document.addEventListener("input", saveDraftFromEvent);
  document.addEventListener("change", event => {
    saveDraftFromEvent(event);
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const form = target.closest('form[data-form="search"]');
    if (form) navigate(searchPath(filtersFromForm(form)));
  });

  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-action]");
    if (!(button instanceof HTMLButtonElement)) return;
    if (["close", "reopen"].includes(button.dataset.action)) {
      try {
        const reopening = button.dataset.action === "reopen";
        localRecords = reopening ? core.markReopened(localRecords, button.dataset.id) : core.markClosed(localRecords, button.dataset.id);
        const saved = saveLocalRecords();
        render();
        showToast(reopening ? (saved ? "已撤销结束，信息恢复为进行中。" : "已恢复为进行中，但浏览器未能持久保存。") : (saved ? "状态已更新，并保存在当前浏览器。" : "状态已更新，但浏览器未能持久保存。"), !saved);
      } catch (error) {
        showToast(error.message || "状态更新失败。", true);
      }
    }
    if (button.dataset.action === "copy") {
      const value = button.dataset.contact || "";
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
        await navigator.clipboard.writeText(value);
        showToast("联系方式已复制。请先核对物品特征再联系。");
      } catch {
        let copied = false;
        const helper = document.createElement("textarea");
        try {
          helper.value = value;
          helper.style.position = "fixed";
          helper.style.opacity = "0";
          document.body.append(helper);
          helper.select();
          copied = document.execCommand("copy");
        } catch { /* 手动复制仍可使用详情页中显示的联系方式。 */ }
        finally { helper.remove(); }
        showToast(copied ? "联系方式已复制。" : "自动复制失败，请手动选中上方联系方式。", !copied);
      }
    }
  });

  window.addEventListener("hashchange", () => {
    render();
    window.scrollTo(0, 0);
    if (typeof app.focus === "function") app.focus({ preventScroll: true });
  });
  render();
})();
