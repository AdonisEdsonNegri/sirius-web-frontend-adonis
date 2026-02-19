/* ================================================================
   SIRIUS WEB - PDV.JS
   Lógica completa do PDV com 3 abas e navegação por teclado
   ================================================================ */

'use strict';

// ================================================================
// CONFIGURAÇÃO DA API (dual: local + Vercel)
// ================================================================
const isDev = window.location.hostname === 'localhost'
           || window.location.hostname === '127.0.0.1'
           || window.location.hostname === ''
           || window.location.protocol === 'file:';

// Local: http://localhost:3000  |  Produção: API separada no Vercel
const API_URL = isDev
    ? 'http://localhost:3000'
    : 'https://sirius-web-api-adonis.vercel.app';

console.log('📍 Ambiente:', isDev ? 'DESENVOLVIMENTO' : 'PRODUÇÃO');
console.log('📡 API URL:', API_URL);

// ================================================================
// ESTADO GLOBAL
// ================================================================
let empresaId = null;
let formasPagamento = [];
let parametros = {};          // parâmetros do sistema
let pedidoAtual = novoPedidoObj();
let itemEmEdicao = null;      // índice do item sendo editado no modal qtd
let abatual = 'cliente';      // aba visível: 'cliente' | 'produtos' | 'pagamentos'

function novoPedidoObj() {
    return {
        numero: null,
        cliente: null,
        itens: [],
        pagamentos: [],
        valor_bruto: 0,
        desconto: 0,
        acrescimo: 0,
        valor_liquido: 0,
        observacoes: ''
    };
}

// ================================================================
// INICIALIZAÇÃO
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticação
    const token = localStorage.getItem('sirius_token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const empresasStr = localStorage.getItem('sirius_empresas');
        if (!empresasStr) {
            console.error('❌ sirius_empresas não encontrado no localStorage');
            window.location.href = 'index.html';
            return;
        }

        const empresas = JSON.parse(empresasStr);
        // Suporte a array ou objeto direto
        const empresa = Array.isArray(empresas) ? empresas[0] : empresas;
        // Suporte a id_empresa ou id
        empresaId = empresa.id_empresa || empresa.id || empresa.empresa_id;

        console.log('🏢 empresaId carregado:', empresaId, '| estrutura:', JSON.stringify(empresa).substring(0, 100));

        if (!empresaId) {
            console.error('❌ empresaId não encontrado. Estrutura recebida:', empresa);
            window.location.href = 'index.html';
            return;
        }
    } catch (e) {
        console.error('❌ Erro ao parsear sirius_empresas:', e);
        window.location.href = 'index.html';
        return;
    }

    // Mostrar tela inicial e configurar eventos globais
    mostrarTelaInicial();
    configurarEventosGlobais();
});

// ================================================================
// TELA INICIAL
// ================================================================
function mostrarTelaInicial() {
    document.getElementById('tela-inicial').style.display = 'block';
    document.getElementById('tela-pdv').style.display = 'none';
    // Focar no botão "Novo Pedido"
    setTimeout(() => {
        const btn = document.getElementById('btn-novo-pedido');
        if (btn) btn.focus();
    }, 100);
}

function voltarDashboard() {
    window.location.href = 'dashboard.html';
}

// ================================================================
// INICIAR NOVO PEDIDO → vai para aba Cliente
// ================================================================
async function iniciarNovoPedido() {
    // Resetar estado
    pedidoAtual = novoPedidoObj();

    // Mostrar tela PDV
    document.getElementById('tela-inicial').style.display = 'none';
    document.getElementById('tela-pdv').style.display = 'flex';

    // Atualizar data no header
    const agora = new Date();
    document.getElementById('dataPedido').textContent = agora.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    // Carregar dados em paralelo
    await Promise.all([
        carregarProximoNumero(),
        carregarClientePadrao(),
        carregarFormasPagamento(),
        carregarParametros()
    ]);

    // Ir para aba Cliente
    irParaAba('cliente');
}

// ================================================================
// NAVEGAÇÃO ENTRE ABAS
// ================================================================
function irParaAba(aba) {
    abatual = aba;

    // Esconder todas as abas
    document.querySelectorAll('.pdv-tab').forEach(t => t.style.display = 'none');

    // Atualizar steps no header
    const steps = { cliente: 1, produtos: 2, pagamentos: 3 };
    const numAba = steps[aba];

    document.querySelectorAll('.pdv-step').forEach(s => {
        const num = steps[s.dataset.tab];
        s.classList.remove('ativo', 'concluido');
        if (num < numAba) s.classList.add('concluido');
        if (num === numAba) s.classList.add('ativo');
    });

    // Mostrar aba atual
    document.getElementById(`tab-${aba}`).style.display = 'block';

    // Foco inicial por aba
    setTimeout(() => {
        if (aba === 'cliente') {
            document.getElementById('inputBuscaCliente').focus();
        } else if (aba === 'produtos') {
            document.getElementById('buscaProduto').focus();
        } else if (aba === 'pagamentos') {
            document.getElementById('formaPagamento').focus();
        }
    }, 80);
}

function voltarAba(aba) {
    irParaAba(aba);
}

