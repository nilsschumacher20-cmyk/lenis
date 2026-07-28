# Rechnungsgenerator

JSON rein, druckfertige Rechnung raus. Keine Abhängigkeiten, nur Node ≥ 18.

## Benutzung

```bash
# Einmalig: eigene Daten eintragen
$EDITOR agentur/rechnung/stammdaten.json

# Rechnung erzeugen
node agentur/rechnung/generate.mjs agentur/rechnung/rechnungen/2026-001.json

# zusätzlich als XRechnung-XML (E-Rechnung)
node agentur/rechnung/generate.mjs agentur/rechnung/rechnungen/2026-001.json --xml

# anderes Ausgabeverzeichnis
node agentur/rechnung/generate.mjs rechnungen/2026-001.json --out ~/Buchhaltung/2026
```

Ergebnis liegt in `out/RE-2026-001.html`. Im Browser öffnen →
**Drucken → Als PDF sichern**, Ränder auf „Standard", Kopf-/Fußzeilen aus.
Das Layout ist auf A4 ausgelegt.

## Dateien

| Datei | Zweck |
|---|---|
| `stammdaten.json` | Deine Agenturdaten — einmal ausfüllen |
| `rechnungen/*.json` | Eine Datei pro Rechnung |
| `vorlage.html` | Layout. Darf frei umgestaltet werden, solange die Platzhalter bleiben |
| `generate.mjs` | Generator inkl. Prüfung der Pflichtangaben |
| `out/` | Erzeugte Rechnungen (nicht eingecheckt) |

## Aufbau einer Rechnungsdatei

```jsonc
{
  "nummer": "RE-2026-001",              // fortlaufend, einmalig
  "datum": "2026-04-25",                // Ausstellungsdatum
  "leistungszeitraum": {                // ODER "leistungsdatum": "2026-04-25"
    "von": "2026-05-01",
    "bis": "2026-05-31"
  },
  "kunde": {
    "firma": "Muster GmbH",
    "ansprechpartner": "Frau Muster",   // optional
    "strasse": "Hauptstraße 45",
    "plz": "48151",
    "ort": "Münster",
    "laendercode": "DE",                // optional, Standard DE
    "ustIdNr": "DE987654321",           // optional
    "kundennummer": "K-2026-003",       // optional
    "referenz": "Vertrag vom 12.03.26", // optional
    "leitwegId": "..."                  // nur bei Behörden als Kunde (XRechnung)
  },
  "positionen": [
    {
      "bezeichnung": "Social-Media-Betreuung Instagram",
      "beschreibung": "8 Posts, 4 Reels, …",  // optional
      "menge": 1,
      "einheit": "Monat",               // Monat | Stunde | Tag | Stück | Pauschale
      "einzelpreis": 1500.0             // NETTO
    }
  ],
  "hinweis": "Vielen Dank …",           // optional
  "zahlungszielTage": 14,               // optional, sonst aus stammdaten.json
  "steuersatz": 19                      // optional, sonst aus stammdaten.json
}
```

Alle Preise werden **netto** angegeben. Die Umsatzsteuer rechnet der Generator
dazu — außer `"kleinunternehmer": true` steht in den Stammdaten, dann entfällt
sie und der Hinweis nach § 19 UStG erscheint automatisch.

## Prüfung der Pflichtangaben

Vor der Ausgabe prüft der Generator die Angaben nach § 14 Abs. 4 UStG:
Anschriften beider Parteien, Steuernummer/USt-IdNr., Rechnungsnummer,
Ausstellungsdatum, Leistungszeitraum, Menge und Art der Leistung, Nettobetrag,
Steuersatz und Steuerbetrag. Fehlt etwas, bricht er mit einer konkreten
Fehlermeldung ab, statt eine unbrauchbare Rechnung zu schreiben.

## Zur XRechnung

`--xml` erzeugt eine XRechnung im UBL-2.1-Format (Profil XRechnung 3.0). Das
deckt den Standardfall „ein Retainer, ein Steuersatz, SEPA-Überweisung" ab und
ist als Vorbereitung auf die E-Rechnungspflicht ab 01.01.2028 gedacht.

**Vor dem ersten echten Versand einmal validieren** — z. B. mit dem
KoSIT-Validator oder einem Online-Prüftool. Der Generator ist nicht zertifiziert,
und für Behördenkunden ist zusätzlich eine **Leitweg-ID** verpflichtend
(Feld `kunde.leitwegId`).

Details zu Fristen und Formaten: [`../04-rechnungsstellung.md`](../04-rechnungsstellung.md), Abschnitt 5.

## Empfohlener Ablauf im Monat

1. Am **25.** die Rechnungen für den Folgemonat erzeugen
2. HTML als PDF exportieren, per Mail an die Buchhaltung des Kunden
3. Rechnung in einer Übersichtstabelle erfassen (Nummer, Kunde, Betrag, fällig, bezahlt)
4. Zahlungseingänge wöchentlich abgleichen, bei Überschreitung: Ablauf aus
   [`../04-rechnungsstellung.md`](../04-rechnungsstellung.md), Abschnitt 7

Ab etwa fünf Kunden lohnt der Umstieg auf eine Buchhaltungssoftware mit
Bankabgleich und automatischem Versand.
