---
title: Afgræns navngiven timeline
id: test-4
draft: true
video: /assets/vid/sda/sda-ex-1.webm
debug: false
scrollDirection: block
help:
  {
    link: https://developer.mozilla.org/en-US/docs/Web/CSS/animation-range,
    topic: animation-range,
  }
startingCSS: |
  .box {
    --distance: 6rem;
    --from: calc(-1 * var(--distance));
    --to: var(--distance);
    line-height: 1;
    margin-block: var(--distance);
    opacity: 0;
    animation: reveal linear both;
    animation-timeline: view(block calc(50% - var(--distance)));
  }
  @keyframes reveal {
    cover 0% {
      opacity: 0;
      translate: 0 var(--from);
    }
    contain 50% {
      opacity: 1;
    }
    cover 100% {
      opacity: 0;
      translate: 0 var(--to);
    }
  }
startingHTML: |
  <div style="height:100%"></div>
  <div class="container" style="display: grid; place-items: center;">
    <div class="box">I'm a box</div>
    <div class="box">I'm a box</div>
    <div class="box">I'm a box</div>
    <div class="box">I'm a box</div>
  </div>
  <div style="height:100%"></div>
hints:
  - { type: property, name: animation-range }
  - { type: value, name: entry }
  - { type: value, name: cover }
  - { type: value, name: "entry 0% entry 100%" }
---

Begræns animationen til kun at køre mens containeren er på vej ind i viewporten vha. `animation-range` `entry`.

Prøv derefter specifikke procenter som `entry 0% entry 100%` for finere kontrol over start- og sluttidspunkt.
