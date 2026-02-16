// =====================================================
// SIRIUS WEB - PDV - JavaScript
// =====================================================

// ===== CONFIGURAÇÕES GLOBAIS =====
const isDev = window.location.hostname === 'localhost' 
           || window.location.hostname === '127.0.0.1'
           || window.location.hostname === ''
           || window.location.protocol === 'file:';

const API_URL = isDev ? 'http://localhost:3000' : 'https://sirius-web-api-adonis.vercel.app';

console.log('📍 Ambiente:', isDev ? 'DESENVOLVIMENTO' : 'PRODUÇÃO');
console.log('📡 API URL:', API_URL);

// ===== ESTADO DA APLICAÇÃO =====
let pedidoAtual = {
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

let formasPagamento = [];
let itemEmEdicao = null;
let empresaId = null;

// =====================================================
// ✅ PARÂMETROS GLOBAIS (CARREGADOS UMA VEZ)
// Performance: ZERO consultas ao banco durante uso!
// =====================================================
let PARAMETROS = {};

function carregarParametros() {
    try {
        const parametrosStr = localStorage.getItem('sirius_parametros');
        if (parametrosStr) {
            PARAMETROS = JSON.parse(parametrosStr);
            console.log('✅ Parâmetros carregados:', PARAMETROS);
            console.log(`📊 Total de parâmetros: ${Object.keys(PARAMETROS).length}`);
        } else {
            console.warn('⚠️ Nenhum parâmetro encontrado no localStorage');
            PARAMETROS = {};
        }
    } catch (error) {
        console.error('❌ Erro ao carregar parâmetros:', error);
        PARAMETROS = {};
    }
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 PDV carregado');
    
    // ✅ CARREGAR PARÂMETROS PRIMEIRO (ANTES DE TUDO!)
    carregarParametros();
    
    const token = checkAuth();
    if (!token) return;
    
    // Carregar dados do usuário e empresa
    const usuario = JSON.parse(localStorage.getItem('sirius_usuario'));
    const empresas = JSON.parse(localStorage.getItem('sirius_empresas') || '[]');
    
    if (empresas.length > 0) {
        empresaId = empresas[0].id;
        console.log('✅ Empresa ID:', empresaId);
    } else {
        showMessage('Nenhuma empresa encontrada. Faça login novamente.', 'error');
        return;
    }
    
    // ✅ CORREÇÃO: NÃO tenta mais atualizar userName (não existe no HTML)
    // A linha abaixo foi REMOVIDA pois causava erro:
    // document.getElementById('userName').textContent = usuario.nome;
    
    // Inicializar pedido
    await inicializarPedido();
    
    // Configurar eventos
    configurarEventos();
});

// ===== AUTENTICAÇÃO =====
function checkAuth() {
    const token = localStorage.getItem('sirius_token');
    if (!token) {
        window.location.href = 'index.html';
        return null;
    }
    return token;
}

function logout() {
    localStorage.removeItem('sirius_token');
    localStorage.removeItem('sirius_usuario');
    localStorage.removeItem('sirius_empresas');
    localStorage.removeItem('sirius_parametros'); // ✅ Limpar parâmetros também
    window.location.href = 'index.html';
}

// ===== INICIALIZAÇÃO DO PEDIDO =====
async function inicializarPedido() {
    try {
        // Obter próximo número
        const numeroResp = await fetch(`${API_URL}/pdv/proximo-numero`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('sirius_token')}`,
                'X-Empresa-Id': empresaId
            }
        });
        const numeroData = await numeroResp.json();
        
        if (numeroData.success) {
            pedidoAtual.numero = numeroData.data.numero;
            document.getElementById('numeroPedido').textContent = numeroData.data.numero;
        } else {
            console.error('Erro ao obter número:', numeroData);
            showMessage(numeroData.message || 'Erro ao obter número do pedido', 'error');
        }
        
        // Obter cliente padrão
        const clienteResp = await fetch(`${API_URL}/pdv/cliente-padrao`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('sirius_token')}`,
                'X-Empresa-Id': empresaId
            }
        });
        const clienteData = await clienteResp.json();
        
        if (clienteData.success) {
            pedidoAtual.cliente = clienteData.data;
            renderizarCliente();
        } else {
            console.error('Erro ao obter cliente:', clienteData);
            document.getElementById('clienteInfo').innerHTML = `
                <div style="color: #ef4444; padding: 12px; background: #fee; border-radius: 6px;">
                    ⚠️ ${clienteData.message || 'Erro ao carregar cliente padrão'}<br>
                    <small>Clique no ícone 🔍 para selecionar um cliente</small>
                </div>
            `;
        }
        
        // Carregar formas de pagamento
        await carregarFormasPagamento();
        
        // Atualizar data
        const now = new Date();
        document.getElementById('dataPedido').textContent = 
            now.toLocaleDateString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        
    } catch (error) {
        console.error('Erro ao inicializar pedido:', error);
        showMessage('Erro ao inicializar pedido', 'error');
    }
}

