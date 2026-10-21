# Performance- og robusthedsaudit — 20. oktober 2026

> Opfølgning 21. oktober 2026: Auditpunkterne er nu behandlet. Se [rettelser, storage-kompatibilitet og testresultater](performance-fixes-2026-10-21.md). Afsnittene nedenfor beskriver tilstanden ved den oprindelige audit.

## Konklusion og omfang

Projektet har konkrete korrekthedsfejl, som bør prioriteres før større performanceændringer. Den største oplagte performancekandidat er at initialisere færre Prism-editorer ved opstart og vinduesresize. Der er ikke påvist voksende hukommelsesforbrug under normal redigering; Prism har dog en konkret fastholdelsesrisiko ved dynamisk fjernelse af editorer.

Gennemgangen dækker projektets routes, layouts, komponenter, klient-JavaScript, lokale Prism/Bliss-scripts, styles, content-schema, øvelsesdata, assets og build-konfiguration. Browserstikprøver er kørt mod det lokale produktionsbuild i isoleret headless Chrome. Ingen applikationskode er ændret. Forslagene er ikke implementeret eller valideret som regressionsfri.

## Verifikation

- `npm run build`: bestået, 108 statiske sider, ca. 2,93 sekunder med eksisterende asset-cache. Dette er ikke en cold-build-måling.
- Browserstikprøver: `/`, `/grid/`, `/flex/`, `/subgrid/`, `/defensive/`, `/sda/`, `/iframe/grid/1/`, `/iframe/sda/1/`. Ingen JavaScript-fejl i de almindelige indlæsningsstikprøver.
- Grid initialiserede 34 Prism-editorer, inklusive 17 skjulte HTML-editorer. SDA initialiserede 18, inklusive 9 skjulte HTML-editorer.
- SDA startede requests til alle 9 videoer uden afspilningsinteraktion.
- Efter 100 redigeringer og HTML/CSS-faneskift på Grid, med eksplicit garbage collection før og efter, var `jsEventListeners` uændret på 686. DOM-tælleren ændrede sig fra 9.952 til 9.953. Tallene dækker browserens dokumenter, ikke alene den synlige side. Dette er en begrænset stabilitetsprøve, ikke et bevis for fravær af leaks eller en heap-retainer-analyse.
- Nedenstående reproduktioner brugte syntetiske input-, keyboard-, submit- og dialog-events. Ingen data blev sendt til CodePen; kun den lokalt genererede payload blev undersøgt.
- Ingen feltmålinger af LCP/INP, netværkstests på mobil, Safari/Firefox-test eller fuld visuel regressionstest er udført.

## Prioriterede fejl

### 1. Høj: Nulstilling konkurrerer med forsinket lagring

**Kilder:** `src/js/exercises.js:26`, `:206`; `src/js/sda-exercises.js:10`, `:137`, `:165`.

En planlagt 300 ms-lagring annulleres ikke ved reset. På SDA blev editoren nulstillet, men den ændrede CSS blev skrevet tilbage til localStorage efter nulstillingen. I standardøvelsen afviste `resetUI()` selve nulstillingen, fordi den nye værdi endnu ikke var gemt, og editoren ikke var tom. Begge dele blev reproduceret.

SDA har samme race ved hurtigt at vende tilbage til startkoden eller tømme editoren: removeItem annullerer ikke den tidligere timer. Afventende requestAnimationFrame-opdateringer kan også konkurrere med reset.

**Retning:** Annuller både save-timer og style-frame før reset; nulstil ud fra aktuel UI-state, uanset storage. Gem/slet altid gennem samme koordinerede mekanisme. Lad reset-state medtage ændret boksantal. Test reset før/efter 300 ms, tom CSS, tilbage til standardværdi og ændret boksantal.

### 2. Høj: De sidste tastetryk kan gå tabt ved navigation

**Kilder:** `src/js/exercises.js:26`; `src/js/sda-exercises.js:10`.

Begge gemmer kun via timer og har ingen flush ved sideskift/skjulning. Navigation inden for debounce-vinduet kan derfor miste ændringen. Dette er konstateret i koden, ikke særskilt reproduceret med navigationstiming.

**Retning:** Hold seneste uskrevede data og flush ved relevant lifecycle-event, fx pagehide og når dokumentet bliver skjult. Test straks-navigation, reload og tilbage/frem; undgå at gøre hvert tastetryk til en synkron storage-write.

### 3. Høj: Storage-fejl kan afbryde øvelsernes initialisering

**Kilder:** `src/js/exercises.js:64`; `src/js/sda-exercises.js:28`, samt write/remove-kald i begge filer.

