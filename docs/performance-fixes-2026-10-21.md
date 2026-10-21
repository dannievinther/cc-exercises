# Rettelser efter performance-audit — 21. oktober 2026

Alle handlingskrævende punkter i auditten er behandlet. `prefetchAll + viewport` og eksisterende font-preloads er bevaret efter brugerens ønske. Ingen generel containment/content-visibility-ændring er indført.

## Status på auditpunkterne

| Punkt | Resultat |
| --- | --- |
| 1. Reset/storage-races | Fælles controller og lagringskø. Reset annullerer tidligere save og style-frame, nulstiller uden afhængighed af storage og opdaterer highlighting/HTML. Ændrede bokse aktiverer reset. Escape annullerer dialogen. |
| 2. Mistede sidste tastetryk | Seneste afventende data flushes ved pagehide og skjult dokument. Tom CSS bevares som en gyldig ændring. |
| 3. Storage-fejl og ugyldige værdier | Beskyttede read/write/remove-kald og fallback i tabens hukommelse. Gemte bokse valideres før DOM-allokering; ugyldige felter ignoreres. |
| 4. SDA-identitet | Ensartet øvelsesidentitet på oversigt, enkeltvisning og iframe. SDA bruger et nyt separat storage-namespace. |
| 5. Navigation | Fælles absolutte øvelsespaths, bogstavsuffix bevares, og enkeltvisning genkendes også på eksempelvis `/flex/4a/`. Sortering/index beregnes én gang pr. collection. |
| 6. Readonly HTML | Muterende editor-genveje respekterer readOnly/disabled. Selection, kopiering og Tab-navigation er fortsat mulige. |
| 7. CodePen-eksport | HTML genereres fra de aktuelle bokse uafhængigt af, om HTML-fanen har været åben. Custom HTML bevares. |
| 8. SDA-prefix | Tolerant PostCSS-parser og særskilt værdiparser erstatter regex/brace-counting. Kommentarer, strings, betingede grupper og nested CSS bevares. Kun animationsreferencer omdøbes; variabler får scoped aliases, så deres brug i andre egenskaber bevares. |
| 9. Prism-initialisering/resize | Initialisering nær viewport og ved aktivering; skjulte HTML-faner initialiseres ved behov. Kodevisningen er nu prerenderet i HTML og genbruges af Prism. Fælles ResizeObserver med én frame-kø erstatter window.resize-handler pr. instans. Skjulte editorer springes over. |
| 10. Oprydning | Instanser har destroy med afmelding af handlers, observers og pending arbejde samt terminering af worker. Fjernede editorer ryddes automatisk op og kan geninitialiseres ved genindsættelse. Den gamle MutationObserver, der kunne kopiere gammel highlighted tekst tilbage i textarea, er fjernet. |
| 11. Videoindlæsning | Poster-billeder bevarer første-frame-preview. Videoer efter første øvelse bruger preload=none. Afspilningsfejl håndteres uden uafvist promise. |
| 12. Arbejde pr. frame | Preview-transform udføres på seneste rå CSS én gang pr. frame. Highlighting samles pr. frame; store kodeindsættelser tokeniseres i en worker. Forældede jobs afsluttes/kasseres. |
| 13. Mindre kandidater | Fælles editor-loader med retry, korrekt rækkefølge og en færdig kodevisning før JavaScript indlæses. Parserblokerende iframe-scripts fjernet. Standard-iframes downloader ikke SDA-parseren. Prefetch og font-preloads bevaret. |

CSSOM alene blev afprøvet til SDA-prefix, men browsertesten viste, at serialization mister animation-shorthands med var(), når animation-timeline også er angivet. Derfor bruges en tolerant source-parser. Kun parsermodulerne importeres, så PostCSS's plugin-pipeline ikke følger med til klienten. Parseren indlæses kun på SDA-sider/embeds.

## Korrektion af første rendering og linjenumre

Brugerens kontrol fandt to regressioner, som de første tests ikke dækkede:

- Den lazy loader oprettede både det synlige pre/code-element, linjenumre og padding efter JavaScript-indlæsning. Den tidligere fallback viste en bar textarea i mellemtiden. EditorSurface prerenderer nu hele kodevisningen med samme Prism-grammatik som klienten. Textarea og pre deler layoutregler, også linjehøjde, fra første rendering. Prism adopterer noderne i stedet for at bygge dem igen. Ingen skjulning af editoren eller timeout bruges til at skjule problemet.
- Den oprindelige linjenummerkode brugte `Array(n).join(...)`, som laver n−1 gentagelser. Fjernelsen af det ekstra array-element indførte derfor en manglende række. Den konstruktion er erstattet af en fælles lineCount/lineNumbersMarkup, som laver én span pr. logisk linje. Den bruges både ved prerendering og senere opdateringer. Prism's complete-hook bruges, fordi after-highlight springes over ved tom kode; worker-stien sender samme completion-event.

Den nye koldstart-test holder al applikations-JavaScript tilbage og verificerer synlig syntax highlighting, fire numre til fire kodelinjer og korrekt padding. Efter frigivelse verificeres genbrug af de samme noder og præcis samme mål, padding, fontstørrelse og linjehøjde. Gemte værdier testes også, mens editorudvidelserne fortsat holdes tilbage. Tomme dokumenter, LF/CRLF/CR, afsluttende tomme linjer, CSS/HTML, iframe og worker-output er dækket.