// ===== CONFIGURAR EVENTOS =====
function configurarEventos() {
    // Busca de produto
    const inputBusca = document.getElementById('buscaProduto');
    let timeoutBusca;
    
    inputBusca.addEventListener('input', (e) => {
        clearTimeout(timeoutBusca);
        const termo = e.target.value.trim();
        
        if (termo.length < 2) {
            document.getElementById('resultadosBusca').innerHTML = '';
            return;
        }
        
        timeoutBusca = setTimeout(() => {
            buscarProdutos(termo);
        }, 300);
    });
    
    // Enter no input de busca
    inputBusca.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const resultados = document.querySelectorAll('.resultado-item');
            if (resultados.length === 1) {
                resultados[0].click();
            }
        }
    });
    
    // Busca de cliente no modal
    const inputBuscaCliente = document.getElementById('inputBuscaCliente');
    let timeoutBuscaCliente;
    
    inputBuscaCliente.addEventListener('input', (e) => {
        clearTimeout(timeoutBuscaCliente);
        const termo = e.target.value.trim();
        
        if (termo.length < 2) {
            document.getElementById('resultadosBuscaCliente').innerHTML = '';
            return;
        }
        
        timeoutBuscaCliente = setTimeout(() => {
            buscarClientes(termo);
        }, 300);
    });
    
    // Fechar modais ao clicar fora
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
    
    // Monitorar mudança de forma de pagamento
    document.getElementById('formaPagamento').addEventListener('change', (e) => {
        const formaSelecionada = formasPagamento.find(f => f.id_forma_pagamento == e.target.value);
        if (formaSelecionada && formaSelecionada.permite_troco) {
            document.getElementById('trocoGroup').style.display = 'block';
        } else {
            document.getElementById('trocoGroup').style.display = 'none';
        }
    });
    
    // Calcular troco automaticamente
    document.getElementById('valorPagamento').addEventListener('input', calcularTroco);
}

// ===== BUSCAR PRODUTOS =====
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
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
    }
}

function renderizarResultadosProdutos(produtos) {
    const container = document.getElementById('resultadosBusca');
    
    if (produtos.length === 0) {
        container.innerHTML = '<div class="empty-message">Nenhum produto encontrado</div>';
        return;
    }
    
    container.innerHTML = produtos.map(p => `
        <div class="resultado-item" onclick='adicionarProdutoAoPedido(${JSON.stringify(p).replace(/'/g, "&#39;")})'>
            <div class="resultado-nome">${p.descricao}</div>
            <div class="resultado-info">
                ${p.codigo ? `<span>Cód: ${p.codigo}</span>` : ''}
                ${p.ean ? `<span>EAN: ${p.ean}</span>` : ''}
                <span>Estoque: ${parseFloat(p.estoque).toFixed(3)}</span>
                <span class="resultado-preco">R$ ${parseFloat(p.preco).toFixed(2)}</span>
            </div>
        </div>
    `).join('');
}

// =====================================================
// ✅ ADICIONAR PRODUTO COM PARÂMETRO 1
// PEDIDO_PERGUNTA_QUANTIDADE
// =====================================================
async function adicionarProdutoAoPedido(produto) {
    console.log('🛒 Adicionando produto:', produto.descricao);
    
    // ✅ LER PARÂMETRO 1 (da memória, ZERO consultas!)
    const perguntaQtd = PARAMETROS.PEDIDO_PERGUNTA_QUANTIDADE || 'N';
    console.log(`📊 PEDIDO_PERGUNTA_QUANTIDADE = ${perguntaQtd}`);
    
    if (perguntaQtd === 'S') {
        // ✅ PARÂMETRO = S: Abrir modal perguntando quantidade
        console.log('💬 Abrindo modal de quantidade...');
        await abrirModalQuantidade(produto);
    } else {
        // ✅ PARÂMETRO = N: Adicionar direto com quantidade 1
        console.log('➕ Adicionando direto com quantidade 1');
        adicionarItemComQuantidade(produto, 1);
    }
}

