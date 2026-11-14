"use strict";

(() => {
  const current = document.currentScript;
  const defaultSource = new URL("../component-templates.html", current.src);
  const cache = new Map();

  async function loadTemplates(source = defaultSource) {
    const url = new URL(source, document.baseURI);
    if (!cache.has(url.href)) {
      const loading = fetch(url).then(response => {
        if (!response.ok) throw new Error("컴포넌트 템플릿을 불러올 수 없어요.");
        return response.text();
      }).then(html => {
        const sourceDocument = new DOMParser().parseFromString(html, "text/html");
        return new Map([...sourceDocument.querySelectorAll("template[data-component-name]")].flatMap(template => {
          const item = { template, url };
          return [[template.dataset.componentName, item], [template.id.slice(9), item]];
        }));
      }).catch(error => { cache.delete(url.href); throw error; });
      cache.set(url.href, loading);
    }
    return cache.get(url.href);
  }

  async function create(name, options = {}) {
    const catalog = await loadTemplates(options.source);
    const entry = catalog.get(name);
    if (!entry) throw new Error("컴포넌트가 없어요. " + name);
    const element = entry.template.content.firstElementChild.cloneNode(true);
    for (const img of element.querySelectorAll("img[src]")) img.src = new URL(img.getAttribute("src"), entry.url);
    const text = options.text || {};
    for (const layer of element.querySelectorAll("[data-figma-node]")) {
      const id = layer.dataset.figmaNode;
      if (Object.hasOwn(text, id) && !layer.firstElementChild) layer.textContent = String(text[id]);
    }
    return element;
  }

  window.ChabakComponents = Object.freeze({ create, loadTemplates });
})();
