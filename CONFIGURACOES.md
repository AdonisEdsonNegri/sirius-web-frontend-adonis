# SIRIUS WEB — Configurações Críticas do Projeto

> **Finalidade:** Este arquivo deve ser consultado obrigatoriamente antes de qualquer
> reescrita ou criação de arquivos JavaScript no frontend.
> Evita erros de configuração como URLs incorretas, nomes de chaves errados, etc.

---

## 1. URLs da API

| Ambiente | URL Base |
|---|---|
| **Local (desenvolvimento)** | `http://localhost:3000` |
| **Produção (Vercel)** | `https://sirius-web-api-adonis.vercel.app` |

### Como usar no código JS:
```javascript
const isDev = window.location.hostname === 'localhost'
           || window.location.hostname === '127.0.0.1'
           || window.location.hostname === ''
           || window.location.protocol === 'file:';

const API_URL = isDev
    ? 'http://localhost:3000'
    : 'https://sirius-web-api-adonis.vercel.app';
```

> ⚠️ **ATENÇÃO:** Nunca usar `/api` como prefixo. As rotas não têm esse prefixo.

---

## 2. Prefixos das Rotas do Backend

| Módulo | Prefixo | Exemplo de rota completa |
|---|---|---|
| PDV | `/pdv/` | `http://localhost:3000/pdv/clientes/buscar` |
| Produtos | `/produtos/` | `http://localhost:3000/produtos` |
| Clientes | `/clientes/` | `http://localhost:3000/clientes` |
| Autenticação | `/auth/` | `http://localhost:3000/auth/login` |
| Empresas | `/empresas/` | `http://localhost:3000/empresas` |
| Vendedores | `/vendedores/` | `http://localhost:3000/vendedores` |
| Formas de Pagamento | `/formas-pagamento/` | `http://localhost:3000/formas-pagamento` |

---

## 3. Rotas Específicas do PDV

| Descrição | Método | Rota |
|---|---|---|
| Próximo número de pedido | GET | `/pdv/proximo-numero` |
| Cliente padrão (Consumidor Final) | GET | `/pdv/cliente-padrao` |
| Buscar clientes | GET | `/pdv/clientes/buscar?termo=...` |
| Buscar produtos | GET | `/pdv/produtos/buscar?termo=...` |
| Formas de pagamento | GET | `/pdv/formas-pagamento` |
| Parâmetros do sistema | GET | `/pdv/parametros` |
| Finalizar pedido | POST | `/pdv/pedidos/finalizar` |
| Listar pedidos | GET | `/pdv/pedidos` |
| Buscar pedido por ID | GET | `/pdv/pedidos/:id` |

---

## 4. localStorage — Chaves e Estrutura

| Chave | Conteúdo |
|---|---|
| `sirius_token` | String com o JWT de autenticação |
| `sirius_empresas` | Array JSON com as empresas do usuário |
| `sirius_usuario` | Objeto JSON com dados do usuário logado |

### Como extrair o empresaId corretamente:
```javascript
const empresas = JSON.parse(localStorage.getItem('sirius_empresas') || '[]');
// A estrutura retornada é um ARRAY de objetos
// O campo correto é .id (não .id_empresa)
const empresaId = empresas[0].id;
```

### Estrutura real do objeto empresa:
```json
{
  "id": 4,
  "razao_social": "Nome da Empresa Ltda",
  "nome_fantasia": "Nome Fantasia",
  "cnpj": "00000000000000"
}
```

> ⚠️ **ATENÇÃO:** O campo é `.id`, não `.id_empresa`. Verificar antes de usar.

---

## 5. Headers Obrigatórios em Toda Requisição

Todo `fetch` para a API precisa dos dois headers abaixo, sem exceção:

```javascript
const response = await fetch(`${API_URL}/pdv/clientes/buscar?termo=...`, {
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('sirius_token')}`,
        'X-Empresa-Id': empresaId   // ← obrigatório para o middleware setTenant
    }
});
```

> O middleware `setTenant` no backend rejeita com **404** se `X-Empresa-Id` não for enviado
> ou chegar como `null`/`undefined`.

---

## 6. Padrões de Nomenclatura

| Tipo | Padrão | Exemplo |
|---|---|---|
| Arquivos | kebab-case | `pdv.html`, `formas-pagamento.css` |
| Funções JS | camelCase | `buscarClientes()`, `renderizarItens()` |
| IDs HTML | kebab-case | `id="btn-novo-pedido"` |
| Variáveis JS | camelCase | `pedidoAtual`, `formasPagamento` |

---

## 7. Padrões de Código Frontend

- **Sem frameworks:** Somente HTML + CSS + JS puro (sem React, Vue, etc.)
- **Sem npm no frontend:** Nenhuma dependência de pacote no frontend
- **Modais personalizados:** Nunca usar `alert()`, `confirm()` ou `prompt()`
- **Encoding:** Sempre UTF-8 em todos os arquivos
- **Cor padrão:** Azul `#2563eb`

