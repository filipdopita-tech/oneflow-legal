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
