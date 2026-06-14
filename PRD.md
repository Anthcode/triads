# PRD — Generator triad gitarowych i progresji na tabulaturze

Jednoplikowa aplikacja webowa (vanilla HTML/CSS/JS, bez backendu, bez frameworków).
Generuje **zamknięte triady** na zestawach strun 3-2-1 / 4-3-2 / 5-4-3 / 6-5-4
w stroju standardowym, ich przewroty, diatoniczne akordy tonacji oraz progresje
z **minimalnym prowadzeniem głosów (minimal voice leading)**.

---

## 1. Architektura aplikacji

Jeden plik `index.html` z logicznym podziałem na sekcje-moduły (komentarze
`/* === nazwa.js === */`). Podział odzwierciedla docelowe pliki:

| Moduł (sekcja) | Odpowiedzialność |
|---|---|
| `notes.js` (music engine) | klasy wysokości, litery nut, enharmoniczny *speller*, skale, jakości triad, cyfry rzymskie |
| `fretboard.js` | stroj standardowy (MIDI strun otwartych), definicje string setów, wyszukiwanie progów dla klasy wysokości |
| `triad-generator.js` | budowa triady (R/3/5), generowanie zamkniętych voicingów + przewrotów na string secie, diatonika tonacji |
| `progression-engine.js` | parser stopni (cyfry rzymskie), mapowanie na akordy, algorytm minimal voice leading (DP/Viterbi) |
| `suggestion-engine.js` (music engine) | propozycje kolejnych akordów: kanoniczny zapis rzymski (`canonicalRoman`), tabele przejść funkcyjnych (dur/moll), korpus popularnych progresji (cykliczne n-gramy), ranking `suggestNext` |
| `audio-schedule.js` (music engine) | czyste funkcje harmonogramu: `midiToFreq`, zdarzenia strum, harmonogram progresji, zdarzenia metronomu |
| `rhythm-patterns.js` (music engine) | wzorce rytmiczne odtwarzania: `PATTERNS` (całe nuty / rock D·DU·UDU / ballada-arpeggio), `patternEvents` (zdarzenia z `vel`, `voice`, `chord`), `humanizeEvents` + seedowany PRNG `mulberry32` (deterministyczny jitter czasu i głośności) |
| `audio.js` | warstwa Web Audio: synteza Karplus-Strong („pluck"), metronom, transport (play / loop / stop), cache buforów, `now()` + hook `onStart` (wspólny zegar dla animacji); **pogłos** (convolver z proceduralnym impulsem — gasnący szum stereo, zero sampli, regulacja „wet"), **panorama głosów** (bas −0.22 / środek 0 / sopran +0.22, feature detect `StereoPannerNode`), **velocity** w plucku, seed humanizacji przesuwany per okrążenie pętli |
| `fretboard-geometry.js` (music engine) | geometria gryfu: pozycje drutów `wireX` (menzura, równomierna temperacja), mapowanie okna progów na viewBox, środki pól (`dotX`, także ułamkowe), inlaye; `hitTest` — czysta odwrotność `dotX`/`stringY` (punkt viewBoxa → struna/próg) dla klikalnego gryfu |
| `anim-timeline.js` (music engine) | czysta oś czasu animacji: ruchy głosów (`voiceMoves`), easing, czas dojazdu `T` (skalowany z BPM, z klamrami), `animState(t)` — pozycje kropek w dowolnej chwili (pętla, count-in, reduced motion) |
| `triad-recognition.js` (music engine) | `recognizeTriad`: MIDI zaznaczonych dźwięków → jakość, pryma, przewrót (z basu), zapis rzymski w tonacji (reużywa `canonicalRoman` — jedna konwencja z parserem i diatoniką), flaga diatoniczności dla wariantu skali, pisownia dźwięków ze stopnia |
| `share-state.js` (music engine) | stan aplikacji ⇄ fragment URL: `encodeShareState` / `decodeShareState` (deterministyczna kolejność kluczy, percent-encoding, pobłażliwa walidacja z klamrami) — fundament „Kopiuj link" |
| `fretboard-view.js` | gryf-scena (SVG + rAF): duży poziomy gryf, 3 kropki-głosy ze smugami, poświata/wibracja strun wg hierarchii ruchu, puls taktu, podgląd voicingu na hover; `setOnIdx` — publikacja indeksu granego akordu dla UI |
| `fretboard-explorer.js` | gryf jako instrument (zakładka Gryf): klikalny SVG-gryf (klik → `hitTest` → selekcja), nakładka skali diatonicznej (kropki-duchy, tonika jako pierścień), selekcja FIFO (1 dźwięk/strunę, maks. 3), karta rozpoznania z plakietką stopnia i akcjami ▶ / „Dopisz do progresji" |
| `ui.js` | render kart, tabów, zakładek, filtrów, presetów, chipów propozycji „co dalej?”, Generate / Practice / Copy, podświetlanie granego akordu; **Tryb Sceny** (pełnoekranowa nakładka, przenoszenie żywych węzłów DOM) i **Kopiuj link** (hash → kontrolki na starcie, `replaceState` w sesjach z linka) |

