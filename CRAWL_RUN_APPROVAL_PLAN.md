# Crawl-Run Refactor: 1 Approval pro Run statt 1 pro Shop

Plan, nicht implementiert. Aktueller Stand: jeder Shop läuft als eigener async Crawl4AI-Job, der Webhook weiß nichts von Geschwister-Jobs → 1 Slack-Message + 1 Approval-Page pro Shop. Bei 15 Shops = ~30 Slack-Nachrichten + 15 Approval-Klicks.

## Ziel

- **3 Slack-Messages pro Run** statt ~30 (Start, Ende mit Zusammenfassung, ggf. Fehler)
- **1 Approval-UI pro Run** statt 1 pro Shop, mit pro-Shop und global Approve/Decline-Buttons
- **1 logischer "Run-Container" im Blob-Storage** statt verstreute Einzeldateien

## Architektur

### Run-Korrelation via Header

`/api/crawl` generiert pro Aufruf:
- `runId` (uuid)
- `runTotal` (Anzahl dispatched Shops)

Beide werden als `X-Run-Id` und `X-Run-Total` Header in `webhook_config.webhook_headers` gesetzt — Crawl4AI gibt sie 1:1 an den Webhook-Aufruf durch.

### Blob-Layout

Pro Shop schreibt der Webhook nach:

```
crawl/runs/{runId}/{slug}.json          # erfolgreicher Shop, mit items[]
crawl/runs/{runId}/{slug}.error.json    # fehlgeschlagener Shop, mit error_message
crawl/runs/{runId}/summary-sent.lock    # Marker damit Summary-Slack nur 1x feuert
```

Approval-UI lädt alles unter `crawl/runs/{runId}/` Prefix.

### "Letzter Webhook = Summary feuern"

Nach Schreiben seines eigenen Blobs listet der Webhook die Files unter `crawl/runs/{runId}/`. Wenn Count == `runTotal`, ist das der letzte Job → Summary-Slack feuern.

**Race-Condition**: zwei Webhooks könnten gleichzeitig "ich bin der letzte" denken. Mitigation: vor dem Summary-Slack einen `summary-sent.lock` Blob schreiben; wenn der schon existiert, exit. Worst-Case 2 Summary-Slacks (kein Datenschaden), Frequenz aber so niedrig dass das praktisch nie passiert.

### Slack Messages

| Zeitpunkt | Nachricht |
|---|---|
| Start (`index.post.ts`) | `:arrow_forward: Run {runId}: 15 shops dispatched` |
| Während | — (Vercel-Logs reichen) |
| Ende (letzter Webhook) | `:checkered_flag: Run {runId}: 12 ok, 3 failed (xyz, abc, def: HTTP 500), [Approve all](link)` |

Aktuell bleiben würde nur die Crawl4AI-internen Failure-Slacks pro Shop (die kommen aus dem Webhook bei `body.status === 'failed'`). Die können wir weglassen und stattdessen im Summary-Slack auflisten — `error_message` aus der `.error.json` Blob.

### Approval UI

`/internal/approve-crawl?runId={runId}` (statt aktuell `?fileUrl=…`).

Layout:
- **Accordion pro Shop** (skaliert besser als Tabs bei 15+ Shops)
- Default: alle zugeklappt, Counter im Header (`baur — 24 Produkte`)
- Pro Shop: `Approve {shop}` + `Decline {shop}` Buttons
- Oben global: `Approve All` + `Decline All`
- Per-Item Edit/Delete bleibt wie bisher

### Failed-Shops im UI

Shops mit `.error.json` werden ebenfalls als Accordion-Eintrag gerendert (kein Approve-Button, nur Anzeige des Fehlers + Slack-/Vercel-Log-Hint). Hilft beim schnellen Debug ohne zwischen Slack und UI hin- und herzuspringen.

## Failure Modes

- **Crawl4AI failt** für einen Shop → Webhook kommt mit `status: failed` → `.error.json` Blob geschrieben → zählt zum Run-Total → Summary kommt ganz normal
- **Crawl4AI hängt / crasht ohne Webhook-Callback** → Run wird nie als "fertig" markiert, Summary kommt nie. Mitigation **deferred**: Cron-Job der alle 15min unfinished Runs (>30min alt, weniger Blobs als Total) findet und Summary mit "stuck" Markierung feuert. Erstmal über Vercel-Logs diagnostizieren.

## Implementierungs-Sequenz

Aufteilung in überschaubare Commits — jeder einzeln deploybar:

1. **`index.post.ts` + `webhook.post.ts`**: Run-ID Korrelation, Blob-Layout `crawl/runs/{runId}/…`, Summary-Slack im letzten Webhook. Approval-UI noch alt — Approval-Link im Summary-Slack zeigt auf die ALTE Per-Shop-UI (eine pro Shop, wie bisher). Nicht super, aber Slack-Spam ist gelöst.
2. **`approve-crawl.vue`**: neue UI mit Accordion + globalen Buttons, lädt per `runId` statt `fileUrl`. Backward-Compat: weiter `fileUrl`-Variante akzeptieren für Übergangs-Runs.
3. **`approve.post.ts` + `decline.post.ts`**: erweitern für Run-weite Operations (Liste von Slug+ProductsToUpload statt ein Block).
4. Optional später: Stuck-Run Cron, falls's nötig wird.

## Offene Punkte

- [ ] **Vercel KV statt Blob-Counting?** Cleanere Atomarität, aber neuer Service. Blob-Counting reicht für unsere Frequenz.
- [ ] **Bestehende In-Flight Approvals**: aktuell ~0-2 Stück die rumliegen. Können bleiben (alte UI funktioniert weiter solange `fileUrl` Param unterstützt wird). Kein Migration-Bedarf.
- [ ] **`isCrawlUploadAutomaticEnabled === 'true'` Modus**: auch hier Summary statt 1-per-shop Slacks. Logic ist symmetrisch.
- [ ] **Daten-Modell für Summary**: pro Shop {slug, itemCount, status: ok|failed, error?: string}. Im Summary-Slack als Block-Kit-Section, im UI als Accordion-Header.

## Bezugspunkte im Code

- `server/api/crawl/index.post.ts` — dispatcht Jobs, Slack-Start
- `server/api/crawl/webhook.post.ts` — pro Shop: Blob-Write + Slack
- `app/pages/internal/approve-crawl.vue` — aktuell Per-Shop, lädt 1 Blob
- `server/api/crawl/approve.post.ts` — schreibt nach Algolia
- `server/api/crawl/decline.post.ts` — löscht Blob ohne Upload
- `server/lib/send-slack-message.ts` — Slack-Wrapper
