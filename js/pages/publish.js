/* 发布信息：表单与草稿恢复 */
(function (root) {
  "use strict";

  const modules = root.ShiguangAppModules || (root.ShiguangAppModules = {});
  modules.pages = modules.pages || {};
  modules.pages.publish = function ({ core, store, ui }) {
    const { warningHtml, escapeHtml, formField, option } = ui;

    function renderPublish() {
      const today = core.localDate();
      const atLimit = store.publicationLimitReached;
      const draft = store.pendingDraft || { type: "lost", title: "", category: "", place: "", date: today, description: "", contact: "", phone: "" };
      return `${warningHtml()}<section class="page-intro"><span class="eyebrow section-eyebrow">发布信息</span><h1>记录一条寻物或招领线索</h1><p>只填写必要信息。请勿公开学号、证件号码或其他不必要的个人资料。</p></section>
        <div class="publish-layout"><section class="form-panel" aria-labelledby="publish-heading"><div class="panel-heading"><span class="panel-index">01</span><div><h2 id="publish-heading">填写物品信息</h2><p>带 <span class="required">*</span> 的项目为必填项</p></div></div>
          <p id="publish-capacity" class="publish-capacity${atLimit ? " publish-capacity-full" : ""}" role="status">已保留 ${store.localRecords.length} / ${core.MAX_LOCAL_RECORDS} 条个人线索（含已结束）。${atLimit ? "已达到上限，暂时无法发布新线索；填写内容仍可保存为草稿。" : "发布后自动分配编号角色配图，仅作装饰。"}</p>
          <form id="publish-form" data-form="publish" novalidate>
            <fieldset class="type-fieldset"><legend>信息类型 <span class="required">*</span></legend><div class="type-switch"><label><input type="radio" name="type" value="lost"${draft.type === "lost" ? " checked" : ""}><span><strong>我丢了物品</strong><small>发布寻物信息</small></span></label><label><input type="radio" name="type" value="found"${draft.type === "found" ? " checked" : ""}><span><strong>我捡到物品</strong><small>发布招领信息</small></span></label></div><span class="field-error" data-error-for="type" aria-live="polite"></span></fieldset>
            <div class="field-grid">
              ${formField("title", "物品名称", `<input id="field-title" name="title" type="text" maxlength="40" placeholder="例如：蓝色校园卡" autocomplete="off" value="${escapeHtml(draft.title)}">`)}
              ${formField("category", "物品类别", `<select id="field-category" name="category"><option value="">请选择类别</option>${core.CATEGORIES.map(category => option(category, category, draft.category)).join("")}</select>`)}
              ${formField("place", "遗失 / 拾取地点", `<input id="field-place" name="place" type="text" maxlength="60" placeholder="例如：图书馆二楼自习区" value="${escapeHtml(draft.place)}">`)}
              ${formField("date", "遗失 / 拾取日期", `<input id="field-date" name="date" type="date" max="${today}" value="${escapeHtml(draft.date)}">`)}
            </div>
            ${formField("description", "物品描述", `<textarea id="field-description" name="description" rows="5" maxlength="500" placeholder="描述颜色、外观特征、可能遗失的位置等；认领时可保留一两个特征用于核对。">${escapeHtml(draft.description)}</textarea>`, "10–500 字；避免填写完整证件号。")}
            <fieldset class="contact-fieldset" aria-describedby="contact-hint"><legend>联系方式 <span class="required" aria-hidden="true">*</span></legend>
              <p id="contact-hint" class="field-hint">邮箱、手机号至少填写一项，也可以同时填写。发布后会在详情页公开，请仅填写愿意公开的联系方式。</p>
              <div class="field-grid">
                ${formField("contact", "联系邮箱", `<input id="field-contact" name="contact" type="email" maxlength="100" placeholder="例如：name@example.edu" autocomplete="email" aria-describedby="contact-hint error-contact" value="${escapeHtml(draft.contact)}">`, "", false)}
                ${formField("phone", "手机号", `<input id="field-phone" name="phone" type="tel" inputmode="numeric" maxlength="11" placeholder="例如：13800138000" autocomplete="tel-national" aria-describedby="contact-hint error-phone" value="${escapeHtml(draft.phone)}">`, "11 位中国大陆手机号。", false)}
              </div>
            </fieldset>
            <p class="draft-status" data-draft-status role="status">${escapeHtml(store.draftWarning || (store.pendingDraft ? "已恢复上次草稿，离开或刷新页面后仍可继续填写。" : "填写内容会自动保存为草稿。"))}</p>
            <div class="form-actions"><button type="submit" class="button button-primary" aria-describedby="publish-capacity"${atLimit ? " disabled" : ""}>确认发布 <span aria-hidden="true">→</span></button><a href="#/home" class="button button-quiet">返回首页</a></div>
          </form>
        </section>
        <aside class="publish-aside"><div class="aside-card"><span class="aside-icon" aria-hidden="true">✦</span><h3>一条清晰的信息，更容易被找到</h3><p>物品名称尽量具体，地点和时间尽量准确。联系方式会展示给查看详情的人。</p></div><div class="aside-steps"><h3>发布之后</h3><ol><li>在“我的发布”中查看记录</li><li>失主或拾得者通过详情联系你</li><li>找回或归还后及时更新状态</li></ol></div></aside></div>`;
    }

    return renderPublish;
  };
})(window);
