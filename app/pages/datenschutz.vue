<script setup lang="ts">
const { t, locale } = useI18n()

useSeoMeta({
  title: () => t('seo.privacy.title'),
  description: () => t('seo.privacy.description'),
})
</script>

<template>
  <UPageSection
    :title="$t('legal.privacy.title')"
    :ui="{ container: 'py-4 sm:py-4 lg:py-4' }"
  >
    <template #description>
      <div class="prose prose-neutral dark:prose-invert max-w-none">
        <template v-if="locale === 'de'">
          <h2>1. Verantwortlicher</h2>
          <p>
            Verantwortlicher im Sinne der DSGVO ist:
          </p>
          <p>
            [NAME]<br>
            [STRASSE HAUSNUMMER]<br>
            [PLZ ORT]<br>
            E-Mail: <a href="mailto:info@gospendl.com">info@gospendl.com</a>
          </p>

          <h2>2. Erhebung allgemeiner Informationen beim Besuch</h2>
          <p>
            Beim Aufruf der Website werden durch unseren Hosting-Dienstleister
            automatisch Informationen erfasst und in sog. Server-Log-Dateien
            gespeichert:
          </p>
          <ul>
            <li>Anonymisierte IP-Adresse</li>
            <li>Datum und Uhrzeit des Zugriffs</li>
            <li>Aufgerufene URL / Referrer</li>
            <li>Browser-Typ, Sprache, Betriebssystem</li>
          </ul>
          <p>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Unser
            berechtigtes Interesse liegt in der Sicherheit und Stabilität
            unseres Angebots. Die Daten werden nach 30 Tagen gelöscht.
          </p>

          <h2>3. Hosting</h2>
          <p>
            Die Website wird bei Vercel Inc., 340 S Lemon Ave #4133,
            Walnut, CA 91789, USA, gehostet. Server können sich innerhalb
            der EU sowie in den USA befinden. Vercel ist unter dem
            EU-US Data Privacy Framework zertifiziert; damit ist die
            Übermittlung in die USA nach Art. 45 DSGVO abgesichert.
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
          </p>

          <h2>4. Cookies und lokale Speicherung</h2>
          <p>
            Wir setzen technisch notwendige Cookies und lokale
            Speicherwerte ein:
          </p>
          <ul>
            <li>
              <strong>satsback_token</strong> – speichert das
              Authentifizierungs-Token für den Cashback-Dienst Satsback.
              Nur gesetzt nach aktiver Anmeldung. Rechtsgrundlage:
              Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) und § 25
              Abs. 2 Nr. 2 TTDSG. Ablauf: Sitzung / bis Logout.
            </li>
            <li>
              <strong>satsback_userId</strong> – ordnet die
              Cashback-Anfrage einem Nutzer zu. Zweck und Rechtsgrundlage
              wie oben.
            </li>
            <li>
              <strong>Präferenz-Speicher</strong> – z.B. gewählte Sprache
              und Farbschema. Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TTDSG.
            </li>
          </ul>

          <h2>5. Reichweitenmessung mit Vercel Analytics</h2>
          <p>
            Wir nutzen Vercel Analytics, einen datenschutzfreundlichen
            Analysedienst des Hosting-Anbieters. Vercel Analytics setzt
            <strong>keine Cookies</strong> und erhebt keine
            personenbezogenen Identifikatoren. Erfasst werden anonymisierte
            Aggregate zu Seitenaufrufen und ungefährer geografischer
            Herkunft. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. Weitere
            Informationen:
            <a href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noopener noreferrer">
              vercel.com/docs/analytics/privacy-policy
            </a>.
          </p>

          <h2>6. Performance-Messung mit Vercel Speed Insights</h2>
          <p>
            Vercel Speed Insights misst Ladezeiten (Web Vitals) unserer
            Seiten anonymisiert. Es werden keine personenbezogenen Daten
            an Vercel übertragen und keine Cookies gesetzt. Rechtsgrundlage:
            Art. 6 Abs. 1 lit. f DSGVO (Interesse an technischer
            Optimierung).
          </p>

          <h2>7. Produktsuche mit Algolia</h2>
          <p>
            Zur Produktsuche setzen wir den Dienst Algolia Inc., 3790 El
            Camino Real, Unit #518, Palo Alto, CA 94306, USA ein. Bei
            einer Suchanfrage werden folgende Daten an Algolia übertragen:
          </p>
          <ul>
            <li>Suchbegriff und Filter-Parameter</li>
            <li>Anonymisierte IP-Adresse</li>
            <li>
              Zufällig generierter User-Token (Session-basiert) zur
              Verbesserung der Suchqualität
            </li>
          </ul>
          <p>
            Algolia verarbeitet die Daten in EU- und US-Rechenzentren.
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. Datenschutzhinweise
            Algolia:
            <a href="https://www.algolia.com/policies/privacy" target="_blank" rel="noopener noreferrer">
              algolia.com/policies/privacy
            </a>.
          </p>

          <h2>8. Cashback-Dienst Satsback</h2>
          <p>
            Wir binden den Cashback-Dienst Satsback ein. Um Cashback zu
            aktivieren, signierst du mittels deiner Nostr-Browser-Erweiterung
            (z.B. Alby oder nos2x) ein Authentifizierungs-Event, das an
            Satsback übertragen wird. Dabei werden übermittelt:
          </p>
          <ul>
            <li>Deine öffentliche Nostr-Adresse (npub)</li>
            <li>Von dir signierte Auth-Events</li>
            <li>
              Die Shop-Kennung, für die ein Cashback-Link erzeugt werden
              soll
            </li>
          </ul>
          <p>
            Die Datenverarbeitung durch Satsback erfolgt eigenverantwortlich.
            Anbieter: Satsback / bitcashback.co. Rechtsgrundlage:
            Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) mit deiner
            aktiven Nutzung. Weitere Informationen findest du unter
            <a href="https://satsback.com" target="_blank" rel="noopener noreferrer">satsback.com</a>.
          </p>

          <h2>9. Datenübermittlung in Drittländer</h2>
          <p>
            Vercel und Algolia können Daten in die USA übertragen. Beide
            Anbieter sind unter dem EU-US Data Privacy Framework
            zertifiziert bzw. verwenden EU-Standardvertragsklauseln, sodass
            ein angemessenes Datenschutzniveau nach Art. 45 bzw. 46 DSGVO
            gewährleistet ist.
          </p>

          <h2>10. Deine Rechte</h2>
          <p>
            Du hast jederzeit das Recht auf:
          </p>
          <ul>
            <li>Auskunft (Art. 15 DSGVO)</li>
            <li>Berichtigung (Art. 16 DSGVO)</li>
            <li>Löschung (Art. 17 DSGVO)</li>
            <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
            <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>
              Widerspruch gegen Verarbeitungen auf Grundlage von
              Art. 6 Abs. 1 lit. f DSGVO (Art. 21 DSGVO)
            </li>
          </ul>
          <p>
            Zur Ausübung genügt eine formlose E-Mail an
            <a href="mailto:info@gospendl.com">info@gospendl.com</a>.
          </p>

          <h2>11. Beschwerderecht bei der Aufsichtsbehörde</h2>
          <p>
            Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde
            zu beschweren. In der Regel wendest du dich an die
            Aufsichtsbehörde deines Bundeslandes oder deines Wohnsitzes.
            Eine Übersicht findest du unter
            <a href="https://www.bfdi.bund.de/DE/Service/Anschriften/Laender/Laender-node.html" target="_blank" rel="noopener noreferrer">
              bfdi.bund.de
            </a>.
          </p>

          <h2>12. Änderungen dieser Datenschutzerklärung</h2>
          <p>
            Wir passen diese Datenschutzerklärung an, wenn sich unser
            Angebot oder die rechtlichen Rahmenbedingungen ändern. Die
            jeweils aktuelle Version ist auf dieser Seite abrufbar.
          </p>
        </template>

        <template v-else>
          <p class="text-muted">
            The legally binding version of our privacy policy is only
            available in German. A summary in English is provided below
            for convenience.
          </p>

          <h2>1. Controller</h2>
          <p>
            [NAME], [ADDRESS], Germany. Email:
            <a href="mailto:info@gospendl.com">info@gospendl.com</a>.
          </p>

          <h2>2. Hosting</h2>
          <p>
            Hosted on Vercel Inc. (USA). Vercel is certified under the
            EU-US Data Privacy Framework.
          </p>

          <h2>3. Cookies &amp; local storage</h2>
          <p>
            Only technically necessary storage:
            <code>satsback_token</code>, <code>satsback_userId</code>
            (session; set after you actively sign in to the Satsback
            cashback service), plus UI preferences (language, theme).
          </p>

          <h2>4. Analytics</h2>
          <p>
            Vercel Analytics and Vercel Speed Insights — cookie-free,
            anonymous aggregate metrics only.
          </p>

          <h2>5. Product search</h2>
          <p>
            Algolia (USA/EU) processes search queries and an anonymous
            user token. See
            <a href="https://www.algolia.com/policies/privacy" target="_blank" rel="noopener noreferrer">algolia.com/policies/privacy</a>.
          </p>

          <h2>6. Cashback via Satsback</h2>
          <p>
            When you activate cashback, your Nostr public key and signed
            auth events are transmitted to Satsback. See
            <a href="https://satsback.com" target="_blank" rel="noopener noreferrer">satsback.com</a>.
          </p>

          <h2>7. Your rights</h2>
          <p>
            You may exercise your GDPR rights (access, correction,
            deletion, restriction, portability, objection) at any time by
            email to
            <a href="mailto:info@gospendl.com">info@gospendl.com</a>.
          </p>

          <h2>8. Supervisory authority</h2>
          <p>
            You may lodge a complaint with a German data protection
            supervisory authority. Overview:
            <a href="https://www.bfdi.bund.de/EN/Home/home_node.html" target="_blank" rel="noopener noreferrer">bfdi.bund.de</a>.
          </p>
        </template>
      </div>
    </template>
  </UPageSection>
</template>
