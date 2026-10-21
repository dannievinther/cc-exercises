// Keep regex/tokenization work for large pastes away from input and scrolling.
self.Prism = { manual: true, disableWorkerMessageHandler: true };
importScripts('/script/prism-custom.min.js');
self.onmessage = ({ data: { code, language } }) => {
  let html;
  try { html = Prism.highlight(code, Prism.languages[language] || {}, language); }
  catch { html = Prism.util.encode(code); }
  self.postMessage({ code, language, html });
};