// ================================================================
// CONFIRMAR CLIENTE → ir para Produtos
// ================================================================
function confirmarCliente() {
    if (!pedidoAtual.cliente) {
        showMessage('Nenhum cliente selecionado. Selecione um cliente ou use o Consumidor Final.', 'warning');
        return;
    }
    // Atualizar badge do cliente na aba Produtos
    const nomeCliente = pedidoAtual.cliente.razao_social || 'Consumidor Final';
    document.getElementById('clienteBadge').textContent = `👤 ${nomeCliente}`;
    document.getElementById('clienteBadgePag').textContent = nomeCliente;

    irParaAba('produtos');
}

// ================================================================
// CONFIRMAR PRODUTOS → ir para Pagamentos
// ================================================================
function confirmarProdutos() {
    if (pedidoAtual.itens.length === 0) {
        showMessage('Adicione pelo menos um produto antes de continuar.', 'warning');
        return;
    }

    // Atualizar resumo na aba pagamentos
    document.getElementById('pagItensQtd').textContent = pedidoAtual.itens.length;
    document.getElementById('pagTotalPedido').textContent = `R$ ${pedidoAtual.valor_liquido.toFixed(2)}`;
    atualizarStatusPagamento();

    irParaAba('pagamentos');
}

// ================================================================
// CANCELAR VENDA
// ================================================================
function cancelarVendaConfirmar() {
    document.getElementById('modalConfirmacao').style.display = 'flex';
    setTimeout(() => {
        document.getElementById('btnConfirmarAcao').focus();
    }, 100);
}

function fecharModalConfirmacao() {
    document.getElementById('modalConfirmacao').style.display = 'none';
}

function executarCancelamento() {
    fecharModalConfirmacao();
    mostrarTelaInicial();
}

// ================================================================
// CARREGAR PRÓXIMO NÚMERO
// ================================================================
async function carregarProximoNumero() {
    try {
        const response = await fetch(`${API_URL}/pdv/proximo-numero`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('sirius_token')}`,
                'X-Empresa-Id': empresaId
            }
        });
        const data = await response.json();
        if (data.success) {
            pedidoAtual.numero = data.data.numero;
            document.getElementById('numeroPedido').textContent = data.data.numero;
        }
    } catch (e) {
        console.error('Erro ao obter número do pedido:', e);
    }
}

// ================================================================
// CARREGAR PARÂMETROS DO SISTEMA
// ================================================================
async function carregarParametros() {
    try {
        const response = await fetch(`${API_URL}/pdv/parametros`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('sirius_token')}`,
                'X-Empresa-Id': empresaId
            }
        });
        const data = await response.json();
        if (data.success && data.data) {
            parametros = {};
            data.data.forEach(p => {
                parametros[p.codigo] = p.valor;
            });
        }
    } catch (e) {
        console.warn('Parâmetros não disponíveis:', e.message);
        parametros = {};
    }
}

// Helpers para parâmetros
function paramAtivo(codigo) {
    const v = (parametros[codigo] || '').toString().toUpperCase();
    return v === 'S' || v === '1' || v === 'TRUE';
}

// ================================================================
// CLIENTE PADRÃO (Consumidor Final)
// ================================================================
async function carregarClientePadrao() {
    try {
        const response = await fetch(`${API_URL}/pdv/cliente-padrao`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('sirius_token')}`,
                'X-Empresa-Id': empresaId
            }
        });
        const data = await response.json();
        if (data.success && data.data) {
            pedidoAtual.cliente = data.data;
        } else {
            pedidoAtual.cliente = { id: 0, razao_social: 'Consumidor Final', documento: '' };
        }
    } catch (e) {
        pedidoAtual.cliente = { id: 0, razao_social: 'Consumidor Final', documento: '' };
    }
    renderizarClienteSelecionado();
}

function renderizarClienteSelecionado() {
    const container = document.getElementById('clienteInfo');
    if (!pedidoAtual.cliente) {
        container.innerHTML = '<div class="cliente-loading">Nenhum cliente selecionado</div>';
        return;
    }
    const c = pedidoAtual.cliente;
    container.innerHTML = `
        <div class="cliente-nome">${c.razao_social}</div>
        ${c.documento ? `<div class="cliente-doc">${c.documento}</div>` : ''}
        ${!c.documento && !c.id ? '<div class="cliente-consumidor">⚡ Cliente padrão do sistema</div>' : ''}
    `;
}

function limparBuscaCliente() {
    document.getElementById('inputBuscaCliente').value = '';
    document.getElementById('resultadosBuscaCliente').innerHTML = '';
    document.getElementById('btnLimparBuscaCliente').style.display = 'none';
    document.getElementById('inputBuscaCliente').focus();
}

// ================================================================
// BUSCAR CLIENTES
// ================================================================

// Array auxiliar para guardar os objetos cliente sem passar pelo HTML
let _clientesResultado = [];

async function buscarClientes(termo) {
    if (!termo || termo.trim().length < 2) {
        document.getElementById('resultadosBuscaCliente').innerHTML =
            '<div class="empty-message">Digite pelo menos 2 caracteres e tecle Enter</div>';
        return;
    }

    console.log('🔍 Buscando clientes | termo:', termo, '| empresaId:', empresaId, '| API_URL:', API_URL);

    // Indicador visual de carregando
    document.getElementById('resultadosBuscaCliente').innerHTML =
        '<div class="empty-message">Buscando...</div>';

    try {
        const token = localStorage.getItem('sirius_token');
        const url = `${API_URL}/pdv/clientes/buscar?termo=${encodeURIComponent(termo)}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': String(empresaId)
            }
        });

        console.log('📡 Resposta clientes | status:', response.status);

        const data = await response.json();
        console.log('📦 Dados clientes:', data);

        if (data.success) {
            renderizarResultadosClientes(data.data);
        } else {
            document.getElementById('resultadosBuscaCliente').innerHTML =
                `<div class="empty-message">Nenhum resultado: ${data.message || ''}</div>`;
        }
    } catch (e) {
        console.error('❌ Erro ao buscar clientes:', e);
        document.getElementById('resultadosBuscaCliente').innerHTML =
            '<div class="empty-message">Erro de conexão ao buscar clientes</div>';
    }
}