Przepływ danych: **stan UI (filtry) → engine (czyste funkcje) → render**.
Engine jest bezstanowy i deterministyczny (te same wejścia → te same wyjścia),
co czyni go w pełni testowalnym (zob. `test.js`, 166 asercji — w tym 14 dla harmonogramu audio, 11 dla stroju Drop C, 22 dla geometrii gryfu i osi czasu animacji, 24 dla silnika propozycji, 15 dla share-state, 16 dla wzorców rytmicznych i humanizacji oraz 17 dla rozpoznawania triad i `hitTest` klikalnego gryfu).

Rozszerzalność: jakości akordów i interwały trzymane w tablicach
(`QUALITY_INTERVALS`), przewroty jako mapa `INVERSIONS`. Dodanie seventh chords =
rozszerzenie tych tablic + uogólnienie generatora z 3 na N głosów; drop-2/arpeggia
= nowa strategia układania głosów na bazie tych samych klas wysokości.

---

## 2. Model danych

```
TUNINGS         : { standard: { open:{1:64(e) … 6:40(E)} },
                    dropC:    { open:{1:62(d), 2:57(A), 3:53(F), 4:48(C), 5:43(G), 6:36(C)} } }
OPEN_MIDI       : alias TUNINGS.standard.open (zgodność wstecz)
STRING_SETS     : { '321':[3,2,1], '432':[4,3,2], '543':[5,4,3], '654':[6,5,4] }
                  (kolejność: BAS -> SOPRAN, czyli struna grubsza -> cieńsza)
SCALE_STEPS     : { major:[0,2,4,5,7,9,11], minor:[0,2,3,5,7,8,10] }
QUALITY_INTERVALS: { maj:[0,4,7], min:[0,3,7], dim:[0,3,6], aug:[0,4,8] }
INVERSIONS      : root:[0,1,2], inv1:[1,2,0], inv2:[2,0,1]  (indeksy R/3/5 bas->sopran)

Chord  = { rootPc, quality, pcs:[R,3,5], names:[..], rootLetter, roman, name, degree }
Voicing= { inversion, inversionName, stringSet, strings:[bas,mid,sopran],
           frets:[bas,mid,sopran], midis:[..], noteNames:[bas..sopran],
           position(avg), minFret }
Key/UI = { tuning, tonicPc, tonicLetter, scaleName, stringSet, inversionFilter,
           minFret, maxFret, progressionText }
Voicing dodatkowo niesie `tuning`, więc render i audio są od niego niezależne.
```

---

## 3. Logika muzyczna

- **Klasa wysokości** = `midi % 12` (C=0 … B=11). Nuta na strunie *s*, progu *f*:
  `midi = OPEN_MIDI[s] + f`.
