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

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 PDV carregado');
    
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
    
    document.getElementById('userName').textContent = usuario.nome;
    
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
    
    // CORREÇÃO 1: Fechar modais ao clicar fora - SÓ NO BACKDROP
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            // Só fecha se clicar EXATAMENTE no backdrop (não nos filhos)
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
    
    // Monitorar mudança de forma de pagamento
    document.getElementById('formaPagamento').addEventListener('change', (e) => {
        const formaSelecionada = formasPagamento.find(f => f.id == e.target.value);
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
            console.log(`🔍 ${data.data.length} produto(s) encontrado(s)`);
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
        <div class="resultado-item" onclick="adicionarProduto(${JSON.stringify(p).replace(/"/g, '&quot;')})">
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

// ===== ADICIONAR PRODUTO =====
function adicionarProduto(produto) {
    console.log('🔍 adicionarProduto chamado com:', produto);
    
    // Verificar se já existe
    const itemExistente = pedidoAtual.itens.find(i => i.id_produto === produto.id);
    console.log('🔍 Item já existe?', itemExistente);
    
    if (itemExistente) {
        // Incrementar quantidade
        itemExistente.quantidade++;
        itemExistente.valor_total = itemExistente.quantidade * itemExistente.valor_unitario;
        console.log('✅ Quantidade atualizada:', itemExistente.quantidade);
    } else {
        // Adicionar novo item
        const novoItem = {
            id_produto: produto.id,
            codigo: produto.codigo,
            ean: produto.ean,
            descricao: produto.descricao,
            descricao_complemento: produto.descricao_complemento,
            unidade: produto.unidade,
            quantidade: 1,
            valor_unitario: parseFloat(produto.preco),
            valor_total: parseFloat(produto.preco),
            estoque: parseFloat(produto.estoque)
        };
        
        console.log('➕ Adicionando novo item:', novoItem);
        pedidoAtual.itens.push(novoItem);
        console.log('📦 Total de itens no pedido:', pedidoAtual.itens.length);
    }
    
    // Limpar busca
    document.getElementById('buscaProduto').value = '';
    document.getElementById('resultadosBusca').innerHTML = '';
    
    // Atualizar interface
    console.log('🔄 Chamando renderizarItens()');
    renderizarItens();
    console.log('🔄 Chamando calcularTotais()');
    calcularTotais();
    
    // Focar novamente no input de busca
    setTimeout(() => {
        document.getElementById('buscaProduto').focus();
    }, 100);
}