Try/catch beskytter kun JSON-parsing, ikke getItem/setItem/removeItem. Med simuleret SecurityError fra getItem kastede Grid-scriptet under initialisering. Kvotefejl under setItem er heller ikke håndteret, og sletning fra pendingSaves springes over ved exception.

**Retning:** Fælles storage-wrapper med in-memory fallback og try/finally til oprydning. Valider gemte felter før brug: boxes skal være et heltal inden for tilladt interval, css en streng. Den nuværende clamp sker før load af gemt boksantal og beskytter derfor ikke mod en stor eller forkert gemt værdi.

### 4. Høj: SDA-iframe deler storage-nøgle med en anden øvelse

**Kilder:** `src/pages/iframe/[...slug].astro:73`; `src/components/SDAExercises.astro:31`.

Normalvisningen bruger `data.id`; iframe bruger filnummer. `/sda/4/` har `sda-03a`, mens `/iframe/sda/4/` har `sda-04`. Sidstnævnte nøgle tilhører normalvisningen af en anden øvelse. Det kan indlæse eller overskrive den forkerte CSS. Nøgleforskellen er bekræftet i browseren.

**Retning:** Én identitetsfunktion for alle visninger. Beslut migration af allerede gemte værdier forsigtigt: en eksisterende kolliderende nøgle kan ikke sikkert henføres til en bestemt øvelse.

### 5. Mellem: Navigation kan pege på forkerte routes

**Kilder:** `src/pages/[...slug].astro:142`, `:150`; `src/components/ExerciseDropdown.astro:32`.

På `/flex/4/` blev næste-linket opløst til `/flex/4/4a` i stedet for `/flex/4a`. Fejlen afhænger af trailing slash på den aktuelle URL. Dropdown bruger parseInt, så `04a` bliver til `4`, og den pågældende øvelse linker til den forkerte side.

**Retning:** Brug absolutte lokale paths og samme slug-funktion overalt. Fjern kun indledende nuller; bevar bogstaver. Test begge URL-former, `4a` og første/sidste øvelse.

### 6. Mellem: Readonly HTML kan ændres af Prism-genveje

**Kilder:** `public/script/prism-live.js:108`; `src/components/exercise/Editor.astro:129`.

Prism installerer sine muterende keyboard handlers på readonly HTML-editorer. En syntetisk Tab-event ændrede textarea.value, selv om readOnly var true. Dette kan også påvirke eksport, som læser textarea.value.

**Retning:** Afbryd muterende genveje ved readOnly/disabled, eller brug en rent læsbar highlighted visning. Bevar kopiering, selection og tilgængelig tastaturnavigation. Test Tab, Enter, parrede tegn og øvrige editor-genveje.

### 7. Mellem: CodePen bruger forældet HTML

**Kilder:** `src/components/exercise/Editor.astro:210`; `src/components/exercise/CodePenButton.astro:207`.

HTML opdateres kun, når HTML-fanen er aktiv/åbnes. Efter at tilføje en boks med CSS-fanen aktiv var previewet på 2 bokse, men den genererede eksport havde 1. Reproduceret uden at sende formularen.

**Retning:** Generer eksport fra aktuel øvelsesstate uafhængigt af synlig fane. Genbrug samme funktion til HTML-visning og eksport; bevar custom HTML. Test også gendannede bokse og reset.

### 8. Mellem: SDA-prefix ændrer gyldige CSS-værdier

**Kilde:** `src/js/sda-exercises.js:66`, især `:117`.

Keyframe-navne erstattes globalt i hele CSS-strengen. Med `@keyframes red` ændres `color: red` til `color: sda-01--red`; det blev reproduceret. Brace-parseren tager heller ikke højde for strings/kommentarer eller alle indlejrede at-rules.

**Retning:** Token-/parserbaseret omdøbning begrænset til keyframe-definitioner og animationsreferencer. Dette er mere regressionsfølsomt end timer- og URL-fixes: test comments, strings, whitespace, flere animationer, shorthand og @media/@supports før udskiftning.

## Performance og hukommelse

### 9. Største kandidat: Initialiser kun relevante Prism-editorer

**Kilder:** `src/layouts/Base.astro:53`; `public/script/prism-live.js:938`; `:225`; `:454`.

Script-loading er udskudt, men idle-callbacken initialiserer stadig alle editorer i én omgang. Hver instans opretter highlighted DOM, MutationObserver og sin egen window.resize-handler. Grid havde 34 instanser, selv om kun én HTML-fane ad gangen behøver at blive læst. Ved resize læser/skriver syncStyles styles for hver instans, også skjulte editorer, hvilket er en kandidat til unødvendigt layoutarbejde.

**Retning:** Initialiser CSS-editorer nær viewport og HTML-editorer ved første aktivering. Brug fælles coalesced resize-behandling og spring uændrede/skjulte instanser over. Mål long frames og resize-arbejde før/efter. Det er ikke nok blot at udskyde download yderligere.