- **Speller enharmoniczny**: litera nuty wynika z pozycji w skali/akordzie
  (kolejne litery C-D-E-F-G-A-B), a znak (♯/♭) dobierany tak, by trafić w klasę
  wysokości. Dzięki temu Eb-dur to `Eb F G Ab Bb C D`, a nie `D# F G G# A# C D`.
- **Triada zamknięta**: trzy głosy rosnące (`m0<m1<m2`), rozpiętość `< 12`
  półtonów, każdy głos na osobnej strunie string setu.
- **Przewroty**: kolejność klas wysokości od basu zależy od przewrotu —
  root: R-3-5; 1. przewrót: 3-5-R(8va); 2. przewrót: 5-R-3.
- **Diatonika**: triada na stopniu *d* = co druga nuta skali
  (`scale[d], scale[d+2], scale[d+4]`); jakość wyznaczana z faktycznych
  interwałów (nie zakodowana na sztywno) — stąd poprawne `vii°`, `ii°` itd.
- **Stopnie progresji (cyfry rzymskie)**: konwencja chromatyczna pop/rock —
  bazą interwałów jest skala **durowa** toniki, wielkość liter = jakość
  (DUR/moll), `°`=zmniejszony, `+`=zwiększony, prefiks `b`/`#` = alteracja prymy.
  Działa identycznie dla tonacji dur i moll (np. `i-bVII-bVI-V` w a-moll → `Am G F E`).
- **Propozycje kolejnych akordów** (`suggestNext`): ranking kandydatów =
  waga z tabeli przejść funkcyjnych (osobne tabele dur/moll; tryb wnioskowany
  z pierwszego stopnia progresji albo przekazany jawnie w `opts.mode`)
  + bonus za kontynuację wzorca z korpusu popularnych progresji (sufiks do
  3 akordów dopasowywany **cyklicznie** — wzorce są pętlami; dłuższy kontekst
  → większy bonus) − lekka kara za ping-pong A–B–A; natychmiastowa repetycja
  wykluczona. Pusta progresja → wagi startowe. Wspólny `canonicalRoman`
  gwarantuje identyczny zapis stopni w diatonice, parserze i propozycjach.
- **Świadomość skali w propozycjach** (`opts.scale`): zbiór kandydatów to unia
  bazowej listy trybu i diatoniki wybranej skali (z `diatonicTriads` — stąd
  np. harmoniczna dodaje `V`, `vii°`, `bIII+`); stopnie diatoniczne dostają
  bonus (+2), zapożyczenia lekką karę (−1), a tooltip mówi które jest które.
  Efekt: `i-bVII-bVI` w naturalnej proponuje oscylację `bVII`, w harmonicznej —
  dominantę `V`. Gdy wybrana skala kłóci się z trybem progresji (skala durowa,
  progresja od `i`), świadomość skali wyłącza się i działa czysta heurystyka —
  parser celowo pozostaje w konwencji durowej bazy, skala steruje tylko
  rankingiem. Korpus i tabele moll zawierają wzorce „mroczne/metalowe”:
  wspinaczkę `i-bVI-bVII(-V)`, oscylację andaluzyjską `i-bVII-bVI-bVII`
  i frygijskie `bII` (vamp `i-bII`, sekwencja `i-bvii-bVI-bII`).

### Algorytm minimal voice leading
1. Dla każdego akordu wygeneruj wszystkie voicingi spełniające filtry.
2. Koszt przejścia między sąsiednimi voicingami =
   `Σ |różnica progów na tej samej strunie|`.
3. Dodatkowo **lekka kara** za bardzo duży skok pozycji:
   `+ 0.5 · max(0, |Δpozycji| − 3)`.
4. Najtańszy przebieg = programowanie dynamiczne (Viterbi) po warstwach akordów
   + backtracking.
