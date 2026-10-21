import { test, expect } from '@playwright/test';

const editor = page => page.locator('.tabpanel-css textarea').first();
async function ready(page, path = '/grid/1/') {
  await page.goto(path);
  await expect(editor(page)).toHaveClass(/prism-live-source/);
}
async function select(source, start, end = start, direction = 'forward') {
  await source.focus();
  await source.evaluate((el, args) => el.setSelectionRange(...args), [start, end, direction]);
}
async function selection(source) {
  return source.evaluate(el => [el.selectionStart, el.selectionEnd, el.selectionDirection]);
}

const cases = [
  ['move up', 'aaa\nbb\ncccc', 5, 5, 'Alt+ArrowUp', 'bb\naaa\ncccc', 1, 1],
  ['move down', 'aaa\nbb\ncccc', 5, 5, 'Alt+ArrowDown', 'aaa\ncccc\nbb', 10, 10],
  ['copy up', 'aaa\nbb\ncccc', 5, 5, 'Alt+Shift+ArrowUp', 'aaa\nbb\nbb\ncccc', 5, 5],
  ['copy down', 'aaa\nbb\ncccc', 5, 5, 'Alt+Shift+ArrowDown', 'aaa\nbb\nbb\ncccc', 8, 8],
  ['move selected lines', 'a\nbb\nccc\ndddd', 3, 7, 'Alt+ArrowDown', 'a\ndddd\nbb\nccc', 8, 12],
  ['copy selected lines', 'a\nbb\nccc\ndddd', 3, 7, 'Alt+Shift+ArrowDown', 'a\nbb\nccc\nbb\nccc\ndddd', 10, 14],
  ['selection excludes next line at column zero', 'a\nbb\nccc', 2, 5, 'Alt+ArrowUp', 'bb\na\nccc', 0, 3],
  ['copy selection ending at column zero', 'a\nbb\nccc', 2, 5, 'Alt+Shift+ArrowDown', 'a\nbb\nbb\nccc', 5, 8],
  ['first line boundary', 'a\nb', 0, 0, 'Alt+ArrowUp', 'a\nb', 0, 0],
  ['last line boundary', 'a\nb', 3, 3, 'Alt+ArrowDown', 'a\nb', 3, 3],
  ['empty line', 'aa\n\nbb', 3, 3, 'Alt+ArrowUp', '\naa\nbb', 0, 0],
  ['trailing empty line', 'aa\n', 3, 3, 'Alt+ArrowUp', '\naa', 0, 0],
  ['copy trailing empty line', 'aa\n', 3, 3, 'Alt+Shift+ArrowDown', 'aa\n\n', 4, 4],
  ['empty document', '', 0, 0, 'Alt+Shift+ArrowDown', '\n', 1, 1],
  ['copy final line without newline', 'a\nbb', 3, 3, 'Alt+Shift+ArrowDown', 'a\nbb\nbb', 6, 6],
  ['unicode and indentation', 'a\n  æ😀\nz', 7, 7, 'Alt+ArrowUp', '  æ😀\na\nz', 5, 5],
];

test('Alt/Option line shortcuts preserve text and caret across boundaries', async ({ page }) => {
  await ready(page);
  const source = editor(page);
  for (const [name, initial, start, end, key, result, resultStart, resultEnd] of cases) {
    await test.step(name, async () => {
      await source.fill(initial);
      await select(source, start, end);
      await source.press(key);
      await expect(source).toHaveValue(result);
      expect((await selection(source)).slice(0, 2)).toEqual([resultStart, resultEnd]);
    });
  }
});

test('backwards selections remain backwards and repeated moves follow the same block', async ({ page }) => {
  await ready(page);
  const source = editor(page);
  await source.fill('a\nbb\nccc\ndddd');
  await select(source, 3, 7, 'backward');
  await source.press('Alt+ArrowUp');
  expect(await selection(source)).toEqual([1, 5, 'backward']);
  await source.press('Alt+ArrowDown');
  await expect(source).toHaveValue('a\nbb\nccc\ndddd');
  expect(await selection(source)).toEqual([3, 7, 'backward']);
});

