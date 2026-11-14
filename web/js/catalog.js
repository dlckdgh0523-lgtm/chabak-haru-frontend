"use strict";

const search = document.querySelector("#ch-component-search");
if (search) {
  const items = [...document.querySelectorAll("[data-component-search]")];
  search.addEventListener("input", () => {
    const value = search.value.trim().toLowerCase();
    let count = 0;
    for (const item of items) {
      item.hidden = !item.dataset.componentSearch.toLowerCase().includes(value);
      if (!item.hidden) count++;
    }
    document.querySelector("#ch-component-count").textContent = count + "개";
  });
}
const track = document.querySelector("[data-rolling-viewport]");
if (track) {
  const move = delta => track.scrollBy({left: delta * 292, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
  document.querySelector("[data-rolling-prev]").addEventListener("click", () => move(-1));
  document.querySelector("[data-rolling-next]").addEventListener("click", () => move(1));
  track.addEventListener("keydown", event => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  });
}
