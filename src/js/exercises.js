import { prefix } from "./utils";

const sections = document.querySelectorAll("section");

let exerciseData = JSON.parse(localStorage.getItem("exerciseData")) || {};

sections.forEach((section) => {
  const styleTag = section.querySelector(".editor > style");
  const textarea = section.querySelector(".editor > textarea");
  const popup = section.querySelector(".popup");
  const output = section.querySelector(".output");
  let startingCSS = textarea.textContent;
  const exerciseKey = section.dataset.exerciseKey;
  const boxKey = `box-${exerciseKey}`;
  const isExtra = section.dataset.extra;

  const boxContainer = section.querySelector(".container");

  const btnControlsContainer = section.querySelector(".controls");
  const addBtn = section.querySelector(".plus");
  const removeBtn = section.querySelector(".minus");

  let boxCount = boxContainer.children.length || 1;
  const maxBoxCount = 12;
  const saveToLocalStorage = (key, value) => {
    exerciseData[key] = value;
    localStorage.setItem("exerciseData", JSON.stringify(exerciseData));
  };

  const reset = section.querySelector(".reset");
  const confirming = section.querySelector(".button-group-confirm");
  const resetBtns = section.querySelector(".reset-buttons");

  // function createBox(count) {
  //   const box = document.createElement("div");
  //   box.classList.add("box", `box-${count}`);
  //   box.textContent = `.box-${count}`;
  //   return box;
  // }
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
      localStorageBoxes == 1 && delete exerciseData[boxKey];
      boxCount = localStorageBoxes;
      const newBoxes = Array.from({ length: boxCount }, (_, index) =>
        createBox(index + 1)
      );
      boxContainer.replaceChildren(...newBoxes);
      updateButtonState();
    }
  }

  function addBox() {
    if (boxCount == maxBoxCount) return;
    const count = boxContainer.children.length;
    const newBox = createBox(count + 1);
    const fragment = document.createDocumentFragment();
    fragment.appendChild(newBox);
    boxContainer.appendChild(fragment); // Tilføjelse af fragment til DOM i én operation

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
      styleTag.innerHTML = null;
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

    styleTag.innerHTML = prefix(textarea.value, exerciseKey);

    if (exerciseData[exerciseKey]) {
      textarea.value = exerciseData[exerciseKey];
      styleTag.innerHTML = prefix(textarea.value, exerciseKey);
    }

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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const resetBtnGroup = section.querySelectorAll(
        ".button-group-confirm button"
      );
      const focusedElement = document.activeElement;

      const closestSection = focusedElement.closest("section");
      const resetButton = closestSection.querySelector(".reset");
      const btnGroup = closestSection.querySelectorAll(
        ".button-group-confirm button"
      );
      if (focusedElement === textarea) {
        if (!resetButton.disabled) {
          resetButton.focus();
        }
        if (resetButton.inert) {
          btnGroup[0].focus();
        }
      }
      if (
        focusedElement === reset ||
        focusedElement === resetBtnGroup[0] ||
        focusedElement === resetBtnGroup[1]
      ) {
        const closestSection = focusedElement.closest("section");
        const textarea = closestSection.querySelector("textarea");
        textarea.focus();
      }
    }
  });
});

// const keySequence = [];
// let konamiString = "";
// const konamiCode = [
//   "ArrowUp",
//   "ArrowUp",
//   "ArrowDown",
//   "ArrowDown",
//   "ArrowLeft",
//   "ArrowRight",
//   "ArrowLeft",
//   "ArrowRight",
//   "b",
//   "a",
// ];

// document.addEventListener("keyup", function (e) {
//   keySequence.push(e.key);
//   keySequence.splice(
//     -konamiCode.length - 1,
//     keySequence.length - konamiCode.length
//   );
//   konamiString = konamiCode.join("");

//   if (
//     keySequence.join("").includes(konamiString) &&
//     !document.documentElement.dataset.extra
//   ) {
//     document.documentElement.dataset.extra = "true";

//     document
//       .querySelectorAll("section[data-extra='true']")[0]
//       .scrollIntoView({ behavior: "smooth" });
//   }
// });
