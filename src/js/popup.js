const popup = Array.from(document.querySelectorAll(".popup"));
popup.forEach((pop) => {
  // const popupSum = pop.querySelector("summary");
  // if (popupSum.length === 0) return;

  pop.addEventListener("click", (e) => {
    pop.open = true;
    inject(e.currentTarget);
    pop.open = false;
    dismiss(pop);
  });
});

function dismiss(details) {
  document.addEventListener("click", ({ target }) => {
    if (!target.closest("summary")) {
      details.open = false;
    }
  });
}

function inject(popup) {
  const exercise = popup.closest("section:has(.controls)");
  const popupTextarea = exercise.querySelector(".popup textarea");
  if (!exercise) return;
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
  popupTextarea.focus();
}
