// Read the live boxes even if the HTML tab has never been opened.
export function exerciseHTML(section) {
  const textarea = section.querySelector('.tabpanel-html textarea');
  if (!textarea) return '';
  if (textarea.dataset.hasCustomHtml === 'true') return textarea.value;
  const container = section.querySelector('.output .container');
  if (!container) return textarea.value;
  const boxes = Array.from(container.children)
    .filter((el) => el.matches('.box, [class*="box-"]'));
  return `<div class="container">\n\t${boxes.map((_, i) =>
    `<div class="box box-${i + 1}">.box-${i + 1}</div>`).join('\n\t')}\n</div>`;
}

export function refreshExerciseHTML(section) {
  const textarea = section.querySelector('.tabpanel-html textarea');
  if (!textarea) return;
  const html = exerciseHTML(section);
  if (textarea.value !== html) {
    textarea.value = html;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
