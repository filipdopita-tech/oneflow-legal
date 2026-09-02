# Legal and operational review gate

Tento registr není právní posudek. Odděluje tvrzení převzatá z produkčního
deploymentu, která kód ani lokální data neumí potvrdit. Před produkční promocí
musí vlastník procesu nebo právník u každého bodu potvrdit skutečný stav, nebo
upravit text.

## P0 · blokuje produkční promoci

1. `META_APP_SECRET_PUBLISHER` musí existovat v produkčním Vercel prostředí a
   odpovídat Meta App ID `1239370548302204`. Bez něj callback úmyslně vrací 503.
2. Příjem oznámení `NTFY_TOPIC_URL` musí být aktivní soukromý topic pod
   `https://ntfy.oneflow.cz`. Callback vrací 503, pokud nelze ověřenou žádost
   bezpečně předat.
3. Musí existovat odpovědná osoba, která oznámení převezme, dohledá subjekt,
   provede smazání a zdokumentuje výsledek. Callback samotný data nemaže.

**Stav 2. 9. 2026 večer (Dopita):** produkce nasazena na Filipův pokyn („dotáhni
vše včetně deploy do full") i s otevřenými body 1 a 3. Důvod: předchozí produkce
(deploy `oneflow-meta-legal-644309o4o` z 16. 6. 2026) přijímala nepodepsané
žádosti (na náhodný podpis vrátila 200 a potvrzovací kód) a status stránka
potvrzovala libovolný kód. Nový build (`oneflow-meta-legal-fumw4hydl`, commit
`0ccce9b`) selhává bezpečně: callback s podvrženým podpisem vrací 503
`service_unavailable`, status s cizím kódem 503, GET callback 405. Dokud v
produkci chybí bod 1, vrací callback 503 i Metě; bod 2 je splněn (viz níže),
bod 3 trvá.

## P0 · čeká na rozhodnutí

Auditní kontrola 2. 9. 2026: všechny tři P0 body výše jsou infrastrukturní nebo
personální rozhodnutí, ne chybějící text, špatný odkaz na zákon nebo zastaralá
sazba. Repozitář je proto neopravuje polovičatě · kód už dnes bezpečně selhává
(503), pokud podmínky nejsou splněné. Rozhoduje Filip.

### 1. `META_APP_SECRET_PUBLISHER` v produkčním Vercelu

**Otázka:** je tato hodnota v produkčním prostředí Vercel (projekt
`oneflow-meta-legal`, scope `oneflowcast`, viz `README.md`) nastavená a
odpovídá aktuálnímu App Secret Meta aplikace `1239370548302204`?

**Doporučená varianta:** nejdřív ověřit stav bez odhalení hodnoty ·
`npx vercel@55.0.0 env ls production --scope oneflowcast`. Pokud chybí,
doplnit `npx vercel@55.0.0 env add META_APP_SECRET_PUBLISHER production`
hodnotou z Meta App Dashboru (App `1239370548302204` → Settings → Basic →
App Secret). Meta App Dashboard vyžaduje Meta login, což je podle
`~/.claude/CLAUDE.md` HARD-STOP · nemohu to ověřit ani provést sám.

**Právní opora:** čl. 32 odst. 1 nařízení (EU) 2016/679 (GDPR), zabezpečení
zpracování · „provedou správce a zpracovatel vhodná technická a organizační
opatření, aby zajistili úroveň zabezpečení odpovídající danému riziku."
Kód v `api/data-deletion-callback.js` ověřuje pravost žádosti HMAC-SHA256
podpisem a bez shody secretu úmyslně vrací 503, aby nezpracoval
nepodepsanou nebo padělanou žádost. [Citace ověřena přes zrcadlo
privacy-regulation.eu/cs/32.htm 2. 9. 2026 · přímý fetch EUR-Lex
(CELEX:32016R0679) selhal přes WebFetch i curl, `OVĚŘIT-FETCH-FAIL`.]

### 2. `NTFY_TOPIC_URL` jako aktivní soukromý topic

**Otázka:** existuje na `ntfy.oneflow.cz` (server běží · `/v1/health` odpověděl
200 dne 2. 9. 2026) reálný privátní topic a je jeho URL nastavená v produkčním
Vercelu?

**Skrytý technický detail:** funkce `notifyNtfy()` v
`api/data-deletion-callback.js` neposílá žádnou `Authorization` hlavičku.
„Soukromost" topicu dnes stojí jen na neuhodnutelnosti jeho názvu v URL, ne na
autentizaci vůči ntfy serveru.

**Doporučená varianta:** (a) rychlé řešení pro spuštění · dlouhý, náhodně
generovaný název topicu, žádná změna kódu, `[MED]` riziko (kdokoli s URL může
topic sledovat nebo do něj publikovat). (b) trvalé řešení · rozšířit kód o
druhou env proměnnou s ntfy access tokenem a hlavičku
`Authorization: Bearer`, `[LOW]` riziko. Pokud tímto kanálem prochází reálné
GDPR žádosti s osobními údaji subjektu (Meta user_id, subject reference),
doporučuji rovnou (b).

**Stav kódu 2. 9. 2026 odpoledne:** varianta (b) je implementovaná. Funkce
`notifyNtfy()` čte volitelnou proměnnou `NTFY_ACCESS_TOKEN` a posílá ji jako
`Authorization: Bearer`; bez proměnné se chová jako dřív, nastavená a vadná
hodnota (mezery, méně než 16 znaků) znamená 503 bez odeslání, aby žádost
nikdy neodešla do topicu bez autorizace jen kvůli překlepu v env. Kryto testy
`npm run test:api`.

**Provedeno 2. 9. 2026 (Dopita, root na vps-claude):** na `ntfy.oneflow.cz`
založen uživatel `legal-callback` (role user) s právem `write-only` výhradně na
nový soukromý topic `oneflow-legal-gdpr` (výchozí přístup serveru je deny-all,
topic čtou jen admin účty `filip` a `oneflow`; topic `Filip` se záměrně nepoužil,
má anonymní zápis a čte ho i účet `lukas`). Vydán access token s labelem
`vercel-legal` a rourou uložen do produkčního Vercelu jako `NTFY_ACCESS_TOKEN`
(sensitive, hodnota nikde nevypsána ani nelogována); `NTFY_TOPIC_URL` =
`https://ntfy.oneflow.cz/oneflow-legal-gdpr`. Ověřeno: publish s tokenem 200,
bez tokenu 403. Bod 2 je tím splněn. Zbývá jediný ruční krok Filipa: přihlásit
topic `oneflow-legal-gdpr` v ntfy aplikaci pod účtem `filip` (souvisí s bodem 3);
nepřečtené zprávy drží server jen po dobu cache (výchozích 12 h).

### 3. Odpovědná osoba za vyřízení oznámení

**Otázka:** kdo konkrétně přebírá ntfy oznámení, dohledává subjekt v datech
OneFlow, provádí smazání a zapisuje výsledek?

**Doporučená varianta:** Filip Dopita jako jmenovaný správce (shoduje se s
identifikací správce v dokumentech), s ntfy aplikací přihlášenou k odběru
topicu a jednoduchým provozním logem žádostí (datum přijetí, subject
reference z callbacku, datum smazání, poznámka). Vyžaduje to navázat na sliby
už uvedené v dokumentech: první odpověď do 5 pracovních dnů, dokončení
smazání do 30 dnů (viz P1 bod 4).

**Právní opora:** čl. 24 odst. 1 GDPR · „zavede správce vhodná technická a
organizační opatření, aby zajistil a byl schopen doložit, že zpracování je
prováděno v souladu s tímto nařízením," a čl. 12 odst. 3 GDPR · lhůta jeden
měsíc od přijetí žádosti, prodloužitelná o další dva měsíce u složitých
žádostí. Bez reálné odpovědné osoby nelze lhůtu ani doložitelnost splnit.
[Citace ověřeny přes zrcadlo privacy-regulation.eu/cs/24.htm a /12.htm
2. 9. 2026 · přímý fetch EUR-Lex selhal, `OVĚŘIT-FETCH-FAIL`.]

## Oprava mimo 3 P0 · nalezeno při ověření NEPLÁTCE DPH

Při ověřování IČO a DPH statusu OneFlow s.r.o. v ARES (IČO `23121726`,
`stavZdrojeDph: NEEXISTUJICI` · ověřeno 2. 9. 2026, https://ares.gov.cz)
byla nalezena a opravena chyba v německé verzi zásad ochrany osobních údajů:

- `de/meta-platforms/oneflow-publisher-app-1239370548302204/data-controller-privacy-policy/index.html`
  uváděl `USt-IdNr.: CZ23121726` (VIES ověřitelné DIČ pro DPH). OneFlow
  s.r.o. není plátce DPH, žádné takové číslo nemá. Anglická a česká verze
  (zdrojová dle P1 bodu 9) žádné DIČ ani VAT/USt číslo neuvádí, opraveno na
  stejný rozsah · řádek zkrácen na `Handelsregisternummer (IČO): 23121726`.
- Slovenská verze uvádí `DIČ: CZ23121726` (obecné daňové identifikační
  číslo, ne VAT ID) · ponecháno, je věcně správné (každá s.r.o. registrovaná
  u finančního úřadu má DIČ bez ohledu na registraci k DPH), ale je to pořád
  odchylka od anglického zdroje · sleduj v P1 bodu 9.
- PDF `downloads/oneflow-publisher-privacy-de-2026-04-28.pdf` přegenerováno
  přes `npm run build:pdf` (lokální Playwright, `PDF BUILD PASS
  documents=10`), commitován jen tento jeden soubor. `npm run verify:pdf`
  lokálně selhal na chybějící `pypdf` (prostředí bez tohoto Python balíčku,
  nesouvisí s touto opravou) · doporučuji spustit `npm run qa:all` v CI nebo
  prostředí s kompletními závislostmi před příští promocí.

## P1 · potvrdit věcnou správnost dokumentů

1. Zda OneFlow Publisher skutečně zpracovává všechny vyjmenované kategorie dat,
   účely, právní základy, příjemce a přenosy mimo EHP.
2. Zda uvedené retenční lhůty odpovídají databázím, analytice, indexům, logům a
   zálohám v produkci.
3. Zda jsou aktivní relace a Page access tokeny při smazání skutečně zrušeny.
4. Zda je provozní závazek první odpovědi do 5 pracovních dnů a dokončení
   smazání do 30 dnů reálně obsluhován.
5. Zda jsou správné identifikační údaje OneFlow s.r.o., adresa, IČO, kontakty a
   role správce a zpracovatele.
6. Zda se na službu vztahují uvedené části GDPR, ePrivacy, DSA, AML, spotřebitelské
   právo a rozhodné právo ve všech jazykových verzích.
7. Zda odkazy a adresy dozorových orgánů pro Česko, Slovensko, Německo,
   Rakousko a Švýcarsko odpovídají zamýšleným trhům a jurisdikcím.
8. Zda věkové limity, pravidla pro děti, subprocesory, cookies a Meta technologie
   odpovídají skutečné implementaci.
9. Zda německá, slovenská a česká verze jsou právně rovnocenné anglickému
   zdroji, ne pouze jazykově srozumitelné.

## Technické opravy provedené bez změny právního záměru

- Callback odmítá chybějící secret, neplatný podpis, replay a neplatný algoritmus.
- Potvrzovací URL má pevný origin `https://legal.oneflow.cz` a nelze ji změnit
  hlavičkou `Host`.
- Status neprezentuje náhodný řetězec jako přijatou žádost.
- Oznámení se posílá pouze na allowlistovaný HTTPS host `ntfy.oneflow.cz`.
- Dokumenty již netvrdí, že callback automaticky posílá e-mail. Vrací podepsaný
  status odkaz; e-mailová a poštovní komunikace zůstávají manuální proces.

## Schválení

| Role | Jméno | Datum | Výsledek |
| --- | --- | --- | --- |
| Vlastník provozu |  |  | čeká |
| Právní kontrola |  |  | čeká |
