import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayCode, lineCount, lineNumbersMarkup } from '../src/js/editor-content.js';

for (const [text,count] of [['',1],['one',1],['one\ntwo',2],['one\ntwo\n',3],['\n\n',3],['one\r\ntwo',2],['one\rtwo',2]]) {
  test(`one number per logical line: ${JSON.stringify(text)}`,()=>{
    assert.equal(lineCount(text),count);
    assert.equal(lineNumbersMarkup(text).match(/<span><\/span>/g).length,count);
    assert.equal(lineCount(displayCode(text)),count);
  });
}
test('the display-only sentinel retains the final empty line without changing source',()=>{
  assert.equal(displayCode('a\n'),'a\n\u200b');
  assert.equal(displayCode('a'),'a');
  assert.equal(displayCode(''),'');
});
