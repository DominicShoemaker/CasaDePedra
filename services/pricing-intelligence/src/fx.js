function formatPtaxDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  if (!match) throw new Error(`Invalid ISO date: ${date}`);
  return `${match[2]}-${match[3]}-${match[1]}`;
}

function subtractDays(date, days) {
  const ms = Date.parse(`${date}T00:00:00Z`) - days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

export async function fetchPtaxUsdBrl(date, { fetchImpl = fetch, maxLookbackDays = 7 } = {}) {
  for (let offset = 0; offset <= maxLookbackDays; offset += 1) {
    const observedDate = subtractDays(date, offset);
    const ptaxDate = formatPtaxDate(observedDate);
    const endpoint = new URL("https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)");
    endpoint.searchParams.set("@moeda", "'USD'");
    endpoint.searchParams.set("@dataCotacao", `'${ptaxDate}'`);
    endpoint.searchParams.set("$format", "json");
    const response = await fetchImpl(endpoint);
    if (!response.ok) throw new Error(`BCB PTAX request failed: ${response.status}`);
    const body = await response.json();
    const values = Array.isArray(body.value) ? body.value : [];
    if (values.length === 0) continue;
    const latest = values.at(-1);
    const buy = Number(latest.cotacaoCompra);
    const sell = Number(latest.cotacaoVenda);
    if (!Number.isFinite(buy) || !Number.isFinite(sell)) throw new Error("BCB PTAX response is missing USD/BRL rates");
    return {
      source: "Banco Central do Brasil PTAX",
      requestedDate: date,
      observedDate,
      brlPerUsdBuy: buy,
      brlPerUsdSell: sell,
      brlPerUsdMid: Number(((buy + sell) / 2).toFixed(6)),
    };
  }
  throw new Error(`No BCB PTAX USD/BRL quote found within ${maxLookbackDays} days of ${date}`);
}

export function brlToUsd(brl, quote) {
  const amount = Number(brl);
  if (!Number.isFinite(amount)) throw new Error(`Invalid BRL amount: ${brl}`);
  const rate = Number(quote.brlPerUsdSell);
  if (!(rate > 0)) throw new Error("Invalid PTAX sell rate");
  return amount / rate;
}
