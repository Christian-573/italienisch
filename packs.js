// Wortpakete. Das nächste Paket wird freigeschaltet, sobald das letzte freigeschaltete zu 80 % gefestigt ist.
// Bitte bei Gelegenheit gegenlesen – Tippfehler und Übersetzungsnuancen sind möglich.
const PACKS = [
  { id: 'a1-basis', name: 'A1 – Basis', words: STARTER_WORDS },
  { id: 'a1-alltag', name: 'A1 – Alltag & Reisen', words: [
    ["il ristorante","das Restaurant"],["la colazione","das Frühstück"],["il pranzo","das Mittagessen"],["la cena","das Abendessen"],
    ["la fame","der Hunger"],["la sete","der Durst"],["il sale","das Salz"],["il pepe","der Pfeffer"],["lo zucchero","der Zucker"],
    ["l'olio","das Öl"],["il riso","der Reis"],["l'uovo","das Ei"],["la zuppa","die Suppe"],["l'insalata","der Salat"],
    ["la verdura","das Gemüse"],["la frutta","das Obst"],["il pomodoro","die Tomate"],["la patata","die Kartoffel"],["il pollo","das Hähnchen"],
    ["il tavolo","der Tisch"],["la sedia","der Stuhl"],["il bicchiere","das Glas"],["il coltello","das Messer"],["la forchetta","die Gabel"],
    ["il cucchiaio","der Löffel"],["il biglietto","die Fahrkarte / das Ticket"],["il treno","der Zug"],["l'autobus","der Bus"],
    ["l'aereo","das Flugzeug"],["l'aeroporto","der Flughafen"],["la macchina","das Auto"],["la bicicletta","das Fahrrad"],
    ["la valigia","der Koffer"],["il passaporto","der Reisepass"],["la mappa","die Landkarte"],
    ["a destra","rechts"],["a sinistra","links"],["dritto","geradeaus"],["vicino","nah"],["lontano","weit"],["qui","hier"],["là","dort"],
    ["aperto","geöffnet"],["chiuso","geschlossen"],["il negozio","das Geschäft"],["il supermercato","der Supermarkt"],["la farmacia","die Apotheke"],
    ["l'ospedale","das Krankenhaus"],["il medico","der Arzt"],["l'aiuto","die Hilfe"],["i soldi","das Geld"],["la banca","die Bank"],["il prezzo","der Preis"],
    ["la famiglia","die Familie"],["la madre","die Mutter"],["il padre","der Vater"],["il fratello","der Bruder"],["la sorella","die Schwester"],
    ["l'amico","der Freund"],["l'amica","die Freundin"],["il bambino","der Junge / das Kind"],["la bambina","das Mädchen"],["l'uomo","der Mann"],["la donna","die Frau"],
    ["il lavoro","die Arbeit"],["la scuola","die Schule"],["il libro","das Buch"],["il telefono","das Telefon"],
    ["il giorno","der Tag"],["la settimana","die Woche"],["il mese","der Monat"],["l'anno","das Jahr"],["la mattina","der Morgen"],["la sera","der Abend"],["la notte","die Nacht"],
    ["il sole","die Sonne"],["la pioggia","der Regen"],["freddo","kalt"],["caldo","warm / heiß"]
  ]},
  { id: 'a2-basis', name: 'A2 – Verben, Wörter & Verbindungen', words: [
    ["abitare","wohnen"],["lavorare","arbeiten"],["studiare","lernen / studieren"],["comprare","kaufen"],["vendere","verkaufen"],["prendere","nehmen"],
    ["vedere","sehen"],["sentire","hören / fühlen"],["sapere","wissen"],["conoscere","kennen"],["dire","sagen"],["dare","geben"],
    ["venire","kommen"],["partire","abreisen / losfahren"],["arrivare","ankommen"],["aspettare","warten"],["cercare","suchen"],["trovare","finden"],
    ["pensare","denken"],["credere","glauben"],["ricordare","sich erinnern (an)"],["dimenticare","vergessen"],["chiedere","fragen / bitten"],["rispondere","antworten"],
    ["aprire","öffnen"],["chiudere","schließen"],["iniziare","beginnen"],["finire","beenden"],["dormire","schlafen"],["vivere","leben"],["amare","lieben"],["piacere","gefallen"],
    ["l'esperienza","die Erfahrung"],["il problema","das Problem"],["la domanda","die Frage"],["la risposta","die Antwort"],["la verità","die Wahrheit"],["il motivo","der Grund"],
    ["la vacanza","der Urlaub"],["il viaggio","die Reise"],["la festa","das Fest / die Party"],["il compleanno","der Geburtstag"],["il regalo","das Geschenk"],
    ["il vestito","das Kleid / der Anzug"],["la camicia","das Hemd"],["le scarpe","die Schuhe"],["il colore","die Farbe"],
    ["rosso","rot"],["blu","blau"],["verde","grün"],["giallo","gelb"],["nero","schwarz"],["bianco","weiß"],
    ["nuovo","neu"],["vecchio","alt"],["giovane","jung"],["facile","einfach"],["difficile","schwierig"],["importante","wichtig"],["stanco","müde"],["felice","glücklich"],["triste","traurig"],
    ["ancora","noch / wieder"],["già","schon"],["mai","nie / jemals"],["spesso","oft"],["forse","vielleicht"],["molto","sehr / viel"],["poco","wenig"],["troppo","zu viel"],
    ["perché","warum / weil"],["quando","wann / als"],["come","wie"],["dove","wo"],["chi","wer"],["che cosa","was"],
    ["però","aber"],["quindi","also / deshalb"],["invece","stattdessen"],["mentre","während"],["dopo","nach / danach"],["prima","vorher / zuerst"],["senza","ohne"],["con","mit"]
  ]}
];
