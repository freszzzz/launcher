/*
 * Fresh – lista modułów moda w grze (menu pod PRAWYM SHIFTEM).
 * Identyfikatory muszą zgadzać się z modułami w mod (pl.freshclient.mod.module.Modules).
 * Stan zapisuje się w <folder gry>/fresh/modules.json – wspólnie dla launchera i moda.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FreshModules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CATEGORIES = { hud: 'HUD', render: 'Grafika i kamera', move: 'Ruch', misc: 'Fresh' };

  const MODULES = [
    { id: 'fps', name: 'Licznik FPS', category: 'hud', on: true, desc: 'Klatki na sekundę, opcjonalnie w kolorze wydajności.' },
    { id: 'cps', name: 'Licznik CPS', category: 'hud', on: true, desc: 'Kliknięcia na sekundę lewym i prawym przyciskiem.' },
    { id: 'keystrokes', name: 'Keystrokes', category: 'hud', on: true, desc: 'Animowane W A S D, mysz z CPS i spacja.' },
    { id: 'coords', name: 'Koordynaty', category: 'hud', on: false, desc: 'XYZ, kierunek, biom i przelicznik Netheru.' },
    { id: 'armor', name: 'Status zbroi', category: 'hud', on: true, desc: 'Zbroja i przedmioty w rękach z wytrzymałością.' },
    { id: 'potions', name: 'Efekty mikstur', category: 'hud', on: true, desc: 'Aktywne efekty w ich kolorach i czas trwania.' },
    { id: 'clock', name: 'Zegar', category: 'hud', on: false, desc: 'Godzina z komputera, 24h lub 12h.' },
    { id: 'ping', name: 'Ping', category: 'hud', on: false, desc: 'Opóźnienie do serwera z kolorem jakości.' },
    { id: 'direction', name: 'Kompas', category: 'hud', on: false, desc: 'Przewijany pasek kierunków jak w grach FPS.' },
    { id: 'speed', name: 'Prędkość', category: 'hud', on: false, desc: 'Prędkość ruchu w b/s lub km/h.' },
    { id: 'memory', name: 'Pamięć RAM', category: 'hud', on: false, desc: 'Zużycie pamięci przez grę.' },
    { id: 'server', name: 'Adres serwera', category: 'hud', on: false, desc: 'Adres serwera, na którym grasz.' },
    { id: 'day', name: 'Licznik dni', category: 'hud', on: false, desc: 'Który to dzień w świecie.' },
    { id: 'fullbright', name: 'Fullbright', category: 'render', on: false, desc: 'Regulowana jasność – widać wszystko w jaskiniach.' },
    { id: 'zoom', name: 'Zoom', category: 'render', on: true, desc: 'Przytrzymaj C. Kółkiem regulujesz przybliżenie.' },
    { id: 'freelook', name: 'Freelook', category: 'render', on: true, desc: 'Lewy Alt – rozglądaj się bez obracania postaci.' },
    { id: 'crosshair', name: 'Własny celownik', category: 'render', on: false, desc: 'Kształt, kolor, rozmiar, obrys i kolor na celu.' },
    { id: 'nametag_self', name: 'Własny nick w F5', category: 'render', on: true, desc: 'Twój nick z ikonką nad głową w widoku z boku.' },
    { id: 'nohurtcam', name: 'No Hurtcam', category: 'render', on: false, desc: 'Brak trzęsienia kamery przy obrażeniach.' },
    { id: 'weather', name: 'Pogoda', category: 'render', on: false, desc: 'Wybierz pogodę widoczną tylko u Ciebie.' },
    { id: 'time', name: 'Pora dnia', category: 'render', on: false, desc: 'Ustaw własną godzinę nieba (tylko wizualnie).' },
    { id: 'lowfire', name: 'Niski ogień', category: 'render', on: false, desc: 'Ogień na ekranie nie zasłania widoku.' },
    { id: 'togglesprint', name: 'Toggle Sprint', category: 'move', on: false, desc: 'Sprint na stałe, opcjonalnie przełączane skradanie.' },
    { id: 'nametag_icons', name: 'Ikonki przy nicku', category: 'misc', on: true, desc: 'Logo Fresh obok nicku graczy z launcherem.' },
    { id: 'cosmetics', name: 'Kosmetyki 3D', category: 'misc', on: true, desc: 'Pokazuj kosmetyki – swoje i innych graczy Fresh.' },
    { id: 'emotes', name: 'Emotki 3D', category: 'misc', on: true, desc: 'Przytrzymaj B – koło 8 emotek, które widzą gracze Fresh.' }
  ];

  return { CATEGORIES, MODULES };
});
