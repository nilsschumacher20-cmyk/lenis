# 04 — Rechnungsstellung

> Orientierung, keine Steuerberatung. Einmal mit deiner Steuerberatung
> gegenlesen, bevor die erste echte Rechnung rausgeht.

## 1. Kleinunternehmer oder Regelbesteuerung?

**Kleinunternehmerregelung (§ 19 UStG)** seit 2025:
- Vorjahresumsatz ≤ **25.000 €** *und* laufendes Jahr ≤ **100.000 €**
- Du weist **keine** Umsatzsteuer aus, darfst aber auch **keine Vorsteuer** ziehen
- Wird die 100.000-€-Grenze im laufenden Jahr überschritten, wirst du **ab
  diesem Umsatz sofort** umsatzsteuerpflichtig — nicht erst im Folgejahr

**Für dich: Regelbesteuerung, von Anfang an.** Drei Gründe:

1. Schon **zwei Kunden** (2 × 1.500 € × 12 = 36.000 €) reißen die 25.000-€-Grenze.
   Du wärst spätestens im zweiten Jahr ohnehin regelbesteuert
2. Deine Kunden sind Unternehmen — die ziehen die Umsatzsteuer als Vorsteuer ab.
   Für sie kostet dein Angebot mit oder ohne USt exakt gleich viel. Der
   vermeintliche „Preisvorteil" der Kleinunternehmerregelung existiert im B2B nicht
3. Du ziehst Vorsteuer aus Kamera, Laptop, Software, Freelancer-Rechnungen —
   bei deinen Anschaffungen im ersten Jahr sind das schnell 2.000–3.000 €

Der Preis dafür: monatliche (im Gründungsjahr) bzw. quartalsweise
Umsatzsteuer-Voranmeldung. Macht deine Buchhaltungssoftware automatisch.

**Merke:** Die vereinnahmte Umsatzsteuer gehört dir nicht. Bei 1.500 € netto
kommen 1.785 € rein — 285 € davon sind Durchlaufposten fürs Finanzamt.
Zusammen mit der Einkommensteuer-Rücklage: **35 % jedes Eingangs sofort auf
ein separates Konto.**

## 2. Pflichtangaben (§ 14 Abs. 4 UStG)

Fehlt eine Angabe, darf dein Kunde keine Vorsteuer ziehen — er kommt zurück und
will eine korrigierte Rechnung. Peinlich und vermeidbar.

1. Vollständiger Name und Anschrift **deines Unternehmens**
2. Vollständiger Name und Anschrift **des Kunden**
3. Deine **Steuernummer** oder **USt-IdNr.**
4. **Ausstellungsdatum**
5. **Fortlaufende, einmalig vergebene Rechnungsnummer**
6. **Menge und Art** der Leistung („Social-Media-Betreuung Instagram, Paket
   Komplett" — nicht nur „Dienstleistung")