// =====================================================
// ✅ ADICIONAR ITEM COM QUANTIDADE ESPECÍFICA
// =====================================================
function adicionarItemComQuantidade(produto, quantidade) {
    // Verificar se já existe
    const itemExistente = pedidoAtual.itens.find(i => i.id_produto === produto.id);
    
    if (itemExistente) {
        // Incrementar quantidade
        itemExistente.quantidade += quantidade;
        itemExistente.valor_total = itemExistente.quantidade * itemExistente.valor_unitario;
    } else {
        // Adicionar novo item
        pedidoAtual.itens.push({
            id_produto: produto.id,
            codigo: produto.codigo,
            ean: produto.ean,
            descricao: produto.descricao,
            descricao_complemento: produto.descricao_complemento,
            unidade: produto.unidade,
            quantidade: quantidade,
            valor_unitario: parseFloat(produto.preco),
            valor_total: quantidade * parseFloat(produto.preco),
            estoque: parseFloat(produto.estoque)
        });
    }
    
    // Limpar busca
    document.getElementById('buscaProduto').value = '';
    document.getElementById('resultadosBusca').innerHTML = '';
    
    // Atualizar interface
    renderizarItens();
    calcularTotais();
    
    // Focar novamente no input de busca
    setTimeout(() => {
        document.getElementById('buscaProduto').focus();
    }, 100);
    
    console.log(`✅ Produto adicionado: ${produto.descricao} - Qtd: ${quantidade}`);
}

// =====================================================
// ✅ MODAL DE QUANTIDADE (PARÂMETRO 1)
// VERSÃO DEFINITIVA: Remoção direta garantida
// =====================================================
async function abrirModalQuantidade(produto) {
    return new Promise((resolve) => {
        // Criar estrutura do modal
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'modalQuantidade';
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modalOverlay.innerHTML = `
            <div class="modal-content" style="
                max-width: 400px;
                background: white;
                border-radius: 12px;
                padding: 0;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            ">
                <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
                    <h3 style="margin: 0; font-size: 20px;">📦 Quantidade</h3>
                </div>
                <div style="padding: 20px;">
                    <p style="margin-bottom: 16px; font-weight: 600;">
                        ${produto.descricao}
                    </p>
                    <p style="color: #6b7280; margin-bottom: 16px; font-size: 14px;">
                        Estoque disponível: <strong>${parseFloat(produto.estoque).toFixed(3)}</strong>
                    </p>
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
                        Quantidade:
                    </label>
                    <input 
                        type="number" 
                        id="inputQuantidadeModal" 
                        value="1" 
                        min="0.001"
                        step="0.001"
                        style="
                            width: 100%;
                            padding: 12px;
                            border: 2px solid #2563eb;
                            border-radius: 8px;
                            font-size: 18px;
                            text-align: center;
                            font-family: inherit;
                        "
                    >
                </div>
                <div style="
                    padding: 20px;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                ">
                    <button id="btnCancelarModal" style="
                        padding: 10px 20px;
                        background: #6b7280;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                    ">
                        Cancelar
                    </button>
                    <button id="btnConfirmarModal" style="
                        padding: 10px 20px;
                        background: #2563eb;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                    ">
                        ✅ Confirmar
                    </button>
                </div>
            </div>
        `;
        
        // Adicionar ao body
        document.body.appendChild(modalOverlay);
        
        // ✅ FUNÇÃO PARA FECHAR MODAL - REMOÇÃO DIRETA!
        const fecharModalDefinitivo = (confirmado) => {
            const input = document.getElementById('inputQuantidadeModal');
            const qtd = input ? parseFloat(input.value) : 1;
            
            console.log('🔒 Fechando modal...');
            
            // ✅ REMOÇÃO DIRETA usando a referência que criamos!
            try {
                document.body.removeChild(modalOverlay);
                console.log('✅ Modal removido com sucesso!');
            } catch (e) {
                console.error('❌ Erro ao remover modal:', e);
                // Tenta forçar display none
                modalOverlay.style.display = 'none';
            }
            
            // Adicionar item se confirmado
            if (confirmado) {
                if (isNaN(qtd) || qtd <= 0) {
                    showMessage('Quantidade inválida!', 'error');
                    resolve(null);
                    return;
                }
                
                console.log(`✅ Confirmado com quantidade: ${qtd}`);
                adicionarItemComQuantidade(produto, qtd);
                resolve(qtd);
            } else {
                console.log('❌ Cancelado');
                resolve(null);
            }
        };
        
        // Event listeners
        setTimeout(() => {
            const input = document.getElementById('inputQuantidadeModal');
            const btnConfirmar = document.getElementById('btnConfirmarModal');
            const btnCancelar = document.getElementById('btnCancelarModal');
            
            if (input) {
                input.focus();
                input.select();
                
                // Enter para confirmar
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        fecharModalDefinitivo(true);
                    }
                });
            }
            
            if (btnConfirmar) {
                btnConfirmar.addEventListener('click', (e) => {
                    e.preventDefault();
                    fecharModalDefinitivo(true);
                });
            }
            
            if (btnCancelar) {
                btnCancelar.addEventListener('click', (e) => {
                    e.preventDefault();
                    fecharModalDefinitivo(false);
                });
            }
            
            // Fechar ao clicar fora
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    fecharModalDefinitivo(false);
                }
            });
        }, 100);
    });
}

