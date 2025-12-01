import { prefix } from "./utils";

// Debounce utility function
function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Batch DOM updates using requestAnimationFrame
let pendingUpdates = [];
let rafScheduled = false;

function scheduleUpdate(updateFn) {
  pendingUpdates.push(updateFn);
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(() => {
      const updates = pendingUpdates;
      pendingUpdates = [];
      rafScheduled = false;
      updates.forEach((fn) => fn());
    });
  }
}

// Cache sections once
const sections = document.querySelectorAll("section");

let exerciseData = JSON.parse(localStorage.getItem("exerciseData")) || {};

// Debounced localStorage save (300ms delay)
const debouncedSaveToStorage = debounce(() => {
  localStorage.setItem("exerciseData", JSON.stringify(exerciseData));
}, 300);

// Cache for DOM elements per section
const sectionCache = new WeakMap();

function getSectionElements(section) {
  if (sectionCache.has(section)) {
    return sectionCache.get(section);
  }

  const elements = {
    styleTag: section.querySelector(".editor > style"),
    textarea: section.querySelector(".editor .tabpanel-css textarea"),
    output: section.querySelector(".output"),
    boxContainer: section.querySelector(".container"),
    btnControlsContainer: section.querySelector(".controls"),
    addBtn: section.querySelector(".plus"),
    removeBtn: section.querySelector(".minus"),
    reset: section.querySelector(".reset"),
    confirming: section.querySelector(".button-group-confirm"),
    resetBtns: section.querySelector(".reset-buttons"),
    confirmButtons: section.querySelectorAll(".button-group-confirm button"),
  };

  sectionCache.set(section, elements);
  return elements;
}