5. Remis kosztów → preferencja niższej pozycji (epsilon · pozycja w koszcie węzła).
6. Pusty zbiór kandydatów (np. zbyt wąski zakres progów) → komunikat, brak crasha.

---

## 4–7. Implementacja, UI, self-check

- Silnik triad (krok 4), generator progresji z VL (krok 5), UI (krok 6) —
  zaimplementowane w `index.html`.
- **Self-check (krok 7)**: `test.js` — 110 asercji, **wszystkie zielone**:
  strój i tercja na strunie B, enharmonia (F♯ vs G♭, Eb-dur), C-dur root na 321
  = `G:5 B:5 e:3`, wszystkie 3 przewroty z właściwą nutą w basie, 4 string sety,
  diatonika C-dur / a-moll / Eb-dur, kadencja andaluzyjska, presety, gładkość
  prowadzenia głosów (maks. ruch ≤ 9 progów), brak fałszywych nut, span < oktawy,
  odporność na pusty zbiór, warianty molowe (harmoniczna: V dur, bIII+; melodyczna:
  IV/V dur, vi°/vii°), `midiToFreq` (A4=440), kolejność i odstępy strum,
  czasy startu akordów i długość całości przy zadanym BPM, akcenty metronomu,
  strój Drop C (MIDI strun otwartych C2 G2 C3 F3 A3 D4, frety i MIDI voicingów
  liczone z właściwego stroju, voice leading w Drop C, domyślny strój bez zmian),
  silnik propozycji (po `ii` → `V`, rozwiązanie kadencji `I-IV-V` → `I`,
  kontynuacja andaluzyjskiej z uzasadnieniem z korpusu, wnioskowanie trybu
  dur/moll, startery pustej progresji, determinizm, brak repetycji,
  parsowalność i grywalność każdej propozycji, rundtrip `canonicalRoman`,
  świadomość skali: flip `bVII`↔`V` między naturalną a harmoniczną, fallback
  przy konflikcie skali z trybem, unia kandydatów z diatoniką melodycznej,
  wzorce metalowe `i-bVI`→`bVII` i frygijskie `i-bII`→`i`, presety Metal
  i Frygijska).

---

## 8–12 potencjalnych błędów domenowych i jak ich unikam

1. **Offset struny B** — między G(3) a B(2) jest wielka tercja (4 półtony),
   nie kwarta. Naiwny równomierny stroj psuje WSZYSTKIE nuty na strunach 1–2.
   → Trzymam jawne MIDI strun otwartych `[40,45,50,55,59,64]`, liczę każdą strunę
   niezależnie. *(test 1)*

2. **Enharmonia (♯ vs ♭)** — `pc % 12` z jedną tablicą krzyżyków da `D#` w Eb-dur.
   → Speller oparty na literach skali/akordu + dobór znaku do klasy wysokości. *(test 2, 8)*

3. **Zawinięcie oktawy w voicingu zamkniętym** — brak wymogu rosnących wysokości
   daje rozproszone voicingi lub zły przewrót.
   → Wymuszam `m0<m1<m2` oraz span `< 12`. *(test 12)*

4. **Ujemne progi / nuta poniżej struny otwartej** — niektóre składniki wypadają
   pod progiem 0; modulo mogłoby „udać", że istnieją.
   → Akceptuję tylko progi `≥ minFret (≥0)`, iteruję oktawy w zakresie. *(wbudowane w `fretsForPc`)*

5. **Mapowanie przewrót→bas (off-by-one)** — mylenie „1. przewrotu" z „pierwszym
   składnikiem".
   → Jawna mapa: root→R, inv1→3, inv2→5 w basie + zdefiniowana kolejność rosnąca. *(test 4)*

6. **Jakości diatoniczne** — zakodowanie wszystkiego jako dur albo zła sekwencja
   (zwłaszcza `vii°`/`ii°`).
   → Jakość liczę z realnych interwałów tercji i kwinty skali, nie z listy. *(test 6, 7)*

