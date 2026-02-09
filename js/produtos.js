// SIRIUS WEB - Produtos JavaScript (VERSÃO FINAL COM VALIDAÇÕES)
// API Configuration
//const API_URL = 'http://localhost:3000'; // Trocar para Vercel depois

const isDev = window.location.hostname === 'localhost' 
           || window.location.hostname === '127.0.0.1'
           || window.location.hostname === ''
           || window.location.protocol === 'file:';

const API_URL = isDev ? 'http://localhost:3000' : 'https://sirius-web-api-adonis.vercel.app';

let token = null;
let empresaId = null;
let produtoEditando = null;
let paginaAtual = 1;
let totalPaginas = 1;
let filtroAtivo = null;
let valorFiltro = '';
let ordenacaoAtual = 'codigo'; // codigo, descricao, data_criacao, ultimos

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacao();
    carregarProdutos();
});

function verificarAutenticacao() {
    token = localStorage.getItem('sirius_token');
    const empresas = JSON.parse(localStorage.getItem('sirius_empresas') || '[]');
    
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    
    if (empresas.length > 0) {
        empresaId = empresas[0].id;
    }
    
    console.log('✅ Autenticado - Token:', token ? 'OK' : 'FALTA', 'EmpresaID:', empresaId);
}

// Menu Toggle (Mobile)
function toggleMenu() {
    const toolbar = document.getElementById('toolbar');
    toolbar.classList.toggle('collapsed');
}

// Dropdown Mobile
function toggleDropdown(event, element) {
    if (window.innerWidth <= 768) {
        event.preventDefault();
        event.stopPropagation();
        element.classList.toggle('active');
    }
}

// Sistema de Abas
function mudarAba(aba) {
    console.log('Mudando para aba:', aba);
    // Remover active de todas as abas
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Ativar aba clicada
    document.querySelector(`[data-tab="${aba}"]`).classList.add('active');
    document.getElementById(`tab-${aba}`).classList.add('active');
}

// Ordenação
function aplicarOrdenacao(tipo) {
    event.preventDefault();
    ordenacaoAtual = tipo;
    
    const textos = {
        'codigo': 'Por Código',
        'descricao': 'Por Descrição',
        'data_criacao': 'Ordem de Inserção',
        'ultimos': 'Últimos Lançamentos'
    };
    
    console.log('Ordenação aplicada:', tipo);
    mostrarMensagem(`Ordenação: ${textos[tipo]}`, 'success');
    carregarProdutos(1);
}

// Carregar Produtos
async function carregarProdutos(pagina = 1) {
    try {
        mostrarLoading(true);
        
        let url = `${API_URL}/produtos?page=${pagina}&limit=20`;
        
        // Aplicar filtros com parâmetros ESPECÍFICOS
        if (filtroAtivo === 'codigo' && valorFiltro) {
            url += `&codigo=${encodeURIComponent(valorFiltro)}`;
        } else if (filtroAtivo === 'descricao' && valorFiltro) {
            url += `&descricao=${encodeURIComponent(valorFiltro)}`;
        } else if (filtroAtivo === 'ean' && valorFiltro) {
            url += `&ean=${encodeURIComponent(valorFiltro)}`;
        }
        
        console.log('🔄 Carregando produtos:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId
            }
        });
        
        const data = await response.json();
        console.log('📦 Resposta da API:', data);
        
        if (data.success) {
            let produtos = data.data;
            
            // Log para debug - mostrar estrutura do primeiro produto
            if (produtos.length > 0) {
                console.log('🔍 Estrutura do produto (primeiro item):', produtos[0]);
            }
            
            // Filtros client-side
            if (filtroAtivo === 'estoque_zero') {
                produtos = produtos.filter(p => parseFloat(p.estoque_atual || 0) === 0);
            } else if (filtroAtivo === 'estoque_baixo') {
                produtos = produtos.filter(p => 
                    p.estoque_minimo > 0 && 
                    parseFloat(p.estoque_atual || 0) < parseFloat(p.estoque_minimo || 0)
                );
            }
            
            // Ordenação client-side
            produtos = ordenarProdutos(produtos);
            
            renderizarTabela(produtos);
            atualizarPaginacao(data.pagination);
            paginaAtual = pagina;
        } else {
            mostrarMensagem(data.message || 'Erro ao carregar produtos', 'error');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar:', error);
        mostrarMensagem('Erro de conexão ao carregar produtos', 'error');
    } finally {
        mostrarLoading(false);
    }
}

