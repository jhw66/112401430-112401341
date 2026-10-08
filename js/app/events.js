/* 事件绑定：搜索提交、发布校验、自动草稿、状态更新与联系方式复制。 */
(function (root) {
  "use strict";

  const modules = root.ShiguangAppModules || (root.ShiguangAppModules = {});
  modules.bindEvents = function ({ core, store, router, ui, navigate, render }) {
    const { searchPath } = router;
    const { showToast, showFormErrors } = ui;

    function filtersFromForm(form) {
      const data = new FormData(form);
      return {
        keyword: String(data.get("keyword") || ""),
        place: String(data.get("place") || ""),
        type: String(data.get("type") || "all"),
        category: String(data.get("category") || "all"),
        status: String(data.get("status") || "all")
      };
    }

    function persistPublishDraft(form) {
      store.persistPublishDraft(Object.fromEntries(new FormData(form).entries()));
      const status = form.querySelector("[data-draft-status]");
      if (status) status.textContent = store.draftWarning || "草稿已保存在当前浏览器。";
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
      if (store.publicationLimitReached) {
        persistPublishDraft(form);
        showToast(`当前浏览器最多保留 ${core.MAX_LOCAL_RECORDS} 条个人线索，已结束的记录也计入数量。`, true);
        return;
      }
      const data = Object.fromEntries(new FormData(form).entries());
      const errors = core.validateDraft(data);
      if (Object.keys(errors).length) {
        persistPublishDraft(form);
        showFormErrors(form, errors);
        showToast("请检查标红的必填信息。", true);
        return;
      }
      let item;
      try {
        item = core.createRecord(data);
        store.addRecord(item);
      } catch (error) {
        persistPublishDraft(form);
        if (error.code === "POST_LIMIT") render();
        showToast(error.message || "发布失败，请稍后重试。", true);
        return;
      }
      form.dataset.submitted = "true";
      const saved = store.saveLocalRecords();
      store.clearPublishDraft();
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
          store.updateStatus(button.dataset.id, reopening);
          const saved = store.saveLocalRecords();
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
  };
})(window);
