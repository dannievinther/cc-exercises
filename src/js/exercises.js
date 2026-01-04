import { prefix } from "./utils";

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

// Cache sections once - exclude SDA exercises (handled by sda-exercises.js)
const sections = document.querySelectorAll("section:not(.sda-exercise)");

// Storage key prefix for exercise data
const STORAGE_PREFIX = "ex:";

// Simple debounced save per key
const pendingSaves = new Map();
function debouncedSave(key, data, delay = 300) {
  if (pendingSaves.has(key)) {
    clearTimeout(pendingSaves.get(key));
  }
  pendingSaves.set(
    key,
    setTimeout(() => {
      if (data === null) {
        localStorage.removeItem(STORAGE_PREFIX + key);
      } else {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
      }
      pendingSaves.delete(key);
    }, delay)
  );
}

// Debounced CSS update to avoid excessive style recalculations
const pendingStyleUpdates = new Map();
function debouncedStyleUpdate(styleTag, css, delay = 16) {
  // ~1 frame
  const key = styleTag;
  if (pendingStyleUpdates.has(key)) {
    cancelAnimationFrame(pendingStyleUpdates.get(key));
  }
  pendingStyleUpdates.set(
    key,
    requestAnimationFrame(() => {
      styleTag.textContent = css;
      pendingStyleUpdates.delete(key);
    })
  );
}

// Get stored exercise data: { css?: string, boxes?: number }
function getStoredData(key) {
  const value = localStorage.getItem(STORAGE_PREFIX + key);
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

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
    resetDialog: section.querySelector(".reset-dialog"),
    resetBtns: section.querySelector(".reset-buttons"),
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
    resetDialog,
    resetBtns,
  } = getSectionElements(section);

  let startingCSS = textarea.textContent;
  const exerciseKey = section.dataset.exerciseKey;
  const startingBoxCount = boxContainer.children.length || 1;

  let boxCount = startingBoxCount;
  const maxBoxCount = 12;

  // Save combined data to localStorage
  const saveExerciseData = (css, boxes) => {
    const data = {};
    if (css && css !== startingCSS) data.css = css;
    if (boxes && boxes !== startingBoxCount) data.boxes = boxes;

    if (Object.keys(data).length === 0) {
      debouncedSave(exerciseKey, null); // Remove if back to defaults
    } else {
      debouncedSave(exerciseKey, data);
    }
  };

  function createBox(count) {
    const box = Object.assign(document.createElement("div"), {
      className: `box box-${count}`,
      textContent: `.box-${count}`,
    });
    return box;
  }

  function loadLocalStorageBoxes() {
    const stored = getStoredData(exerciseKey);
    const storedBoxes = stored?.boxes;

    if (storedBoxes && storedBoxes !== boxCount) {
      boxCount = storedBoxes;
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
    saveExerciseData(textarea.value, boxCount);
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
    const stored = getStoredData(exerciseKey);
    if (stored || textarea.value === "") {
      localStorage.removeItem(STORAGE_PREFIX + exerciseKey);
      if (stored?.boxes) {
        boxCount = startingBoxCount;
        const newBoxes = Array.from({ length: boxCount }, (_, index) =>
          createBox(index + 1)
        );
        boxContainer.replaceChildren(...newBoxes);
      }
      styleTag.textContent = "";
      textarea.value = startingCSS;
      textarea.focus();
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

    const stored = getStoredData(exerciseKey);
    if (stored?.css) {
      textarea.value = stored.css;
    }
    styleTag.textContent = prefix(textarea.value, exerciseKey);

    updateResetButtonState();
  }

  // Input handler - defined once, outside init() to prevent memory leaks
  textarea.addEventListener("input", (e) => {
    const value = e.target.value;

    // Debounced style update (every frame)
    debouncedStyleUpdate(styleTag, prefix(value, exerciseKey));

    // Debounced storage save (300ms) - combined with box count
    saveExerciseData(value, boxCount);

    updateResetButtonState();
  });

  init();

  output.addEventListener("dblclick", (_) => {
    output.hasAttribute("style") && output.removeAttribute("style");
  });

  // Open dialog when reset button is clicked
  reset?.addEventListener("click", () => {
    resetDialog?.show();
  });

  // Handle dialog close - check returnValue to determine action
  resetDialog?.addEventListener("close", () => {
    if (resetDialog.returnValue === "yes") {
      resetUI();
    } else {
      // Delay focus to prevent Enter key from inserting into textarea
      requestAnimationFrame(() => textarea.focus());
    }
  });

  // Roving tabindex for confirm buttons in dialog
  resetDialog?.addEventListener("keydown", (event) => {
    const buttons = resetDialog.querySelectorAll(".confirm-btn");
    const currentIndex = Array.from(buttons).indexOf(document.activeElement);

    if (currentIndex === -1) return;

    let newIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      newIndex = (currentIndex + 1) % buttons.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      newIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    } else {
      return;
    }

    buttons[currentIndex].setAttribute("tabindex", "-1");
    buttons[newIndex].setAttribute("tabindex", "0");
    buttons[newIndex].focus();
  });
});

// Global Escape key handler using event delegation (single listener instead of per-section)
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  const focusedElement = document.activeElement;
  const closestSection = focusedElement?.closest("section");
  if (!closestSection) return;

  const { textarea, reset, resetDialog } = getSectionElements(closestSection);

  // If dialog is open, let it handle Escape naturally
  if (resetDialog?.open) return;

  if (focusedElement === textarea) {
    if (!reset.disabled) {
      reset.focus();
    }
  } else if (focusedElement === reset) {
    textarea.focus();
  }
});
