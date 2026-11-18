# 0030. The tutorial is the book

- **Status:** accepted (2026-11-18, the author's word, after reading the book's first two chapters; revisable by the author's word)
- **Date:** 2026-11-18

## Context

Decision 0021 started a second tutorial beside the first, which it archived at `/tutorial/archivo/`. Its part 1 was
written, read, and found correct and stiff ([tutorial-v3.md](../tutorial-v3.md) §1). A third version was planned as a
book, its order re-derived from how twenty-three courses, books and syllabi are organized
([tutorial-research.md](../tutorial-research.md)): from a pixel up, every piece made by hand and with the library,
seven parts and 58 chapters. Its first two chapters, _La pantalla_ and _Líneas_, were written. The plan's path waited
for its whole Parte I before the switch (tutorial-v3.md §8).

## Decision

- **The book is the tutorial, now.** `/tutorial/` is its first page (the map, how to read it, the whole syllabus), and
  its chapters live in their parts' folders, numbered through the book: `/tutorial/dibujar/01-la-pantalla/`. The site
  shows no other tutorial: "cuando entro a tutorial veo todo referido a este nuevo tutorial como el único".
- **The earlier tutorials leave the site.** Their pages are gone from `src/content/docs/tutorial/`; every address they
  answered at (the archive's, the second version's, the first one's before it was archived, stage 1's renames, the
  pilot's) lands on the book's first page (`src/redirects.mjs`). Their text is in the repository as it was, at commit
  `7707772`, and the Bitácora's links point there: it is a log of what was done, and links to what was done.
- **Their code stays, as material.** The figures and project steps of both (`src/lessons/stage-*`, `parte-*`,
  `notation`, `typescript`; `src/course/parte-*`), and the first prototype's (`material/`), are the book's raw material
  (tutorial-v3.md §8): chapter 7 takes the projection, chapter 25 the replays, chapter 41 the cone. They still compile and
  their unit tests still run; no page shows them.
- **The tests follow.** The browser tests read the book's chapters (`e2e/lessons.e2e.ts`) and run every one of their
  examples (`e2e/tutorial.e2e.ts`); the rules of shape for the earlier tutorials' lessons (decisions 0013 and 0021) go
  with their pages; the links between pages, and to the code, are still checked, the Bitácora's pinned ones too.

## Consequences

- The tutorial has two chapters for now, and says so on its first page; the home page counts chapters, not lessons.
- An old link to any lesson arrives at the book's first page, not at the lesson: the lesson is no longer on the site.
- Chapters are added part by part; a new part is a folder under `tutorial/` and a group in the sidebar.
