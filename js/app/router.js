/* Hash 路由、搜索参数与详情返回入口；负责路径转换。 */
(function (root) {
  "use strict";

  const modules = root.ShiguangAppModules || (root.ShiguangAppModules = {});
  modules.createRouter = function (core) {
    function currentRoute() {
      const raw = location.hash.slice(1) || "/home";
      const [path, query = ""] = raw.split("?");
      const segments = path.split("/").filter(Boolean);
      return { page: segments[0] || "home", id: segments[1] || "", params: new URLSearchParams(query) };
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

    function searchPath(filters) {
      const params = new URLSearchParams();
      if (filters.keyword) params.set("keyword", core.clean(filters.keyword));
      if (filters.type && filters.type !== "all") params.set("type", filters.type);
      if (filters.category && filters.category !== "all") params.set("category", filters.category);
      if (filters.status && filters.status !== "all") params.set("status", filters.status);
      const query = params.toString();
      return `/search${query ? `?${query}` : ""}`;
    }

    return { currentRoute, detailPath, detailReturn, searchFilters, searchPath };
  };
})(window);
