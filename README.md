# Triady

Jednoplikowa aplikacja webowa do generowania zamkniętych triad gitarowych, pracy z diatoniką tonacji i budowania progresji z minimalnym prowadzeniem głosów. Aplikacja działa bez backendu i bez frameworków, opiera się na czystym HTML, CSS i JavaScript, a dodatkowo potrafi odtwarzać voicingi oraz całe progresje bezpośrednio w przeglądarce.

## Co robi aplikacja

Triady pomagają szybko znaleźć grywalne układy triad na wybranych zestawach strun, przełączać się między przewrotami i rozumieć ich funkcję w tonacji. Silnik potrafi też zaplanować całą progresję tak, aby ruch między kolejnymi voicingami był możliwie mały, korzystając z algorytmu minimal voice leading opartego na programowaniu dynamicznym.

Najważniejsze możliwości:

- Generowanie zamkniętych triad dla jakości: dur, moll, zmniejszony i zwiększony.
- Obsługa zestawów strun 3-2-1, 4-3-2, 5-4-3 i 6-5-4.
- Filtrowanie po przewrotach, zakresie progów, tonacji, skali i stroju.
- Praca na diatonice tonacji w skalach durowej, molowej naturalnej, harmonicznej i melodycznej.
- Parsowanie progresji zapisanych cyframi rzymskimi, na przykład `I-V-vi-IV` albo `i-bVII-bVI-V`.
- Automatyczne układanie voicingów z minimalnym prowadzeniem głosów.
- Sugestie „co dalej?” dla kolejnego stopnia progresji na podstawie heurystyk harmonicznych i korpusu popularnych wzorców.
- Odtwarzanie pojedynczych voicingów i całych progresji przez Web Audio, z rytmami, metronomem, count-inem i opcjonalnym pogłosem.
- Tryb Sceny do grania i prezentacji progresji na dużym, animowanym gryfie.
- Karta Gryf, w której można kliknąć dźwięki na podstrunnicy, rozpoznać triadę i dopisać ją do progresji.
- Udostępnianie stanu aplikacji przez URL dzięki funkcji „Kopiuj link”.

## Jak działa

Model danych opiera się na klasach wysokości MIDI, jawnie zdefiniowanych strojach oraz poprawnym spellingu enharmonicznym, dzięki czemu aplikacja nie zgaduje nazw nut „po krzyżykach”, tylko wyprowadza je z funkcji skali i akordu. Generowanie triad uwzględnia prawdziwe relacje między strunami, w tym nieregularność między strunami G i B, co jest kluczowe dla poprawnych tabów i diagramów.

Planowanie progresji odbywa się warstwowo: dla każdego akordu generowany jest zbiór możliwych voicingów, a następnie silnik wybiera najtańszą ścieżkę między nimi. Koszt przejścia liczy różnice progów na tych samych strunach i dodaje lekką karę za duży skok pozycji, dzięki czemu wynik jest zarówno muzycznie płynny, jak i grywalny.

## Architektura

Docelowa architektura została opisana jako zestaw logicznych modułów, mimo że wdrożenie końcowe mieści się w jednym pliku `index.html`. PRD wyróżnia między innymi moduły odpowiedzialne za notację i teorię (`notes.js`), geometrię gryfu (`fretboard.js`, `fretboard-geometry.js`), generowanie triad (`triad-generator.js`), planowanie progresji (`progression-engine.js`), sugestie harmoniczne (`suggestion-engine.js`), audio (`audio.js`, `audio-schedule.js`, `rhythm-patterns.js`), animację (`anim-timeline.js`), rozpoznawanie triad (`triad-recognition.js`) oraz serializację stanu do URL (`share-state.js`).

Taki podział ma jedną ważną zaletę: silnik pozostaje bezstanowy i deterministyczny, więc łatwo go testować, rozwijać i utrzymywać. Te same wejścia dają te same wyjścia, a warstwa UI tylko wizualizuje wynik działania czystych funkcji.

## Stroje i zakres funkcji

Aktualnie aplikacja wspiera dwa stroje: standardowy oraz Drop C. Dzięki temu diagramy, taby, audio i minimal voice leading działają nie tylko dla klasycznego stroju E A D G B e, ale również dla cięższych zastosowań harmonicznych i riffowych.

Obsługiwane są wyłącznie triady zamknięte, bez drop-2, drop-3 i bez open voicings. Roadmapa przewiduje jednak dalszy rozwój w stronę akordów septymowych, arpeggiów, eksportu MIDI, dodatkowych strojów oraz bardziej zaawansowanego rankingu sugestii.

