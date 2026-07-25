# Social-Media-Agentur — Instagram-Retainer 1.500 € / Monat

Dieser Ordner enthält **Geschäftsunterlagen**, keinen Bibliotheks-Code des Repos.
Alles ist so geschrieben, dass du es direkt benutzen kannst: kopieren, Platzhalter
ersetzen, losarbeiten.

## Inhalt

| Datei | Inhalt |
|---|---|
| [`01-angebot-und-kalkulation.md`](01-angebot-und-kalkulation.md) | Was genau für 1.500 €/Monat drin ist, Zeitaufwand, Deckungsbeitrag, Preisstaffel |
| [`02-12-monats-plan.md`](02-12-monats-plan.md) | Monat für Monat: Ziele, Aufgaben, KPI, Umsatzplan |
| [`03-akquise-anschreiben.md`](03-akquise-anschreiben.md) | Kalt-Mail, Instagram-DM, Telefonleitfaden, Follow-ups, Angebotsmail |
| [`04-rechnungsstellung.md`](04-rechnungsstellung.md) | Pflichtangaben, Kleinunternehmer vs. Regelbesteuerung, E-Rechnung, Mahnwesen |
| [`05-onboarding-und-betrieb.md`](05-onboarding-und-betrieb.md) | Kunden-Onboarding, Zugriffe, Monatsrhythmus, Reporting |
| [`06-zielliste-brandenburg.md`](06-zielliste-brandenburg.md) | Marktgröße Raum Brandenburg a.d.H., Radius, Listenaufbau in 4 Stunden |
| [`akquise/zielliste.csv`](akquise/zielliste.csv) | Arbeitsdatei für die Kaltakquise (Excel/LibreOffice) |
| [`07-leistungspakete.md`](07-leistungspakete.md) | Drei Pakete inkl. Kalkulation, Verkaufslogik und Google-Ads-Regeln |
| [`angebot/pakete.html`](angebot/pakete.html) | Kundenblatt zum Ausdrucken (A4, eine Seite) |
| [`08-materialbeschaffung.md`](08-materialbeschaffung.md) | Woher Fotos und Videos kommen: Drehtag, Archiv, Kundenzulieferung |
| [`vorlagen/drehauftrag.md`](vorlagen/drehauftrag.md) | Monatlicher Drehauftrag an den Kunden + Filmanleitung |
| [`09-name-und-marke.md`](09-name-und-marke.md) | Namensfindung, Firmierungsrecht, Marken- und Domainprüfung |
| [`rechnung/`](rechnung/) | Rechnungsgenerator: JSON rein → druckfertige HTML-Rechnung (+ XRechnung-XML) raus |

## Schnellstart

```bash
# 1. Stammdaten deiner Agentur eintragen
$EDITOR agentur/rechnung/stammdaten.json

# 2. Beispielrechnung erzeugen
node agentur/rechnung/generate.mjs agentur/rechnung/rechnungen/2026-001.json

# 3. Ergebnis öffnen und per Browser als PDF drucken
open agentur/rechnung/out/RE-2026-001.html
```

## Wichtiger Hinweis

Die Abschnitte zu Steuern, Rechnungspflichtangaben und Wettbewerbsrecht sind
sorgfältig recherchierte **Orientierung, keine Steuer- oder Rechtsberatung**.
Bevor du die erste echte Rechnung schreibst und bevor du in die Kaltakquise
gehst: einmal mit Steuerberater:in bzw. Anwält:in gegenlesen. Das kostet dich
einmal ein paar hundert Euro und spart dir potenziell fünfstellige Probleme.
