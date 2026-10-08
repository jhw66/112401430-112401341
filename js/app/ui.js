/* 公共界面工具：安全转义、日期、卡片、表单控件、校验与消息提示。 */
(function (root) {
  "use strict";

  const modules = root.ShiguangAppModules || (root.ShiguangAppModules = {});
  modules.createUI = function (core, store, router) {
    const { detailPath } = router;
    const toastElement = document.querySelector("#toast");
    let toastTimer;

    const icons = {
      "证件卡片": "▣", "钥匙": "⚿", "数码物品": "◈", "雨具": "☂",
      "水杯": "◉", "书本文具": "▤", "其他": "✦"
    };

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      })[char]);
    }

    function showToast(message, isError = false) {
      clearTimeout(toastTimer);
      toastElement.textContent = message;
      toastElement.classList.toggle("toast-error", isError);
      toastElement.hidden = false;
      toastTimer = setTimeout(() => { toastElement.hidden = true; }, 4200);
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

    function itemVisual(item, detail = false) {
      const className = detail ? "detail-icon" : "item-icon";
      if (item.owner === "local" && Number.isInteger(item.imageNumber) && item.imageNumber >= 1 && item.imageNumber <= core.MAX_LOCAL_RECORDS) {
        const number = item.imageNumber;
        const filename = String(number).padStart(2, "0");
        return `<span class="${className} item-image" data-image-number="${number}"><img src="assets/images/post-${filename}.png" alt="配图 ${number}，装饰角色，并非物品实拍" width="64" height="64"><span class="image-number" aria-hidden="true">${number}</span></span>`;
      }
      return `<span class="${className}" aria-hidden="true">${icons[item.category] || "✦"}</span>`;
    }

    function deleteButton(item) {
      if (item.owner !== "local" || item.status !== "closed") return "";
      return `<button class="button button-danger hold-delete" type="button" data-action="delete" data-id="${escapeHtml(item.id)}" aria-label="长按1秒删除${escapeHtml(item.title)}" title="按住1秒删除；删除后不可恢复。键盘可按住空格或回车，按 Esc 取消。"><span>长按删除</span></button>`;
    }

    function itemCard(item, returnTo = "/search") {
      const href = `#${detailPath(item.id, returnTo)}`;
      return `<a class="item-card ${item.status === "closed" ? "item-card-closed" : ""}" href="${href}" aria-label="查看${escapeHtml(item.title)}详情">
        <div class="card-top">${itemVisual(item)}${typePill(item)}${statusPill(item)}</div>
        <h3>${escapeHtml(item.title)}</h3>
        <p class="card-description">${escapeHtml(item.description)}</p>
        <div class="card-meta"><span>⌖ ${escapeHtml(item.place)}</span><span>◷ ${dateLabel(item.date)}</span></div>
        <div class="card-bottom"><span>${escapeHtml(item.category)}</span><span class="card-arrow" aria-hidden="true">↗</span></div>
      </a>`;
    }

    function warningHtml() {
      return store.storageWarning ? `<div class="storage-warning" role="alert">${escapeHtml(store.storageWarning)}</div>` : "";
    }

    function option(value, label, selected) {
      return `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
    }

    function formField(name, label, control, hint = "", required = true) {
      return `<div class="form-field"><label for="field-${name}">${label}${required ? '<span class="required" aria-hidden="true"> *</span>' : ""}</label>${control}${hint ? `<small class="field-hint">${hint}</small>` : ""}<span id="error-${name}" class="field-error" data-error-for="${name}" aria-live="polite"></span></div>`;
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

    return { escapeHtml, showToast, dateLabel, publishedDateLabel, typePill, statusPill, itemVisual, deleteButton, itemCard, warningHtml, option, formField, showFormErrors };
  };
})(window);
