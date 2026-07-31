# OneFlow Legal

Kanonický zdroj veřejných Meta Platform právních a data-deletion povrchů na
`legal.oneflow.cz`.

## Produkce

- Vercel projekt: `oneflow-meta-legal`
- Scope: `oneflowcast`
- Project ID: `prj_gceWWl6yTIeJeetVAoVCXRbP2i3s`
- Povinné env keys: `META_APP_SECRET_PUBLISHER`, `NTFY_TOPIC_URL`

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

```bash
npx vercel@55.0.0 --scope oneflowcast
```

Preview musí projít stejným browser a route gate. Produkce se promuje až poté:

```bash
npx vercel@55.0.0 promote <preview-url> --scope oneflowcast
```

Produkční promoci blokuje neuzavřený `LEGAL_REVIEW.md` a chybějící
`META_APP_SECRET_PUBLISHER`. Rollback používá předchozí production deployment
ID přes Vercel rollback.
