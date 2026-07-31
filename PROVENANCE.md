# Production source provenance

Stav obnoven 31. 7. 2026 z Vercel production deploymentu pomocí oficiálního
read-only Deployment Files API.

- Project: `oneflow-meta-legal`
- Project ID: `prj_gceWWl6yTIeJeetVAoVCXRbP2i3s`
- Deployment ID: `dpl_7bjbJmcQAvTYi1QK5JSUpKmcvqwr`
- Production alias: `https://legal.oneflow.cz`
- Obnovené zdrojové soubory: 27
- Hash contract: Vercel file UID se u všech souborů shodoval se SHA-1 obsahu

Původní deployment byl před úpravami byte-shodný na rootu a všech
zveřejněných sitemap routách. Baseline hashe jsou v
`RECOVERED-DEPLOYMENT.sha1`.

Následné změny zachovávají rozsah a význam obnovených dokumentů. Opravují
vlastnictví zdroje, lokální fonty, dokumentový shell, legacy redirecty,
přístupnost, print, nepravdivé technické odkazy a fail-closed ověřování
data-deletion callbacku.

Právní a provozní tvrzení, která nelze prokázat samotným repozitářem, jsou
oddělena v `LEGAL_REVIEW.md`. Produkční publikace nové verze je podmíněna
potvrzením tohoto registru vlastníkem procesu nebo právníkem.
