/* 应用启动入口：组装状态、路由、界面与页面，并绑定事件和首次渲染。 */
(function () {
  "use strict";

  const core = window.ShiguangCore;
  const modules = window.ShiguangAppModules;
  const app = document.querySelector("#app");
  const store = modules.createStore(core);
  const router = modules.createRouter(core);
  const ui = modules.createUI(core, store, router);
  const context = { core, store, router, ui };
  const { currentRoute, detailReturn } = router;

  const renderHome = modules.pages.home(context);
  const renderSearch = modules.pages.search(context);
  const renderPublish = modules.pages.publish(context);
  const renderDetail = modules.pages.detail(context);
  const renderSuccess = modules.pages.success({ ...context, renderDetail });
  const renderMine = modules.pages.mine(context);

  function navigate(path) {
    if (location.hash === `#${path}`) render();
    else location.hash = path;
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
    const page = ["search", "publish", "detail", "success", "mine"].includes(route.page) ? route.page : "home";
    app.className = `main-content page-${page}`;
    app.innerHTML = content;
    const navPage = route.page === "detail" ? detailReturn(route.params).path.split("?")[0].slice(1) : route.page === "success" ? "publish" : route.page;
    updateNavigation(navPage);
    const pageTitles = { search: "发现信息", publish: "发布信息", detail: "信息详情", success: "发布成功", mine: "我的发布" };
    const title = Object.prototype.hasOwnProperty.call(pageTitles, route.page) ? pageTitles[route.page] : "首页";
    document.title = `${title}｜拾光·校园失物招领`;
  }

  modules.bindEvents({ core, store, router, ui, navigate, render });

  window.addEventListener("hashchange", () => {
    render();
    window.scrollTo(0, 0);
    if (typeof app.focus === "function") app.focus({ preventScroll: true });
  });
  render();
})();
