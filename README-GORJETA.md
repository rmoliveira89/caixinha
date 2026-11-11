# Gorjeta via Pix — A Batataria

Site para o **cliente** escanear o QR Code da comanda e enviar uma gorjeta (Pix) ao entregador.

## Arquivos

| Arquivo | Uso |
|---------|-----|
| `gorjeta.html` | Página pública do cliente (hospede em qualquer servidor ou CDN) |
| `gorjeta-supabase.sql` | Rode **uma vez** no SQL Editor do Supabase |
| `gorjeta-integracao.js` | Funções para o app de entregas gerar/buscar o link |

## Como funciona

1. O app de entregas (index) atribui um entregador ao pedido.
2. O sistema chama `garantirLinkGorjeta(pedido)` e grava em `gorjeta_links` um código no formato:

   ```
   a7f3c2e1-12345
   └ token ┘ └── número do pedido (sempre no final)
   ```

3. O gerador de QR Code da comanda lê o link:

   ```
   https://seu-dominio.com/gorjeta.html?c=a7f3c2e1-12345
   ```

4. O cliente escaneia → vê **nome/apelido do entregador**, **nome do cliente** e **nº do pedido** → escolhe R$ 1, 3, 5, 10 ou valor livre → gera Pix (QR + copia-e-cola) com a **chave** cadastrada do entregador.

## Passo a passo

### 1. Supabase

Abra o **SQL Editor** do projeto e execute o conteúdo de `gorjeta-supabase.sql`.

Isso cria:

- colunas `apelido` e `chave` em `entregadores`
- tabela `gorjeta_links`
- tabela `gorjeta_eventos` (opcional, métricas)

### 2. Hospedar a página do cliente

Publique `gorjeta.html` (Netlify, Vercel, GitHub Pages, mesmo host do app, etc.).

No topo do arquivo, a URL/key do Supabase já apontam para o mesmo projeto do app:

```js
const SUPABASE_URL = "https://umptefufjwvtsoegutet.supabase.co";
const SUPABASE_KEY = "sb_publishable_...";
```

### 3. Integrar no app de entregas

1. Cole as funções de `gorjeta-integracao.js` no `index.html` (ou importe o script).
2. Ajuste:

   ```js
   const GORJETA_BASE_URL = "https://seu-dominio.com/gorjeta.html";
   ```

3. Quando o pedido receber entregador (reserva / “adicionar à minha lista”), chame:

   ```js
   const r = await garantirLinkGorjeta(pedido);
   if (r.ok) {
     // r.url  → use no QR Code da comanda
     // r.codigo → a7f3c2e1-12345
   }
   ```

4. No gerador de comanda/QR, para um pedido já existente:

   ```js
   const r = await buscarLinkGorjetaPorPedido(numeroPedido);
   if (r.ok) desenharQR(r.url);
   ```

### 4. Cadastro do entregador (apelido + chave)

Na tela **Configurações → Entregadores**, inclua dois campos:

- **Apelido** — nome amigável mostrado ao cliente (se vazio, usa o `nome`)
- **Chave Pix** — CPF, CNPJ, e-mail, telefone ou chave aleatória

No `insert` / `update` do Supabase, envie `apelido` e `chave`.  
No `select`, inclua essas colunas.

## Formato do link (importante)

- Query string: `gorjeta.html?c=TOKEN-NUMERO`
- Também aceita: `?g=`, `#TOKEN-NUMERO`, ou path `/TOKEN-NUMERO`
- O **número do pedido fica no final** do código (após `-` ou `_`), para outros sistemas usarem se precisarem.

## Valores de gorjeta

- Botões: **R$ 1 · 3 · 5 · 10**
- Campo livre a partir de **R$ 1,00**
- Gera payload Pix estático (BR Code) com valor + chave do entregador
- QR Code na tela + botão “Copiar código Pix”

## Observações

- A página do cliente **não exige login**.
- Sem chave Pix cadastrada, a página avisa e não gera pagamento.
- Políticas RLS do SQL estão abertas ao `anon` (igual ao restante do app). Em produção, restrinja se necessário.
- O botão “Já paguei a gorjeta” só registra um evento local/Supabase; a confirmação real do Pix é no banco do entregador.