function renderizarItens() {
    console.log('🔄 renderizarItens() executado - Total de itens:', pedidoAtual.itens.length);
    
    const tbody = document.getElementById('itensTabela');
    const badge = document.getElementById('quantidadeItens');
    
    badge.textContent = `${pedidoAtual.itens.length} itens`;
    
    if (pedidoAtual.itens.length === 0) {
        console.log('📭 Nenhum item - mostrando mensagem vazia');
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div class="empty-message">Nenhum item adicionado</div>
                </td>
            </tr>
        `;
        return;
    }
    
    console.log('📦 Renderizando itens:', pedidoAtual.itens);
    
    tbody.innerHTML = pedidoAtual.itens.map((item, index) => `
        <tr>
            <td class="item-seq">${index + 1}</td>
            <td>
                <div class="item-nome">${item.descricao}</div>
                <div class="item-codigo">Cód: ${item.codigo}</div>
            </td>
            <td class="item-qtd">${parseFloat(item.quantidade).toFixed(3)}</td>
            <td class="item-valor">R$ ${parseFloat(item.valor_unitario).toFixed(2)}</td>
            <td class="item-valor"><strong>R$ ${parseFloat(item.valor_total).toFixed(2)}</strong></td>
            <td class="item-acoes">
                <button class="btn-action" onclick="editarItem(${index})" title="Editar quantidade">✏️</button>
                <button class="btn-action" onclick="removerItem(${index})" title="Remover">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function editarItem(index) {
    itemEmEdicao = index;
    const item = pedidoAtual.itens[index];
    
    // IDs CORRETOS do HTML
    document.getElementById('nomeProdutoModal').textContent = item.descricao;
    document.getElementById('estoqueProdutoModal').textContent = `Estoque: ${item.estoque.toFixed(3)}`;
    document.getElementById('novaQuantidade').value = item.quantidade;
    
    document.getElementById('modalQuantidade').classList.add('show');
    setTimeout(() => {
        document.getElementById('novaQuantidade').select();
    }, 100);
}

// CORREÇÃO: Funções do modal de quantidade
function fecharModalQuantidade() {
    document.getElementById('modalQuantidade').classList.remove('show');
    itemEmEdicao = null;
}

function confirmarQuantidade() {
    const novaQtd = parseFloat(document.getElementById('novaQuantidade').value);
    
    if (!novaQtd || novaQtd <= 0) {
        showMessage('Quantidade inválida', 'error');
        return;
    }
    
    if (itemEmEdicao === null) {
        showMessage('Nenhum item selecionado', 'error');
        return;
    }
    
    const item = pedidoAtual.itens[itemEmEdicao];
    
    // Validar estoque
    if (novaQtd > item.estoque) {
        showMessage(
            `Estoque insuficiente. Disponível: ${item.estoque.toFixed(3)}`,
            'error'
        );
        return;
    }
    
    // Atualizar quantidade
    item.quantidade = novaQtd;
    item.valor_total = item.quantidade * item.valor_unitario;
    
    renderizarItens();
    calcularTotais();
    fecharModalQuantidade();
}

function removerItem(index) {
    pedidoAtual.itens.splice(index, 1);
    renderizarItens();
    calcularTotais();
}

// ===== CALCULAR TOTAIS =====
function calcularTotais() {
    console.log('💰 calcularTotais() executado');
    pedidoAtual.valor_bruto = pedidoAtual.itens.reduce((sum, item) => sum + item.valor_total, 0);
    pedidoAtual.valor_liquido = pedidoAtual.valor_bruto - pedidoAtual.desconto + pedidoAtual.acrescimo;
    
    console.log('💰 Valor bruto:', pedidoAtual.valor_bruto.toFixed(2));
    console.log('💰 Valor líquido:', pedidoAtual.valor_liquido.toFixed(2));
    
    document.getElementById('subtotal').textContent = `R$ ${pedidoAtual.valor_bruto.toFixed(2)}`;
    document.getElementById('desconto').textContent = `R$ ${pedidoAtual.desconto.toFixed(2)}`;
    document.getElementById('acrescimo').textContent = `R$ ${pedidoAtual.acrescimo.toFixed(2)}`;
    document.getElementById('totalGeral').textContent = `R$ ${pedidoAtual.valor_liquido.toFixed(2)}`;
    
    atualizarStatusPagamento();
}

// ===== BUSCAR CLIENTES =====
async function buscarClientes(termo) {
    try {
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
        }
    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
    }
}

function renderizarResultadosClientes(clientes) {
    const container = document.getElementById('resultadosBuscaCliente');
    
    if (clientes.length === 0) {
        container.innerHTML = '<div class="empty-message">Nenhum cliente encontrado</div>';
        return;
    }
    
    // CORREÇÃO EXTRA: Filtrar no frontend também para garantir
    const termoBusca = document.getElementById('inputBuscaCliente').value.trim().toLowerCase();
    const clientesFiltrados = clientes.filter(c => {
        const razaoSocial = (c.razao_social || '').toLowerCase();
        const nomeFantasia = (c.nome_fantasia || '').toLowerCase();
        const documento = (c.documento || '').toLowerCase();
        const cpf = (c.cpf || '').replace(/\D/g, '');
        const cnpj = (c.cnpj || '').replace(/\D/g, '');
        
        return razaoSocial.includes(termoBusca) ||
               nomeFantasia.includes(termoBusca) ||
               documento.includes(termoBusca) ||
               cpf.includes(termoBusca) ||
               cnpj.includes(termoBusca);
    });
    
    if (clientesFiltrados.length === 0) {
        container.innerHTML = '<div class="empty-message">Nenhum cliente encontrado com este termo</div>';
        return;
    }
    
    container.innerHTML = clientesFiltrados.map(c => `
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
            
            const select = document.getElementById('formaPagamento');
            select.innerHTML = '<option value="">Selecione...</option>' + 
                formasPagamento.map(f => 
                    `<option value="${f.id}">${f.descricao}</option>`
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
    
    // CORREÇÃO 2: Calcular valor restante descontando o troco dos pagamentos já feitos
    const totalPagoEfetivo = pedidoAtual.pagamentos.reduce((sum, p) => sum + (p.valor - (p.troco || 0)), 0);
    const valorRestante = pedidoAtual.valor_liquido - totalPagoEfetivo;
    
    document.getElementById('valorPagamento').value = valorRestante.toFixed(2);
    document.getElementById('valorTroco').value = '';
    document.getElementById('formaPagamento').value = '';
    document.getElementById('trocoGroup').style.display = 'none';
    
    document.getElementById('modalPagamento').classList.add('show');
}

function fecharModalPagamento() {
    document.getElementById('modalPagamento').classList.remove('show');
}

function calcularTroco() {
    const formaSelecionada = formasPagamento.find(f => 
        f.id == document.getElementById('formaPagamento').value
    );
    
    if (!formaSelecionada || !formaSelecionada.permite_troco) {
        return;
    }
    
    const valorPago = parseFloat(document.getElementById('valorPagamento').value) || 0;
    
    // CORREÇÃO 2: Calcular valor restante descontando o troco dos pagamentos já feitos
    const totalPagoEfetivo = pedidoAtual.pagamentos.reduce((sum, p) => sum + (p.valor - (p.troco || 0)), 0);
    const valorRestante = pedidoAtual.valor_liquido - totalPagoEfetivo;
    
    const troco = Math.max(0, valorPago - valorRestante);
    document.getElementById('valorTroco').value = troco.toFixed(2);
}

function adicionarPagamento() {
    const idForma = document.getElementById('formaPagamento').value;
    const valor = parseFloat(document.getElementById('valorPagamento').value);
    
    if (!idForma) {
        showMessage('Selecione uma forma de pagamento', 'error');
        return;
    }
    
    if (!valor || valor <= 0) {
        showMessage('Informe um valor válido', 'error');
        return;
    }
    
    const formaSelecionada = formasPagamento.find(f => f.id == idForma);
    
    // Validar se a forma de pagamento foi encontrada
    if (!formaSelecionada) {
        showMessage('Forma de pagamento não encontrada. Tente recarregar a página.', 'error');
        return;
    }
    
    const troco = formaSelecionada.permite_troco ? 
        parseFloat(document.getElementById('valorTroco').value) || 0 : 0;
    
    pedidoAtual.pagamentos.push({
        id_forma_pagamento: parseInt(idForma),
        descricao: formaSelecionada.descricao,
        valor: valor,
        troco: troco,
        permite_troco: formaSelecionada.permite_troco
    });
    
    renderizarPagamentos();
    atualizarStatusPagamento();
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
    atualizarStatusPagamento();
}

function atualizarStatusPagamento() {
    // CORREÇÃO 2: Total pago EFETIVO = valor - troco
    const totalPago = pedidoAtual.pagamentos.reduce((sum, p) => sum + (p.valor - (p.troco || 0)), 0);
    const faltante = pedidoAtual.valor_liquido - totalPago;
    
    document.getElementById('totalPago').textContent = `R$ ${totalPago.toFixed(2)}`;
    document.getElementById('valorFaltante').textContent = `R$ ${Math.max(0, faltante).toFixed(2)}`;
    
    // Habilitar/desabilitar botão finalizar
    const btnFinalizar = document.getElementById('btnFinalizar');
    if (faltante <= 0.01 && pedidoAtual.itens.length > 0) {
        btnFinalizar.disabled = false;
        btnFinalizar.style.opacity = '1';
    } else {
        btnFinalizar.disabled = true;
        btnFinalizar.style.opacity = '0.5';
    }
}

// ===== FINALIZAR PEDIDO =====
async function finalizarPedido() {
    console.log('🔍 Iniciando finalização do pedido...');
    console.log('📦 Dados do pedido:', JSON.stringify(pedidoAtual, null, 2));
    
    // Validações
    if (!pedidoAtual.cliente || !pedidoAtual.cliente.id) {
        console.error('❌ Cliente não selecionado');
        showMessage('Nenhum cliente selecionado. Por favor, selecione um cliente.', 'error');
        return;
    }
    console.log('✅ Cliente validado:', pedidoAtual.cliente);
    
    if (pedidoAtual.itens.length === 0) {
        console.error('❌ Nenhum item no pedido');
        showMessage('Adicione itens ao pedido', 'error');
        return;
    }
    console.log('✅ Itens validados:', pedidoAtual.itens.length);
    
    if (pedidoAtual.pagamentos.length === 0) {
        console.error('❌ Nenhum pagamento');
        showMessage('Adicione pelo menos uma forma de pagamento', 'error');
        return;
    }
    console.log('✅ Pagamentos validados:', pedidoAtual.pagamentos.length);
    
    // CORREÇÃO 2: Validar com total pago efetivo (descontando troco)
    const totalPago = pedidoAtual.pagamentos.reduce((sum, p) => sum + (p.valor - (p.troco || 0)), 0);
    const diferenca = Math.abs(totalPago - pedidoAtual.valor_liquido);
    
    console.log('💰 Total do pedido:', pedidoAtual.valor_liquido.toFixed(2));
    console.log('💵 Total pago efetivo:', totalPago.toFixed(2));
    console.log('📊 Diferença:', diferenca.toFixed(2));
    
    if (diferenca > 0.01) {
        console.error('❌ Total pago não confere');
        showMessage(
            `O total dos pagamentos não confere com o valor do pedido.\n` +
            `Valor do pedido: R$ ${pedidoAtual.valor_liquido.toFixed(2)}\n` +
            `Total pago (descontado troco): R$ ${totalPago.toFixed(2)}\n` +
            `Diferença: R$ ${diferenca.toFixed(2)}`,
            'error'
        );
        return;
    }
    
    // Validar estoque
    for (const item of pedidoAtual.itens) {
        if (item.quantidade > item.estoque) {
            showMessage(
                `Estoque insuficiente para ${item.descricao}. ` +
                `Disponível: ${item.estoque.toFixed(3)} - Solicitado: ${item.quantidade.toFixed(3)}`,
                'error'
            );
            return;
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
            // CORREÇÃO 3: Mostrar relatório do pedido
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
    
    // CORREÇÃO 1: Resetar botão finalizar
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
    // CORREÇÃO: Limpar dados do pedido ANTES de mostrar o relatório
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
    
    // Usar dados salvos ou dados do servidor
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
    // Resetar estado do pedido
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
    
    // CORREÇÃO: Resetar botão finalizar
    const btnFinalizar = document.getElementById('btnFinalizar');
    if (btnFinalizar) {
        btnFinalizar.disabled = false;
        btnFinalizar.textContent = '✅ Finalizar Pedido';
        btnFinalizar.style.opacity = '1';
    }
    
    renderizarItens();
    renderizarPagamentos();
    renderizarCliente();
    calcularTotais();
}

function fecharRelatorioPedido() {
    document.getElementById('modalRelatorioPedido').classList.remove('show');
    // Iniciar novo pedido automaticamente
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
    
    // Definir título baseado no tipo
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
    
    // Se houver callback, executar ao fechar
    if (callback) {
        modal.dataset.callback = 'temp';
        window.tempCallback = callback;
    }
}

function fecharModalMensagem() {
    const modal = document.getElementById('modalMensagem');
    modal.classList.remove('show');
    
    // Executar callback se houver
    if (modal.dataset.callback && window.tempCallback) {
        const cb = window.tempCallback;
        delete window.tempCallback;
        delete modal.dataset.callback;
        cb();
    }
}