// ===== RENDERIZAR ITENS =====
function renderizarItens() {
    const tbody = document.getElementById('itensTabela');
    
    if (pedidoAtual.itens.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-state">
                <td colspan="6">
                    <div class="empty-message">Nenhum item adicionado</div>
                </td>
            </tr>
        `;
        document.getElementById('quantidadeItens').textContent = '0 itens';
        return;
    }
    
    tbody.innerHTML = pedidoAtual.itens.map((item, index) => `
        <tr>
            <td class="item-seq">${index + 1}</td>
            <td>
                <div class="item-nome">${item.descricao}</div>
                ${item.codigo ? `<div class="item-codigo">Cód: ${item.codigo}</div>` : ''}
            </td>
            <td class="item-qtd">${item.quantidade.toFixed(3)}</td>
            <td class="item-valor">R$ ${item.valor_unitario.toFixed(2)}</td>
            <td class="item-valor">R$ ${item.valor_total.toFixed(2)}</td>
            <td class="item-acoes">
                <button class="btn-action" onclick="editarQuantidade(${index})" title="Editar Quantidade">✏️</button>
                <button class="btn-action" onclick="removerItem(${index})" title="Remover">🗑️</button>
            </td>
        </tr>
    `).join('');
    
    document.getElementById('quantidadeItens').textContent = `${pedidoAtual.itens.length} ${pedidoAtual.itens.length === 1 ? 'item' : 'itens'}`;
}

// ===== EDITAR QUANTIDADE =====
function editarQuantidade(index) {
    const item = pedidoAtual.itens[index];
    itemEmEdicao = index;
    
    document.getElementById('nomeProdutoModal').textContent = item.descricao;
    document.getElementById('estoqueProdutoModal').textContent = `Estoque disponível: ${item.estoque.toFixed(3)} ${item.unidade}`;
    document.getElementById('novaQuantidade').value = item.quantidade;
    
    document.getElementById('modalQuantidade').classList.add('show');
    document.getElementById('novaQuantidade').focus();
    document.getElementById('novaQuantidade').select();
}

function confirmarQuantidade() {
    const novaQtd = parseFloat(document.getElementById('novaQuantidade').value);
    
    if (!novaQtd || novaQtd <= 0) {
        showMessage('Quantidade inválida', 'error');
        return;
    }
    
    const item = pedidoAtual.itens[itemEmEdicao];
    
    if (novaQtd > item.estoque) {
        showMessage(`Estoque insuficiente. Disponível: ${item.estoque.toFixed(3)}`, 'error');
        return;
    }
    
    item.quantidade = novaQtd;
    item.valor_total = item.quantidade * item.valor_unitario;
    
    renderizarItens();
    calcularTotais();
    fecharModalQuantidade();
}

function fecharModalQuantidade() {
    document.getElementById('modalQuantidade').classList.remove('show');
    itemEmEdicao = null;
}

// ===== REMOVER ITEM =====
function removerItem(index) {
    pedidoAtual.itens.splice(index, 1);
    renderizarItens();
    calcularTotais();
}

// ===== CALCULAR TOTAIS =====
function calcularTotais() {
    pedidoAtual.valor_bruto = pedidoAtual.itens.reduce((sum, item) => sum + item.valor_total, 0);
    pedidoAtual.valor_liquido = pedidoAtual.valor_bruto - pedidoAtual.desconto + pedidoAtual.acrescimo;
    
    document.getElementById('subtotal').textContent = `R$ ${pedidoAtual.valor_bruto.toFixed(2)}`;
    document.getElementById('desconto').textContent = `R$ ${pedidoAtual.desconto.toFixed(2)}`;
    document.getElementById('acrescimo').textContent = `R$ ${pedidoAtual.acrescimo.toFixed(2)}`;
    document.getElementById('totalGeral').textContent = `R$ ${pedidoAtual.valor_liquido.toFixed(2)}`;
    
    atualizarStatusPagamento();
}

// ===== BUSCAR CLIENTES =====
async function buscarClientes(termo) {
    try {
        if (!termo || termo.trim().length < 2) {
            document.getElementById('resultadosBuscaCliente').innerHTML = 
                '<div class="empty-message">Digite pelo menos 2 caracteres para buscar</div>';
            return;
        }
        
        const response = await fetch(
            `${API_URL}/pdv/clientes/buscar?termo=${encodeURIComponent(termo)}`,
            {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('sirius_token')}`,
                    'X-Empresa-Id': empresaId
                }
            }
        );
        
        const data = await response.json();
        
        if (data.success) {
            renderizarResultadosClientes(data.data);
        } else {
            console.error('Erro ao buscar clientes:', data);
            document.getElementById('resultadosBuscaCliente').innerHTML = 
                '<div class="empty-message">Erro ao buscar clientes</div>';
        }
    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        document.getElementById('resultadosBuscaCliente').innerHTML = 
            '<div class="empty-message">Erro ao buscar clientes</div>';
    }
}

