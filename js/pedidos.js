// =====================================================
// SIRIUS WEB - Pedidos
// =====================================================

// API_URL já está declarado em auth.js

// =====================================================
// ESTADO GLOBAL
// =====================================================
let paginaAtual = 1;
let totalPaginas = 1;
let filtroAtivo = {};
let ordenacao = 'numero_desc';
let pedidoAtualVisualizar = null;

// =====================================================
// INICIALIZAÇÃO
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Pedidos carregado');
    verificarAutenticacao();
    const empresaId = obterEmpresaId();
    
    // Exibir nome do usuário
    const usuario = JSON.parse(localStorage.getItem('sirius_usuario'));
    if (usuario) {
        document.getElementById('userName').textContent = usuario.nome;
    }
    
    if (empresaId) {
        console.log('✅ Empresa ID:', empresaId);
        carregarPedidos();
    } else {
        console.error('❌ Empresa ID não encontrado');
        mostrarMensagem('Empresa não identificada', 'error');
    }
});

// =====================================================
// CARREGAR PEDIDOS
// =====================================================
async function carregarPedidos(pagina = 1) {
    try {
        const empresaId = obterEmpresaId();
        const token = obterToken();
        
        // Construir query string
        const params = new URLSearchParams({
            page: pagina,
            limit: 20
        });
        
        // Adicionar ordenação
        if (ordenacao) {
            params.append('ordenacao', ordenacao);
        }
        
        // Adicionar filtros
        if (filtroAtivo.tipo === 'numero' && filtroAtivo.valor) {
            params.append('numero', filtroAtivo.valor);
        }
        if (filtroAtivo.tipo === 'hoje') {
            params.append('hoje', 'true');
        }
        if (filtroAtivo.tipo === 'data' && filtroAtivo.valor) {
            params.append('data_inicial', filtroAtivo.valor);
        }
        if (filtroAtivo.tipo === 'cliente' && filtroAtivo.valor) {
            params.append('id_cliente', filtroAtivo.valor);
        }
        
        const response = await fetch(`${API_URL}/pdv/pedidos?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao carregar pedidos');
        }
        
        const result = await response.json();
        
        if (result.success) {
            renderizarPedidos(result.data);
            renderizarPaginacao(result.pagination);
            paginaAtual = result.pagination.page;
            totalPaginas = result.pagination.totalPages;
        } else {
            throw new Error(result.message || 'Erro ao carregar pedidos');
        }
        
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        mostrarMensagem('Erro ao carregar pedidos: ' + error.message, 'error');
        document.getElementById('tabelaPedidos').innerHTML = `
            <tr><td colspan="7" style="text-align: center; color: red;">
                Erro ao carregar pedidos
            </td></tr>
        `;
    }
}

// =====================================================
// RENDERIZAR PEDIDOS
// =====================================================
function renderizarPedidos(pedidos) {
    const tbody = document.getElementById('tabelaPedidos');
    
    if (!pedidos || pedidos.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7" style="text-align: center;">
                Nenhum pedido encontrado
            </td></tr>
        `;
        return;
    }
    
    tbody.innerHTML = pedidos.map(pedido => {
        const data = new Date(pedido.created_at).toLocaleDateString('pt-BR');
        const valor = parseFloat(pedido.valor_liquido).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
        
        const statusClass = {
            'F': 'status-finalizado',
            'A': 'status-aberto',
            'C': 'status-cancelado'
        }[pedido.status] || 'status-aberto';
        
        const statusTexto = {
            'F': 'Finalizado',
            'A': 'Aberto',
            'C': 'Cancelado'
        }[pedido.status] || 'Aberto';
        
        return `
            <tr>
                <td><strong>#${pedido.numero}</strong></td>
                <td>${data}</td>
                <td>${pedido.nome_cliente || '-'}</td>
                <td>${pedido.cpf_cnpj_cliente || '-'}</td>
                <td><strong>${valor}</strong></td>
                <td><span class="status-badge ${statusClass}">${statusTexto}</span></td>
                <td>
                    <button class="btn-small btn-visualizar" onclick="visualizarPedido(${pedido.id})">
                        👁️ Visualizar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// =====================================================
// RENDERIZAR PAGINAÇÃO
// =====================================================
function renderizarPaginacao(pagination) {
    const paginacaoDiv = document.getElementById('paginacao');
    
    if (!pagination || pagination.totalPages <= 1) {
        paginacaoDiv.style.display = 'none';
        return;
    }
    
    paginacaoDiv.style.display = 'flex';
    paginacaoDiv.innerHTML = `
        <button ${!pagination.hasPrev ? 'disabled' : ''} onclick="carregarPedidos(${pagination.page - 1})">
            ◀ Anterior
        </button>
        <span>Página ${pagination.page} de ${pagination.totalPages}</span>
        <button ${!pagination.hasNext ? 'disabled' : ''} onclick="carregarPedidos(${pagination.page + 1})">
            Próximo ▶
        </button>
    `;
}

// =====================================================
// ORDENAÇÃO
// =====================================================
function aplicarOrdenacao(tipo) {
    ordenacao = tipo;
    carregarPedidos(1);
}

// =====================================================
// FILTROS
// =====================================================
function abrirFiltroNumero() {
    document.getElementById('modalFiltroNumero').style.display = 'block';
    document.getElementById('filtroNumeroPedido').value = '';
    document.getElementById('filtroNumeroPedido').focus();
}

function aplicarFiltroNumero() {
    const numero = document.getElementById('filtroNumeroPedido').value.trim();
    
    if (!numero) {
        mostrarMensagem('Digite o número do pedido', 'error');
        return;
    }
    
    filtroAtivo = {
        tipo: 'numero',
        valor: numero,
        texto: `Pedido #${numero}`
    };
    
    mostrarFiltroAtivo();
    fecharModal('modalFiltroNumero');
    carregarPedidos(1);
}

function aplicarFiltroHoje() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    
    filtroAtivo = {
        tipo: 'hoje',
        texto: `Pedidos de Hoje (${hoje})`
    };
    
    mostrarFiltroAtivo();
    carregarPedidos(1);
}

function abrirFiltroData() {
    document.getElementById('modalFiltroData').style.display = 'block';
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('filtroDataInicial').value = hoje;
    document.getElementById('filtroDataInicial').focus();
}

function aplicarFiltroData() {
    const data = document.getElementById('filtroDataInicial').value;
    
    if (!data) {
        mostrarMensagem('Selecione uma data', 'error');
        return;
    }
    
    const dataFormatada = new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
    
    filtroAtivo = {
        tipo: 'data',
        valor: data,
        texto: `Pedidos a partir de ${dataFormatada}`
    };
    
    mostrarFiltroAtivo();
    fecharModal('modalFiltroData');
    carregarPedidos(1);
}

function abrirFiltroCliente() {
    document.getElementById('modalFiltroCliente').style.display = 'block';
    document.getElementById('buscaCliente').value = '';
    document.getElementById('resultadosBuscaCliente').innerHTML = '';
    document.getElementById('buscaCliente').focus();
    
    // Listener para busca
    const inputBusca = document.getElementById('buscaCliente');
    inputBusca.removeEventListener('input', buscarClientesFiltro);
    inputBusca.addEventListener('input', buscarClientesFiltro);
}

// =====================================================
// NORMALIZAÇÃO DE TEXTO (para busca sem acentos)
// =====================================================
function normalizeText(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

async function buscarClientesFiltro() {
    const termo = document.getElementById('buscaCliente').value.trim();
    const resultadosDiv = document.getElementById('resultadosBuscaCliente');
    
    if (termo.length < 2) {
        resultadosDiv.innerHTML = '';
        return;
    }
    
    try {
        const empresaId = obterEmpresaId();
        const token = obterToken();
        
        const response = await fetch(`${API_URL}/pdv/clientes/buscar?termo=${encodeURIComponent(termo)}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId
            }
        });
        
        const result = await response.json();
        
        if (result.success && result.data && result.data.length > 0) {
            // Normalizar termo de busca
            const termoNormalizado = normalizeText(termo);
            
            // Filtrar clientes usando normalização de texto
            const clientesFiltrados = result.data.filter(cliente => {
                const nomeNormalizado = normalizeText(cliente.razao_social || '');
                const documentoNormalizado = normalizeText(cliente.documento || '');
                const fantasiaNormalizado = normalizeText(cliente.nome_fantasia || '');
                
                return nomeNormalizado.includes(termoNormalizado) ||
                       documentoNormalizado.includes(termoNormalizado) ||
                       fantasiaNormalizado.includes(termoNormalizado);
            });
            
            if (clientesFiltrados.length > 0) {
                resultadosDiv.innerHTML = clientesFiltrados.map(cliente => `
                    <div class="item-busca" onclick="selecionarClienteFiltro(${cliente.id}, '${cliente.razao_social.replace(/'/g, "\\'")}')">
                        <strong>${cliente.razao_social}</strong><br>
                        <small>${cliente.documento || ''}</small>
                    </div>
                `).join('');
            } else {
                resultadosDiv.innerHTML = '<div class="item-busca">Nenhum cliente encontrado</div>';
            }
        } else {
            resultadosDiv.innerHTML = '<div class="item-busca">Nenhum cliente encontrado</div>';
        }
        
    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
    }
}

function selecionarClienteFiltro(idCliente, nomeCliente) {
    filtroAtivo = {
        tipo: 'cliente',
        valor: idCliente,
        texto: `Cliente: ${nomeCliente}`
    };
    
    mostrarFiltroAtivo();
    fecharModal('modalFiltroCliente');
    carregarPedidos(1);
}

function mostrarFiltroAtivo() {
    const filtroDiv = document.getElementById('filtroAtivo');
    const filtroTexto = document.getElementById('filtroTexto');
    
    if (filtroAtivo.texto) {
        filtroTexto.textContent = `🔍 Filtro Ativo: ${filtroAtivo.texto}`;
        filtroDiv.style.display = 'flex';
    } else {
        filtroDiv.style.display = 'none';
    }
}

function limparFiltros() {
    filtroAtivo = {};
    document.getElementById('filtroAtivo').style.display = 'none';
    carregarPedidos(1);
}

// =====================================================
// VISUALIZAR PEDIDO
// =====================================================
async function visualizarPedido(idPedido) {
    try {
        const empresaId = obterEmpresaId();
        const token = obterToken();
        
        const response = await fetch(`${API_URL}/pdv/pedidos/${idPedido}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao buscar pedido');
        }
        
        const result = await response.json();
        
        if (result.success) {
            pedidoAtualVisualizar = result.data;
            renderizarDetalhesPedido(result.data);
            document.getElementById('modalVisualizarPedido').style.display = 'block';
        } else {
            throw new Error(result.message || 'Erro ao buscar pedido');
        }
        
    } catch (error) {
        console.error('Erro ao visualizar pedido:', error);
        mostrarMensagem('Erro ao visualizar pedido: ' + error.message, 'error');
    }
}

function renderizarDetalhesPedido(pedido) {
    const data = new Date(pedido.created_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const statusTexto = {
        'F': 'Finalizado',
        'A': 'Aberto',
        'C': 'Cancelado'
    }[pedido.status] || 'Aberto';
    
    const valorBruto = parseFloat(pedido.valor_bruto).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
    
    const desconto = parseFloat(pedido.desconto || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
    
    const acrescimo = parseFloat(pedido.acrescimo || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
    
    const valorLiquido = parseFloat(pedido.valor_liquido).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
    
    let html = `
        <div class="pedido-info">
            <div class="pedido-info-row">
                <div class="pedido-info-item">
                    <div class="pedido-info-label">Número do Pedido</div>
                    <div class="pedido-info-value"><strong>#${pedido.numero}</strong></div>
                </div>
                <div class="pedido-info-item">
                    <div class="pedido-info-label">Data/Hora</div>
                    <div class="pedido-info-value">${data}</div>
                </div>
                <div class="pedido-info-item">
                    <div class="pedido-info-label">Status</div>
                    <div class="pedido-info-value"><strong>${statusTexto}</strong></div>
                </div>
            </div>
            
            <div class="pedido-info-row">
                <div class="pedido-info-item">
                    <div class="pedido-info-label">Cliente</div>
                    <div class="pedido-info-value">${pedido.nome_cliente || '-'}</div>
                </div>
                <div class="pedido-info-item">
                    <div class="pedido-info-label">Documento</div>
                    <div class="pedido-info-value">${pedido.cpf_cnpj_cliente || '-'}</div>
                </div>
                <div class="pedido-info-item">
                    <div class="pedido-info-label">Usuário</div>
                    <div class="pedido-info-value">${pedido.usuario || '-'}</div>
                </div>
            </div>
        </div>
        
        <h3 class="section-subtitle">📦 Itens do Pedido</h3>
        <table class="pedido-itens-table">
            <thead>
                <tr>
                    <th>Seq</th>
                    <th>Código</th>
                    <th>Descrição</th>
                    <th>Qtd</th>
                    <th>Vlr Unit.</th>
                    <th>Vlr Total</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    if (pedido.itens && pedido.itens.length > 0) {
        pedido.itens.forEach((item, index) => {
            const valorUnit = parseFloat(item.valor_unitario).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            });
            const valorTotal = parseFloat(item.valor_total).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            });
            
            let descricao = item.descricao || '';
            if (descricao.length > 50) {
                descricao = descricao.substring(0, 47) + '...';
            }
            
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.codigo_produto || '-'}</td>
                    <td>${descricao}</td>
                    <td>${parseFloat(item.quantidade).toFixed(3)}</td>
                    <td>${valorUnit}</td>
                    <td><strong>${valorTotal}</strong></td>
                </tr>
            `;
        });
    }
    
    html += `
            </tbody>
        </table>
        
        <div class="pedido-info">
            <div class="pedido-info-row">
                <div class="pedido-info-item">
                    <div class="pedido-info-label">Valor Bruto</div>
                    <div class="pedido-info-value">${valorBruto}</div>
                </div>
                <div class="pedido-info-item">
                    <div class="pedido-info-label">Desconto</div>
                    <div class="pedido-info-value">${desconto}</div>
                </div>
                <div class="pedido-info-item">
                    <div class="pedido-info-label">Acréscimo</div>
                    <div class="pedido-info-value">${acrescimo}</div>
                </div>
            </div>
        </div>
        
        <div class="pedido-total">
            VALOR TOTAL: ${valorLiquido}
        </div>
    `;
    
    if (pedido.observacoes) {
        html += `
            <h3 class="section-subtitle">📝 Observações</h3>
            <p>${pedido.observacoes}</p>
        `;
    }
    
    document.getElementById('conteudoPedido').innerHTML = html;
}

// =====================================================
// IMPRIMIR PEDIDO ATUAL
// =====================================================
function imprimirPedidoAtual() {
    if (!pedidoAtualVisualizar) {
        mostrarMensagem('Nenhum pedido selecionado', 'error');
        return;
    }
    
    imprimirPedido(pedidoAtualVisualizar);
}

// =====================================================
// GERAR RELATÓRIO DE PEDIDOS
// =====================================================
async function gerarRelatorioPedidos() {
    // TÉCNICA: Abrir janela IMEDIATAMENTE (igual produtos/clientes)
    const janelaRelatorio = window.open('', '_blank');
    
    if (!janelaRelatorio) {
        mostrarMensagem('Popup bloqueado! Por favor, permita popups para este site.', 'error');
        return;
    }
    
    // Mostrar tela de carregamento enquanto busca dados
    janelaRelatorio.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Gerando Relatório...</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: #f5f5f5;
                }
                .loading {
                    text-align: center;
                    font-size: 18px;
                    color: #667eea;
                }
                .spinner {
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #667eea;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                    margin: 20px auto;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="loading">
                <div class="spinner"></div>
                <p>Gerando relatório de pedidos...</p>
                <p style="font-size: 14px; color: #999;">Aguarde, buscando dados...</p>
            </div>
        </body>
        </html>
    `);
    
    try {
        const empresaId = obterEmpresaId();
        const token = obterToken();
        
        // Buscar TODOS os pedidos do filtro atual (sem paginação)
        const params = new URLSearchParams({
            page: 1,
            limit: 1000 // Limite alto para pegar todos
        });
        
        // Adicionar ordenação
        if (ordenacao) {
            params.append('ordenacao', ordenacao);
        }
        
        // Adicionar filtros
        if (filtroAtivo.tipo === 'numero' && filtroAtivo.valor) {
            params.append('numero', filtroAtivo.valor);
        }
        if (filtroAtivo.tipo === 'hoje') {
            params.append('hoje', 'true');
        }
        if (filtroAtivo.tipo === 'data' && filtroAtivo.valor) {
            params.append('data_inicial', filtroAtivo.valor);
        }
        if (filtroAtivo.tipo === 'cliente' && filtroAtivo.valor) {
            params.append('id_cliente', filtroAtivo.valor);
        }
        
        const response = await fetch(`${API_URL}/pdv/pedidos?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao buscar pedidos para relatório');
        }
        
        const result = await response.json();
        
        if (result.success && result.data.length > 0) {
            // Buscar detalhes de cada pedido
            const pedidosDetalhados = [];
            
            for (const pedido of result.data) {
                const detResponse = await fetch(`${API_URL}/pdv/pedidos/${pedido.id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'X-Empresa-Id': empresaId
                    }
                });
                
                if (detResponse.ok) {
                    const detResult = await detResponse.json();
                    if (detResult.success) {
                        pedidosDetalhados.push(detResult.data);
                    }
                }
            }
            
            // Preencher janela que já foi aberta com o relatório
            imprimirRelatorioPedidos(pedidosDetalhados, janelaRelatorio);
        } else {
            janelaRelatorio.close();
            mostrarMensagem('Nenhum pedido encontrado para o relatório', 'error');
        }
        
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        janelaRelatorio.close();
        mostrarMensagem('Erro ao gerar relatório: ' + error.message, 'error');
    }
}

function imprimirRelatorioPedidos(pedidos, janelaRelatorio) {
    const dataAtual = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Pedidos</title>
            <style>
                @page { margin: 1cm; }
                body { font-family: Arial, sans-serif; font-size: 10pt; }
                h1 { text-align: center; font-size: 16pt; margin-bottom: 5px; }
                h2 { text-align: center; font-size: 12pt; margin-top: 0; color: #666; }
                .info { text-align: center; margin-bottom: 20px; font-size: 9pt; }
                .pedido { border: 1px solid #000; padding: 10px; margin-bottom: 15px; page-break-inside: avoid; }
                .pedido-header { background: #f0f0f0; padding: 8px; margin-bottom: 8px; font-weight: bold; }
                table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                th, td { border: 1px solid #ddd; padding: 5px; text-align: left; }
                th { background: #f0f0f0; font-weight: bold; }
                .totais { text-align: right; margin-top: 8px; font-weight: bold; }
                .footer { margin-top: 20px; text-align: center; font-size: 8pt; color: #666; }
                @media print {
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>RELATÓRIO DE PEDIDOS</h1>
            <h2>SIRIUS WEB ERP</h2>
            <div class="info">
                Emitido em: ${dataAtual}<br>
                ${filtroAtivo.texto ? 'Filtro: ' + filtroAtivo.texto : 'Todos os pedidos'}
            </div>
    `;
    
    pedidos.forEach(pedido => {
        const data = new Date(pedido.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        html += `
            <div class="pedido">
                <div class="pedido-header">
                    Pedido #${pedido.numero} | ${data} | 
                    Cliente: ${pedido.nome_cliente || 'Não informado'} | 
                    Documento: ${pedido.cpf_cnpj_cliente || '-'}
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th width="5%">Item</th>
                            <th width="15%">Código</th>
                            <th>Descrição</th>
                            <th width="10%">Qtd</th>
                            <th width="12%">Vlr Unit.</th>
                            <th width="12%">Vlr Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if (pedido.itens && pedido.itens.length > 0) {
            pedido.itens.forEach((item, index) => {
                const valorUnit = parseFloat(item.valor_unitario).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
                const valorTotal = parseFloat(item.valor_total).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
                
                html += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${item.codigo_produto || '-'}</td>
                        <td>${item.descricao || ''}</td>
                        <td style="text-align: right;">${parseFloat(item.quantidade).toFixed(3)}</td>
                        <td style="text-align: right;">R$ ${valorUnit}</td>
                        <td style="text-align: right;">R$ ${valorTotal}</td>
                    </tr>
                `;
            });
        }
        
        const valorBruto = parseFloat(pedido.valor_bruto).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        const desconto = parseFloat(pedido.desconto || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        const acrescimo = parseFloat(pedido.acrescimo || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        const valorLiquido = parseFloat(pedido.valor_liquido).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        html += `
                    </tbody>
                </table>
                
                <div class="totais">
                    Valor Bruto: R$ ${valorBruto} | 
                    Desconto: R$ ${desconto} | 
                    Acréscimo: R$ ${acrescimo} | 
                    <strong>TOTAL: R$ ${valorLiquido}</strong>
                </div>
            </div>
        `;
    });
    
    html += `
            <div class="footer">
                Relatório gerado pelo SIRIUS WEB ERP - Total de ${pedidos.length} pedido(s)
            </div>
            <br>
            <button onclick="window.print()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">🖨️ Imprimir</button>
        </body>
        </html>
    `;
    
    // Preencher janela que já foi aberta
    janelaRelatorio.document.open();
    janelaRelatorio.document.write(html);
    janelaRelatorio.document.close();
}

// =====================================================
// IMPRIMIR PEDIDO INDIVIDUAL
// =====================================================
function imprimirPedido(pedido) {
    const data = new Date(pedido.created_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Pedido #${pedido.numero}</title>
            <style>
                @page { margin: 1cm; }
                body { font-family: Arial, sans-serif; font-size: 11pt; }
                h1 { text-align: center; font-size: 18pt; margin-bottom: 5px; }
                h2 { text-align: center; font-size: 13pt; margin-top: 0; color: #666; }
                .info { margin: 20px 0; padding: 10px; background: #f9f9f9; border: 1px solid #ddd; }
                .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #000; padding: 8px; text-align: left; }
                th { background: #e0e0e0; font-weight: bold; }
                .totais { margin-top: 20px; text-align: right; font-size: 12pt; }
                .total-final { font-size: 16pt; font-weight: bold; margin-top: 10px; }
                .footer { margin-top: 30px; text-align: center; font-size: 9pt; color: #666; }
            </style>
        </head>
        <body>
            <h1>PEDIDO DE VENDA</h1>
            <h2>SIRIUS WEB ERP</h2>
            
            <div class="info">
                <div class="info-row">
                    <strong>Pedido Nº:</strong> <span>${pedido.numero}</span>
                </div>
                <div class="info-row">
                    <strong>Data/Hora:</strong> <span>${data}</span>
                </div>
                <div class="info-row">
                    <strong>Cliente:</strong> <span>${pedido.nome_cliente || 'Não informado'}</span>
                </div>
                <div class="info-row">
                    <strong>Documento:</strong> <span>${pedido.cpf_cnpj_cliente || '-'}</span>
                </div>
                ${pedido.usuario ? `
                <div class="info-row">
                    <strong>Atendente:</strong> <span>${pedido.usuario}</span>
                </div>
                ` : ''}
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th width="5%">Item</th>
                        <th width="15%">Código</th>
                        <th>Descrição</th>
                        <th width="10%">Qtd</th>
                        <th width="12%">Vlr Unit.</th>
                        <th width="12%">Vlr Total</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    if (pedido.itens && pedido.itens.length > 0) {
        pedido.itens.forEach((item, index) => {
            const valorUnit = parseFloat(item.valor_unitario).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            const valorTotal = parseFloat(item.valor_total).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.codigo_produto || '-'}</td>
                    <td>${item.descricao || ''}</td>
                    <td style="text-align: right;">${parseFloat(item.quantidade).toFixed(3)}</td>
                    <td style="text-align: right;">R$ ${valorUnit}</td>
                    <td style="text-align: right;">R$ ${valorTotal}</td>
                </tr>
            `;
        });
    }
    
    const valorBruto = parseFloat(pedido.valor_bruto).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    const desconto = parseFloat(pedido.desconto || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    const acrescimo = parseFloat(pedido.acrescimo || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    const valorLiquido = parseFloat(pedido.valor_liquido).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    html += `
                </tbody>
            </table>
            
            <div class="totais">
                <div>Valor Bruto: R$ ${valorBruto}</div>
                ${parseFloat(pedido.desconto || 0) > 0 ? `<div>Desconto: R$ ${desconto}</div>` : ''}
                ${parseFloat(pedido.acrescimo || 0) > 0 ? `<div>Acréscimo: R$ ${acrescimo}</div>` : ''}
                <div class="total-final">TOTAL: R$ ${valorLiquido}</div>
            </div>
            
            ${pedido.observacoes ? `
            <div style="margin-top: 20px;">
                <strong>Observações:</strong><br>
                ${pedido.observacoes}
            </div>
            ` : ''}
            
            <div class="footer">
                Documento gerado pelo SIRIUS WEB ERP
            </div>
        </body>
        </html>
    `;
    
    const janelaImpressao = window.open('', '_blank');
    
    if (!janelaImpressao) {
        mostrarMensagem('Popup bloqueado! Permita popups para este site e tente novamente.', 'error');
        return;
    }
    
    janelaImpressao.document.write(html);
    janelaImpressao.document.close();
    janelaImpressao.focus();
    
    setTimeout(() => {
        janelaImpressao.print();
    }, 500);
}

// =====================================================
// MODAL
// =====================================================
function fecharModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

// =====================================================
// MENSAGENS
// =====================================================
function mostrarMensagem(texto, tipo = 'success') {
    const mensagemDiv = document.getElementById('mensagem');
    mensagemDiv.textContent = texto;
    mensagemDiv.className = `mensagem ${tipo}`;
    mensagemDiv.style.display = 'block';
    
    setTimeout(() => {
        mensagemDiv.style.display = 'none';
    }, 5000);
}

// =====================================================
// UTILITÁRIOS
// =====================================================
function obterEmpresaId() {
    const empresas = JSON.parse(localStorage.getItem('sirius_empresas') || '[]');
    return empresas.length > 0 ? empresas[0].id : null;
}

function obterToken() {
    return localStorage.getItem('sirius_token');
}

function verificarAutenticacao() {
    const token = obterToken();
    const empresaId = obterEmpresaId();
    
    if (!token || !empresaId) {
        window.location.href = 'index.html';
    }
}

function logout() {
    localStorage.removeItem('sirius_token');
    localStorage.removeItem('sirius_usuario');
    localStorage.removeItem('sirius_empresas');
    window.location.href = 'index.html';
}

function showMessage(mensagem) {
    alert(mensagem);
}