function renderizarResultadosClientes(clientes) {
    const container = document.getElementById('resultadosBuscaCliente');
    _clientesResultado = clientes || [];

    if (_clientesResultado.length === 0) {
        container.innerHTML = '<div class="empty-message">Nenhum cliente encontrado</div>';
        return;
    }

    container.innerHTML = _clientesResultado.map((c, idx) => `
        <div
            class="resultado-item"
            tabindex="0"
            data-idx="${idx}"
            onclick="selecionarClientePorIdx(${idx})"
            onkeydown="teclaResultadoCliente(event, ${idx})"
        >
            <div class="resultado-nome">${c.razao_social}</div>
            <div class="resultado-info">
                ${c.nome_fantasia ? `<span>${c.nome_fantasia}</span>` : ''}
                ${c.documento ? `<span>${c.documento}</span>` : ''}
            </div>
        </div>
    `).join('');
}

function selecionarClientePorIdx(idx) {
    selecionarCliente(_clientesResultado[idx]);
}

function selecionarCliente(cliente) {
    pedidoAtual.cliente = cliente;
    renderizarClienteSelecionado();
    // Limpar busca
    document.getElementById('inputBuscaCliente').value = '';
    document.getElementById('resultadosBuscaCliente').innerHTML = '';
    document.getElementById('btnLimparBuscaCliente').style.display = 'none';
    // Focar no botão confirmar
    document.getElementById('btnConfirmarCliente').focus();
}

function teclaResultadoCliente(event, idx) {
    if (event.key === 'Enter') {
        event.preventDefault();
        selecionarClientePorIdx(idx);
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        const next = event.target.nextElementSibling;
        if (next) next.focus();
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prev = event.target.previousElementSibling;
        if (prev) prev.focus();
        else document.getElementById('inputBuscaCliente').focus();
    }
}

// ================================================================
// FORMAS DE PAGAMENTO
// ================================================================
async function carregarFormasPagamento() {
    try {
        const response = await fetch(`${API_URL}/pdv/formas-pagamento`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('sirius_token')}`,
                'X-Empresa-Id': empresaId
            }
        });
        const data = await response.json();
        if (data.success) {
            formasPagamento = data.data;
            const select = document.getElementById('formaPagamento');
            select.innerHTML = '<option value="">Selecione...</option>' +
                formasPagamento.map(f =>
                    `<option value="${f.id}">${f.descricao}</option>`
                ).join('');
        }
    } catch (e) {
        console.error('Erro ao carregar formas de pagamento:', e);
    }
}

// ================================================================
// BUSCAR PRODUTOS
// ================================================================

// Array auxiliar para guardar os objetos produto sem passar pelo HTML
let _produtosResultado = [];

async function buscarProdutos(termo) {
    try {
        const response = await fetch(
            `${API_URL}/pdv/produtos/buscar?termo=${encodeURIComponent(termo)}`,
            {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('sirius_token')}`,
                    'X-Empresa-Id': empresaId
                }
            }
        );

        const data = await response.json();

        if (data.success) {
            renderizarResultadosProdutos(data.data);
        } else {
            console.error('Erro ao buscar produtos:', data);
        }
    } catch (e) {
        console.error('Erro ao buscar produtos:', e);
    }
}

function renderizarResultadosProdutos(produtos) {
    const container = document.getElementById('resultadosBusca');
    _produtosResultado = produtos || [];

    if (_produtosResultado.length === 0) {
        container.innerHTML = '<div class="empty-message">Nenhum produto encontrado</div>';
        return;
    }

    container.innerHTML = _produtosResultado.map((p, idx) => {
        const estoque = parseFloat(p.estoque) || 0;
        const estoqueClass = estoque <= 0 ? 'resultado-estoque-zero' : 'resultado-estoque';
        return `
            <div
                class="resultado-item"
                tabindex="0"
                data-idx="${idx}"
                onclick="adicionarProdutoPorIdx(${idx})"
                onkeydown="teclaResultadoProduto(event, ${idx})"
            >
                <div class="resultado-nome">${p.descricao}</div>
                <div class="resultado-info">
                    ${p.codigo ? `<span>Cód: ${p.codigo}</span>` : ''}
                    ${p.ean ? `<span>EAN: ${p.ean}</span>` : ''}
                    <span class="${estoqueClass}">Estq: ${estoque.toFixed(3)}</span>
                    <span class="resultado-preco">R$ ${parseFloat(p.preco).toFixed(2)}</span>
                </div>
            </div>
        `;
    }).join('');
}

function adicionarProdutoPorIdx(idx) {
    adicionarProduto(_produtosResultado[idx]);
}

