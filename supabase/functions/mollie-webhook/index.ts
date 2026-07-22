// Uitgeschakeld: Karen werkt enkel met QR-betaling op eigen IBAN, geen Mollie.
// Vervangen door een no-op stub in plaats van de functie te verwijderen (geen
// delete-tool beschikbaar voor edge functions) -- doet niets meer, raakt de
// database niet aan. Was voorheen publiek aanroepbaar (verify_jwt=false,
// vereist voor een Mollie-webhook) en dus onnodig blootgesteld aanvalsoppervlak
// zolang de echte logica erin stond.
Deno.serve(async () => new Response('disabled', { status: 410 }))