Prerendering kræver mere statisk HTML end den tidligere bare textarea. Arbejdet med at oprette det synlige markup flyttes til buildtid; Live-instansers handlers og resize-arbejde oprettes fortsat kun efter behov. De tidligere 1.813 DOM-elementer var målt før denne rettelse og er ikke længere den aktuelle DOM-måling.

## Gemte løsninger

Standardøvelser bruger stadig `ex:<collection>-<fil-id>` med samme JSON-format `{css?: string, boxes?: number}`. Eksempler: `ex:grid-01`, `ex:flexbox-04a`. Gyldige eksisterende værdier indlæses; uvedkommende nøgler slettes eller migreres ikke. Gemte bokse gendannes også i standard-iframes uden plus/minus-knapper. Custom HTML overskrives ikke med genererede bokse.

SDA bruger `ex:sda-v2:<stabilt-data-id>`, eksempelvis `ex:sda-v2:sda-03a`. Gamle SDA-nøgler læses ikke, fordi den tidligere iframe-identitet kunne kollidere med en anden øvelse. De gamle værdier efterlades urørte. Dette følger brugerens tilladelse til at ændre tidligere SDA-lagring.

Hvis browseren afviser persistent storage, virker redigering, preview og reset stadig med fallback i den aktuelle tab. En sådan fallback kan ikke bevare løsningen efter en ny dokumentindlæsning; browseren har netop afvist lagringen.

## Verifikation

- Produktionsbuild bestået: 108 sider. Astro-konfigurationen er uændret.
- 93 beståede browsertests i Chrome og WebKit samt 8 unit-tests af linjetælling/display-tekst. Én CDP-specifik hukommelsestest springes forventeligt over i WebKit.
- Firefox blev hentet og forsøgt startet med både den normale og en separat temp-mappe, men processen afsluttede med `Could not find profile folder`. Firefox-testene er derfor ikke verificeret på denne maskine.
- Regressionstests dækker eksisterende JSON-data, ugyldige værdier, storage-read/write/remove-fejl, straks-navigation/reload, tom CSS, reset før debounce, bokse, iframe, SDA-nøgler, navigation med `4a`, eksport, readonly-genveje, hints, IME, fejlet download/retry, worker-highlighting, stale jobs, parser-cases, fjernelse/genindsættelse og resize/scroll.
- 50 input-events i samme frame medfører én highlighting-kørsel og preview af den nyeste CSS.
- Grid initialiserede 2 editorer ved første indlæsning i testens 1440 × 1000 viewport mod 34 i den oprindelige audit. DOM-stikprøven har nu 3.674 elementer mod tidligere 3.681: highlighting-markup leveres i HTML, mens antallet af aktive editorinstanser stadig er reduceret. Antallet afhænger af viewport og brugerens navigation.
- Efter opvarmning af begge editorfaner og 100 redigeringer/faneskift: 436 event listeners både før og efter garbage collection; DOM-counter 10.018 → 10.010. Browsercounteren omfatter flere dokumenter. Dette understøtter stabilitet i den testede brugerrejse, ikke et generelt bevis for fravær af alle leaks.
- Videooversigten tester 9 poster-previews, højst én initial videofil-request og faktisk afspilning. De 11 genererede poster-assets fylder samlet ca. 116 KB på disk.
- Font-/padding-metrics og scrollsynkronisering er kontrolleret ved 390, 1024 og 1440 px bredde. Screenshots genereres i test-results til visuel inspektion.
- Buildet viser fortsat de tidligere minifier-advarsler om `:interest-source` og `:target-current`; de kommer fra eksisterende CSS.

Der er ikke indført LCP/INP-feltmåling eller foretaget en fuld pixelbaseret sammenligning af alle sider. WebKit-test er ikke en test af hver konkret Safari-udgave.

## Kør kontrollerne igen

```sh
npm ci
npx playwright install chrome webkit
npm test -- --project=webkit
```

`npm test` bygger automatisk produktionsfilerne, kører unit-tests og vælger Chrome til browsertestene. `npm test -- --project=webkit` vælger både Chrome og WebKit. Unit-tests kan også køres separat med `npm run test:unit`. `npm run test:cross-browser` bygger, kører unit-tests og vælger alle tre konfigurerede browsere; Firefox kræver `npx playwright install firefox` og en fungerende lokal Firefox-testinstallation. Testene starter selv Astro-preview via det offentlige programatiske API på port 8128 og bruger isolerede browserkontekster. Testserveren er en foreground-proces, som Playwright kan stoppe; den kræver ikke Python og påvirkes ikke af Astro-CLI'ens automatiske baggrundsstart i agentmiljøer. CodePen-formularer undersøges lokalt uden at blive sendt.

Ved en ny video:

```sh
npm run posters
```

Ved udskiftning af en eksisterende video:

```sh
npm run posters -- --force
```

Postergenerering kræver ffmpeg. Poster-filerne er indcheckningsklare assets; ffmpeg behøver ikke findes på produktionshosten.

## Separat dependency-observation

Npm rapporterede ved installation af test-/parserafhængigheder seks eksisterende transitive advisories (fem high, én moderate). Der er ikke kørt en generel `npm audit fix` eller en Astro-opgradering som del af disse rettelser. Dette er et separat vedligeholdelsespunkt; browserfunktionstests er ikke en sikkerhedsaudit af afhængighederne.
