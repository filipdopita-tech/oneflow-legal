# OneFlow Legal repository contract

Tento repozitář je kanonický zdroj `legal.oneflow.cz`.

## Pevné hranice

- Právní obsah se nesmí kreativně přepisovat bez schváleného zdroje.
- Callback pro smazání dat musí ověřovat Meta `signed_request` a při chybějícím
  app secretu selhat uzavřeně.
- Produkční callback se netestuje mutačním POSTem.
- Globální `noindex` hlavička, canonical routy, legacy redirecty a obě API
  funkce se musí zachovat.
- Žádné externí fonty, inline spustitelné skripty, U+2013 ani U+2014.

## Povinný gate

```bash
npm ci
python3 -m http.server 4180
BASE_URL=http://127.0.0.1:4180 npm run qa:all
```

Produkce se nasazuje nejdřív jako Vercel preview. Production promotion je
povolený až po preview QA, kontrole env key metadata, secrets scanu a rollback
identifikaci předchozího deploymentu.