function teclaResultadoProduto(event, idx) {
    if (event.key === 'Enter') {
        event.preventDefault();
        adicionarProdutoPorIdx(idx);
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        const next = event.target.nextElementSibling;
        if (next) next.focus();
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prev = event.target.previousElementSibling;
        if (prev) prev.focus();
        else document.getElementById('buscaProduto').focus();
    }
}

// ================================================================
// ADICIONAR PRODUTO
// ================================================================
function adicionarProduto(produto) {
    const estoque = parseFloat(produto.estoque) || 0;

    // Verificar estoque (conforme parâmetro)
    const permiteSemEstoque = paramAtivo('PDV_PERMITE_VENDA_SEM_ESTOQUE');
    if (!permiteSemEstoque && estoque <= 0) {
        showMessage(`Produto "${produto.descricao}" sem saldo em estoque!`, 'error');
        return;
    }

    // Verificar se parâmetro exige informar quantidade manualmente
    const pedirQuantidade = paramAtivo('PDV_PEDIR_QUANTIDADE');
    const itemExistente = pedidoAtual.itens.find(i => i.id_produto === produto.id);

    if (pedirQuantidade && !itemExistente) {
        // Abrir modal de quantidade
        abrirModalQuantidade(produto);
    } else if (itemExistente) {
        // Incrementar quantidade do item existente
        const novaQtd = itemExistente.quantidade + 1;
        if (!permiteSemEstoque && novaQtd > itemExistente.estoque) {
            showMessage(
                `Estoque insuficiente para "${produto.descricao}". Disponível: ${itemExistente.estoque.toFixed(3)}`,
                'error'
            );
            return;
        }
        itemExistente.quantidade = novaQtd;
        itemExistente.valor_total = itemExistente.quantidade * itemExistente.valor_unitario;
    } else {
        // Novo item com quantidade 1
        pedidoAtual.itens.push({
            id_produto: produto.id,
            codigo: produto.codigo,
            ean: produto.ean,
            descricao: produto.descricao,
            descricao_complemento: produto.descricao_complemento,
            unidade: produto.unidade,
            quantidade: 1,
            valor_unitario: parseFloat(produto.preco),
            valor_total: parseFloat(produto.preco),
            estoque: estoque
        });
    }

    // Limpar busca e focar novamente
    document.getElementById('buscaProduto').value = '';
    document.getElementById('resultadosBusca').innerHTML = '';

    renderizarItens();
    calcularTotais();

    setTimeout(() => document.getElementById('buscaProduto').focus(), 80);
}