## Audio i interakcja

Warstwa audio korzysta z Web Audio API, czyli przeglądarkowego silnika DSP do tworzenia grafu audio, planowania zdarzeń w czasie i kontroli parametrów takich jak głośność, panorama czy pogłos. W praktyce aplikacja nie odtwarza gotowych plików dźwiękowych, tylko sama syntetyzuje brzmienie i precyzyjnie ustawia moment startu każdego dźwięku, uderzenia metronomu oraz kolejnych akordów w progresji.

Podstawowe brzmienie struny powstaje przez syntezę typu Karplus-Strong. To klasyczna technika modelowania fizycznego, w której krótki impuls szumu trafia do bardzo krótkiej pętli opóźniającej z tłumieniem i prostym filtrowaniem. Taki układ zachowuje się podobnie do szarpniętej struny: początek jest jasny i perkusyjny, a potem dźwięk naturalnie wygasa. W tym projekcie daje to lekki, gitaropodobny „pluck” bez użycia sampli, a dodatkowy convolver dokłada syntetyczny pogłos, żeby brzmienie nie było całkowicie suche.

Można odtwarzać pojedyncze voicingi, całą progresję, pętlę ćwiczeniową, a także korzystać z rytmów takich jak całe nuty, rockowy strumming i balladowe arpeggio.

Interfejs pokazuje nie tylko karty voicingów i tabulatury, ale też animowany gryf sceniczny, podświetlenie aktualnie granego akordu oraz interaktywny gryf do wskazywania nut. To sprawia, że aplikacja działa jednocześnie jako pomoc teoretyczna, ćwiczeniówka i szybki proof-of-concept muzycznego narzędzia pisanego z AI-pair programmerem.

## Uruchomienie

Ponieważ jest to aplikacja statyczna, najprostszy sposób uruchomienia to otwarcie pliku HTML w przeglądarce. Jeśli przeglądarka ogranicza niektóre funkcje przy otwieraniu pliku lokalnego, wygodniej uruchomić prosty serwer HTTP w katalogu projektu.

Przykład:

```bash
python -m http.server 8000
```

Następnie otwórz adres `http://localhost:8000/` i załaduj plik aplikacji. Sam stan aplikacji może być współdzielony przez fragment URL, więc testowanie presetów i progresji jest wygodne także między urządzeniami.

## Przykładowe użycie

1. Wybierz tonację, skalę, strój i zestaw strun.
2. W zakładce **Akord** sprawdź dostępne przewroty triady.
3. W zakładce **Diatonika** klikaj stopnie skali, aby szybko przechodzić po funkcjach harmonicznych.
4. W zakładce **Progresja** wpisz ciąg cyfr rzymskich i wygeneruj plan voicingów z minimalnym ruchem palców.
5. Użyj **Odtwórz**, **Ćwicz** i **Scena**, aby usłyszeć i zobaczyć progresję w ruchu.
6. W zakładce **Gryf** zaznacz trzy dźwięki i sprawdź, jaką triadę rozpoznaje silnik.

## Jakość i testy

PRD opisuje szeroki zestaw testów obejmujących między innymi enharmonię, rozpoznawanie przewrotów, planowanie voice leadingu, stroje alternatywne, geometrię gryfu, animację, share-state i audio scheduling. Wspomniane jest 166 asercji, co pokazuje, że projekt od początku był traktowany nie jako jednorazowy hack, ale jako mały, solidny silnik muzyczny.

## Ograniczenia

Aktualna wersja skupia się na triadach zamkniętych i nie próbuje być pełnym systemem analizy harmonicznej. Speller alteracji jest pragmatyczny, parser progresji celowo trzyma się jednej, spójnej konwencji chromatycznej, a część zaawansowanych przypadków, takich jak pełne rozstrzyganie funkcji akordów zwiększonych, została świadomie uproszczona i udokumentowana.

## Roadmapa

Kierunki dalszego rozwoju opisane w PRD obejmują:

- seventh chords i N-głosowy generator voicingów,
- drop-2, arpeggia i open voicings,
- eksport MIDI i zapis PNG tabów,
- kolejne stroje, takie jak Drop D i DADGAD,
- rozszerzenie rozpoznawania akordów,
- bardziej zaawansowane sterowanie rankingiem sugestii harmonicznych.

## Dla kogo

To narzędzie jest przydatne dla gitarzystów, którzy chcą szybciej ogarniać przewroty i voice leading, dla songwriterów układających progresje, a także dla developerów zainteresowanych tym, jak daleko można zajść z muzyczną aplikacją webową bez frameworków i bez backendu.
