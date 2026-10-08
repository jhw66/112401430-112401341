/* 发布数据预处理与字段校验；同时支持浏览器脚本和 Node.js。 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./constants.js"), require("./utils.js"));
  } else {
    const modules = root.ShiguangCoreModules || (root.ShiguangCoreModules = {});
    modules.validation = factory(modules.constants, modules.utils);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (constants, utils) {
  "use strict";

  const { CATEGORIES, TYPES } = constants;
  const { clean, localDate, validCalendarDate } = utils;

  function normalizeDraft(draft) {
    return {
      type: clean(draft?.type),
      title: clean(draft?.title),
      category: clean(draft?.category),
      place: clean(draft?.place),
      date: clean(draft?.date),
      description: clean(draft?.description, true),
      contact: clean(draft?.contact),
      phone: clean(draft?.phone)
    };
  }

  function validateContacts(draft) {
    const contact = typeof draft?.contact === "string" ? clean(draft.contact) : "";
    const phone = typeof draft?.phone === "string" ? clean(draft.phone) : "";
    const errors = {};
    if (!contact && !phone) errors.contact = "请至少填写联系邮箱或手机号中的一项。";
    if ((draft?.contact !== undefined && typeof draft.contact !== "string") ||
        (contact && (contact.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)))) {
      errors.contact = "请填写有效的联系邮箱（不超过 100 个字符）。";
    }
    if ((draft?.phone !== undefined && typeof draft.phone !== "string") ||
        (phone && !/^1[3-9]\d{9}$/.test(phone))) {
      errors.phone = "请填写有效的 11 位中国大陆手机号。";
    }
    return errors;
  }

  function validateDraft(draft, today = localDate()) {
    const item = normalizeDraft(draft);
    const errors = {};
    if (typeof draft?.type !== "string" || !TYPES.includes(item.type)) errors.type = "请选择寻物或招领。";
    if (item.title.length < 2 || item.title.length > 40) errors.title = "物品名称需填写 2–40 个字。";
    if (!CATEGORIES.includes(item.category)) errors.category = "请选择物品类别。";
    if (item.place.length < 2 || item.place.length > 60) errors.place = "地点需填写 2–60 个字。";
    if (!validCalendarDate(item.date) || item.date > today) errors.date = "请选择不晚于今天的有效日期。";
    if (item.description.length < 10 || item.description.length > 500) errors.description = "描述需填写 10–500 个字。";
    Object.assign(errors, validateContacts(draft));
    return errors;
  }

  return Object.freeze({ normalizeDraft, validateContacts, validateDraft });
});
