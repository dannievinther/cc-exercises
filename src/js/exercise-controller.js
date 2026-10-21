import { readExercise, readStorage, saveStorage, storageKey } from './exercise-storage.js';
import { refreshExerciseHTML } from './exercise-html.js';

export function initExercises(selector, transform, sda = false) {
  document.querySelectorAll(selector).forEach((section) => {
    const textarea = section.querySelector('.tabpanel-css textarea');
    const style = section.querySelector('.editor > style.style');
    const output = section.querySelector(sda ? '.sda-result' : '.output');
    const container = output?.querySelector('.container');
    const reset = section.querySelector('.reset');
    const dialog = section.querySelector('.reset-dialog');
    if (!textarea || !style || !reset || !dialog) return;
    const initialCSS = textarea.defaultValue;
    const initialBoxes = container?.children.length ?? 1;
    const canChangeBoxes = !sda && !!container && section.querySelector('.tabpanel-html textarea')?.dataset.hasCustomHtml !== 'true';
    const key = storageKey(section.dataset.exerciseKey, sda);
    let frame = 0;

    function render() {
      frame = 0;
      style.textContent = transform(textarea.value, section.dataset.exerciseKey);
    }
    function scheduleRender() {
      if (!frame) frame = requestAnimationFrame(render);
    }
    function boxCount() { return container?.children.length ?? initialBoxes; }
    function replaceBoxes(count) {
      container.replaceChildren(...Array.from({ length: count }, (_, i) =>
        Object.assign(document.createElement('div'), {
          className: `box box-${i + 1}`, textContent: `.box-${i + 1}`,
        })));
    }
    function updateButtons() {
      const count = boxCount();
      reset.disabled = textarea.value === initialCSS && count === initialBoxes;
      const plus = section.querySelector('.plus');
      const minus = section.querySelector('.minus');
      if (plus) plus.disabled = count >= 12;
      if (minus) minus.disabled = count <= 1;
    }
    function save() {
      if (sda) {
        saveStorage(key, textarea.value === initialCSS ? null : textarea.value);
      } else {
        const data = {};
        // Empty CSS is a deliberate edit and must survive navigation.
        if (textarea.value !== initialCSS) data.css = textarea.value;
        if (canChangeBoxes && boxCount() !== initialBoxes) data.boxes = boxCount();
        saveStorage(key, Object.keys(data).length ? JSON.stringify(data) : null);
      }
      updateButtons();
    }

    const stored = sda ? { css: readStorage(key) } : readExercise(key);
    if (typeof stored.css === 'string') textarea.value = stored.css;
    if (canChangeBoxes && stored.boxes && stored.boxes !== initialBoxes) replaceBoxes(stored.boxes);
    render();
    updateButtons();
    refreshExerciseHTML(section);
    textarea.dispatchEvent(new CustomEvent('editor-refresh'));

    textarea.addEventListener('input', () => { scheduleRender(); save(); });
    section.querySelector('.controls')?.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('button') : null;
      if (!button || button.disabled || !canChangeBoxes) return;
      const count = boxCount();
      if (button.matches('.plus') && count < 12) {
        const box = Object.assign(document.createElement('div'), {
          className: `box box-${count + 1}`, textContent: `.box-${count + 1}`,
        });
        container.append(box);
      } else if (button.matches('.minus') && count > 1) container.lastElementChild.remove();
      else return;
      save();
      refreshExerciseHTML(section);
      section.dispatchEvent(new CustomEvent('boxeschanged', { bubbles: true }));
    });
    output?.addEventListener('dblclick', () => output.removeAttribute('style'));
    reset.addEventListener('click', () => {
      dialog.returnValue = '';
      dialog.show();
    });
    dialog.addEventListener('close', () => {
      if (dialog.returnValue === 'yes') {
        cancelAnimationFrame(frame);
        frame = 0;
        saveStorage(key, null, true);
        textarea.value = initialCSS;
        if (canChangeBoxes && boxCount() !== initialBoxes) replaceBoxes(initialBoxes);
        output?.removeAttribute('style');
        render();
        updateButtons();
        refreshExerciseHTML(section);
        textarea.dispatchEvent(new CustomEvent('editor-refresh'));
      }
      requestAnimationFrame(() => textarea.focus());
    });
    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dialog.close('no');
        return;
      }
      const buttons = Array.from(dialog.querySelectorAll('.confirm-btn'));
      const current = buttons.indexOf(document.activeElement);
      const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (current < 0 || !direction) return;
      event.preventDefault();
      const next = (current + direction + buttons.length) % buttons.length;
      buttons[current].tabIndex = -1;
      buttons[next].tabIndex = 0;
      buttons[next].focus();
    });
  });
}

// One handler for both exercise types; do not interfere with an open dialog.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const focused = document.activeElement;
  const section = focused?.closest('section[data-exercise-key]');
  if (!section || section.querySelector('.reset-dialog')?.open) return;
  const textarea = section.querySelector('.tabpanel-css textarea');
  const reset = section.querySelector('.reset');
  if (focused === textarea && reset && !reset.disabled) reset.focus();
  else if (focused === reset) textarea?.focus();
});