function ordenarProdutos(produtos) {
    const copia = [...produtos];
    
    switch (ordenacaoAtual) {
        case 'codigo':
            return copia.sort((a, b) => a.codigo.localeCompare(b.codigo));
        case 'descricao':
            return copia.sort((a, b) => a.descricao.localeCompare(b.descricao));
        case 'data_criacao':
            return copia.sort((a, b) => a.id - b.id); // ASC
        case 'ultimos':
            return copia.sort((a, b) => b.id - a.id); // DESC
        default:
            return copia;
    }
}

function renderizarTabela(produtos) {
    const tbody = document.getElementById('tbody');
    
    if (produtos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 40px;">Nenhum produto encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = produtos.map(p => {
        const estoqueBaixo = p.estoque_minimo > 0 && parseFloat(p.estoque_atual || 0) < parseFloat(p.estoque_minimo || 0);
        const statusClass = estoqueBaixo ? 'estoque-baixo' : '';
        const statusBadge = p.ativo === 'S' ? '🟢 Ativo' : '🔴 Inativo';
        
        // Usar o campo id que vem da API
        const produtoId = p.id;
        
        // Escapar aspas na descrição
        const descricaoEscapada = (p.descricao || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        return `
            <tr class="${statusClass}">
                <td>${p.codigo}</td>
                <td>${p.descricao}</td>
                <td>${p.unidade || 'UN'}</td>
                <td>${formatarNumero(p.estoque_atual, 3)}</td>
                <td>R$ ${formatarNumero(p.preco_custo, 2)}</td>
                <td>R$ ${formatarNumero(p.preco_venda, 2)}</td>
                <td>${statusBadge}</td>
                <td style="white-space: nowrap;">
                    <button class="btn-small btn-ficha" 
                            onclick="gerarRelatorioIndividual(${produtoId})" 
                            title="Ficha Completa do Produto">📄</button>
                    <button class="btn-small btn-movimentacoes" 
                            onclick="verMovimentacoes(${produtoId})" 
                            title="Movimentações de Estoque">📊</button>
                    <button class="btn-small btn-edit" 
                            onclick="editarProduto(${produtoId})" 
                            title="Editar Produto">✏️</button>
                    <button class="btn-small btn-delete" 
                            onclick="confirmarExclusao(${produtoId}, '${descricaoEscapada}')" 
                            title="Inativar Produto">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
    
    console.log('✅ Tabela renderizada:', produtos.length, 'produtos');
}

function atualizarPaginacao(pagination) {
    if (!pagination) {
        console.warn('⚠️ Paginação não fornecida');
        return;
    }
    
    totalPaginas = pagination.totalPages;
    document.getElementById('pageInfo').textContent = `Página ${pagination.page} de ${pagination.totalPages}`;
    document.getElementById('btnPrev').disabled = !pagination.hasPrev;
    document.getElementById('btnNext').disabled = !pagination.hasNext;
    
    console.log('📄 Paginação:', pagination);
}

function mudarPagina(direcao) {
    const novaPagina = paginaAtual + direcao;
    console.log('📄 Mudando página:', paginaAtual, '→', novaPagina);
    
    if (novaPagina >= 1 && novaPagina <= totalPaginas) {
        carregarProdutos(novaPagina);
    }
}

// Filtros
async function aplicarFiltro(tipo) {
    event.preventDefault();
    
    if (tipo === 'codigo') {
        const valor = await siriusPrompt('Digite o código do produto:', '', 'Filtrar por Código');
        if (valor) {
            filtroAtivo = 'codigo';
            valorFiltro = valor;
            mostrarFiltroAtivo(`Código: ${valor}`);
            carregarProdutos(1);
        }
    } else if (tipo === 'descricao') {
        const valor = await siriusPrompt('Digite parte da descrição:', '', 'Filtrar por Descrição');
        if (valor) {
            filtroAtivo = 'descricao';
            valorFiltro = valor;
            mostrarFiltroAtivo(`Descrição contém: ${valor}`);
            carregarProdutos(1);
        }
    } else if (tipo === 'ean') {
        const valor = await siriusPrompt('Digite o código EAN/Barras:', '', 'Filtrar por EAN');
        if (valor) {
            filtroAtivo = 'ean';
            valorFiltro = valor;
            mostrarFiltroAtivo(`EAN contém: ${valor}`);
            carregarProdutos(1);
        }
    } else if (tipo === 'estoque_zero') {
        filtroAtivo = 'estoque_zero';
        valorFiltro = '';
        mostrarFiltroAtivo('Produtos com Estoque Zero');
        carregarProdutos(1);
    } else if (tipo === 'estoque_baixo') {
        filtroAtivo = 'estoque_baixo';
        valorFiltro = '';
        mostrarFiltroAtivo('Produtos com Estoque Abaixo do Mínimo');
        carregarProdutos(1);
    }
}

function mostrarFiltroAtivo(texto) {
    document.getElementById('filtroAtivo').style.display = 'flex';
    document.getElementById('textoFiltro').textContent = texto;
}

function limparFiltro() {
    filtroAtivo = null;
    valorFiltro = '';
    document.getElementById('filtroAtivo').style.display = 'none';
    carregarProdutos(1);
}

// Relatório Geral
function gerarRelatorio() {
    event.preventDefault();
    
    const tbody = document.getElementById('tbody');
    const rows = tbody.querySelectorAll('tr');
    
    if (rows.length === 0 || (rows.length === 1 && rows[0].cells.length === 1)) {
        alertSirius('Nenhum produto para gerar relatório');
        return;
    }
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Produtos - SIRIUS WEB</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #667eea; text-align: center; }
                .info { text-align: center; color: #666; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #667eea; color: white; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .estoque-baixo { background-color: #fff3cd !important; }
                @media print {
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>🏢 SIRIUS WEB - Relatório de Produtos</h1>
            <div class="info">
                <strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')} 
                <strong>Hora:</strong> ${new Date().toLocaleTimeString('pt-BR')}
            </div>
            ${filtroAtivo ? `<div class="info"><strong>Filtro:</strong> ${document.getElementById('textoFiltro').textContent}</div>` : ''}
            <table>
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Descrição</th>
                        <th>Unidade</th>
                        <th>Estoque</th>
                        <th>Preço Custo</th>
                        <th>Preço Venda</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${Array.from(rows).map(row => {
                        const cells = Array.from(row.cells);
                        if (cells.length === 1) return '';
                        const className = row.classList.contains('estoque-baixo') ? 'estoque-baixo' : '';
                        return `
                            <tr class="${className}">
                                ${cells.slice(0, 7).map(cell => `<td>${cell.textContent}</td>`).join('')}
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            <br>
            <button onclick="window.print()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">🖨️ Imprimir</button>
        </body>
        </html>
    `;
    
    const janela = window.open('', '_blank');
    janela.document.write(html);
    janela.document.close();
}

// =====================================================
// VALIDAÇÃO DE CÓDIGO DE BARRAS EAN-13
// =====================================================
function validarEAN13(codigoBarras) {
    // Remove espaços e hífens
    const ean = codigoBarras.replace(/[\s-]/g, '');
    
    // Verifica se tem 13 dígitos numéricos
    if (!/^\d{13}$/.test(ean)) {
        return { valido: false, mensagem: 'O código EAN-13 deve conter exatamente 13 dígitos numéricos.' };
    }
    
    // Calcula o dígito verificador
    const digitos = ean.split('').map(Number);
    const digitoVerificador = digitos[12];
    
    let soma = 0;
    for (let i = 0; i < 12; i++) {
        // Multiplica por 1 ou 3 alternadamente (posições ímpares por 1, pares por 3)
        soma += digitos[i] * (i % 2 === 0 ? 1 : 3);
    }
    
    const resto = soma % 10;
    const digitoCalculado = resto === 0 ? 0 : 10 - resto;
    
    if (digitoCalculado !== digitoVerificador) {
        return { 
            valido: false, 
            mensagem: `Código EAN-13 inválido! O dígito verificador correto deveria ser ${digitoCalculado}, mas foi informado ${digitoVerificador}.` 
        };
    }
    
    return { valido: true, mensagem: 'Código EAN-13 válido!' };
}

// Alert Customizado "Sirius Web informa:" (com z-index alto para aparecer sobre modal)
function alertSirius(mensagem) {
    const existente = document.getElementById('alertSirius');
    if (existente) existente.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'alertSirius';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.6);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    const box = document.createElement('div');
    box.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        max-width: 500px;
        width: 90%;
        animation: slideDown 0.3s ease-out;
    `;
    
    box.innerHTML = `
        <h3 style="color: #667eea; margin: 0 0 20px 0; font-size: 1.5em;">🏢 Sirius Web informa:</h3>
        <p style="color: #333; font-size: 1.1em; margin: 0 0 25px 0; line-height: 1.5;">${mensagem}</p>
        <button onclick="document.getElementById('alertSirius').remove()" 
                style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                       color: white; 
                       border: none; 
                       padding: 12px 30px; 
                       border-radius: 8px; 
                       cursor: pointer; 
                       font-size: 16px;
                       font-weight: bold;
                       width: 100%;">
            OK
        </button>
    `;
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    // Fechar ao clicar fora
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

// Relatório Individual do Produto (FICHA)
async function gerarRelatorioIndividual(id) {
    console.log('📄 Gerando ficha do produto ID:', id);
    
    if (!id || id === 'undefined') {
        console.error('❌ ID inválido:', id);
        alertSirius('ID do produto inválido!');
        return;
    }
    
    try {
        const url = `${API_URL}/produtos/${id}`;
        console.log('🔄 Buscando produto:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId
            }
        });
        
        console.log('📡 Response status:', response.status);
        
        const data = await response.json();
        console.log('📦 Dados recebidos:', data);
        
        if (!data.success) {
            console.error('❌ Erro na API:', data.message);
            alertSirius(data.message || 'Erro ao buscar produto');
            return;
        }
        
        const p = data.data;
        console.log('✅ Produto encontrado:', p);
        
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Ficha do Produto - ${p.descricao}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #667eea; text-align: center; }
                    .info { text-align: center; color: #666; margin-bottom: 30px; }
                    .section { margin-bottom: 30px; padding: 20px; border: 2px solid #667eea; border-radius: 10px; }
                    .section-title { color: #667eea; font-size: 1.3em; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
                    .field { margin: 10px 0; display: grid; grid-template-columns: 200px 1fr; }
                    .field strong { color: #333; }
                    @media print {
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <h1>🏢 SIRIUS WEB - Ficha do Produto</h1>
                <div class="info">
                    <strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')} 
                    <strong>Hora:</strong> ${new Date().toLocaleTimeString('pt-BR')}
                </div>
                
                <div class="section">
                    <div class="section-title">📦 Dados Básicos</div>
                    <div class="field"><strong>Código:</strong> <span>${p.codigo}</span></div>
                    <div class="field"><strong>Código de Barras (EAN):</strong> <span>${p.codigo_barras || '-'}</span></div>
                    <div class="field"><strong>Descrição:</strong> <span>${p.descricao}</span></div>
                    <div class="field"><strong>Descrição Complementar:</strong> <span>${p.descricao_complemento || '-'}</span></div>
                    <div class="field"><strong>Unidade:</strong> <span>${p.unidade}</span></div>
                    <div class="field"><strong>Preço Custo:</strong> <span>R$ ${formatarNumero(p.preco_custo, 2)}</span></div>
                    <div class="field"><strong>Preço Venda:</strong> <span>R$ ${formatarNumero(p.preco_venda, 2)}</span></div>
                    <div class="field"><strong>Status:</strong> <span>${p.ativo === 'S' ? '🟢 Ativo' : '🔴 Inativo'}</span></div>
                    <div class="field"><strong>Disponível no PDV:</strong> <span>${p.ativo_pdv ? 'Sim' : 'Não'}</span></div>
                </div>
                
                <div class="section">
                    <div class="section-title">📊 Estoque</div>
                    <div class="field"><strong>Estoque Atual:</strong> <span>${formatarNumero(p.estoque_atual, 3)}</span></div>
                    <div class="field"><strong>Estoque Mínimo:</strong> <span>${formatarNumero(p.estoque_minimo, 3)}</span></div>
                    <div class="field"><strong>Estoque Máximo:</strong> <span>${formatarNumero(p.estoque_maximo, 3)}</span></div>
                </div>
                
                <div class="section">
                    <div class="section-title">📋 Dados Fiscais (NFCe)</div>
                    <div class="field"><strong>NCM:</strong> <span>${p.ncm || '-'}</span></div>
                    <div class="field"><strong>CEST:</strong> <span>${p.cest || '-'}</span></div>
                    <div class="field"><strong>CFOP:</strong> <span>${p.cfop || '-'}</span></div>
                    <div class="field"><strong>Origem da Mercadoria:</strong> <span>${p.origem_mercadoria || '-'}</span></div>
                    <div class="field"><strong>CST ICMS:</strong> <span>${p.icms_situacao_tributaria || '-'}</span></div>
                    <div class="field"><strong>Alíquota ICMS:</strong> <span>${p.icms_aliquota || 0}%</span></div>
                    <div class="field"><strong>CST PIS:</strong> <span>${p.pis_situacao_tributaria || '-'}</span></div>
                    <div class="field"><strong>Alíquota PIS:</strong> <span>${p.pis_aliquota || 0}%</span></div>
                    <div class="field"><strong>CST COFINS:</strong> <span>${p.cofins_situacao_tributaria || '-'}</span></div>
                    <div class="field"><strong>Alíquota COFINS:</strong> <span>${p.cofins_aliquota || 0}%</span></div>
                </div>
                
                ${p.observacoes ? `
                <div class="section">
                    <div class="section-title">📝 Observações</div>
                    <p>${p.observacoes}</p>
                </div>
                ` : ''}
                
                <br>
                <button onclick="window.print()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">🖨️ Imprimir</button>
            </body>
            </html>
        `;
        
        const janela = window.open('', '_blank');
        janela.document.write(html);
        janela.document.close();
        
        console.log('✅ Relatório gerado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao gerar relatório:', error);
        alertSirius('Erro ao gerar relatório: ' + error.message);
    }
}

// Modal
function abrirModal(produto = null) {
    const modal = document.getElementById('modal');
    const modalBody = modal.querySelector('.modal-body');
    
    modal.style.display = 'block';
    document.getElementById('modalTitle').textContent = produto ? 'Editar Produto' : 'Novo Produto';
    
    // Scroll para o topo do modal
    setTimeout(() => {
        modalBody.scrollTop = 0;
    }, 50);
    
    // Ativar primeira aba
    mudarAba('basico');
    
    if (produto) {
        produtoEditando = produto;
        preencherFormulario(produto);
    } else {
        produtoEditando = null;
        document.getElementById('produtoForm').reset();
        document.getElementById('ativo').checked = true;
        document.getElementById('ativo_pdv').checked = true;
    }
}

function fecharModal() {
    document.getElementById('modal').style.display = 'none';
    produtoEditando = null;
}

function preencherFormulario(produto) {
    console.log('📝 Preenchendo formulário com:', produto);
    
    // Campos básicos
    document.getElementById('codigo').value = produto.codigo || '';
    document.getElementById('ean').value = produto.codigo_barras || '';
    document.getElementById('descricao').value = produto.descricao || '';
    document.getElementById('descricao_complemento').value = produto.descricao_complemento || '';
    document.getElementById('unidade_comercial').value = produto.unidade || '';
    document.getElementById('custo').value = produto.preco_custo || '';
    document.getElementById('valor_venda').value = produto.preco_venda || '';
    
    // Estoque
    document.getElementById('saldo').value = produto.estoque_atual || '';
    document.getElementById('estoque_minimo').value = produto.estoque_minimo || '';
    document.getElementById('estoque_maximo').value = produto.estoque_maximo || '';
    
    // Dados fiscais
    document.getElementById('ncm').value = produto.ncm || '';
    document.getElementById('cest').value = produto.cest || '';
    document.getElementById('cfop').value = produto.cfop || '';
    document.getElementById('origem').value = produto.origem_mercadoria || '';
    
    // ICMS
    document.getElementById('cst_icms').value = produto.icms_situacao_tributaria || '';
    document.getElementById('aliq_icms').value = produto.icms_aliquota || '';
    
    // PIS
    document.getElementById('cst_pis').value = produto.pis_situacao_tributaria || '';
    document.getElementById('aliq_pis').value = produto.pis_aliquota || '';
    
    // COFINS
    document.getElementById('cst_cofins').value = produto.cofins_situacao_tributaria || '';
    document.getElementById('aliq_cofins').value = produto.cofins_aliquota || '';
    
    // Configurações
    document.getElementById('ativo').checked = produto.ativo === 'S';
    document.getElementById('ativo_pdv').checked = produto.ativo_pdv || false;
    document.getElementById('observacoes').value = produto.observacoes || '';
}

// Salvar Produto (COM VALIDAÇÕES COMPLETAS)
async function salvarProduto(event) {
    event.preventDefault();
    
    // ========== VALIDAÇÕES OBRIGATÓRIAS ==========
    const codigo = document.getElementById('codigo').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    const preco_venda = document.getElementById('valor_venda').value;
    const unidade = document.getElementById('unidade_comercial').value.trim();
    const codigoBarras = document.getElementById('ean').value.trim();
    
    if (!codigo) {
        alertSirius('Por favor, informe o <strong>código</strong> do produto!');
        mudarAba('basico'); // Vai para a aba correta
        document.getElementById('codigo').focus();
        return;
    }
    
    if (!descricao) {
        alertSirius('Por favor, informe a <strong>descrição</strong> do produto!');
        mudarAba('basico');
        document.getElementById('descricao').focus();
        return;
    }
    
    if (!preco_venda || parseFloat(preco_venda) <= 0) {
        alertSirius('Por favor, informe um <strong>preço de venda</strong> válido!');
        mudarAba('basico');
        document.getElementById('valor_venda').focus();
        return;
    }
    
    if (!unidade) {
        alertSirius('Por favor, informe a <strong>unidade de medida</strong>!');
        mudarAba('basico');
        document.getElementById('unidade_comercial').focus();
        return;
    }
    
    // ========== VALIDAÇÃO DO CÓDIGO EAN-13 (SE PREENCHIDO) ==========
    if (codigoBarras) {
        const validacao = validarEAN13(codigoBarras);
        if (!validacao.valido) {
            alertSirius(validacao.mensagem);
            mudarAba('basico');
            document.getElementById('ean').focus();
            return;
        }
    }
    
    // ========== PREPARAR DADOS NO FORMATO DA API ==========
    const dados = {
        codigo: codigo,
        codigo_barras: codigoBarras || null,
        descricao: descricao,
        descricao_complemento: document.getElementById('descricao_complemento').value.trim() || null,
        unidade: unidade.toUpperCase(),
        preco_custo: parseFloat(document.getElementById('custo').value) || 0,
        preco_venda: parseFloat(preco_venda),
        estoque_atual: parseFloat(document.getElementById('saldo').value) || 0,
        estoque_minimo: parseFloat(document.getElementById('estoque_minimo').value) || 0,
        estoque_maximo: parseFloat(document.getElementById('estoque_maximo').value) || 0,
        ncm: document.getElementById('ncm').value.trim() || null,
        cest: document.getElementById('cest').value.trim() || null,
        cfop: document.getElementById('cfop').value.trim() || null,
        origem_mercadoria: document.getElementById('origem').value || null,
        icms_situacao_tributaria: document.getElementById('cst_icms').value.trim() || null,
        icms_aliquota: parseFloat(document.getElementById('aliq_icms').value) || 0,
        pis_situacao_tributaria: document.getElementById('cst_pis').value.trim() || null,
        pis_aliquota: parseFloat(document.getElementById('aliq_pis').value) || 0,
        cofins_situacao_tributaria: document.getElementById('cst_cofins').value.trim() || null,
        cofins_aliquota: parseFloat(document.getElementById('aliq_cofins').value) || 0,
        ativo: document.getElementById('ativo').checked ? 'S' : 'N',
        ativo_pdv: document.getElementById('ativo_pdv').checked,
        observacoes: document.getElementById('observacoes').value.trim() || null
    };
    
    console.log('💾 Salvando produto:', dados);
    
    try {
        const produtoId = produtoEditando ? produtoEditando.id : null;
        
        const url = produtoId 
            ? `${API_URL}/produtos/${produtoId}` 
            : `${API_URL}/produtos`;
        
        const method = produtoId ? 'PUT' : 'POST';
        
        console.log(`📤 ${method} ${url}`);
        
        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });
        
        const data = await response.json();
        console.log('📥 Resposta:', data);
        
        if (data.success) {
            mostrarMensagem(data.message, 'success');
            fecharModal();
            carregarProdutos(paginaAtual);
        } else {
            alertSirius(data.message || 'Erro ao salvar produto');
        }
    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        alertSirius('Erro de conexão ao salvar produto');
    }
}

// Editar Produto
async function editarProduto(id) {
    console.log('✏️ Editando produto ID:', id);
    
    if (!id || id === 'undefined') {
        console.error('❌ ID inválido:', id);
        alertSirius('ID do produto inválido!');
        return;
    }
    
    try {
        const url = `${API_URL}/produtos/${id}`;
        console.log('🔄 Buscando:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId
            }
        });
        
        const data = await response.json();
        console.log('📦 Dados recebidos da API:', data);
        
        if (data.success) {
            abrirModal(data.data);
        } else {
            mostrarMensagem(data.message || 'Erro ao buscar produto', 'error');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        mostrarMensagem('Erro de conexão ao buscar produto', 'error');
    }
}

// Excluir Produto
function confirmarExclusao(id, descricao) {
    const existente = document.getElementById('alertSirius');
    if (existente) existente.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'alertSirius';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.6);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    const box = document.createElement('div');
    box.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        max-width: 500px;
        width: 90%;
    `;
    
    box.innerHTML = `
        <h3 style="color: #667eea; margin: 0 0 20px 0; font-size: 1.5em;">🏢 Sirius Web informa:</h3>
        <p style="color: #333; font-size: 1.1em; margin: 0 0 25px 0; line-height: 1.5;">Deseja realmente inativar o produto:<br><strong>"${descricao}"</strong>?</p>
        <div style="display: flex; gap: 10px;">
            <button onclick="document.getElementById('alertSirius').remove()" 
                    style="background: #6c757d; 
                           color: white; 
                           border: none; 
                           padding: 12px 30px; 
                           border-radius: 8px; 
                           cursor: pointer; 
                           font-size: 16px;
                           font-weight: bold;
                           flex: 1;">
                Cancelar
            </button>
            <button onclick="document.getElementById('alertSirius').remove(); excluirProduto(${id});" 
                    style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); 
                           color: white; 
                           border: none; 
                           padding: 12px 30px; 
                           border-radius: 8px; 
                           cursor: pointer; 
                           font-size: 16px;
                           font-weight: bold;
                           flex: 1;">
                Inativar
            </button>
        </div>
    `;
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

async function excluirProduto(id) {
    try {
        const response = await fetch(`${API_URL}/produtos/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarMensagem(data.message, 'success');
            carregarProdutos(paginaAtual);
        } else {
            mostrarMensagem(data.message, 'error');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        mostrarMensagem('Erro ao excluir produto', 'error');
    }
}

// Utilidades
function mostrarLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    document.getElementById('tabelaContainer').style.display = show ? 'none' : 'block';
}

function mostrarMensagem(texto, tipo) {
    const div = document.getElementById('mensagem');
    div.textContent = texto;
    div.className = `mensagem ${tipo}`;
    div.style.display = 'block';
    
    setTimeout(() => {
        div.style.display = 'none';
    }, 5000);
    
    console.log(`📢 Mensagem (${tipo}):`, texto);
}

function formatarNumero(valor, decimais = 2) {
    if (valor === null || valor === undefined) return '0,00';
    return parseFloat(valor).toFixed(decimais).replace('.', ',');
}

// =====================================================
// NAVEGAR PARA MOVIMENTAÇÕES
// =====================================================
function verMovimentacoes(produtoId) {
    window.location.href = `produtos-movimentacoes.html?id=${produtoId}`;
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target == modal) {
        fecharModal();
    }
}

// =====================================================
// MODAL PROMPT PERSONALIZADO (Sirius Web)
// =====================================================
function siriusPrompt(mensagem, valorPadrao = '', titulo = 'Sirius Web') {
    return new Promise((resolve) => {
        const existente = document.getElementById('alertSirius');
        if (existente) existente.remove();
        
        const overlay = document.createElement('div');
        overlay.id = 'alertSirius';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.6);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const box = document.createElement('div');
        box.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            max-width: 500px;
            width: 90%;
            animation: slideDown 0.3s ease-out;
        `;
        
        const inputId = 'siriusPromptInput_' + Date.now();
        
        box.innerHTML = `
            <h3 style="color: #667eea; margin: 0 0 20px 0; font-size: 1.5em;">🏢 ${titulo}</h3>
            <p style="color: #333; font-size: 1.1em; margin: 0 0 15px 0; line-height: 1.5;">${mensagem}</p>
            <input type="text" id="${inputId}" value="${valorPadrao}" 
                   style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; 
                          font-size: 16px; margin-bottom: 20px; box-sizing: border-box;"
                   placeholder="Digite aqui...">
            <div style="display: flex; gap: 10px;">
                <button id="btnCancelar" 
                        style="background: #6c757d; 
                               color: white; 
                               border: none; 
                               padding: 12px 30px; 
                               border-radius: 8px; 
                               cursor: pointer; 
                               font-size: 16px;
                               font-weight: bold;
                               flex: 1;">
                    Cancelar
                </button>
                <button id="btnOk" 
                        style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                               color: white; 
                               border: none; 
                               padding: 12px 30px; 
                               border-radius: 8px; 
                               cursor: pointer; 
                               font-size: 16px;
                               font-weight: bold;
                               flex: 1;">
                    OK
                </button>
            </div>
        `;
        
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        
        const input = document.getElementById(inputId);
        const btnOk = document.getElementById('btnOk');
        const btnCancelar = document.getElementById('btnCancelar');
        
        // Focar e selecionar texto
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
        
        // Handler OK
        const confirmar = () => {
            const valor = input.value.trim();
            overlay.remove();
            resolve(valor || null);
        };
        
        // Handler Cancelar
        const cancelar = () => {
            overlay.remove();
            resolve(null);
        };
        
        btnOk.onclick = confirmar;
        btnCancelar.onclick = cancelar;
        
        // ENTER confirma
        input.onkeypress = (e) => {
            if (e.key === 'Enter') {
                confirmar();
            }
        };
        
        // ESC cancela
        overlay.onkeydown = (e) => {
            if (e.key === 'Escape') {
                cancelar();
            }
        };
    });
}

console.log('🚀 Produtos JS - VERSÃO FINAL COM VALIDAÇÕES ✅');
