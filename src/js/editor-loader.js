import { displayCode, installLineNumbers, lineCount, lineNumbersMarkup } from './editor-content.js';

const scripts = new Map();
let loading;
let coreLoading;
let started = false;
let visibilityObserver;
let resizeObserver;
const resizeQueue = new Set();
let resizeFrame = 0;

function script(src, ready) {
  if (ready()) return Promise.resolve();
  if (scripts.has(src)) return scripts.get(src);
  const promise = new Promise((resolve, reject) => {
    const node = document.createElement('script');
    node.src = src;
    node.onload = () => ready() ? resolve() : reject(new Error(`Editor script did not initialize: ${src}`));
    node.onerror = () => { node.remove(); reject(new Error(`Could not load ${src}`)); };
    document.head.append(node);
  }).catch((error) => { scripts.delete(src); throw error; });
  scripts.set(src, promise);
  return promise;
}

function loadCore() {
  if (!coreLoading) {
    window.Prism ??= { manual: true };
    coreLoading = script('/script/prism-custom.min.js', () => !!window.Prism.highlightElement)
      .then(() => installLineNumbers(window.Prism))
      .catch((error) => { coreLoading = null; throw error; });
  }
  return coreLoading;
}

function renderSurface(textarea) {
  const code = textarea.parentElement?.matches('[data-editor-shell]')
    ? textarea.previousElementSibling?.querySelector('code') : null;
  if (!code || !textarea.isConnected) return;
  const value = displayCode(textarea.value);
  const Prism = window.Prism?.highlightElement && window.Prism.__lineNumbers ? window.Prism : null;
  if (code.textContent === value && code.querySelector('.line-numbers-rows')?.children.length === lineCount(value) && (!code.dataset.editorPlain || !Prism)) return;
  code.textContent = value;
  if (Prism) {
    Prism.highlightElement(code);
    delete code.dataset.editorPlain;
  } else {
    // Only needed for typing before download completes or after a network error.
    // Retain the same shell, gutter and padding rather than exposing a bare input.
    code.insertAdjacentHTML('beforeend', lineNumbersMarkup(value));
    code.dataset.editorPlain = 'true';
  }
}

function load() {
  if (!loading) loading = (async () => {
    // The visible, pre-rendered surface only needs core. Editing extensions can
    // finish later, and Bliss need not delay either highlighting or restoration.
    await Promise.all([
      loadCore(),
      script('/script/bliss-minimal.js', () => !!window.Bliss),
    ]);
    await script('/script/prism-live.js', () => !!window.Prism.Live);
    await script('/script/prism-live-markup.js', () => !!window.Prism.Live.languages.markup);
    await script('/script/prism-live-css.js', () => !!window.Prism.Live.languages.css);
  })().catch((error) => { loading = null; throw error; });
  return loading;
}

function initialize(textarea) {
  if (!textarea.isConnected || textarea.closest('.is-hidden')) return;
  const Live = window.Prism?.Live;
  if (!Live) return;
  let instance = Live.all.get(textarea);
  if (!instance) {
    instance = new Live(textarea);
    instance.onDestroy = () => {
      resizeObserver?.unobserve(instance.wrapper);
      visibilityObserver?.unobserve(instance.wrapper);
      resizeQueue.delete(instance);
    };
    resizeObserver?.observe(instance.wrapper);
    visibilityObserver?.unobserve(textarea);
    visibilityObserver?.observe(instance.wrapper);
  }
  instance.syncStyles();
  instance.update();
  instance.syncScroll();
}

export function activateEditor(textarea) {
  if (!textarea?.matches('textarea.prism-live') || textarea.closest('.is-hidden')) return;
  // Synchronous when ready: keyboard shortcuts and tab changes see current DOM.
  if (window.Prism?.Live?.languages.css) initialize(textarea);
  else {
    loadCore().then(() => renderSurface(textarea)).catch(() => {});
    load().then(() => initialize(textarea)).catch(() => {
      // Static content stays styled; subsequent interaction retries enhancement.
    });
  }
}

function scheduleResize(instance) {
  resizeQueue.add(instance);
  if (!resizeFrame) resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    for (const editor of resizeQueue) {
      if (editor.source.isConnected && !editor.source.closest('.is-hidden') && editor.wrapper.getClientRects().length) {
        editor.syncStyles();
        editor.syncScroll();
      }
    }
    resizeQueue.clear();
  });
}

export function startEditors() {
  if (started) return;
  started = true;
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const instance = window.Prism?.Live?.all.get(entry.target);
      if (instance) scheduleResize(instance);
    }
  });
  if ('IntersectionObserver' in window) visibilityObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) {
      if (entry.target instanceof HTMLTextAreaElement) activateEditor(entry.target);
      else {
        const instance = window.Prism?.Live?.all.get(entry.target);
        if (instance) scheduleResize(instance);
      }
    }
  }, { rootMargin: '300px' });
  document.querySelectorAll('textarea.prism-live').forEach((textarea) => {
    if (visibilityObserver) visibilityObserver.observe(textarea);
    else if (!textarea.closest('.is-hidden')) activateEditor(textarea);
  });
  for (const type of ['focusin', 'pointerdown', 'input']) {
    document.addEventListener(type, (event) => {
      const textarea = event.target;
      if (!(textarea instanceof HTMLTextAreaElement)) return;
      if (type === 'input' && window.Prism?.Live?.all.get(textarea)) return;
      if (type === 'input') renderSurface(textarea);
      activateEditor(textarea);
    }, { capture: true });
  }
  document.addEventListener('editor-refresh', ({ target }) => {
    if (!(target instanceof HTMLTextAreaElement) || target.closest('.is-hidden') || window.Prism?.Live?.all.get(target)) return;
    const rect = target.getBoundingClientRect();
    if (rect.bottom >= -300 && rect.top <= innerHeight + 300) activateEditor(target);
  }, { capture: true });
  // Removing a section must release observers, pending frames and instance handlers.
  new MutationObserver((records) => {
    for (const record of records) for (const node of record.removedNodes) {
      if (!(node instanceof Element) || node.isConnected) continue;
      const sources = node.matches('.prism-live-source') ? [node] : node.querySelectorAll('.prism-live-source');
      for (const source of sources) {
        const instance = window.Prism?.Live?.all.get(source);
        if (!instance || source.isConnected) continue;
        resizeObserver.unobserve(instance.wrapper);
        visibilityObserver?.unobserve(instance.wrapper);
        resizeQueue.delete(instance);
        instance.destroy();
      }
      if (node.matches('textarea.prism-live')) visibilityObserver?.unobserve(node);
      for (const textarea of node.querySelectorAll('textarea.prism-live')) visibilityObserver?.unobserve(textarea);
    }
  }).observe(document.body, { childList: true, subtree: true });
  // Font loading can change metrics without changing wrapper dimensions.
  document.fonts.ready.then(() => {
    document.querySelectorAll('.prism-live-source').forEach((source) => {
      const instance = window.Prism?.Live?.all.get(source);
      if (instance) scheduleResize(instance);
    });
  });
}