7. **Kwinta zmniejszona/zwiększona** — założenie „kwinta = +7 zawsze" psuje akordy
   dim/aug.
   → Kwintę biorę ze skali (dim=+6, aug=+8 z `QUALITY_INTERVALS`). *(test 6)*

8. **Konwencja cyfr rzymskich** — `bVII` w moll mogłoby wyjść podwójnie obniżone.
   → Jedna, udokumentowana konwencja: baza durowa + jawne alteracje + wielkość
   liter; alteracja nie zmienia litery nuty. *(test 9, 10)*

9. **Kolejność string setu / która struna jest basem** — `'321'` wypisuje struny
   od cienkiej, ale bas to struna 3. Pomyłka odwraca przewroty.
   → String set zawsze `[bas … sopran]` (grubsza → cieńsza), buduję rosnąco. *(test 3, 5)*

10. **Pusty zbiór voicingów przy filtrach** — zbyt wąski zakres progów → brak
    kandydata → DP się wykłada.
    → Wykrywam pusty zbiór, zwracam `{ok:false, failedIndex}`, UI pokazuje
    komunikat zamiast się sypać. *(test 13)*

11. **Niewspółmierne porównanie głosów w VL** — porównywanie sopranu jednego
    akordu z basem drugiego.
    → Cała progresja na tym samym string secie; koszt liczony per identyczny
    indeks struny. *(test 11)*

12. **Próg 0 (struna pusta) w koszcie/pozycji** — traktowanie 0 jako „wyjątku"
    zaburza metrykę pozycji.
    → Próg 0 to zwykła wartość; pozycja = średnia progów, kara tylko za
    *bardzo duży* skok (`> 3`). *(test 11)*

13. **`#` w progresji ucina fragment URL** — alterowane stopnie (`#iv°`)
    zawierają znak, który wg RFC 3986 nie może wystąpić wewnątrz fragmentu;
    surowe wklejenie psuje link.
    → Wszystkie wartości w hashu są percent-encodowane (`encodeURIComponent`),
    a test pilnuje braku surowego `#` w zakodowanym stanie. *(testy share-state)*

14. **Śmieciowy / wrogi hash** — link może przyjść z literówką, obciętym
    `%xx` albo wartościami spoza dziedziny (`bpm=999`, `f=99-1`, `s=lokrycka`).
    → `decodeShareState` jest pobłażliwy: nieznane pary pomija, liczby
    klamruje do dziedziny (`bpm` → [40, 180], progi → [0, 22]), odwrócony
    zakres naprawia, zepsute kodowanie ignoruje; tonacja dodatkowo filtrowana
    w UI przez listę `KEYS`. Śmieci nigdy nie wywracają inicjalizacji.
    *(testy share-state)*

15. **Stan pochodny w linku** — kuszące jest zapisanie planu/voicingów;
    wtedy link rozjeżdża się z silnikiem po każdej zmianie algorytmu.
    → Hash niesie wyłącznie **wejścia** (strój, tonacja, skala, zestaw,
    przewroty, progi, progresja, BPM, flaga sceny); plan zawsze liczony
    na świeżo z tych samych czystych funkcji.

