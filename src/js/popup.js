const popup = Array.from(document.querySelectorAll(".popup"));
popup.forEach((pop) => {
  pop.addEventListener("click", (e) => {
    inject(pop);
    dismiss(pop);
    pop.style.pointerEvents = "none";
  });
});

function dismiss(details) {
  document.addEventListener("click", ({ target }) => {
    if (!target.closest("summary")) {
      details.open = false;
      details.style.pointerEvents = "auto";
    }
  });
}

function inject(popup) {
  popup.open = true;
  const exercise = popup.closest("section:has(.controls)");
  if (!exercise) return;
  const popupTextarea = exercise.querySelector(".popup textarea");
  const exerciseKey = exercise.dataset.exerciseKey;
  const boxes = localStorage.getItem(`box-${exerciseKey}`);
  if (!boxes) return;
  const boxCount = Array.from(
    { length: boxes },
    (_, index) => `<div class="box box-${index + 1}">.box-${index + 1}</div>`
  ).join("\n\t");
  const customContent = `<div class="container">
  ${boxCount}
</div>`;
  popupTextarea.value = customContent;
  popupTextarea.focus();
  popup.open = false;
}
