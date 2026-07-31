# OneFlow Legal design system

## Charakter

Právní archiv, ne marketingový landing. Povrch je teplý papír, text inkoust,
hierarchie Fraunces, provozní text Inter Tight a metadata Geist Mono.
Podpisovým prvkem je přesná platinová vlasová linka.

## Tokeny

| Token | Hodnota | Použití |
| --- | --- | --- |
| `--paper` | `#f3f1ed` | hlavní povrch |
| `--paper-deep` | `#e9e6df` | oddělené provozní plochy |
| `--ink` | `#08090b` | nadpisy a primární text |
| `--muted` | `#68645f` | metadata a sekundární text |
| `--line` | `#cfcbc4` | vlasové oddělovače |
| `--focus` | `#4d493f` | focus ring |

Typografický kontrakt:

- Fraunces: titul dokumentu a kapitoly.
- Inter Tight: právní text a ovládání.
- Geist Mono: folia, čísla sekcí, jazyky a technická metadata.

## Komponenty

- `site-header`: stále dostupná cesta na archiv, gallery a hlavní OneFlow.
- `document-header`: titul, provenance, verze a účinnost dokumentu.
- `lang-toc`: přepínač jazyků a dokumentů, hairline místo pill navigace.
- `section`: kapitola s číslovaným foliem.
- `lang-block`: právní obsah bez dekorativní karty.
- `notice`: významově oddělená provozní informace.
- `method`: postup s doporučenou a standardní variantou.
- `status-panel`: validní, chybějící, neplatný a nedostupný stav.

## Pravidla použití

1. Žádný právní odstavec se nepoužívá jako dekorativní marketingová copy.
2. Radius je vyhrazen focusu a kódu, ne celé informační architektuře.
3. Barva nenese stav sama. Stav má label, nadpis a čitelný popis.
4. Tabulka se na úzkém viewportu posouvá uvnitř vlastního obalu bez overflow
   celé stránky.
5. Print skrývá navigaci, zachovává provenance a používá A4 s kontrolovanými
   zlomy.
6. Veškerý pohyb je krátký, funkční a vypnutý při `prefers-reduced-motion`.

Kompletní živá galerie je na `/system/`.
