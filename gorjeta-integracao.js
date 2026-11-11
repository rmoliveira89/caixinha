/**
 * ============================================================
 * INTEGRAÇÃO GORJETA — cole trechos no index.html do app
 * ============================================================
 *
 * 1) Rode o SQL (gorjeta-supabase.sql) no Supabase.
 * 2) Hospede gorjeta.html (mesmo domínio ou qualquer URL pública).
 * 3) Ajuste GORJETA_BASE_URL abaixo para a URL pública do gorjeta.html.
 * 4) Chame garantirLinkGorjeta(pedido) quando o entregador for
 *    definido no pedido (reserva / "adicionar à minha lista" / sync).
 * 5) No cadastro de entregadores, inclua os campos apelido e chave
 *    (ver HTML de exemplo no final deste arquivo).
 *
 * Formato do código:  {token8}-{numero_pedido}
 * Exemplo de link:    https://seusite.com/gorjeta.html?c=a7f3c2e1-12345
 * O número do pedido fica SEMPRE no final do código.
 */

const GORJETA_BASE_URL = "https://SEU_DOMINIO_AQUI/gorjeta.html"; // ← altere

/** Gera token curto aleatório (hex) */
function _gorjetaToken(len) {
  const n = Math.max(6, len || 8);
  const a = new Uint8Array(Math.ceil(n / 2));
  (window.crypto || window.msCrypto).getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, "0")).join("").slice(0, n);
}

/**
 * Garante um link de gorjeta para o pedido.
 * - Se já existir (mesmo pedido_id ou numero_pedido + entregador), reutiliza.
 * - Caso contrário cria um novo código terminando com o número do pedido.
 * Retorna { ok, codigo, url, row } ou { ok:false, erro }.
 */
async function garantirLinkGorjeta(pedido) {
  try {
    const client = typeof getSb === "function" ? getSb() : null;
    if (!client) return { ok: false, erro: "Supabase não configurado" };
    if (!pedido) return { ok: false, erro: "Pedido inválido" };

    const numero = String(pedido.numero_pedido || "").trim();
    if (!numero) return { ok: false, erro: "Pedido sem número" };

    const entNome = String(
      pedido.entregador_nome ||
      (typeof getNomeReserva === "function" ? getNomeReserva(pedido) : "") ||
      ""
    ).trim();
    if (!entNome) return { ok: false, erro: "Pedido sem entregador" };

    // já existe?
    let existente = null;
    if (pedido.id) {
      const r = await client.from("gorjeta_links").select("*")
        .eq("pedido_id", String(pedido.id)).eq("ativo", true).maybeSingle();
      if (r.data) existente = r.data;
    }
    if (!existente) {
      const r = await client.from("gorjeta_links").select("*")
        .eq("numero_pedido", numero)
        .ilike("entregador_nome", entNome)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (r.data) existente = r.data;
    }
    if (existente) {
      const url = GORJETA_BASE_URL + (GORJETA_BASE_URL.indexOf("?") >= 0 ? "&" : "?") + "c=" + encodeURIComponent(existente.codigo);
      return { ok: true, codigo: existente.codigo, url, row: existente, reutilizado: true };
    }

    // cria novo: token + "-" + numero_pedido
    const codigo = _gorjetaToken(8) + "-" + numero.replace(/[^\w]/g, "");
    const row = {
      codigo,
      numero_pedido: numero,
      pedido_id: pedido.id ? String(pedido.id) : null,
      cliente_nome: String(pedido.cliente_nome || "").trim() || null,
      entregador_nome: entNome,
      ativo: true
    };

    const { data, error } = await client.from("gorjeta_links").insert(row).select("*").maybeSingle();
    if (error) throw error;

    const url = GORJETA_BASE_URL + (GORJETA_BASE_URL.indexOf("?") >= 0 ? "&" : "?") + "c=" + encodeURIComponent((data && data.codigo) || codigo);
    return { ok: true, codigo: (data && data.codigo) || codigo, url, row: data || row, reutilizado: false };
  } catch (e) {
    console.warn("garantirLinkGorjeta", e);
    return { ok: false, erro: (e && e.message) || String(e) };
  }
}

/**
 * Busca o link já gerado (para o sistema de QR Code da comanda).
 * Uso típico no gerador de comanda/QR:
 *   const r = await buscarLinkGorjetaPorPedido(numeroPedido);
 *   if (r.ok) desenharQR(r.url);
 */
async function buscarLinkGorjetaPorPedido(numeroPedido) {
  try {
    const client = typeof getSb === "function" ? getSb() : null;
    if (!client) return { ok: false, erro: "Supabase não configurado" };
    const num = String(numeroPedido || "").trim();
    if (!num) return { ok: false, erro: "Número vazio" };

    const { data, error } = await client.from("gorjeta_links").select("*")
      .eq("numero_pedido", num)
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, erro: "Link ainda não gerado" };

    const url = GORJETA_BASE_URL + (GORJETA_BASE_URL.indexOf("?") >= 0 ? "&" : "?") + "c=" + encodeURIComponent(data.codigo);
    return { ok: true, codigo: data.codigo, url, row: data };
  } catch (e) {
    return { ok: false, erro: (e && e.message) || String(e) };
  }
}

/* Expor no window se estiver no browser */
if (typeof window !== "undefined") {
  window.garantirLinkGorjeta = garantirLinkGorjeta;
  window.buscarLinkGorjetaPorPedido = buscarLinkGorjetaPorPedido;
  window.GORJETA_BASE_URL = GORJETA_BASE_URL;
}

/* ============================================================
 * EXEMPLO — campos apelido e chave no cadastro de entregadores
 * (Configurações › Entregadores)
 *
 * No formulário de adicionar/editar entregador, inclua:
 *
 * <label>Apelido (gorjeta)</label>
 * <input id="entApelido" placeholder="Como o cliente vê o nome" />
 *
 * <label>Chave Pix</label>
 * <input id="entChave" placeholder="CPF, e-mail, telefone ou chave aleatória" />
 *
 * No insert/update, envie também:
 *   apelido: (document.getElementById('entApelido').value || '').trim() || null,
 *   chave:   (document.getElementById('entChave').value || '').trim() || null,
 *
 * No select de listagem/edição, inclua 'apelido,chave' no .select(...).
 *
 * Onde chamar garantirLinkGorjeta:
 *   - ao reservar/atribuir pedido ao entregador
 *   - ao sincronizar pedidos que já têm entregador_nome
 * Exemplo:
 *   const r = await garantirLinkGorjeta(pedido);
 *   if (r.ok) console.log('QR gorjeta:', r.url);
 * ============================================================ */