for (const key of ['Alt+ArrowUp', 'Alt+ArrowDown', 'Alt+Shift+ArrowUp', 'Alt+Shift+ArrowDown']) {
  test(`${key} supports native undo/redo, highlighting and storage`, async ({ page }) => {
    const initial = '.container {\n  display: grid;\n  gap: 7px;\n}';
    // Start from a saved document, without a preceding synthetic fill edit.
    // WebKit groups fill() and insertText into one native undo transaction.
    await page.addInitScript(css => {
      if (!localStorage.getItem('seeded-lines')) {
        localStorage.setItem('ex:grid-01', JSON.stringify({ css }));
        localStorage.setItem('seeded-lines', 'yes');
      }
    }, initial);
    await ready(page);
    const source = editor(page);
    await select(source, initial.indexOf('gap'));
    await source.press(key);
    const changed = await source.inputValue();
    expect(changed).not.toBe(initial);
    await expect(page.locator('.tabpanel-css pre code')).toHaveText(changed);
    const mac = await page.evaluate(() => navigator.platform.startsWith('Mac'));
    await source.press(mac ? 'Meta+z' : 'Control+z');
    await expect(source).toHaveValue(initial);
    await source.press(mac ? 'Meta+Shift+z' : 'Control+Shift+z');
    await expect(source).toHaveValue(changed);
    await page.reload();
    await expect(source).toHaveValue(changed);
  });
}

test('IME, disabled editors and additional modifiers do not invoke line shortcuts', async ({ page }) => {
  await ready(page);
  const source = editor(page);
  await source.fill('aaa\nbbb');
  for (const flags of [{ isComposing: true }, { ctrlKey: true }, { metaKey: true }]) {
    await select(source, 5);
    const consumed = await source.evaluate((el, flags) => !el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true, cancelable: true, ...flags })), flags);
    expect(consumed).toBe(false);
    await expect(source).toHaveValue('aaa\nbbb');
  }
  await source.evaluate(el => {
    el.disabled = true;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true, cancelable: true }));
    el.disabled = false;
  });
  await expect(source).toHaveValue('aaa\nbbb');
});

test('textarea fallback updates highlighting and saves the line edit once', async ({ page }) => {
  await ready(page);
  const source = editor(page);
  await source.fill('a\nb');
  await select(source, 0);
  await page.evaluate(() => { document.execCommand = () => false; });
  await source.press('Alt+Shift+ArrowDown');
  await expect(source).toHaveValue('a\na\nb');
  await expect(page.locator('.tabpanel-css pre code')).toHaveText('a\na\nb');
  await page.reload();
  await expect(source).toHaveValue('a\na\nb');
});