7. **Zeitpunkt bzw. Zeitraum der Leistung** (z. B. „Leistungszeitraum:
   01.–31.03.2026") — auch wenn er mit dem Rechnungsdatum übereinstimmt
8. **Nettoentgelt**, aufgeschlüsselt nach Steuersätzen
9. **Steuersatz und Steuerbetrag** — oder Hinweis auf Steuerbefreiung
10. Ggf. vorab vereinbarte **Minderungen des Entgelts** (Skonto, Rabatte)

**Kleinbetragsrechnungen bis 250 € brutto** kommen mit weniger Angaben aus —
für dein Geschäft irrelevant, aber gut zu wissen für Belege, die du selbst bekommst.

Bei **Kleinunternehmerstatus** zusätzlich der Hinweis:
„Gemäß § 19 UStG wird keine Umsatzsteuer berechnet."

## 3. Rechnungsnummern

Fortlaufend und **einmalig** — jede Nummer darf nur einmal existieren, Lücken
solltest du erklären können.

Empfohlenes Schema: **`RE-2026-001`**
- `RE` Präfix · `2026` Jahr · `001` fortlaufend, jährlich zurückgesetzt

Gutschriften/Stornos bekommen eine eigene Nummer aus derselben Reihe (nicht die
Originalnummer erneut vergeben) mit Verweis: „Storno zu RE-2026-014".

## 4. Der Retainer-Rhythmus

Bei monatlicher Betreuung **immer im Voraus abrechnen** — du lieferst einen
Monat lang, bevor du sonst Geld siehst.

| Wann | Was |
|---|---|
| 25. des Vormonats | Rechnung für den Folgemonat erstellen und versenden |
| 1. des Monats | Leistungsbeginn |
| Zahlungsziel | **14 Tage ab Rechnungsdatum** |
| SEPA-Lastschrift | Wenn der Kunde mitmacht: Mandat einholen. Spart dir das komplette Mahnwesen |

Formulierung für den Leistungszeitraum bei Vorausrechnung:
„Leistungszeitraum: 01.04.2026 – 30.04.2026".

**Setup-Fee** wird separat und sofort bei Vertragsabschluss berechnet, nicht mit
dem ersten Monat vermischt.

## 5. E-Rechnung — Zeitplan (Stand Mitte 2026)

| Ab wann | Was gilt |
|---|---|
| seit 01.01.2025 | **Alle** Unternehmen in Deutschland müssen E-Rechnungen **empfangen** können. Eine E-Mail-Adresse dafür reicht |
| bis 31.12.2026 | Übergangsfrist: Papier- und PDF-Rechnungen im B2B weiterhin zulässig (PDF nur mit Zustimmung des Empfängers) |
| ab 01.01.2027 | Unternehmen mit Vorjahresumsatz **über 800.000 €** müssen E-Rechnungen **versenden** |
| ab 01.01.2028 | **Alle** Unternehmen müssen E-Rechnungen versenden |

**Für dich konkret:** Mit ~120.000 € Jahresumsatz darfst du bis Ende 2027 weiter
PDF verschicken (mit Zustimmung des Kunden — hol sie dir schriftlich im Vertrag).
**Ab 01.01.2028 musst du umstellen.** Empfangen können musst du schon jetzt:
Richte eine feste Adresse wie `rechnung@deine-agentur.de` ein und archiviere
dort alles.

Zulässige Formate: **XRechnung** (reines XML) und **ZUGFeRD ab 2.0.1** (PDF mit
eingebettetem XML). Der Generator in [`rechnung/`](rechnung/) erzeugt neben der
HTML/PDF-Rechnung optional bereits eine XRechnung-XML-Datei — damit bist du
vorbereitet, ohne die Software wechseln zu müssen.

> Ein PDF ist **keine** E-Rechnung. Auch ein sehr schönes nicht. Entscheidend ist
> das maschinenlesbare, strukturierte XML.

## 6. Aufbewahrung

- **Rechnungen: 8 Jahre** (seit 2025 von 10 auf 8 Jahre verkürzt)
- Übrige Buchführungsunterlagen, Jahresabschlüsse: weiterhin **10 Jahre**
- Fristbeginn: Ende des Kalenderjahres, in dem die Rechnung ausgestellt wurde
- E-Rechnungen müssen im **Originalformat** (XML) aufbewahrt werden — ein
  Ausdruck oder eine PDF-Visualisierung genügt nicht
- Unveränderbar speichern (GoBD): ein normaler Ordner in der Cloud reicht streng
  genommen nicht, Buchhaltungssoftware mit revisionssicherem Archiv schon

## 7. Wenn nicht gezahlt wird

Ein Kunde, der drei Monate nicht zahlt und weiter betreut wird, ist der teuerste
Fehler in Jahr 1. Leg dir diesen Ablauf fest hin und weiche nicht davon ab:

| Tag | Schritt |
|---|---|
| +1 nach Fälligkeit | **Zahlungserinnerung** per Mail, freundlich, ohne Drohung |
| +7 | **Anruf.** Persönlich, sachlich: „Ist die Rechnung bei Ihnen durchgerutscht?" — löst 80 % der Fälle |
| +14 | **1. Mahnung** mit neuer Frist (7 Tage), Hinweis auf Verzugszinsen |
| +21 | **2. Mahnung**, letzte Frist, **Ankündigung der Leistungseinstellung** |
| +30 | **Leistung einstellen.** Kein Content mehr, kein Community-Management. Vorher schriftlich ankündigen |
| +35 | **Gerichtliches Mahnverfahren** (Online-Mahnantrag, ab ca. 32 € Gebühr) oder Inkasso |

**Rechtlich nützlich:**
- Verzug tritt spätestens **30 Tage nach Rechnungserhalt** automatisch ein
  (§ 286 Abs. 3 BGB) — eine Mahnung ist dafür nicht zwingend nötig
- Setzt du ein konkretes Zahlungsziel („zahlbar bis 14.04.2026"), tritt Verzug
  direkt am Tag danach ein
- **Verzugszinsen im B2B:** 9 Prozentpunkte über dem Basiszinssatz (§ 288 Abs. 2 BGB)
- **Verzugspauschale 40 €** pro verspäteter Zahlung (§ 288 Abs. 5 BGB) — die
  darfst du zusätzlich berechnen, ohne einen Schaden nachzuweisen

Der wichtigste Punkt steht im Vertrag, nicht im Mahnwesen: **„Bei Zahlungsverzug
von mehr als 14 Tagen ist der Auftragnehmer berechtigt, die Leistung bis zum
Zahlungseingang auszusetzen."** Ohne diese Klausel arbeitest du weiter, während
du auf Geld wartest.

## 8. Werkzeuge

**Für den Anfang** reicht der Generator in [`rechnung/`](rechnung/): JSON
ausfüllen, Befehl ausführen, HTML im Browser als PDF drucken. Volle Kontrolle,
keine Kosten, alle Pflichtangaben drin.

**Ab ca. Monat 4 / 5 Kunden** lohnt eine echte Buchhaltungslösung (lexoffice,
sevdesk, Papierkram o. ä., ~15–25 €/Monat). Was du dort bekommst und der
Generator nicht leistet:
- Bankabgleich (offene Posten automatisch als bezahlt markieren)
- Umsatzsteuer-Voranmeldung direkt ans Finanzamt
- Wiederkehrende Rechnungen automatisch am 25. versenden
- GoBD-konformes, revisionssicheres Archiv
- DATEV-Export für deine Steuerberatung

Bei 10 Retainer-Kunden ist der automatische Versand allein die 20 € wert.