---

## 8. Passagem de Objetos para Funções via HTML

**Nunca** usar `JSON.stringify` em atributos `onclick`:
```html
<!-- ❌ ERRADO — quebra com nomes que têm aspas ou acentos -->
<div onclick="selecionar(${JSON.stringify(obj)})">

<!-- ✅ CORRETO — guardar em array e referenciar pelo índice -->
<div onclick="selecionarPorIdx(${idx})">
```

```javascript
// No JS, manter array auxiliar:
let _listaResultados = [];

function selecionarPorIdx(idx) {
    const obj = _listaResultados[idx];
    // usar obj normalmente
}
```

---

## 9. Estrutura de Arquivos do Frontend

```
/                        ← raiz do frontend
├── index.html           ← login
├── dashboard.html
├── pdv.html
├── pedidos.html
├── clientes.html
├── produtos.html
├── css/
│   ├── pdv.css
│   └── ...
├── js/
│   ├── pdv.js
│   └── ...
└── TelaInicialDoPDV.jpg ← imagem da tela inicial do PDV (raiz do frontend)
```

> ⚠️ O arquivo `TelaInicialDoPDV.jpg` fica na **raiz do frontend**, não dentro de `/img/`.
> No CSS referenciar como `url('../TelaInicialDoPDV.jpg')` a partir de `/css/`.

---

## 10. Lições Aprendidas (Erros que já aconteceram)

| # | Erro | Causa | Solução |
|---|---|---|---|
| 1 | Todas as rotas retornavam 404 | `API_URL` com `/api` no final, que não existe | Usar `http://localhost:3000` sem sufixo |
| 2 | `X-Empresa-Id` chegava null | `empresaId` lido antes de estar inicializado | Sempre usar `localStorage.getItem()` no momento do fetch |
| 3 | Clique em resultado de busca não funcionava | `JSON.stringify` em atributo `onclick` quebrava com caracteres especiais | Usar array auxiliar + índice numérico |
| 4 | Endpoint 404 | Rota era `/pdv/proximo-numero`, não `/pdv/pedidos/proximo-numero` | Verificar `pdv-routes.js` antes de assumir o path |
| 5 | Imagem não carregava | Path relativo incorreto no CSS | Usar `url('../TelaInicialDoPDV.jpg')` a partir de `/css/` |
| 6 | `buscarClientes` retornava clientes errados (ex: "jo" trazia "DOM PEDRO") | `termoNumerico` vazio gerava `$3 = '%%'` no SQL, que casa com **qualquer** registro | Tornar a condição CPF/CNPJ condicional: só incluir no `WHERE` quando `termoNumerico.length > 0` |
| 7 | (padrão geral de risco) | Qualquer `replace()` que pode retornar `''` + `ILIKE '%%'` no SQL retorna **todos** os registros | Sempre validar se o parâmetro tem conteúdo antes de incluí-lo na cláusula `WHERE`. Aplicável a buscas de produtos, pedidos e qualquer outra entidade |

---

*Atualizado em: fevereiro de 2026 — v1.1*
*Projeto: SIRIUS WEB ERP Multi-Tenant*

## Arquitetura JavaScript — Regras Obrigatórias

### auth.js é o único arquivo incluído em TODAS as páginas
Sempre incluir como primeiro script: `<script src="js/auth.js"></script>`

### Funções globais disponíveis via auth.js
Nunca redefinir essas funções em outros arquivos ou inline no HTML:
- `obterToken()` — retorna o JWT do localStorage
- `obterEmpresaId()` — retorna o ID da empresa ativa  
- `verificarAutenticacao()` — redireciona para login se não autenticado
- `logout()` — limpa sessão e redireciona para index.html
- `showMessage(texto, tipo)` — exibe mensagem na tela

### Checklist ao criar nova página HTML
1. Verificar se TODOS os `getElementById()` chamados no JS têm o elemento 
   correspondente no HTML — um ID ausente causa TypeError silencioso que 
   trava toda a inicialização
2. Abrir e fechar modais pelo mesmo método — se o JS abre com 
   `style.display='block'`, fechar com `style.display='none'`
3. Não duplicar funções que já estão em auth.js

"Atualizado em 27/02/2026"