for (const [platform, primary] of [['MacIntel', 'Meta'], ['Win32', 'Control']]) {
  test(`insert lines above/below with indentation and selections: ${platform}`, async ({ page }) => {
    await page.addInitScript(platform => Object.defineProperty(navigator, 'platform', { value: platform }), platform);
    await ready(page);
    const source = editor(page);
    const rows = [
      ['aaa\n  bb\ncccc', 6, 6, false, 'aaa\n  bb\n  \ncccc', 11],
      ['aaa\n  bb\ncccc', 6, 6, true, 'aaa\n  \n  bb\ncccc', 6],
      ['{\n}', 0, 0, false, '{\n\t\n}', 3],
      ['{\n}', 0, 0, true, '\n{\n}', 0],
      ['', 0, 0, false, '\n', 1],
      ['', 0, 0, true, '\n', 0],
      ['a\n', 2, 2, false, 'a\n\n', 3],
      ['a\n', 2, 2, true, 'a\n\n', 2],
      ['\t', 1, 1, false, '\t\n\t', 3],
      ['\t', 1, 1, true, '\t\n\t', 1],
      ['a\nbb\nc', 0, 4, false, 'a\nbb\n\nc', 5],
    ];
    for (const [initial, start, end, above, result, caret] of rows) {
      await source.fill(initial);
      await select(source, start, end);
      await source.press(`${primary}+${above ? 'Shift+' : ''}Enter`);
      await expect(source).toHaveValue(result);
      expect((await selection(source)).slice(0, 2)).toEqual([caret, caret]);
    }
    await source.fill('a\nbb\nc');
    await select(source, 0, 4, 'backward');
    await source.press(`${primary}+Enter`);
    await expect(source).toHaveValue('a\n\nbb\nc');
  });

  test(`Danish Shift+7 toggles CSS comments without changing the selection: ${platform}`, async ({ page }) => {
    await page.addInitScript(platform => Object.defineProperty(navigator, 'platform', { value: platform }), platform);
    await ready(page);
    const source = editor(page);
    for (const [initial, start, end] of [
      ['.container {\n  gap: 7px;\n}', 17, 17],
      ['gap: 7px;', 0, 9],
      ['gap: 7px;\ndisplay: grid;', 0, 23],
      ['', 0, 0],
    ]) {
      await source.fill(initial);
      await select(source, start, end);
      await source.press(`${primary}+Shift+Digit7`);
      expect(await source.inputValue()).toContain('/*');
      await source.press(`${primary}+Shift+Digit7`);
      await expect(source).toHaveValue(initial);
      expect((await selection(source)).slice(0, 2)).toEqual([start, end]);
    }
    // Actual Danish layout event: Shift+7 reports '/' rather than US '&'.
    await source.fill('gap: 7px;');
    await select(source, 4);
    const consumed = await source.evaluate((el, primary) => !el.dispatchEvent(new KeyboardEvent('keydown', {
      key: '/', code: 'Digit7', shiftKey: true, metaKey: primary === 'Meta', ctrlKey: primary === 'Control', bubbles: true, cancelable: true,
    })), primary);
    expect(consumed).toBe(true);
    await expect(source).toHaveValue('/*gap: 7px;*/');
  });
}

for (const shortcut of ['Enter', 'Shift+Enter', 'Shift+Digit7']) {
  test(`new shortcut ${shortcut} keeps native undo/redo and saves`, async ({ page }) => {
    const initial = '.container {\n  gap: 7px;\n}';
    await page.addInitScript(css => {
      if (!localStorage.getItem('seeded-new-shortcuts')) {
        localStorage.setItem('ex:grid-01', JSON.stringify({ css }));
        localStorage.setItem('seeded-new-shortcuts', 'yes');
      }
    }, initial);
    await ready(page);
    const source = editor(page);
    await select(source, initial.indexOf('gap'));
    const primary = await page.evaluate(() => navigator.platform.startsWith('Mac') ? 'Meta' : 'Control');
    await source.press(`${primary}+${shortcut}`);
    const changed = await source.inputValue();
    expect(changed).not.toBe(initial);
    await expect(page.locator('.tabpanel-css pre code')).toHaveText(changed);
    await source.press(`${primary}+z`);
    await expect(source).toHaveValue(initial);
    await source.press(`${primary}+Shift+z`);
    await expect(source).toHaveValue(changed);
    await page.reload();
    await expect(source).toHaveValue(changed);
  });
}

test('rapid comment toggles use current text while worker highlighting is pending', async ({ page }) => {
  await ready(page);
  const source = editor(page);
  const initial = '.container {\n' + '--property: 1px;\n'.repeat(1500) + '}';
  await source.fill(initial);
  await select(source, 0, initial.length, 'backward');
  await source.evaluate(el => {
    const mac = navigator.platform.startsWith('Mac');
    for (let i = 0; i < 2; i++) el.dispatchEvent(new KeyboardEvent('keydown', {
      key: '/', code: 'Digit7', shiftKey: true, metaKey: mac, ctrlKey: !mac, bubbles: true, cancelable: true,
    }));
  });
  await expect(source).toHaveValue(initial);
  expect(await selection(source)).toEqual([0, initial.length, 'backward']);
});
