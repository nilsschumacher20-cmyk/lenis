#!/usr/bin/env node
/**
 * Rechnungsgenerator für die Social-Media-Agentur.
 *
 *   node agentur/rechnung/generate.mjs rechnungen/2026-001.json [--xml] [--out <verzeichnis>]
 *
 * Liest die Stammdaten (stammdaten.json) und eine Rechnungsdatei, prüft die
 * Pflichtangaben nach § 14 UStG und schreibt eine druckfertige HTML-Rechnung.
 * Mit --xml zusätzlich eine XRechnung (UBL 2.1) als Vorbereitung auf die
 * E-Rechnungspflicht ab 2028.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HIER = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------- Formatierung

/** Betrag in Cent -> "1.785,00 €" */
function eur(cent) {
  return `${zahl(cent / 100, 2, 2)} €`
}

/** Deutsche Zahlendarstellung mit Tausenderpunkt. */
function zahl(wert, minNachkomma = 0, maxNachkomma = 2) {
  const negativ = wert < 0
  let text = Math.abs(wert).toFixed(maxNachkomma)
  if (maxNachkomma > minNachkomma) {
    text = text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
    const [, nachkomma = ''] = text.split('.')
    if (nachkomma.length < minNachkomma) {
      text = (nachkomma ? text : `${text}.`) + '0'.repeat(minNachkomma - nachkomma.length)
    }
  }
  const [vor, nach] = text.split('.')
  const mitPunkten = vor.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${negativ ? '-' : ''}${mitPunkten}${nach ? `,${nach}` : ''}`
}

/** "2026-04-25" -> "25.04.2026" */
function datumDe(iso) {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}

/** ISO-Datum plus n Tage, wieder als ISO. */
function plusTage(iso, tage) {
  const [j, m, t] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(j, m - 1, t))
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeXml(text) {
  return escapeHtml(text).replace(/'/g, '&apos;')
}

// ------------------------------------------------------------------- Template

const SEKTION = /\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/

/** Wert über einen Punktpfad aus dem Kontextstapel holen. */
function lookup(pfad, stapel) {
  const teile = pfad.split('.')
  for (const ebene of stapel) {
    if (ebene == null || typeof ebene !== 'object') continue
    if (!(teile[0] in ebene)) continue
    let wert = ebene
    for (const teil of teile) {
      if (wert == null || typeof wert !== 'object') return undefined
      wert = wert[teil]
    }
    return wert
  }
  return undefined
}

/**
 * Minimaler Mustache-Dialekt: {{wert}}, {{#block}}…{{/block}}.
 * Arrays werden wiederholt, andere truthy-Werte einmal gerendert, falsy weggelassen.
 * Gleichnamige Blöcke dürfen nicht ineinander verschachtelt werden.
 */
function render(vorlage, stapel) {
  let out = vorlage
  let treffer
  while ((treffer = SEKTION.exec(out))) {
    const [voll, name, inhalt] = treffer
    const wert = lookup(name, stapel)
    let ersatz = ''
    if (Array.isArray(wert)) {
      ersatz = wert.map((eintrag) => render(inhalt, [eintrag, ...stapel])).join('')
    } else if (wert) {
      ersatz = render(inhalt, [typeof wert === 'object' ? wert : {}, ...stapel])
    }
    out = out.slice(0, treffer.index) + ersatz + out.slice(treffer.index + voll.length)
  }
  return out.replace(/\{\{([\w.]+)\}\}/g, (_, pfad) => {
    const wert = lookup(pfad, stapel)
    return wert == null ? '' : escapeHtml(wert)
  })
}

// -------------------------------------------------------------------- Prüfung

const PFLICHT_STAMMDATEN = [
  ['firma', 'Name des Unternehmens'],
  ['strasse', 'Straße'],
  ['plz', 'PLZ'],
  ['ort', 'Ort'],
]

const PFLICHT_KUNDE = [
  ['firma', 'Name des Kunden'],
  ['strasse', 'Straße des Kunden'],
  ['plz', 'PLZ des Kunden'],
  ['ort', 'Ort des Kunden'],
]

function pruefe(stammdaten, rechnung) {
  const fehler = []

  for (const [feld, bezeichnung] of PFLICHT_STAMMDATEN) {
    if (!stammdaten[feld]) fehler.push(`stammdaten.json: ${bezeichnung} ("${feld}") fehlt`)
  }
  if (!stammdaten.steuernummer && !stammdaten.ustIdNr) {
    fehler.push('stammdaten.json: Steuernummer oder USt-IdNr. ist Pflicht (§ 14 Abs. 4 Nr. 2 UStG)')
  }

  if (!rechnung.nummer) fehler.push('Rechnungsnummer ("nummer") fehlt')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rechnung.datum ?? '')) {
    fehler.push('Rechnungsdatum ("datum") fehlt oder ist nicht im Format YYYY-MM-DD')
  }
  if (!rechnung.kunde) {
    fehler.push('Kundendaten ("kunde") fehlen')
  } else {
    for (const [feld, bezeichnung] of PFLICHT_KUNDE) {
      if (!rechnung.kunde[feld]) fehler.push(`kunde.${feld}: ${bezeichnung} fehlt`)
    }
  }

  const zeitraum = rechnung.leistungszeitraum
  if (!zeitraum?.von && !rechnung.leistungsdatum) {
    fehler.push(
      'Leistungszeitraum ("leistungszeitraum.von"/".bis") oder "leistungsdatum" fehlt (§ 14 Abs. 4 Nr. 6 UStG)'
    )
  }

  if (!Array.isArray(rechnung.positionen) || rechnung.positionen.length === 0) {
    fehler.push('Mindestens eine Position ("positionen") ist erforderlich')
  } else {
    rechnung.positionen.forEach((pos, i) => {
      if (!pos.bezeichnung) fehler.push(`positionen[${i}]: "bezeichnung" fehlt`)
      if (typeof pos.menge !== 'number') fehler.push(`positionen[${i}]: "menge" muss eine Zahl sein`)
      if (typeof pos.einzelpreis !== 'number') {
        fehler.push(`positionen[${i}]: "einzelpreis" muss eine Zahl sein (netto)`)
      }
    })
  }

  return fehler
}

// ---------------------------------------------------------------- Berechnung

function berechne(stammdaten, rechnung) {
  const kleinunternehmer = Boolean(stammdaten.kleinunternehmer)
  const steuersatz = kleinunternehmer ? 0 : (rechnung.steuersatz ?? stammdaten.steuersatz ?? 19)

  const positionen = rechnung.positionen.map((pos, i) => {
    const gesamtCent = Math.round(pos.menge * pos.einzelpreis * 100)
    return {
      ...pos,
      nr: i + 1,
      gesamtCent,
      einheit: pos.einheit ?? '',
      mengeAnzeige: zahl(pos.menge, 0, 2),
      einzelpreisAnzeige: eur(Math.round(pos.einzelpreis * 100)),
      gesamtAnzeige: eur(gesamtCent),
    }
  })

  const nettoCent = positionen.reduce((summe, pos) => summe + pos.gesamtCent, 0)
  const steuerCent = Math.round((nettoCent * steuersatz) / 100)
  const bruttoCent = nettoCent + steuerCent

  const zahlungszielTage = rechnung.zahlungszielTage ?? stammdaten.zahlungszielTage ?? 14
  const faelligIso = plusTage(rechnung.datum, zahlungszielTage)

  return {
    kleinunternehmer,
    umsatzsteuerpflichtig: !kleinunternehmer,
    steuersatz,
    positionen,
    nettoCent,
    steuerCent,
    bruttoCent,
    zahlungszielTage,
    faelligIso,
  }
}

// --------------------------------------------------------------------- HTML

function baueHtml(stammdaten, rechnung, kalkulation) {
  const vorlage = readFileSync(join(HIER, 'vorlage.html'), 'utf8')
  const kunde = rechnung.kunde
  const zeitraum = rechnung.leistungszeitraum

  const leistungszeitraumText = zeitraum?.von
    ? `Leistungszeitraum: ${datumDe(zeitraum.von)}${zeitraum.bis ? ` – ${datumDe(zeitraum.bis)}` : ''}`
    : `Leistungsdatum: ${datumDe(rechnung.leistungsdatum)}`

  const kontakt = [
    stammdaten.inhaber,
    `${stammdaten.strasse}, ${stammdaten.plz} ${stammdaten.ort}`,
    stammdaten.telefon,
    stammdaten.email,
    stammdaten.website,
  ].filter(Boolean)

  const kontext = {
    ...stammdaten,
    ...rechnung,
    ...kalkulation,
    kunde: {
      ...kunde,
      landAnzeigen: (kunde.laendercode ?? 'DE') !== 'DE',
    },
    kontaktblock: kontakt.join('\n'),
    absenderzeile: `${stammdaten.firma} · ${stammdaten.strasse} · ${stammdaten.plz} ${stammdaten.ort}`,
    datumAnzeige: datumDe(rechnung.datum),
    faelligAnzeige: datumDe(kalkulation.faelligIso),
    leistungszeitraumText,
    steuersatzAnzeige: zahl(kalkulation.steuersatz, 0, 2),
    nettoAnzeige: eur(kalkulation.nettoCent),
    steuerAnzeige: eur(kalkulation.steuerCent),
    bruttoAnzeige: eur(kalkulation.bruttoCent),
    fussLinks: [stammdaten.firma, stammdaten.inhaber, stammdaten.strasse, `${stammdaten.plz} ${stammdaten.ort}`]
      .filter(Boolean)
      .join('\n'),
    fussMitte: [
      stammdaten.steuernummer && `Steuernummer: ${stammdaten.steuernummer}`,
      stammdaten.ustIdNr && `USt-IdNr.: ${stammdaten.ustIdNr}`,
      stammdaten.telefon,
      stammdaten.email,
    ]
      .filter(Boolean)
      .join('\n'),
    fussRechts: [
      stammdaten.bank?.institut,
      stammdaten.bank?.iban && `IBAN ${stammdaten.bank.iban}`,
      stammdaten.bank?.bic && `BIC ${stammdaten.bank.bic}`,
      stammdaten.fusszeile,
    ]
      .filter(Boolean)
      .join('\n'),
  }

  return render(vorlage, [kontext])
}

// ----------------------------------------------------------------- XRechnung

const EINHEITEN = {
  Monat: 'MON',
  Monate: 'MON',
  Stunde: 'HUR',
  Stunden: 'HUR',
  Tag: 'DAY',
  Tage: 'DAY',
  Stück: 'H87',
  Pauschale: 'LS',
}

function betrag(cent) {
  return (cent / 100).toFixed(2)
}

function baueXml(stammdaten, rechnung, kalkulation) {
  const kunde = rechnung.kunde
  const zeitraum = rechnung.leistungszeitraum
  const kategorie = kalkulation.kleinunternehmer ? 'E' : 'S'
  const satz = kalkulation.steuersatz.toFixed(2)

  const partei = (daten, name) => `
    <cac:${name}>
      <cac:Party>
        ${daten.ustIdNr ? `<cbc:EndpointID schemeID="9930">${escapeXml(daten.ustIdNr)}</cbc:EndpointID>` : ''}
        <cac:PostalAddress>
          <cbc:StreetName>${escapeXml(daten.strasse)}</cbc:StreetName>
          <cbc:CityName>${escapeXml(daten.ort)}</cbc:CityName>
          <cbc:PostalZone>${escapeXml(daten.plz)}</cbc:PostalZone>
          <cac:Country>
            <cbc:IdentificationCode>${escapeXml(daten.laendercode ?? 'DE')}</cbc:IdentificationCode>
          </cac:Country>
        </cac:PostalAddress>
        ${
          daten.ustIdNr
            ? `<cac:PartyTaxScheme>
          <cbc:CompanyID>${escapeXml(daten.ustIdNr)}</cbc:CompanyID>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:PartyTaxScheme>`
            : ''
        }
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${escapeXml(daten.firma)}</cbc:RegistrationName>
        </cac:PartyLegalEntity>
        ${
          daten.email || daten.telefon
            ? `<cac:Contact>
          ${daten.ansprechpartner ? `<cbc:Name>${escapeXml(daten.ansprechpartner)}</cbc:Name>` : ''}
          ${daten.telefon ? `<cbc:Telephone>${escapeXml(daten.telefon)}</cbc:Telephone>` : ''}
          ${daten.email ? `<cbc:ElectronicMail>${escapeXml(daten.email)}</cbc:ElectronicMail>` : ''}
        </cac:Contact>`
            : ''
        }
      </cac:Party>
    </cac:${name}>`

  const zeilen = kalkulation.positionen
    .map(
      (pos) => `
    <cac:InvoiceLine>
      <cbc:ID>${pos.nr}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${EINHEITEN[pos.einheit] ?? 'C62'}">${pos.menge}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="EUR">${betrag(pos.gesamtCent)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escapeXml(pos.bezeichnung)}</cbc:Name>
        ${pos.beschreibung ? `<cbc:Description>${escapeXml(pos.beschreibung)}</cbc:Description>` : ''}
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${kategorie}</cbc:ID>
          <cbc:Percent>${satz}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="EUR">${pos.einzelpreis.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(rechnung.nummer)}</cbc:ID>
  <cbc:IssueDate>${rechnung.datum}</cbc:IssueDate>
  <cbc:DueDate>${kalkulation.faelligIso}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${escapeXml(kunde.leitwegId ?? kunde.kundennummer ?? kunde.referenz ?? rechnung.nummer)}</cbc:BuyerReference>
  ${
    zeitraum?.von
      ? `<cac:InvoicePeriod>
    <cbc:StartDate>${zeitraum.von}</cbc:StartDate>
    ${zeitraum.bis ? `<cbc:EndDate>${zeitraum.bis}</cbc:EndDate>` : ''}
  </cac:InvoicePeriod>`
      : ''
  }
  ${partei(stammdaten, 'AccountingSupplierParty')}
  ${partei(kunde, 'AccountingCustomerParty')}
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cbc:PaymentID>${escapeXml(rechnung.nummer)}</cbc:PaymentID>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${escapeXml((stammdaten.bank?.iban ?? '').replace(/\s/g, ''))}</cbc:ID>
      <cbc:Name>${escapeXml(stammdaten.bank?.kontoinhaber ?? stammdaten.firma)}</cbc:Name>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:PaymentTerms>
    <cbc:Note>Zahlbar ohne Abzug bis ${datumDe(kalkulation.faelligIso)}</cbc:Note>
  </cac:PaymentTerms>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${betrag(kalkulation.steuerCent)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${betrag(kalkulation.nettoCent)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${betrag(kalkulation.steuerCent)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${kategorie}</cbc:ID>
        <cbc:Percent>${satz}</cbc:Percent>
        ${kalkulation.kleinunternehmer ? '<cbc:TaxExemptionReason>Kleinunternehmer gemäß § 19 UStG</cbc:TaxExemptionReason>' : ''}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${betrag(kalkulation.nettoCent)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${betrag(kalkulation.nettoCent)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${betrag(kalkulation.bruttoCent)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${betrag(kalkulation.bruttoCent)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${zeilen}
</Invoice>
`
}

// ---------------------------------------------------------------------- CLI

function main() {
  const argumente = process.argv.slice(2)
  const datei = argumente.find((arg) => !arg.startsWith('--'))
  const mitXml = argumente.includes('--xml')
  const outIndex = argumente.indexOf('--out')
  const outVerzeichnis = outIndex >= 0 ? argumente[outIndex + 1] : join(HIER, 'out')

  if (!datei) {
    console.error(
      'Aufruf: node agentur/rechnung/generate.mjs <rechnung.json> [--xml] [--out <verzeichnis>]\n' +
        'Beispiel: node agentur/rechnung/generate.mjs agentur/rechnung/rechnungen/2026-001.json --xml'
    )
    process.exit(1)
  }

  const rechnungsPfad = isAbsolute(datei) ? datei : resolve(process.cwd(), datei)
  const kandidat = existsSync(rechnungsPfad) ? rechnungsPfad : join(HIER, datei)
  if (!existsSync(kandidat)) {
    console.error(`Rechnungsdatei nicht gefunden: ${datei}`)
    process.exit(1)
  }

  const stammdaten = JSON.parse(readFileSync(join(HIER, 'stammdaten.json'), 'utf8'))
  const rechnung = JSON.parse(readFileSync(kandidat, 'utf8'))

  const fehler = pruefe(stammdaten, rechnung)
  if (fehler.length > 0) {
    console.error('Rechnung unvollständig – folgende Pflichtangaben fehlen:\n')
    for (const eintrag of fehler) console.error(`  • ${eintrag}`)
    console.error('\nSiehe agentur/04-rechnungsstellung.md, Abschnitt 2.')
    process.exit(1)
  }

  const kalkulation = berechne(stammdaten, rechnung)
  mkdirSync(outVerzeichnis, { recursive: true })

  const htmlPfad = join(outVerzeichnis, `${rechnung.nummer}.html`)
  writeFileSync(htmlPfad, baueHtml(stammdaten, rechnung, kalkulation), 'utf8')

  console.log(`Rechnung ${rechnung.nummer} an ${rechnung.kunde.firma}`)
  console.log(`  Netto   ${eur(kalkulation.nettoCent).padStart(12)}`)
  if (kalkulation.umsatzsteuerpflichtig) {
    console.log(`  USt ${String(kalkulation.steuersatz).padStart(2)} % ${eur(kalkulation.steuerCent).padStart(12)}`)
  }
  console.log(`  Brutto  ${eur(kalkulation.bruttoCent).padStart(12)}`)
  console.log(`  Fällig  ${datumDe(kalkulation.faelligIso).padStart(12)}`)
  console.log(`\n  HTML -> ${htmlPfad}`)

  if (mitXml) {
    const xmlPfad = join(outVerzeichnis, `${rechnung.nummer}.xml`)
    writeFileSync(xmlPfad, baueXml(stammdaten, rechnung, kalkulation), 'utf8')
    console.log(`  XML  -> ${xmlPfad}`)
  }

  console.log('\nHTML im Browser öffnen und über "Drucken → Als PDF sichern" exportieren.')
}

main()