sections.forEach((section) => {
  const {
    styleTag,
    textarea,
    output,
    boxContainer,
    btnControlsContainer,
    addBtn,
    removeBtn,
    reset,
    confirming,
    resetBtns,
    confirmButtons,
  } = getSectionElements(section);

  let startingCSS = textarea.textContent;
  const exerciseKey = section.dataset.exerciseKey;
  const boxKey = `box-${exerciseKey}`;
  const isExtra = section.dataset.extra;

  let boxCount = boxContainer.children.length || 1;
  const maxBoxCount = 12;

  const saveToLocalStorage = (key, value) => {
    exerciseData[key] = value;
    debouncedSaveToStorage();
  };

  function createBox(count) {
    const box = Object.assign(document.createElement("div"), {
      className: `box box-${count}`,
      textContent: `.box-${count}`,
    });
    return box;
  }

  function loadLocalStorageBoxes() {
    const localStorageBoxes = exerciseData[boxKey];

    if (localStorageBoxes && localStorageBoxes !== boxCount) {
      boxCount = localStorageBoxes;
      const newBoxes = Array.from({ length: boxCount }, (_, index) =>
        createBox(index + 1)
      );
      scheduleUpdate(() => {
        boxContainer.replaceChildren(...newBoxes);
        updateButtonState();
      });
    }
  }

  function addBox() {
    if (boxCount == maxBoxCount) return;
    const count = boxContainer.children.length;
    const newBox = createBox(count + 1);
    boxContainer.appendChild(newBox);

    boxCount++;
  }

  function removeBox() {
    if (boxCount == 1) return;

    const lastBox = boxContainer.lastElementChild;
    lastBox && boxContainer.removeChild(lastBox);

    boxCount--;
  }

  function modifyBoxes(action) {
    action();
    saveToLocalStorage(boxKey, boxCount);
    updateButtonState();
    // Dispatch event to notify tabs that boxes changed
    section.dispatchEvent(new CustomEvent("boxeschanged", { bubbles: true }));
  }

  btnControlsContainer?.addEventListener("click", (event) => {
    const { target } = event;

    if (target.classList.contains("plus")) {
      modifyBoxes(addBox);
    } else if (target.classList.contains("minus")) {
      modifyBoxes(removeBox);
    }
  });

  function setButtonDisabledState(button, isDisabled) {
    if (!button || button.disabled === isDisabled) return;
    button.disabled = isDisabled;
  }

  function updateButtonState() {
    setButtonDisabledState(removeBtn, boxCount == 1);
    setButtonDisabledState(addBtn, boxCount >= maxBoxCount);
  }

  function updateResetButtonState() {
    reset.disabled = textarea.value === startingCSS;
  }

  function resetUI() {
    if (exerciseData[exerciseKey] || textarea.value === "") {
      delete exerciseData[exerciseKey];
      if (exerciseData[`extra-${exerciseKey}`]) {
        delete exerciseData[`extra-${exerciseKey}`];
      }
      if (exerciseData[boxKey]) {
        delete exerciseData[boxKey];
        boxCount = boxContainer.children.length;
      }
      localStorage.setItem("exerciseData", JSON.stringify(exerciseData));
      styleTag.innerHTML = "";
      textarea.value = startingCSS;
      textarea.focus(); /* ensure that the UI updates */
      reset.disabled = true;
      output.getAttribute("style") && output.removeAttribute("style");
      init();
    } else {
      reset.disabled = false;
    }
  }

  function init() {
    if (boxCount > maxBoxCount) {
      boxCount = maxBoxCount;
      const newBoxes = Array.from({ length: maxBoxCount }, (_, index) =>
        createBox(index + 1)
      );
      boxContainer.replaceChildren(...newBoxes);
    }
    loadLocalStorageBoxes();
    updateButtonState();

    if (exerciseData[exerciseKey]) {
      textarea.value = exerciseData[exerciseKey];
    }
    styleTag.innerHTML = prefix(textarea.value, exerciseKey);

    if (exerciseData[`extra-${exerciseKey}`]) {
      document.documentElement.dataset.extra = "true";
    }

    updateResetButtonState();

    textarea.addEventListener("input", (e) => {
      styleTag.innerHTML = prefix(e.target.value, exerciseKey);
      saveToLocalStorage(exerciseKey, textarea.value);

      if (isExtra) {
        saveToLocalStorage(`extra-${exerciseKey}`, true);
      }

      if (textarea.value === "") {
        delete exerciseData[exerciseKey];
        delete exerciseData[`extra-${exerciseKey}`];
        localStorage.setItem("exerciseData", JSON.stringify(exerciseData));
      }

      updateResetButtonState();
    });
  }

  init();

  output.addEventListener("dblclick", (_) => {
    output.hasAttribute("style") && output.removeAttribute("style");
  });

  reset.addEventListener("click", (e) => {
    if (textarea.value === "") {
      resetUI();
    } else {
      reset.setAttribute("inert", "");
      resetBtns.classList.add("active");
      confirming.querySelector(":scope > :first-child").focus();
    }
  });

  confirming.addEventListener("click", ({ target }) => {
    let option = target.dataset.accept;
    if (option === "true") resetUI();
    if (option === "false") textarea.focus();
    resetBtns.classList.remove("active");
    reset.removeAttribute("inert");
  });

  // Arrow key navigation for confirm buttons using event delegation
  confirming.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const currentButton = event.target;
      const newButton = currentButton.nextElementSibling || confirmButtons[0];
      currentButton.setAttribute("tabindex", "-1");
      newButton.setAttribute("tabindex", "0");
      newButton.focus();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const currentButton = event.target;
      const newButton =
        currentButton.previousElementSibling ||
        confirmButtons[confirmButtons.length - 1];
      currentButton.setAttribute("tabindex", "-1");
      newButton.setAttribute("tabindex", "0");
      newButton.focus();
    }
  });
});

// Global Escape key handler using event delegation (single listener instead of per-section)
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  const focusedElement = document.activeElement;
  const closestSection = focusedElement?.closest("section");
  if (!closestSection) return;

  const { textarea, reset, confirmButtons } =
    getSectionElements(closestSection);

  if (focusedElement === textarea) {
    if (!reset.disabled) {
      reset.focus();
    } else if (reset.hasAttribute("inert")) {
      confirmButtons[0]?.focus();
    }
  } else if (
    focusedElement === reset ||
    focusedElement === confirmButtons[0] ||
    focusedElement === confirmButtons[1]
  ) {
    textarea.focus();
  }
});
