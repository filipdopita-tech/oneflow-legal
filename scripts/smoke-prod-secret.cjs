#!/usr/bin/env node
/* Overi, ze META_APP_SECRET_PUBLISHER v produkci Vercelu je TEN SPRAVNY.
 *
 * Proc pres status endpoint a ne pres callback: uspesny POST na
 * /api/data-deletion-callback/ posle skutecnou ntfy notifikaci o GDPR zadosti.
 * Status endpoint overuje confirmation code TYMZ secretem, ale je to GET
 * bez jakehokoli vedlejsiho efektu. Kdyz projde, secret sedi.
 *
 * Pouziti:
 *   META_APP_SECRET_PUBLISHER='<secret z Meta App Dashboard>' node scripts/smoke-prod-secret.cjs
 *
 * Vysledky:
 *   200 "Verified request" · secret v produkci se shoduje s tim, ktery jsi zadal
 *   400 "Invalid code"     · v produkci je JINY secret (preklep, spatne zkopirovano)
 *   503                    · v produkci secret vubec neni (fail-closed drzi)
 */
const { _test } = require("../api/data-deletion-callback");

const ORIGIN = process.env.SMOKE_ORIGIN || "https://legal.oneflow.cz";
const secret = process.env.META_APP_SECRET_PUBLISHER || "";

const main = async () => {
  if (!secret) {
    console.error("Chybi META_APP_SECRET_PUBLISHER v prostredi. Priklad:");
    console.error("  META_APP_SECRET_PUBLISHER='<secret>' node scripts/smoke-prod-secret.cjs");
    process.exit(2);
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const code = _test.createConfirmationCode("smoke-prod-secret", issuedAt, secret);
  const url = `${ORIGIN}/api/deletion-status/?code=${encodeURIComponent(code)}`;

  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000) });
  const html = await response.text();
  const label = (html.match(/<span class="method-label">([^<]*)<\/span>/) || [, ""])[1];

  console.log(`${ORIGIN} · HTTP ${response.status} · ${label || "(bez stitku)"}`);

  if (response.status === 200 && label === "Verified request") {
    console.log("OK · produkce ma stejny App Secret, jaky jsi zadal. Callback je funkcni.");
    return 0;
  }
  if (response.status === 400) {
    console.error("CHYBA · produkce ma JINY App Secret nez ten zadany. Zkontroluj hodnotu ve Vercelu.");
    return 1;
  }
  if (response.status === 503) {
    console.error("CHYBA · produkce nema App Secret vubec. Fail-closed drzi, callback vraci 503.");
    return 1;
  }
  console.error("CHYBA · necekana odpoved, endpoint nebo deploy neni ve stavu, ktery skript umi posoudit.");
  return 1;
};

main().then((code) => process.exit(code)).catch((error) => {
  console.error(`CHYBA · ${error.message}`);
  process.exit(1);
});
