// SDA (Scroll-Driven Animations) exercises functionality
// Uses same pattern as exercises.js but with SDA-specific CSS prefixing

import { prefix } from "./utils";

// Debounce utility function
function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Use separate localStorage namespace for iframe embeds
const isIframe = document.body.hasAttribute("data-iframe");
const storageKey = isIframe ? "exerciseData-iframe" : "exerciseData";

let exerciseData = JSON.parse(localStorage.getItem(storageKey)) || {};

// Debounced localStorage save (300ms delay)
const debouncedSaveToStorage = debounce(() => {
  localStorage.setItem(storageKey, JSON.stringify(exerciseData));
}, 300);

const saveToLocalStorage = (key, value) => {
  exerciseData[key] = value;
  debouncedSaveToStorage();
};

const sdaSections = document.querySelectorAll("section.sda-exercise");

sdaSections.forEach((section) => {
  const styleTag = section.querySelector(".editor > style.style");
  const textarea = section.querySelector(".editor .tabpanel-css textarea");
  const resetBtn = section.querySelector(".reset");
  const resetDialog = section.querySelector(".reset-dialog");
  const exerciseKey = section.dataset.exerciseKey;

  if (!textarea || !styleTag) return;

  const startingCSS = textarea.textContent;

  // Custom prefix for SDA - wraps CSS in scoped selector like regular exercises
  // But keeps @keyframes at root level with scoped names
  function sdaPrefix(css, key) {
    // Collect all keyframe names used in this CSS
    const keyframeNames = new Set();
    const keyframeRegex = /@keyframes\s+([\w-]+)\s*\{/g;
    let match;
    while ((match = keyframeRegex.exec(css)) !== null) {
      keyframeNames.add(match[1]);
    }

    // Extract @keyframes blocks (they must remain at root level)
    // Uses brace counting to handle nested braces properly
    const keyframesBlocks = [];
    let cssWithoutKeyframes = "";
    let i = 0;

    while (i < css.length) {
      // Check for @keyframes
      if (css.slice(i).match(/^@keyframes\s+[\w-]+\s*\{/)) {
        const match = css.slice(i).match(/^@keyframes\s+([\w-]+)\s*\{/);
        const keyframeName = match[1];
        let keyframeStart = i;
        i += match[0].length;
        let braceCount = 1;

        // Find matching closing brace
        while (i < css.length && braceCount > 0) {
          if (css[i] === "{") braceCount++;
          else if (css[i] === "}") braceCount--;
          i++;
        }

        // Scope the keyframe name to this exercise
        let keyframeBlock = css.slice(keyframeStart, i);
        keyframeBlock = keyframeBlock.replace(
          `@keyframes ${keyframeName}`,
          `@keyframes ${key}--${keyframeName}`
        );
        keyframesBlocks.push(keyframeBlock);
      } else {
        cssWithoutKeyframes += css[i];
        i++;
      }
    }

    // Replace animation references to use scoped keyframe names
    let scopedCSS = cssWithoutKeyframes;
    keyframeNames.forEach((name) => {
      // Match animation: name or animation-name: name
      const animationRegex = new RegExp(`\\b${name}\\b`, "g");
      scopedCSS = scopedCSS.replace(animationRegex, `${key}--${name}`);
    });

    // Wrap in scoped selector (like regular exercises, but with .sda-result)
    const wrappedCSS = `[data-exercise-key="${key}"] .sda-result {
    ${scopedCSS}
}`;

    // Append keyframes at the end (at root level, but with scoped names)
    return wrappedCSS + "\n" + keyframesBlocks.join("\n");
  }

  // Update reset button state
  function updateResetState() {
    if (resetBtn) {
      resetBtn.disabled = textarea.value === startingCSS;
    }
  }

  // Reset UI
  function resetUI() {
    if (exerciseData[exerciseKey]) {
      delete exerciseData[exerciseKey];
      localStorage.setItem("exerciseData", JSON.stringify(exerciseData));
    }
    styleTag.innerHTML = "";
    textarea.value = startingCSS;
    textarea.focus();
    resetBtn.disabled = true;
    init();
  }

  // Initialize
  function init() {
    // Load saved CSS from localStorage
    if (exerciseData[exerciseKey]) {
      textarea.value = exerciseData[exerciseKey];
    }
    styleTag.innerHTML = sdaPrefix(textarea.value, exerciseKey);
    updateResetState();
  }

  // Listen for input
  textarea.addEventListener("input", (e) => {
    styleTag.innerHTML = sdaPrefix(e.target.value, exerciseKey);
    saveToLocalStorage(exerciseKey, textarea.value);

    if (textarea.value === "" || textarea.value === startingCSS) {
      delete exerciseData[exerciseKey];
      localStorage.setItem("exerciseData", JSON.stringify(exerciseData));
    }

    updateResetState();
  });

  init();

  // Handle reset dialog
  resetBtn?.addEventListener("click", () => {
    resetDialog?.show();
  });

  resetDialog?.addEventListener("close", () => {
    if (resetDialog.returnValue === "yes") {
      resetUI();
    } else {
      requestAnimationFrame(() => textarea.focus());
    }
  });

  // Roving tabindex for dialog buttons
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