function renderizarResultadosClientes(clientes) {
    const container = document.getElementById('resultadosBuscaCliente');
    
    if (clientes.length === 0) {
        container.innerHTML = '<div class="empty-message">Nenhum cliente encontrado</div>';
        return;
    }
    
    container.innerHTML = clientes.map(c => `
        <div class="resultado-item" onclick="selecionarCliente(${JSON.stringify(c).replace(/"/g, '&quot;')})">
            <div class="resultado-nome">${c.razao_social}</div>
            <div class="resultado-info">
                ${c.nome_fantasia ? `<span>${c.nome_fantasia}</span>` : ''}
                ${c.documento ? `<span>${c.documento}</span>` : ''}
            </div>
        </div>
    `).join('');
}

function selecionarCliente(cliente) {
    pedidoAtual.cliente = cliente;
    renderizarCliente();
    fecharModalCliente();
}

function renderizarCliente() {
    const container = document.getElementById('clienteInfo');
    
    if (!pedidoAtual.cliente) {
        container.innerHTML = '<div class="loading">Nenhum cliente selecionado</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="cliente-nome">${pedidoAtual.cliente.razao_social}</div>
        ${pedidoAtual.cliente.documento ? `<div class="cliente-doc">${pedidoAtual.cliente.documento}</div>` : ''}
    `;
}

// ===== MODALS =====
function abrirBuscaCliente() {
    document.getElementById('inputBuscaCliente').value = '';
    document.getElementById('resultadosBuscaCliente').innerHTML = '';
    document.getElementById('modalBuscaCliente').classList.add('show');
    setTimeout(() => {
        document.getElementById('inputBuscaCliente').focus();
    }, 100);
}

function fecharModalCliente() {
    document.getElementById('modalBuscaCliente').classList.remove('show');
}

// ===== FORMAS DE PAGAMENTO =====
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
            
            console.log('✅ Formas de pagamento carregadas:', formasPagamento.length);
            console.log('Primeira forma:', formasPagamento[0]);
            
            const select = document.getElementById('formaPagamento');
            select.innerHTML = '<option value="">Selecione...</option>' + 
                formasPagamento.map(f => 
                    `<option value="${f.id_forma_pagamento}">${f.descricao}</option>`
                ).join('');
        } else {
            console.error('Erro ao carregar formas de pagamento:', data);
        }
    } catch (error) {
        console.error('Erro ao carregar formas de pagamento:', error);
    }
}

// ===== PAGAMENTOS =====
function abrirModalPagamento() {
    if (pedidoAtual.itens.length === 0) {
        showMessage('Adicione itens ao pedido antes de adicionar pagamentos', 'error');
        return;
    }
    
    // ✅ VERIFICAR SE SELECT TEM OPTIONS
    const select = document.getElementById('formaPagamento');
    if (select && select.options.length <= 1) {
        console.warn('⚠️ Select vazio! Recarregando formas de pagamento...');
        carregarFormasPagamento();
    }
    
    const valorRestante = pedidoAtual.valor_liquido - 
        pedidoAtual.pagamentos.reduce((sum, p) => sum + p.valor, 0);
    
    document.getElementById('valorPagamento').value = valorRestante.toFixed(2);
    document.getElementById('valorTroco').value = '';
    document.getElementById('formaPagamento').value = '';
    document.getElementById('trocoGroup').style.display = 'none';
    
    const modal = document.getElementById('modalPagamento');
    modal.classList.add('show');
    
    console.log('✅ Modal de pagamento aberto');
}

function fecharModalPagamento() {
    const modal = document.getElementById('modalPagamento');
    
    if (!modal) {
        console.error('❌ Modal de pagamento não encontrado!');
        return;
    }
    
    console.log('🔒 Fechando modal de pagamento...');
    
    // Método 1: classList.remove
    try {
        modal.classList.remove('show');
        console.log('✅ Modal de pagamento fechado (classList.remove)');
    } catch (e) {
        console.error('❌ Erro ao remover classe show:', e);
        // Método 2: forçar display none
        try {
            modal.style.display = 'none';
            console.log('✅ Modal de pagamento fechado (display none)');
        } catch (e2) {
            console.error('❌ Erro ao esconder modal:', e2);
        }
    }
    
    // Limpar campos
    document.getElementById('formaPagamento').value = '';
    document.getElementById('valorPagamento').value = '';
    document.getElementById('valorTroco').value = '';
    document.getElementById('trocoGroup').style.display = 'none';
}

function calcularTroco() {
    const formaSelecionada = formasPagamento.find(f => f.id_forma_pagamento == document.getElementById('formaPagamento').value);
    
    if (!formaSelecionada || !formaSelecionada.permite_troco) {
        return;
    }
    
    const valorRestante = pedidoAtual.valor_liquido - 
        pedidoAtual.pagamentos.reduce((sum, p) => sum + p.valor, 0);
    
    const valorPago = parseFloat(document.getElementById('valorPagamento').value) || 0;
    const troco = valorPago - valorRestante;
    
    document.getElementById('valorTroco').value = troco > 0 ? troco.toFixed(2) : '0.00';
}

function adicionarPagamento() {
    const select = document.getElementById('formaPagamento');
    const idForma = select ? select.value : undefined;
    const valorStr = document.getElementById('valorPagamento').value;
    
    console.log('🔍 Adicionando pagamento...');
    console.log('Select encontrado:', !!select);
    console.log('Quantidade de options:', select ? select.options.length : 0);
    console.log('ID Forma selecionada:', idForma);
    console.log('Formas disponíveis no array:', formasPagamento.length);
    
    if (!select || select.options.length <= 1) {
        showMessage('Erro: Formas de pagamento não carregadas. Aguarde ou recarregue a página.', 'error');
        console.error('❌ Select vazio ou não encontrado!');
        return;
    }
    
    if (!idForma || idForma === '') {
        showMessage('Selecione uma forma de pagamento', 'error');
        return;
    }
    
    const valor = parseFloat(valorStr);
    if (!valor || valor <= 0) {
        showMessage('Valor inválido', 'error');
        return;
    }
    
    // ✅ CORREÇÃO: Validar se forma existe ANTES de usar
    const forma = formasPagamento.find(f => f.id_forma_pagamento == idForma);
    if (!forma) {
        showMessage('Forma de pagamento não encontrada. Recarregue a página.', 'error');
        console.error('❌ Forma de pagamento não encontrada:', idForma);
        console.error('Formas disponíveis:', formasPagamento);
        console.error('IDs disponíveis:', formasPagamento.map(f => f.id_forma_pagamento));
        return;
    }
    
    const troco = forma.permite_troco ? parseFloat(document.getElementById('valorTroco').value) || 0 : 0;
    
    pedidoAtual.pagamentos.push({
        id_forma_pagamento: forma.id_forma_pagamento,
        descricao: forma.descricao,
        valor: valor,
        troco: troco
    });
    
    console.log('✅ Pagamento adicionado:', forma.descricao, '-', valor);
    
    renderizarPagamentos();
    calcularTotais();
    fecharModalPagamento();
}

function renderizarPagamentos() {
    const container = document.getElementById('pagamentosLista');
    
    if (pedidoAtual.pagamentos.length === 0) {
        container.innerHTML = '<div class="empty-message">Nenhum pagamento adicionado</div>';
        return;
    }
    
    container.innerHTML = pedidoAtual.pagamentos.map((pag, index) => `
        <div class="pagamento-item">
            <div>
                <div class="pagamento-desc">${pag.descricao}</div>
                <div class="pagamento-valor">R$ ${pag.valor.toFixed(2)}</div>
                ${pag.troco > 0 ? `<div class="pagamento-troco">Troco: R$ ${pag.troco.toFixed(2)}</div>` : ''}
            </div>
            <button class="btn-action" onclick="removerPagamento(${index})" title="Remover">🗑️</button>
        </div>
    `).join('');
}

function removerPagamento(index) {
    pedidoAtual.pagamentos.splice(index, 1);
    renderizarPagamentos();
    calcularTotais();
}

function atualizarStatusPagamento() {
    const totalPago = pedidoAtual.pagamentos.reduce((sum, p) => sum + p.valor, 0);
    const faltante = pedidoAtual.valor_liquido - totalPago;
    
    document.getElementById('totalPago').textContent = `R$ ${totalPago.toFixed(2)}`;
    document.getElementById('valorFaltante').textContent = `R$ ${Math.max(0, faltante).toFixed(2)}`;
    
    const btnFinalizar = document.getElementById('btnFinalizar');
    if (faltante > 0.01) {
        btnFinalizar.disabled = true;
        btnFinalizar.style.opacity = '0.5';
    } else {
        btnFinalizar.disabled = false;
        btnFinalizar.style.opacity = '1';
    }
}

// ===== FINALIZAR PEDIDO =====
async function finalizarPedido() {
    // Validações
    if (pedidoAtual.itens.length === 0) {
        showMessage('Adicione itens ao pedido', 'error');
        return;
    }
    
    const totalPago = pedidoAtual.pagamentos.reduce((sum, p) => sum + p.valor, 0);
    const faltante = pedidoAtual.valor_liquido - totalPago;
    
    if (faltante > 0.01) {
        showMessage(`Faltam R$ ${faltante.toFixed(2)} para completar o pagamento`, 'error');
        return;
    }
    
    // ✅ VALIDAR ESTOQUE COM PARÂMETRO 2
    // PERMITE_SALDO_NEGATIVO
    const permiteSaldoNegativo = PARAMETROS.PERMITE_SALDO_NEGATIVO || 'N';
    console.log(`📊 PERMITE_SALDO_NEGATIVO = ${permiteSaldoNegativo}`);
    
    if (permiteSaldoNegativo === 'N') {
        // ✅ PARÂMETRO = N: VALIDAR estoque (não permite negativo)
        console.log('🔒 Validando estoque (não permite saldo negativo)...');
        
        for (const item of pedidoAtual.itens) {
            if (item.quantidade > item.estoque) {
                showMessage(
                    `Estoque insuficiente para ${item.descricao}. ` +
                    `Disponível: ${item.estoque.toFixed(3)} - Solicitado: ${item.quantidade.toFixed(3)}`,
                    'error'
                );
                console.error(`❌ Estoque insuficiente: ${item.descricao}`);
                return;
            }
        }
        console.log('✅ Estoque validado - tudo OK');
    } else {
        // ✅ PARÂMETRO = S: NÃO VALIDAR (permite negativo)
        console.log('✅ Permite saldo negativo - pulando validação de estoque');
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
        
    } catch (error) {
        console.error('Erro ao finalizar pedido:', error);
        showMessage(error.message || 'Erro ao finalizar pedido', 'error');
        btnFinalizar.disabled = false;
        btnFinalizar.textContent = '✅ Finalizar Pedido';
    }
}

// ===== NOVO PEDIDO =====
async function novoPedido() {
    // Resetar estado
    pedidoAtual = {
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
    
    // Limpar interface
    document.getElementById('observacoes').value = '';
    document.getElementById('buscaProduto').value = '';
    document.getElementById('resultadosBusca').innerHTML = '';
    
    const btnFinalizar = document.getElementById('btnFinalizar');
    btnFinalizar.disabled = false;
    btnFinalizar.textContent = '✅ Finalizar Pedido';
    btnFinalizar.style.opacity = '1';
    
    renderizarItens();
    renderizarPagamentos();
    calcularTotais();
    
    // Reinicializar
    await inicializarPedido();
    
    // Focar no input de busca
    document.getElementById('buscaProduto').focus();
}

// ===== RELATÓRIO DO PEDIDO =====
function mostrarRelatorioPedido(pedidoFinalizado) {
    const dadosPedidoParaRelatorio = {
        numero: pedidoAtual.numero,
        cliente: {...pedidoAtual.cliente},
        itens: [...pedidoAtual.itens],
        pagamentos: [...pedidoAtual.pagamentos],
        valor_bruto: pedidoAtual.valor_bruto,
        desconto: pedidoAtual.desconto,
        acrescimo: pedidoAtual.acrescimo,
        valor_liquido: pedidoAtual.valor_liquido,
        observacoes: pedidoAtual.observacoes,
        created_at: new Date()
    };
    
    // Limpar pedido atual
    limparPedidoAtual();
    
    const modal = document.getElementById('modalRelatorioPedido');
    const dados = pedidoFinalizado.pedido || pedidoFinalizado || dadosPedidoParaRelatorio;
    
    // Cabeçalho
    document.getElementById('relatorioNumero').textContent = dados.numero;
    document.getElementById('relatorioData').textContent = new Date(dados.created_at || new Date()).toLocaleString('pt-BR');
    
    // Cliente
    const clienteNome = dados.cliente?.razao_social || dadosPedidoParaRelatorio.cliente?.razao_social || 'Cliente não identificado';
    const clienteDoc = dados.cliente?.documento || dadosPedidoParaRelatorio.cliente?.documento || '';
    document.getElementById('relatorioCliente').textContent = clienteNome;
    document.getElementById('relatorioClienteDoc').textContent = clienteDoc ? `(${clienteDoc})` : '';
    
    // Itens
    const itens = dados.itens || dadosPedidoParaRelatorio.itens;
    const itensHTML = itens.map(item => `
        <tr>
            <td>${item.descricao}</td>
            <td style="text-align: center;">${parseFloat(item.quantidade).toFixed(3)}</td>
            <td style="text-align: right;">R$ ${parseFloat(item.valor_unitario).toFixed(2)}</td>
            <td style="text-align: right;"><strong>R$ ${parseFloat(item.valor_total).toFixed(2)}</strong></td>
        </tr>
    `).join('');
    document.getElementById('relatorioItens').innerHTML = itensHTML;
    
    // Totais
    const valorBruto = dados.valor_bruto || dadosPedidoParaRelatorio.valor_bruto;
    const desconto = dados.desconto || dadosPedidoParaRelatorio.desconto || 0;
    const acrescimo = dados.acrescimo || dadosPedidoParaRelatorio.acrescimo || 0;
    const valorLiquido = dados.valor_liquido || dadosPedidoParaRelatorio.valor_liquido;
    
    document.getElementById('relatorioSubtotal').textContent = `R$ ${parseFloat(valorBruto).toFixed(2)}`;
    document.getElementById('relatorioDesconto').textContent = `R$ ${parseFloat(desconto).toFixed(2)}`;
    document.getElementById('relatorioAcrescimo').textContent = `R$ ${parseFloat(acrescimo).toFixed(2)}`;
    document.getElementById('relatorioTotal').textContent = `R$ ${parseFloat(valorLiquido).toFixed(2)}`;
    
    // Pagamentos
    const pagamentos = dados.pagamentos || dadosPedidoParaRelatorio.pagamentos;
    const pagamentosHTML = pagamentos.map(pag => `
        <tr>
            <td>${pag.descricao}</td>
            <td style="text-align: right;">R$ ${parseFloat(pag.valor).toFixed(2)}</td>
            <td style="text-align: right;">${pag.troco > 0 ? `R$ ${parseFloat(pag.troco).toFixed(2)}` : '-'}</td>
        </tr>
    `).join('');
    document.getElementById('relatorioPagamentos').innerHTML = pagamentosHTML;
    
    // Observações
    const obs = dados.observacoes || dadosPedidoParaRelatorio.observacoes || '';
    document.getElementById('relatorioObservacoes').textContent = obs || 'Nenhuma observação';
    
    // Mostrar modal
    modal.classList.add('show');
}

function limparPedidoAtual() {
    pedidoAtual = {
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
    
    document.getElementById('observacoes').value = '';
    document.getElementById('buscaProduto').value = '';
    document.getElementById('resultadosBusca').innerHTML = '';
    
    renderizarItens();
    renderizarPagamentos();
    renderizarCliente();
    calcularTotais();
}

function fecharRelatorioPedido() {
    document.getElementById('modalRelatorioPedido').classList.remove('show');
    inicializarPedido();
    document.getElementById('buscaProduto').focus();
}

function imprimirRelatorioPedido() {
    window.print();
}

// ===== MENSAGENS =====
function showMessage(mensagem, tipo = 'info', callback = null) {
    const modal = document.getElementById('modalMensagem');
    const titulo = document.getElementById('mensagemTitulo');
    const texto = document.getElementById('mensagemTexto');
    
    switch(tipo) {
        case 'success':
            titulo.textContent = '✅ Sucesso';
            titulo.style.color = '#10b981';
            break;
        case 'error':
            titulo.textContent = '❌ Erro';
            titulo.style.color = '#ef4444';
            break;
        case 'warning':
            titulo.textContent = '⚠️ Atenção';
            titulo.style.color = '#f59e0b';
            break;
        default:
            titulo.textContent = 'ℹ️ Informação';
            titulo.style.color = '#2563eb';
    }
    
    texto.textContent = mensagem;
    modal.classList.add('show');
    
    if (callback) {
        modal.dataset.callback = 'temp';
        window.tempCallback = callback;
    }
}

function fecharModalMensagem() {
    const modal = document.getElementById('modalMensagem');
    modal.classList.remove('show');
    
    if (modal.dataset.callback && window.tempCallback) {
        const cb = window.tempCallback;
        delete window.tempCallback;
        delete modal.dataset.callback;
        cb();
    }
}