**Regressioner at beskytte imod:** Highlight skal være klar ved første interaktion; textarea/pre-fontmetrics og scroll skal matche; hints, tab-navigation, reset og eksport skal stadig virke før initialisering.

### 10. Potentiel leak ved dynamisk fjernelse, ikke påvist i nuværende flow

**Kilder:** `public/script/prism-live.js:225`, `:245`, `:865`.

window.resize-callbacken lukker over instansen, og der findes ingen destroy-metode til at afmelde callbacken. Dermed fastholdes en fjernet editor gennem window → listener → instans → DOM, selv om instansregistret bruger WeakMap. Observeren har unobserve, men ingen samlet lifecycle-oprydning.

Projektet bruger normale dokumentnavigationer uden ClientRouter og fjerner ikke normalt editorerne. Derfor er dette en fremtidig/dynamisk lifecycle-risiko, ikke en dokumenteret vedvarende leak i den nuværende brugerrejse. De 100 gentagelser gav stabilt listener-antal.

**Retning:** Tilføj eksplicit destroy/dispose før dynamisk indhold eller klientnavigation indføres. Afmeld globale callbacks, disconnect observer, og annuller egne pending frames. Undgå at kalde alle lokale DOM-listeners leaks: de kan indsamles sammen med deres DOM, hvis der ikke findes eksterne referencer.

### 11. Videoer henter data, selv når de er langt nede på siden

**Kilde:** `src/components/exercise/TargetMedia.astro:26`, `:45`.

Alle videoer har preload=metadata og et fragment på #t=0.001, også under folden. På SDA sås requests til alle 9 videoer ved load. Det præcise byteforbrug afhænger af serverens Range-understøttelse og videofilernes struktur.

**Retning:** Evaluer poster-billeder og preload=none for videoer langt fra viewport, evt. metadata-fetch nær viewport. Ændr ikke blindt til none: det nuværende første-frame-preview kan ellers forsvinde. Test thumbnail, dimensioner/CLS, første play, Safari og afspilningsfejl.

### 12. CSS-transformation sker før frame-coalescing

**Kilde:** `src/js/sda-exercises.js:162`.

sdaPrefix kaldes synkront for hvert input, før requestAnimationFrame-coalescing; kun DOM-skrivningen samles. Derfor spares parserarbejdet ikke ved flere inputs i samme frame. Prism-highlighting udføres også synkront ved input, så den samlede gevinst skal måles frem for antages.

**Retning:** Gem seneste rå CSS og transformér én gang pr. frame. Sørg for korrekt rækkefølge ved reset og storage, og test store indsatser samt hurtig indtastning.

### 13. Mindre kandidater

- `astro.config.mjs:65`: prefetchAll + viewport kan hente flere HTML-sider end nødvendigt. Overvej målrettet hover/tap-prefetch, men mål netværksbesparelsen mod navigationens oplevede hastighed.
- `src/pages/iframe/[...slug].astro:139`: parserblokerende Prism-scripts og den uminificerede prism-custom.js kan samles med den fælles loader. Script-rækkefølgen skal bevares.
- Loaderen i Base og iframe sætter prismLoaded før succes og har ingen retry/error-håndtering. `{ once: true }` på focusin fjernes også, hvis første fokus er på et andet element; idle-callbacken skjuler normalt problemet. Brug en delt loading-promise, håndter fejl og afmeld først efter relevant fokus.
- Tre fonte preloads generelt; iframe ser ikke ud til at bruge displayfonten fra logoet. Undersøg faktisk fontbrug før conditional preloads. Billeder har allerede responsive assets og lazy-loading; ingen grund til generel udskiftning.
- Gentagen filtrering/sortering i getStaticPaths kan samles pr. collection, men buildet er allerede hurtigt. Det påvirker buildtid, ikke besøgendes runtime.
- Undlad generelle contain/content-visibility-ændringer uden visuel test: projektet bruger scroll timelines, anchors og overflow, som kan reagere på containment.

## Anbefalet rækkefølge

1. Ret storage/reset, ensret øvelsesidentitet, og tilføj fokuserede tests af de beskrevne races og storage-fejl.
2. Ret URL-generering, readonly-genveje og eksport-state; test både oversigt, enkeltøvelse og iframe.
3. Ret SDA-transformeren med egne parser-cases.
4. Optimér Prism-initialisering/resize og videoindlæsning ud fra før/efter-målinger og visuel QA.

De første rettelser kan holdes små og afgrænsede. Større editor-, parser- og containmentændringer bør ikke beskrives som regressionsfri uden browser- og interaktionstest.
