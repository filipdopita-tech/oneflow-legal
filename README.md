# OneFlow Legal

Kanonický zdroj veřejných Meta Platform právních a data-deletion povrchů na
`legal.oneflow.cz`.

## Produkce

- Vercel projekt: `oneflow-meta-legal`
- Scope: `oneflowcast`
- Project ID: `prj_gceWWl6yTIeJeetVAoVCXRbP2i3s`
- Povinné env keys: `META_APP_SECRET_PUBLISHER`, `NTFY_TOPIC_URL`
- Doporučený env key: `NTFY_ACCESS_TOKEN` (ntfy access token, odchází jako `Authorization: Bearer`; bez něj stojí soukromí topicu jen na neuhodnutelném názvu, vadná hodnota = 503 bez odeslání)

Hodnoty secretů se nikdy neukládají do repozitáře ani do reportů.

## Lokální ověření

```bash
npm ci
python3 -m http.server 4180
BASE_URL=http://127.0.0.1:4180 npm run qa:all
```

`qa:all` normalizuje zdroj, sestaví a ověří 10 tagovaných A4 PDF, zkontroluje
API testy, všech 15 rout ve dvou viewpor-tech a Lighthouse pro archiv i dlouhý
dokument. SEO score se nepoužívá jako gate, protože služba má záměrný
`noindex`; dostupnost pro Meta crawler ověřuje `robots.txt` a route gate.

## Deploy

Projekt nemá git integraci s Vercelem. Push do `main` nic nenasadí; nasazuje se
jen ručně přes CLI z linknutého pracovního stromu (`.vercel/` je gitignored, při
prvním použití `npx vercel@55.0.0 link --scope oneflowcast`). Přesně proto běžela
produkce od 16. 6. do 2. 9. 2026 na 78 dní starém buildu, i když repo mělo
přestavbu hotovou.

```bash
npx vercel@55.0.0 deploy --yes --scope oneflowcast          # preview (za Deployment Protection, smoke test tam neprojde)
npx vercel@55.0.0 deploy --prod --yes --scope oneflowcast   # produkce = https://legal.oneflow.cz
```

Po produkčním deployi smoke test proti živé doméně: `/` 200, `/de/privacy/` 200,
`/instagram-privacy.html` 308 na meta-platforms cestu, callback GET 405 a POST
s podvrženým podpisem 503 `service_unavailable` (dokud chybí secret) nebo 400
`invalid_signature` (se secretem). Env proměnné se zapékají při buildu, změna
přes `vercel env` platí až po dalším deployi. Rollback:
`npx vercel@55.0.0 rollback <předchozí production deployment> --scope oneflowcast`.

Otevřené body před ostrým provozem callbacku eviduje `LEGAL_REVIEW.md` (P0):
`META_APP_SECRET_PUBLISHER` v produkci a jmenovaná odpovědná osoba.