16. **Duplikacja transportu na scenie** — drugi komplet przycisków
    oznaczałby podwójne wiązanie stanu (disabled, „lit", checkboxy).
    → Tryb Sceny **przenosi żywe węzły DOM** (`#fb-wrap`, `.transport`)
    do nakładki i z powrotem do kotwic (`#fb-home`, `#transport-home`);
    wszystkie nasłuchy i referencje (`FretboardView.wrap`) zostają ważne.
    *(smoke test jsdom: wejście / wyjście / ponowne wejście)*

17. **Poświata gryfu zakłada „3 zdarzenia na akord"** — stare mapowanie
    `voice = k % 3, chord = ⌊k/3⌋` pęka przy wzorcach (rock = 18 zdarzeń
    na akord, ballada = 8, strum „up" odwraca kolejność głosów).
    → Każde zdarzenie niesie jawne pola `voice` i `chord`; gryf-scena mapuje
    z nich strunę, a indeksowe mapowanie zostaje tylko jako fallback.
    *(testy wzorców: niezmienniki voice/chord)*

18. **Humanizacja rozjeżdża obraz z dźwiękiem** — jitter nałożony na
    `chordTimes` przesunąłby animację kropek i podświetlenie kart względem
    siatki; jitter w poświacie wymagałby współdzielenia seeda między audio
    a widokiem.
    → Humanizowane są **wyłącznie zdarzenia nut**; `chordTimes`
    i `totalDuration` pozostają na siatce *(test)*. Gryf-scena liczy poświaty
    z harmonogramu **bez** humanizacji — rozjazd ±8 ms jest poniżej progu
    percepcji wzrokowej, a wzorzec (jedyna widoczna zmienna) jest wspólny.

19. **Wzorzec psuje zgodność wsteczną** — zmiana `progressionSchedule`
    mogłaby przesunąć czasy/długości dotychczasowego grania (i 22 asercje
    animacji liczone z tej siatki).
    → Wzorzec `whole` odtwarza dawne zachowanie **co do sekundy**
    (klamra długości `min(len·beat·0.95, takt·0.95, 2.2)`), także dla
    podglądu propozycji (`beatsPerChord = 2`). *(testy: whole = legacy
    przy 4 i 2 ćwierćnutach na akord; komplet starych asercji zielony)*

20. **Pogłos na metronomie** — klik puszczony przez convolver zamienia się
    w rozmyty szum i gubi funkcję metronomu.
    → Wysyłka do pogłosu tylko w `note()` (nuty); `click()` idzie suchą
    ścieżką wprost do mastera. Włącznik reguluje gain „wet", więc działa
    natychmiast, bez przebudowy grafu w trakcie grania.

21. **Glify podwójnych alteracji (utajony błąd)** — `spellPc` pisze 𝄪/𝄫
    (np. bVI w tonacji D♭ ma prymę **B𝄫**), a `parseNote` czytał tylko #/♯
    i b/♭ — progresja `bVI` w D♭ wywracała parser **od zawsze**; błąd znalazł
    masowy roundtrip rozpoznawania triad (12 tonacji × 4 skale × 7 stopni).
    → Regex `parseNote` przyjmuje 𝄪/𝄫 (oba glify mają `length === 2`, więc
    arytmetyka alteracji działa bez zmian). Niezmiennik z testem:
    `parseNote ∘ spellPc = id` dla |alteracji| ≤ 2 + regresja `bVI` w D♭.

22. **Triada zwiększona jest symetryczna** — każdy z trzech dźwięków może
    być prymą, więc „przewrót" aug jest niedefiniowalny z samych klas
    wysokości.
    → Konwencja: pryma aug = bas (przewrót zawsze „pozycja zasadnicza");
    skutek uboczny: diatoniczny aug (bIII+/III+ w moll harmonicznej
    i melodycznej) rozpoznany poza pozycją zasadniczą pokaże „zapożyczenie"
    — udokumentowane ograniczenie konwencji. *(test aug)*

23. **Wybór stopnia dla zapożyczeń** — interwał od toniki bywa dwuznaczny
    (6 półtonów = #IV albo bV).
    → Ranking: czysty stopień > bemol > krzyżyk — spójny z bemolową
    konwencją korpusu (bII/bIII/bVI/bVII); litera nuty wynika ze stopnia
    (dlatego w C-dur zaznaczone A♭/G♯ pisze się A♭ przy bVI). *(testy)*

24. **Klik na SVG ≠ współrzędne viewBoxa** — clientX/Y trzeba przeskalować,
    a logika „w które pole trafiłem" łatwo rozjeżdża się z rysowaniem.
    → `hitTest` to czysta odwrotność `dotX`/`stringY` w module geometrii,
    testowana roundtripem wszystkich pól w dwóch oknach (z siodełkiem
    i bez) plus granice dokładnie na drutach progów; warstwa brudna tylko
    skaluje piksele do viewBoxa. *(testy hitTest)*

---

## Ograniczenia i dalsze rozszerzenia

- ~~Tylko skala naturalna molowa~~ → **zrobione:** harmoniczna i melodyczna
  (wznosząca) molowa; jakości liczone z realnych interwałów, więc nowe warianty
  dają poprawne wyniki automatycznie. Parser progresji celowo pozostaje w
  konwencji durowej bazy (wariant skali steruje tylko diatoniką).
- Triady zamknięte (bez drop-2/drop-3, bez open voicings).
- Speller alteracji chromatycznych jest pragmatyczny (nie pełna analiza tonalna).
- ~~audio (Web Audio)~~ → **zrobione:** odtwarzanie pojedynczych voicingów (▶ na
  karcie, strum bas→sopran) i całych progresji (suwak BPM, podświetlanie granego
  akordu), tryb ćwiczenia (pętla + metronom z akcentem na „raz" + count-in),
  brzmienie syntezowane algorytmem Karplus-Strong (zero sampli, zero zależności).
  Harmonogram odtwarzania to czyste funkcje w silniku — testowalne bez
  `AudioContext`.
- **Stroje alternatywne:** struktura `TUNINGS` (strój = MIDI strun otwartych +
  nazwy strun); zaimplementowane: standardowy i Drop C. Voicing niesie swój strój,
  więc diagramy, taby i audio działają bez zmian; dodanie kolejnego stroju
  (Drop D, DADGAD…) = jeden wpis w mapie. Uwaga domenowa: w Drop C interwał
  struna 6→5 to kwinta (7 półtonów), nie kwarta — dlatego frety liczone są
  zawsze z jawnych MIDI strun otwartych, nigdy ze stałych odstępów.
- **Propozycje „co dalej?”** → **zrobione:** czysta heurystyka w silniku
  (tabele przejść funkcyjnych + korpus n-gramów, zero zależności); UI: 3 chipy
  pod polem progresji z uzasadnieniem w tooltipie, klik dopisuje stopień
  i przelicza plan, ▶ odtwarza przejście ostatni akord → kandydat na voicingu
  o minimalnym koszcie (`transitionCost`), odświeżanie na żywo podczas
  wpisywania (debounce 250 ms). Świadome decyzje: ranking czysto harmoniczny
  (koszt VL nie wpływa na kolejność propozycji — do rozważenia jako opcja),
  tryb moll dla pustego pola brany z wyboru skali w kontrolkach.
- **Skala steruje rankingiem propozycji** → **zrobione** (zob. §3): bonus
  diatoniczny + kara za zapożyczenie + unia kandydatów; fallback przy
  konflikcie skali z trybem progresji. Presety rozszerzone o Metal
  (`i-bVI-bVII`) i Frygijską (`i-bvii-bVI-bII`); korpus o `i-bVI-bVII-V`,
  `i-bVII-bVI-bVII` i vamp `i-bII` — wzorce udokumentowane w źródłach
  o harmonii metalowej/frygijskiej.
- **Tryb Sceny + Kopiuj link** → **zrobione:** pełnoekranowa nakładka do grania
  i prezentacji (wielka typografia: cyfra rzymska + nazwa aktualnego akordu,
  zapowiedź następnego, licznik `akord i / n`, pasek progresji), gryf-scena
  powiększony na środku, transport w szklanym doku (blur + krawędź + cień,
  paleta bursztyn/drewno), wejście/wyjście przyciskiem `⛶ Scena` / `✕ Wyjdź` / Esc.
  Świadome decyzje: (1) **zero duplikacji** — nakładka przejmuje żywe węzły DOM,
  a typografię akordu napędza hak `FretboardView.setOnIdx` (to samo źródło prawdy,
  które ustawia podpis pod gryfem; odpala się tylko przy zmianie indeksu, nie co
  klatkę); (2) **hierarchia ruchu nienaruszona** — pływający „żar" w tle sceny to
  czysta dekoracja, więc animuje się wyłącznie przy włączonym checkboxie „efekty"
  i poza `prefers-reduced-motion`. Link: `encodeShareState`/`decodeShareState`
  w silniku (13 asercji), przycisk **Kopiuj link** koduje pełny stan wejściowy do
  fragmentu URL (z fallbackiem schowka), `#…&st=1` otwiera aplikację od razu na
  scenie z wczytaną progresją; pasek adresu jest synchronizowany (`replaceState`)
  tylko w sesjach rozpoczętych z linka — czysty URL zostaje czysty.
- **Żywe brzmienie (audio 2.0)** → **zrobione:** wzorce rytmiczne jako czyste
  funkcje w silniku (`rhythm-patterns.js`): Całe nuty (dawne zachowanie),
  Rock `D·DU·UDU` (strumy down/up z velocity — kostka w górę gra ciszej,
  „raz" akcentowany) i Ballada (arpeggio ósemkowe bas-środek-sopran z dłużej
  wybrzmiewającym basem). Humanizacja: deterministyczny jitter ±8 ms / ±12%
  głośności (seedowany `mulberry32` → testowalna co do bajta), seed losowany
  per sesja i przesuwany per okrążenie pętli ćwiczenia — każde okrążenie
  „oddycha" inaczej. Warstwa Web Audio: pogłos z proceduralnego impulsu
  (gasnący szum stereo, zero sampli — w duchu Karplus-Stronga), panorama
  głosów bas←→sopran, velocity w plucku. UI: select „rytm" + checkbox
  „pogłos" w transporcie; zmiana rytmu w trakcie grania restartuje sesję
  w tym samym trybie (natychmiastowy efekt na scenie); wzorzec jest częścią
  linku udostępniania (`pt=`). Świadome decyzje: poświaty gryfu liczone
  z tego samego wzorca, ale bez humanizacji (zob. pułapka 18); pogłos nie
  trafia do linku (preferencja lokalna, nie treść muzyczna); metronom suchy.
- **Gryf jako instrument (zakładka Gryf)** → **zrobione:** klikalny gryf —
  odwrócenie przepływu danych (dotąd aplikacja mówiła, gdzie położyć palce;
  teraz użytkownik pokazuje chwyt, a silnik go nazywa). Klik gra dźwięk
  i zaznacza pole (`hitTest` w czystej geometrii), trzy dźwięki na trzech
  strunach → `recognizeTriad`: jakość, pryma, przewrót z basu, slash-nazwa
  (C/E), zapis rzymski w tonacji + plakietka „diatoniczny / zapożyczenie",
  akcje ▶ Zagraj i „Dopisz stopień do progresji" (domyka pętlę: gryf →
  stopień → progresja → scena). Nakładka skali diatonicznej (kropki-duchy,
  tonika jako pierścień) reaguje na tonację/wariant skali/strój. Selekcja:
  jeden dźwięk na strunę, maks. 3 z FIFO (czwarty klik wypycha najstarszy),
  klik w zaznaczone pole odznacza. Bonus iteracji: **żywe tempo** — zmiana
  BPM lub rytmu w trakcie grania restartuje sesję w tym samym trybie.
  Masowy roundtrip rozpoznania (12 tonacji × 4 skale × 7 stopni) znalazł
  i naprawił utajony błąd spellera (pułapka 21).
- Roadmapa: seventh chords (N-głosowy generator), drop-2, arpeggia, eksport MIDI,
  zapis PNG taba, kolejne stroje (Drop D, DADGAD), ranking propozycji ważony
  kosztem voice leadingu, własny edytor wzorców rytmicznych, rozpoznawanie
  triad rozszerzone o seventh chords, prawdziwie ciągłe tempo (bez restartu).
