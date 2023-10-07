const footerBtn = document.querySelector(".load-more");

// const notHome = window.location.pathname !== "/";

if (!document.querySelector("section[data-extra='true']")) {
  document.documentElement.dataset.extra = "true";
}

footerBtn?.addEventListener("click", (e) => {
  document.documentElement.dataset.extra = "true";
  document
    .querySelectorAll("section[data-extra='true']")[0]
    .scrollIntoView({ behavior: "smooth" });
});