// ================================================================
// RENDERIZAR ITENS
// ================================================================
function renderizarItens() {
    const tbody = document.getElementById('itensTabela');
    const qtdSpan = document.getElementById('quantidadeItens');

    if (pedidoAtual.itens.length === 0) {
        tbody.innerHTML = `
            <tr class="linha-vazia">
                <td colspan="6"><div class="empty-itens">Nenhum item adicionado</div></td>
            </tr>
        `;
        qtdSpan.textContent = '0 itens';
        return;
    }

    qtdSpan.textContent = `${pedidoAtual.itens.length} ${pedidoAtual.itens.length === 1 ? 'item' : 'itens'}`;

    tbody.innerHTML = pedidoAtual.itens.map((item, idx) => `
        <tr>
            <td class="item-seq">${idx + 1}</td>
            <td>
                <div class="item-nome">${item.descricao}</div>
                ${item.codigo ? `<div class="item-sub">Cód: ${item.codigo}</div>` : ''}
            </td>
            <td>
                <button
                    class="item-qtd-btn"
                    onclick="abrirEdicaoQuantidade(${idx})"
                    title="Editar quantidade"
                >
                    ${parseFloat(item.quantidade).toFixed(3)} ${item.unidade}
                </button>
            </td>
            <td>R$ ${item.valor_unitario.toFixed(2)}</td>
            <td class="item-total">R$ ${item.valor_total.toFixed(2)}</td>
            <td>
                <button class="btn-remover-item" onclick="removerItem(${idx})" title="Remover">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// ================================================================
// CALCULAR TOTAIS
// ================================================================
function calcularTotais() {
    pedidoAtual.valor_bruto = pedidoAtual.itens.reduce((s, i) => s + i.valor_total, 0);
    pedidoAtual.valor_liquido = pedidoAtual.valor_bruto - pedidoAtual.desconto + pedidoAtual.acrescimo;

    document.getElementById('subtotal').textContent = `R$ ${pedidoAtual.valor_bruto.toFixed(2)}`;
    document.getElementById('desconto').textContent = `R$ ${pedidoAtual.desconto.toFixed(2)}`;
    document.getElementById('acrescimo').textContent = `R$ ${pedidoAtual.acrescimo.toFixed(2)}`;
    document.getElementById('totalGeral').textContent = `R$ ${pedidoAtual.valor_liquido.toFixed(2)}`;

    // Exibir/ocultar linhas de desconto e acréscimo
    document.getElementById('linhDesconto').style.display =
        pedidoAtual.desconto > 0 ? 'flex' : 'none';
    document.getElementById('linhaAcrescimo').style.display =
        pedidoAtual.acrescimo > 0 ? 'flex' : 'none';

    // Mini-total no header
    document.getElementById('totalMini').textContent = `R$ ${pedidoAtual.valor_liquido.toFixed(2)}`;
}

// ================================================================
// MODAL: QUANTIDADE DO PRODUTO
// ================================================================

// Guardar produto do modal em variável, não no dataset
let _produtoModalQuantidade = null;

function abrirModalQuantidade(produto, indice = null) {
    itemEmEdicao = indice;
    _produtoModalQuantidade = produto;

    const modal = document.getElementById('modalQuantidade');
    const infoEl = document.getElementById('produtoInfoModal');
    const inputEl = document.getElementById('inputQuantidade');

    // Título e info
    document.getElementById('modalQuantidadeTitulo').textContent =
        indice !== null ? 'Editar Quantidade' : 'Informar Quantidade';

    const preco = parseFloat(produto.preco || produto.valor_unitario || 0);
    const estoque = parseFloat(produto.estoque) || 0;
    infoEl.textContent = `${produto.descricao} — R$ ${preco.toFixed(2)} | Estoque: ${estoque.toFixed(3)}`;

    // Valor inicial
    const qtdAtual = indice !== null ? pedidoAtual.itens[indice].quantidade : 1;
    inputEl.value = qtdAtual;

    modal.style.display = 'flex';
    setTimeout(() => {
        inputEl.focus();
        inputEl.select();
    }, 80);
}

function abrirEdicaoQuantidade(indice) {
    const item = pedidoAtual.itens[indice];
    const produtoRef = {
        id: item.id_produto,
        descricao: item.descricao,
        valor_unitario: item.valor_unitario,
        preco: item.valor_unitario,
        estoque: item.estoque,
        unidade: item.unidade
    };
    abrirModalQuantidade(produtoRef, indice);
}

function confirmarQuantidade() {
    const inputEl = document.getElementById('inputQuantidade');
    const novaQtd = parseFloat(inputEl.value);

    if (!novaQtd || novaQtd <= 0) {
        showMessage('Informe uma quantidade válida maior que zero.', 'warning');
        inputEl.focus();
        return;
    }

    const produto = _produtoModalQuantidade;
    if (!produto) {
        fecharModalQuantidade();
        return;
    }

    const estoque = parseFloat(produto.estoque) || 0;
    const permiteSemEstoque = paramAtivo('PDV_PERMITE_VENDA_SEM_ESTOQUE');

    if (!permiteSemEstoque && estoque > 0 && novaQtd > estoque) {
        showMessage(
            `Estoque insuficiente. Disponível: ${estoque.toFixed(3)}`,
            'error'
        );
        inputEl.focus();
        return;
    }

    if (itemEmEdicao !== null) {
        // Editar item existente
        const item = pedidoAtual.itens[itemEmEdicao];
        item.quantidade = novaQtd;
        item.valor_total = novaQtd * item.valor_unitario;
    } else {
        // Adicionar novo item
        const preco = parseFloat(produto.preco || produto.valor_unitario || 0);
        const itemExistente = pedidoAtual.itens.find(i => i.id_produto === produto.id);
        if (itemExistente) {
            itemExistente.quantidade = novaQtd;
            itemExistente.valor_total = novaQtd * itemExistente.valor_unitario;
        } else {
            pedidoAtual.itens.push({
                id_produto: produto.id,
                codigo: produto.codigo,
                ean: produto.ean,
                descricao: produto.descricao,
                descricao_complemento: produto.descricao_complemento,
                unidade: produto.unidade,
                quantidade: novaQtd,
                valor_unitario: preco,
                valor_total: novaQtd * preco,
                estoque: estoque
            });
        }
    }

    fecharModalQuantidade();
    renderizarItens();
    calcularTotais();
    setTimeout(() => document.getElementById('buscaProduto').focus(), 80);
}

function fecharModalQuantidade() {
    document.getElementById('modalQuantidade').style.display = 'none';
    itemEmEdicao = null;
    _produtoModalQuantidade = null;
}

function teclaModalQuantidade(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        confirmarQuantidade();
    } else if (event.key === 'Escape') {
        fecharModalQuantidade();
    }
}

// ================================================================
// REMOVER ITEM
// ================================================================
function removerItem(index) {
    pedidoAtual.itens.splice(index, 1);
    renderizarItens();
    calcularTotais();
}

// ================================================================
// PAGAMENTOS
// ================================================================
function onFormaChange() {
    const idForma = document.getElementById('formaPagamento').value;
    const forma = formasPagamento.find(f => f.id == idForma);
    const trocoGroup = document.getElementById('trocoGroup');

    if (forma && forma.permite_troco) {
        trocoGroup.style.display = 'flex';
    } else {
        trocoGroup.style.display = 'none';
        document.getElementById('valorTroco').value = '';
    }

    // Preencher valor faltante automaticamente
    const faltante = Math.max(0,
        pedidoAtual.valor_liquido -
        pedidoAtual.pagamentos.reduce((s, p) => s + p.valor, 0)
    );
    document.getElementById('valorPagamento').value = faltante > 0 ? faltante.toFixed(2) : '';

    calcularTroco();
}

function calcularTroco() {
    const idForma = document.getElementById('formaPagamento').value;
    const forma = formasPagamento.find(f => f.id == idForma);

    if (!forma || !forma.permite_troco) {
        document.getElementById('valorTroco').value = '';
        return;
    }

    const valorPago = parseFloat(document.getElementById('valorPagamento').value) || 0;
    const totalPagoAtual = pedidoAtual.pagamentos.reduce((s, p) => s + p.valor, 0);
    const faltante = pedidoAtual.valor_liquido - totalPagoAtual;
    const troco = Math.max(0, valorPago - faltante);
    document.getElementById('valorTroco').value = troco.toFixed(2);
}

function adicionarPagamento() {
    const idForma = document.getElementById('formaPagamento').value;
    const valor = parseFloat(document.getElementById('valorPagamento').value);

    if (!idForma) {
        showMessage('Selecione uma forma de pagamento.', 'warning');
        document.getElementById('formaPagamento').focus();
        return;
    }

    if (!valor || valor <= 0) {
        showMessage('Informe um valor válido.', 'warning');
        document.getElementById('valorPagamento').focus();
        return;
    }

    const forma = formasPagamento.find(f => f.id == idForma);
    if (!forma) {
        showMessage('Forma de pagamento inválida.', 'error');
        return;
    }

    const troco = forma.permite_troco
        ? (parseFloat(document.getElementById('valorTroco').value) || 0)
        : 0;

    pedidoAtual.pagamentos.push({
        id_forma_pagamento: parseInt(idForma),
        descricao: forma.descricao,
        valor: valor,
        troco: troco,
        permite_troco: forma.permite_troco
    });

    // Limpar formulário
    document.getElementById('formaPagamento').value = '';
    document.getElementById('valorPagamento').value = '';
    document.getElementById('valorTroco').value = '';
    document.getElementById('trocoGroup').style.display = 'none';

    renderizarPagamentos();
    atualizarStatusPagamento();

    document.getElementById('formaPagamento').focus();
}

function renderizarPagamentos() {
    const container = document.getElementById('pagamentosLista');

    if (pedidoAtual.pagamentos.length === 0) {
        container.innerHTML = '<div class="empty-pagamentos">Nenhum pagamento adicionado</div>';
        return;
    }

    container.innerHTML = pedidoAtual.pagamentos.map((pag, idx) => `
        <div class="pagamento-item">
            <div>
                <div class="pagamento-desc">${pag.descricao}</div>
                <div class="pagamento-valor">R$ ${pag.valor.toFixed(2)}</div>
                ${pag.troco > 0 ? `<div class="pagamento-troco">Troco: R$ ${pag.troco.toFixed(2)}</div>` : ''}
            </div>
            <button class="btn-remover-pag" onclick="removerPagamento(${idx})" title="Remover">🗑️</button>
        </div>
    `).join('');
}

function removerPagamento(index) {
    pedidoAtual.pagamentos.splice(index, 1);
    renderizarPagamentos();
    atualizarStatusPagamento();
}

function atualizarStatusPagamento() {
    const totalPago = pedidoAtual.pagamentos.reduce((s, p) => s + p.valor, 0);
    const faltante = pedidoAtual.valor_liquido - totalPago;

    document.getElementById('totalPago').textContent = `R$ ${totalPago.toFixed(2)}`;
    document.getElementById('valorFaltante').textContent = `R$ ${Math.max(0, faltante).toFixed(2)}`;
    document.getElementById('pagTotalPedido').textContent = `R$ ${pedidoAtual.valor_liquido.toFixed(2)}`;
    document.getElementById('pagItensQtd').textContent = pedidoAtual.itens.length;

    const btnFinalizar = document.getElementById('btnFinalizar');
    const pago = faltante <= 0.01 && pedidoAtual.itens.length > 0;
    btnFinalizar.disabled = !pago;
}

// ================================================================
// FINALIZAR PEDIDO
// ================================================================
async function finalizarPedido() {
    // Validações finais
    if (!pedidoAtual.cliente || pedidoAtual.cliente.id === undefined) {
        showMessage('Nenhum cliente selecionado.', 'error');
        return;
    }

    if (pedidoAtual.itens.length === 0) {
        showMessage('Nenhum item no pedido.', 'error');
        return;
    }

    if (pedidoAtual.pagamentos.length === 0) {
        showMessage('Adicione pelo menos uma forma de pagamento.', 'error');
        return;
    }

    const totalPago = pedidoAtual.pagamentos.reduce((s, p) => s + p.valor, 0);
    if (Math.abs(totalPago - pedidoAtual.valor_liquido) > 0.01) {
        showMessage('O total dos pagamentos não confere com o valor do pedido.', 'error');
        return;
    }

    // Verificar estoque dos itens (front-end)
    const permiteSemEstoque = paramAtivo('PDV_PERMITE_VENDA_SEM_ESTOQUE');
    if (!permiteSemEstoque) {
        for (const item of pedidoAtual.itens) {
            if (item.quantidade > item.estoque) {
                showMessage(
                    `Estoque insuficiente: "${item.descricao}". ` +
                    `Disponível: ${item.estoque.toFixed(3)} — Solicitado: ${item.quantidade.toFixed(3)}`,
                    'error'
                );
                return;
            }
        }
    }

    // Coletar observações
    pedidoAtual.observacoes = document.getElementById('observacoes').value;

    // Desabilitar botão
    const btnFinalizar = document.getElementById('btnFinalizar');
    btnFinalizar.disabled = true;
    btnFinalizar.textContent = 'Finalizando...';

    try {
        const response = await fetch(`${API_URL}/pdv/pedidos/finalizar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('sirius_token')}`,
                'X-Empresa-Id': empresaId,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pedidoAtual)
        });

        const data = await response.json();

        if (data.success) {
            mostrarRelatorioPedido(data.data);
        } else {
            throw new Error(data.message || 'Erro ao finalizar pedido');
        }
    } catch (e) {
        console.error('Erro ao finalizar pedido:', e);
        showMessage(e.message || 'Erro ao finalizar pedido', 'error');
        btnFinalizar.disabled = false;
        btnFinalizar.textContent = '✅ Finalizar Pedido';
    }
}

// ================================================================
// RELATÓRIO DO PEDIDO (Impressão)
// ================================================================
function mostrarRelatorioPedido(pedidoFinalizado) {
    // Capturar dados antes de resetar o pedido
    const dados = {
        numero: pedidoFinalizado.numero || pedidoAtual.numero,
        cliente: pedidoAtual.cliente,
        itens: [...pedidoAtual.itens],
        pagamentos: [...pedidoAtual.pagamentos],
        valor_bruto: pedidoAtual.valor_bruto,
        desconto: pedidoAtual.desconto,
        acrescimo: pedidoAtual.acrescimo,
        valor_liquido: pedidoAtual.valor_liquido,
        observacoes: pedidoAtual.observacoes
    };

    // Número e data
    document.getElementById('relatorioNumero').textContent = dados.numero || '-';
    document.getElementById('relatorioData').textContent = new Date().toLocaleString('pt-BR');

    // Cliente
    const nomeCliente = dados.cliente ? dados.cliente.razao_social : 'Consumidor Final';
    const docCliente = dados.cliente && dados.cliente.documento ? ` (${dados.cliente.documento})` : '';
    document.getElementById('relatorioCliente').textContent = nomeCliente + docCliente;

    // Itens
    document.getElementById('relatorioItens').innerHTML = dados.itens.map(item => `
        <tr>
            <td>${item.descricao}</td>
            <td style="text-align:center">${parseFloat(item.quantidade).toFixed(3)}</td>
            <td style="text-align:right">R$ ${parseFloat(item.valor_unitario).toFixed(2)}</td>
            <td style="text-align:right"><strong>R$ ${parseFloat(item.valor_total).toFixed(2)}</strong></td>
        </tr>
    `).join('');

    // Totais
    document.getElementById('relatorioSubtotal').textContent = `R$ ${parseFloat(dados.valor_bruto).toFixed(2)}`;
    document.getElementById('relatorioDesconto').textContent = `R$ ${parseFloat(dados.desconto).toFixed(2)}`;
    document.getElementById('relatorioAcrescimo').textContent = `R$ ${parseFloat(dados.acrescimo).toFixed(2)}`;
    document.getElementById('relatorioTotal').textContent = `R$ ${parseFloat(dados.valor_liquido).toFixed(2)}`;

    document.getElementById('relatorioLinhaDesconto').style.display =
        dados.desconto > 0 ? 'flex' : 'none';
    document.getElementById('relatorioLinhaAcrescimo').style.display =
        dados.acrescimo > 0 ? 'flex' : 'none';

    // Pagamentos
    document.getElementById('relatorioPagamentos').innerHTML = dados.pagamentos.map(pag => `
        <tr>
            <td>${pag.descricao}</td>
            <td style="text-align:right">R$ ${parseFloat(pag.valor).toFixed(2)}</td>
            <td style="text-align:right">${pag.troco > 0 ? `R$ ${parseFloat(pag.troco).toFixed(2)}` : '-'}</td>
        </tr>
    `).join('');

    // Observações
    const obsWrapper = document.getElementById('relatorioObsWrapper');
    if (dados.observacoes && dados.observacoes.trim()) {
        document.getElementById('relatorioObservacoes').textContent = dados.observacoes;
        obsWrapper.style.display = 'block';
    } else {
        obsWrapper.style.display = 'none';
    }

    // Mostrar modal
    document.getElementById('modalRelatorioPedido').style.display = 'flex';

    // Imprimir automaticamente
    setTimeout(() => {
        window.print();
    }, 400);
}

function imprimirRelatorioPedido() {
    window.print();
}

function fecharRelatorioPedido() {
    document.getElementById('modalRelatorioPedido').style.display = 'none';
    // Voltar à tela inicial
    mostrarTelaInicial();
}

// ================================================================
// MENSAGENS MODAIS
// ================================================================
function showMessage(mensagem, tipo = 'info', callback = null) {
    const modal = document.getElementById('modalMensagem');
    const titulo = document.getElementById('mensagemTitulo');

    const config = {
        success: { texto: '✅ Sucesso', cor: '#10b981' },
        error:   { texto: '❌ Erro',    cor: '#ef4444' },
        warning: { texto: '⚠️ Atenção', cor: '#f59e0b' },
        info:    { texto: 'ℹ️ Informação', cor: '#2563eb' }
    };

    const c = config[tipo] || config.info;
    titulo.textContent = c.texto;
    titulo.style.color = c.cor;

    document.getElementById('mensagemTexto').textContent = mensagem;
    modal.style.display = 'flex';

    if (callback) {
        modal.dataset.hasCallback = '1';
        window._msgCallback = callback;
    } else {
        delete modal.dataset.hasCallback;
        window._msgCallback = null;
    }

    setTimeout(() => document.getElementById('btnMensagemOK').focus(), 80);
}

function fecharModalMensagem() {
    const modal = document.getElementById('modalMensagem');
    modal.style.display = 'none';

    if (modal.dataset.hasCallback && window._msgCallback) {
        const cb = window._msgCallback;
        window._msgCallback = null;
        delete modal.dataset.hasCallback;
        cb();
    }
}

// ================================================================
// EVENTOS GLOBAIS (teclado + mouse)
// ================================================================
function configurarEventosGlobais() {

    // ----- Busca de Cliente -----
    const inputCliente = document.getElementById('inputBuscaCliente');

    // Ao digitar: apenas controla o botão limpar (sem busca automática)
    inputCliente.addEventListener('input', (e) => {
        const temTexto = e.target.value.trim().length > 0;
        document.getElementById('btnLimparBuscaCliente').style.display = temTexto ? 'block' : 'none';
        // Limpa resultados se o campo foi esvaziado
        if (!temTexto) {
            document.getElementById('resultadosBuscaCliente').innerHTML = '';
        }
    });

    // Enter: disparar busca ou confirmar cliente
    inputCliente.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const termo = inputCliente.value.trim();

            if (!termo) {
                // Campo vazio → confirmar Consumidor Final direto
                confirmarCliente();
                return;
            }

            // Verificar se já há resultados listados
            const resultados = document.querySelectorAll('#resultadosBuscaCliente .resultado-item');
            if (resultados.length === 1) {
                // Um único resultado → selecionar direto
                resultados[0].click();
            } else if (resultados.length > 1) {
                // Vários resultados já listados → ir ao primeiro
                resultados[0].focus();
            } else {
                // Sem resultados ainda → executar a busca
                buscarClientes(termo);
            }

        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const primeiro = document.querySelector('#resultadosBuscaCliente .resultado-item');
            if (primeiro) primeiro.focus();

        } else if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('btnConfirmarCliente').focus();

        } else if (e.key === 'Escape') {
            inputCliente.value = '';
            document.getElementById('resultadosBuscaCliente').innerHTML = '';
            document.getElementById('btnLimparBuscaCliente').style.display = 'none';
        }
    });

    // Botão confirmar cliente com Enter
    document.getElementById('btnConfirmarCliente').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmarCliente();
        }
    });

    // ----- Busca de Produto -----
    const inputProduto = document.getElementById('buscaProduto');
    let timeoutProduto;

    inputProduto.addEventListener('input', (e) => {
        clearTimeout(timeoutProduto);
        const termo = e.target.value.trim();

        if (termo.length < 2) {
            document.getElementById('resultadosBusca').innerHTML = '';
            return;
        }

        timeoutProduto = setTimeout(() => buscarProdutos(termo), 300);
    });

    inputProduto.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const primeiro = document.querySelector('#resultadosBusca .resultado-item');
            if (primeiro) primeiro.focus();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const resultados = document.querySelectorAll('#resultadosBusca .resultado-item');
            if (resultados.length === 1) resultados[0].click();
        } else if (e.key === 'F5') {
            e.preventDefault();
            confirmarProdutos();
        }
    });

    // Botão finalizar produtos com F5 ou Enter
    document.getElementById('btnFinalizarProdutos').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmarProdutos();
        }
    });

    // ----- Pagamentos: Enter na forma de pagamento -----
    document.getElementById('formaPagamento').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('valorPagamento').focus();
        }
    });

    document.getElementById('valorPagamento').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            adicionarPagamento();
        }
    });

    // ----- ESC global: fechar modais ou cancelar -----
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Fechar qualquer modal aberto
            const modaisAbertos = document.querySelectorAll('.modal-overlay[style*="flex"]');
            if (modaisAbertos.length > 0) {
                const ultimo = modaisAbertos[modaisAbertos.length - 1];
                if (ultimo.id === 'modalMensagem') fecharModalMensagem();
                else if (ultimo.id === 'modalQuantidade') fecharModalQuantidade();
                else if (ultimo.id === 'modalConfirmacao') fecharModalConfirmacao();
                // Relatório não fecha com ESC (tem que confirmar)
            } else if (document.getElementById('tela-pdv').style.display !== 'none') {
                cancelarVendaConfirmar();
            }
        }

        // F5 na aba de produtos → finalizar produtos
        if (e.key === 'F5' && abatual === 'produtos') {
            e.preventDefault();
            confirmarProdutos();
        }
    });

    // ----- Fechar modal ao clicar no overlay -----
    ['modalQuantidade', 'modalMensagem', 'modalConfirmacao'].forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('click', (e) => {
            if (e.target === el) {
                if (id === 'modalMensagem') fecharModalMensagem();
                else if (id === 'modalQuantidade') fecharModalQuantidade();
                else if (id === 'modalConfirmacao') fecharModalConfirmacao();
            }
        });
    });

    // ----- Tela inicial: Enter abre novo pedido -----
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const telaInicial = document.getElementById('tela-inicial');
            if (telaInicial.style.display !== 'none' && !telaInicial.style.display) {
                // Tela inicial visível
                const focoAtual = document.activeElement;
                if (focoAtual && focoAtual.id === 'btn-voltar') return; // não fazer nada
                iniciarNovoPedido();
            }
        }
    });
}

// ================================================================
// FUNÇÃO GLOBAL: logout (compatibilidade)
// ================================================================
function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}
