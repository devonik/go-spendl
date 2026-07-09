<script setup lang="ts">
const { t, locale } = useI18n()

useSeoMeta({
  title: () => t('seo.imprint.title'),
  description: () => t('seo.imprint.description'),
})
</script>

<template>
  <UPageSection
    :title="$t('legal.imprint.title')"
    :ui="{ container: 'py-4 sm:py-4 lg:py-4' }"
  >
    <template #description>
      <UAlert
        icon="i-lucide-triangle-alert"
        color="warning"
        variant="subtle"
        title="ENTWURF – nicht rechtsgültig"
        description="Dieses Impressum ist ein Platzhalter. Vor dem Livegang durch geprüfte Angaben (Name, Anschrift, verantwortliche Person) ersetzen."
        class="mb-8"
      />

      <div class="prose prose-neutral dark:prose-invert max-w-none">
        <template v-if="locale === 'de'">
          <h2>Angaben gemäß § 5 TMG</h2>

          <h2>Kontakt</h2>
          <p>
            E-Mail: <a href="mailto:info@gospendl.com">info@gospendl.com</a>
          </p>

          <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
          <p>
            [NAME]<br>
            [STRASSE HAUSNUMMER]<br>
            [PLZ ORT]
          </p>

          <h2>Streitschlichtung</h2>
          <p>
            Die Europäische Kommission stellt eine Plattform zur
            Online-Streitbeilegung (OS) bereit:
            <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">
              https://ec.europa.eu/consumers/odr/
            </a>. Unsere E-Mail-Adresse findest du oben im Impressum.
          </p>
          <p>
            Wir sind nicht bereit oder verpflichtet, an
            Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>

          <h2>Haftung für Inhalte</h2>
          <p>
            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene
            Inhalte auf diesen Seiten nach den allgemeinen Gesetzen
            verantwortlich. Nach §§ 8 bis 10 TMG sind wir als
            Diensteanbieter jedoch nicht verpflichtet, übermittelte oder
            gespeicherte fremde Informationen zu überwachen oder nach
            Umständen zu forschen, die auf eine rechtswidrige Tätigkeit
            hinweisen.
          </p>
          <p>
            Verpflichtungen zur Entfernung oder Sperrung der Nutzung von
            Informationen nach den allgemeinen Gesetzen bleiben hiervon
            unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem
            Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung
            möglich. Bei Bekanntwerden von entsprechenden
            Rechtsverletzungen werden wir diese Inhalte umgehend
            entfernen.
          </p>

          <h2>Haftung für Links</h2>
          <p>
            Unser Angebot enthält Links zu externen Websites Dritter, auf
            deren Inhalte wir keinen Einfluss haben. Deshalb können wir
            für diese fremden Inhalte auch keine Gewähr übernehmen. Für
            die Inhalte der verlinkten Seiten ist stets der jeweilige
            Anbieter oder Betreiber der Seiten verantwortlich. Die
            verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf
            mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte
            waren zum Zeitpunkt der Verlinkung nicht erkennbar.
          </p>
          <p>
            Eine permanente inhaltliche Kontrolle der verlinkten Seiten
            ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung
            nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen
            werden wir derartige Links umgehend entfernen.
          </p>

          <h2>Urheberrecht</h2>
          <p>
            Die durch die Seitenbetreiber erstellten Inhalte und Werke
            auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die
            Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
            Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen
            der schriftlichen Zustimmung des jeweiligen Autors bzw.
            Erstellers. Downloads und Kopien dieser Seite sind nur für
            den privaten, nicht kommerziellen Gebrauch gestattet.
          </p>

          <h2>Hinweis zu Affiliate-Links</h2>
          <p>
            GoSpendl enthält Verlinkungen zu Onlineshops über den
            Cashback-Dienst Satsback. Wenn du über einen solchen Link
            einkaufst, erhältst du Cashback in Form von Bitcoin und wir
            können ebenfalls eine Provision erhalten. Für dich entstehen
            dadurch keine zusätzlichen Kosten. Die Auswahl und Bewertung
            der Shops erfolgt neutral und unabhängig von etwaigen
            Provisionen.
          </p>
        </template>

        <template v-else>
          <h2>Legal information according to § 5 TMG</h2>
          <p>
            [NAME]<br>
            [STREET NUMBER]<br>
            [POSTCODE CITY]<br>
            Germany
          </p>

          <h2>Contact</h2>
          <p>
            Email: <a href="mailto:info@gospendl.com">info@gospendl.com</a>
          </p>

          <h2>Responsible for content according to § 18 Abs. 2 MStV</h2>
          <p>
            [NAME]<br>
            [STREET NUMBER]<br>
            [POSTCODE CITY]
          </p>

          <h2>Dispute resolution</h2>
          <p>
            The European Commission provides a platform for online
            dispute resolution (ODR):
            <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">
              https://ec.europa.eu/consumers/odr/
            </a>. We are neither willing nor obliged to participate in
            dispute resolution proceedings before a consumer arbitration
            board.
          </p>

          <h2>Liability for content</h2>
          <p>
            As a service provider, we are responsible for our own
            content on these pages according to general laws pursuant to
            § 7 (1) TMG. According to §§ 8 to 10 TMG, however, we as a
            service provider are not obligated to monitor transmitted or
            stored third-party information or to investigate
            circumstances that indicate illegal activity.
          </p>

          <h2>Liability for links</h2>
          <p>
            Our offer contains links to external websites of third
            parties, on whose content we have no influence. Therefore,
            we cannot assume any liability for these external contents.
            The respective provider or operator of the pages is always
            responsible for the content of the linked pages.
          </p>

          <h2>Affiliate disclosure</h2>
          <p>
            GoSpendl contains links to online shops via the cashback
            service Satsback. When you purchase through such a link, you
            receive cashback in the form of Bitcoin, and we may also
            receive a commission. This does not result in any additional
            costs for you. Shop selection and evaluation is neutral and
            independent of any commissions.
          </p>
        </template>
      </div>
    </template>
  </UPageSection>
</template>
