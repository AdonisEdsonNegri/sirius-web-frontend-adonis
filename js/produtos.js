// =====================================================
// SIRIUS WEB - Produtos JavaScript
// VERSÃO CORRIGIDA - ORDENAÇÃO FUNCIONANDO
// =====================================================

// Detecta ambiente
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

// =====================================================
// INICIALIZAÇÃO
// =====================================================
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

// =====================================================
// MENU TOGGLE E DROPDOWN (MOBILE)
// =====================================================
function toggleMenu() {
    const toolbar = document.getElementById('toolbar');
    toolbar.classList.toggle('collapsed');
}

function toggleDropdown(event, element) {
    if (window.innerWidth <= 768) {
        event.preventDefault();
        event.stopPropagation();
        element.classList.toggle('active');
    }
}

// =====================================================
// SISTEMA DE ABAS
// =====================================================
function mudarAba(aba) {
    console.log('Mudando para aba:', aba);
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${aba}"]`).classList.add('active');
    document.getElementById(`tab-${aba}`).classList.add('active');
}

// =====================================================
// ORDENAÇÃO ✅ CORRIGIDA - ENVIA PARÂMETROS PARA BACKEND
// =====================================================
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

// =====================================================
// CARREGAR PRODUTOS ✅ CORRIGIDO - ADICIONA PARÂMETROS DE ORDENAÇÃO
// =====================================================
async function carregarProdutos(pagina = 1) {
    try {
        mostrarLoading(true);
        
        let url = `${API_URL}/produtos?page=${pagina}&limit=20`;
        
        // ✅ CORREÇÃO: Adicionar parâmetros de ordenação para o backend
        let orderBy = 'codigo';
        let orderDir = 'ASC';
        
        switch (ordenacaoAtual) {
            case 'codigo':
                orderBy = 'codigo';
                orderDir = 'ASC';
                break;
            case 'descricao':
                orderBy = 'descricao';
                orderDir = 'ASC';
                break;
            case 'data_criacao':
                orderBy = 'id_produto';
                orderDir = 'ASC';
                break;
            case 'ultimos':
                orderBy = 'id_produto';
                orderDir = 'DESC';  // ✅ DESC para últimos lançamentos
                break;
        }
        
        url += `&orderBy=${orderBy}&orderDir=${orderDir}`;
        
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
            
            if (produtos.length > 0) {
                console.log('🔍 Estrutura do produto (primeiro item):', produtos[0]);
            }
            
            // Filtros client-side (apenas para estoque_zero e estoque_baixo)
            if (filtroAtivo === 'estoque_zero') {
                produtos = produtos.filter(p => parseFloat(p.estoque_atual || 0) === 0);
            } else if (filtroAtivo === 'estoque_baixo') {
                produtos = produtos.filter(p => 
                    p.estoque_minimo > 0 && 
                    parseFloat(p.estoque_atual || 0) < parseFloat(p.estoque_minimo || 0)
                );
            }
            
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

// =====================================================
// RENDERIZAR TABELA
// =====================================================
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
        
        return `
            <tr class="${statusClass}">
                <td>${p.codigo || '-'}</td>
                <td>${p.descricao || '-'}</td>
                <td>${p.unidade || '-'}</td>
                <td>${parseFloat(p.estoque_atual || 0).toFixed(3)}</td>
                <td>R$ ${parseFloat(p.preco_custo || 0).toFixed(2)}</td>
                <td>R$ ${parseFloat(p.preco_venda || 0).toFixed(2)}</td>
                <td>${statusBadge}</td>
                <td style="white-space: nowrap;">
                    <button class="btn-small btn-edit" onclick="editarProduto(${p.id})" title="Editar">✏️</button>
                    <button class="btn-small btn-movimentacoes" onclick="window.location.href='produtos-movimentacoes.html?id=${p.id}'" title="Movimentações">📊</button>
                    <button class="btn-small btn-delete" onclick="confirmarExclusao(${p.id}, '${p.descricao.replace(/'/g, "\\'")})" title="Inativar">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
    
    console.log('✅ Tabela renderizada:', produtos.length, 'produtos');
}

// =====================================================
// PAGINAÇÃO
// =====================================================
function atualizarPaginacao(pagination) {
    totalPaginas = pagination.totalPages;
    document.getElementById('paginaInfo').textContent = 
        `Página ${pagination.page} de ${pagination.totalPages}`;
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

// =====================================================
// FILTROS
// =====================================================
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

// =====================================================
// RELATÓRIO GERAL
// =====================================================
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
// MODAL - ABRIR/FECHAR
// =====================================================
function abrirModal(produto = null) {
    const modal = document.getElementById('modal');
    const modalBody = modal.querySelector('.modal-body');
    
    modal.style.display = 'block';
    document.getElementById('modalTitle').textContent = produto ? 'Editar Produto' : 'Novo Produto';
    
    setTimeout(() => {
        modalBody.scrollTop = 0;
    }, 50);
    
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

// =====================================================
// PREENCHER FORMULÁRIO
// =====================================================
function preencherFormulario(produto) {
    console.log('📝 Preenchendo formulário com:', produto);
    
    // Helper function null-safe
    const preencherCampo = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.value = valor || '';
    };
    
    const preencherCheckbox = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.checked = valor || false;
    };
    
    // Campos básicos
    preencherCampo('codigo', produto.codigo);
    preencherCampo('ean', produto.codigo_barras);
    preencherCampo('descricao', produto.descricao);
    preencherCampo('descricao_complemento', produto.descricao_complemento);
    preencherCampo('unidade_comercial', produto.unidade);
    preencherCampo('custo', produto.preco_custo);
    preencherCampo('valor_venda', produto.preco_venda);
    
    // Estoque (saldo é readonly)
    preencherCampo('saldo', produto.estoque_atual);
    preencherCampo('estoque_minimo', produto.estoque_minimo);
    preencherCampo('estoque_maximo', produto.estoque_maximo);
    
    // Dados fiscais (null-safe)
    preencherCampo('ncm', produto.ncm);
    preencherCampo('cest', produto.cest);
    preencherCampo('cfop', produto.cfop);
    
    const origemEl = document.getElementById('origem');
    if (origemEl) origemEl.value = produto.origem_mercadoria || '';
    
    preencherCampo('cst_icms', produto.icms_situacao_tributaria);
    preencherCampo('aliq_icms', produto.icms_aliquota);
    preencherCampo('cst_pis', produto.pis_situacao_tributaria);
    preencherCampo('aliq_pis', produto.pis_aliquota);
    preencherCampo('cst_cofins', produto.cofins_situacao_tributaria);
    preencherCampo('aliq_cofins', produto.cofins_aliquota);
    
    // Configurações
    preencherCheckbox('ativo', produto.ativo === 'S');
    preencherCheckbox('ativo_pdv', produto.ativo_pdv);
}

// =====================================================
// SALVAR PRODUTO
// =====================================================
async function salvarProduto(event) {
    event.preventDefault();
    
    const codigo = document.getElementById('codigo').value.trim();
    const codigoBarras = document.getElementById('ean').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    const unidade = document.getElementById('unidade_comercial').value;
    const preco_venda = document.getElementById('valor_venda').value;
    
    // Validações
    if (!codigo) {
        alertSirius('Por favor, informe o <strong>código</strong> do produto!');
        mudarAba('basico');
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
    
    // Validação EAN-13
    if (codigoBarras) {
        const validacao = validarEAN13(codigoBarras);
        if (!validacao.valido) {
            alertSirius(validacao.mensagem);
            mudarAba('basico');
            document.getElementById('ean').focus();
            return;
        }
    }
    
    // Preparar dados (null-safe)
    const dados = {
        codigo: codigo,
        codigo_barras: codigoBarras || null,
        descricao: descricao,
        descricao_complemento: document.getElementById('descricao_complemento').value.trim() || null,
        unidade: unidade.toUpperCase(),
        preco_custo: parseFloat(document.getElementById('custo').value) || 0,
        preco_venda: parseFloat(preco_venda),
        // estoque_atual NÃO enviado (readonly)
        estoque_minimo: parseFloat(document.getElementById('estoque_minimo').value) || 0,
        estoque_maximo: parseFloat(document.getElementById('estoque_maximo').value) || 0
    };
    
    // Campos fiscais null-safe
    const ncmEl = document.getElementById('ncm');
    if (ncmEl && ncmEl.value.trim()) dados.ncm = ncmEl.value.trim();
    
    const cestEl = document.getElementById('cest');
    if (cestEl && cestEl.value.trim()) dados.cest = cestEl.value.trim();
    
    const cfopEl = document.getElementById('cfop');
    if (cfopEl && cfopEl.value.trim()) dados.cfop = cfopEl.value.trim();
    
    const origemEl = document.getElementById('origem');
    if (origemEl && origemEl.value) dados.origem_mercadoria = origemEl.value;
    
    const cstIcmsEl = document.getElementById('cst_icms');
    if (cstIcmsEl && cstIcmsEl.value.trim()) dados.icms_situacao_tributaria = cstIcmsEl.value.trim();
    
    const aliqIcmsEl = document.getElementById('aliq_icms');
    if (aliqIcmsEl && aliqIcmsEl.value) dados.icms_aliquota = parseFloat(aliqIcmsEl.value) || 0;
    
    const cstPisEl = document.getElementById('cst_pis');
    if (cstPisEl && cstPisEl.value.trim()) dados.pis_situacao_tributaria = cstPisEl.value.trim();
    
    const aliqPisEl = document.getElementById('aliq_pis');
    if (aliqPisEl && aliqPisEl.value) dados.pis_aliquota = parseFloat(aliqPisEl.value) || 0;
    
    const cstCofinsEl = document.getElementById('cst_cofins');
    if (cstCofinsEl && cstCofinsEl.value.trim()) dados.cofins_situacao_tributaria = cstCofinsEl.value.trim();
    
    const aliqCofinsEl = document.getElementById('aliq_cofins');
    if (aliqCofinsEl && aliqCofinsEl.value) dados.cofins_aliquota = parseFloat(aliqCofinsEl.value) || 0;
    
    const ativoEl = document.getElementById('ativo');
    dados.ativo = ativoEl && ativoEl.checked ? 'S' : 'N';
    
    const ativoPdvEl = document.getElementById('ativo_pdv');
    dados.ativo_pdv = ativoPdvEl ? ativoPdvEl.checked : false;
    
    console.log('💾 Salvando produto:', dados);
    
    try {
        const produtoId = produtoEditando ? produtoEditando.id : null;
        const url = produtoId ? `${API_URL}/produtos/${produtoId}` : `${API_URL}/produtos`;
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

// =====================================================
// EDITAR PRODUTO
// =====================================================
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

// =====================================================
// EXCLUIR PRODUTO (INATIVAR)
// =====================================================
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

// =====================================================
// VALIDAÇÃO EAN-13
// =====================================================
function validarEAN13(codigoBarras) {
    const ean = codigoBarras.replace(/[\s-]/g, '');
    
    if (!/^\d{13}$/.test(ean)) {
        return { valido: false, mensagem: 'O código EAN-13 deve conter exatamente 13 dígitos numéricos.' };
    }
    
    const digitos = ean.split('').map(Number);
    const digitoVerificador = digitos[12];
    
    let soma = 0;
    for (let i = 0; i < 12; i++) {
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

// =====================================================
// UTILITÁRIOS
// =====================================================
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

// Alert customizado
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
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

// Prompt customizado
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
        `;
        
        const inputId = 'siriusPromptInput';
        
        box.innerHTML = `
            <h3 style="color: #667eea; margin: 0 0 15px 0; font-size: 1.5em;">🏢 ${titulo}</h3>
            <p style="color: #333; font-size: 1.1em; margin: 0 0 15px 0; line-height: 1.5;">${mensagem}</p>
            <input type="text" id="${inputId}" value="${valorPadrao}" 
                   style="width: 100%; 
                          padding: 12px; 
                          border: 2px solid #ddd; 
                          border-radius: 8px; 
                          font-size: 16px;
                          margin-bottom: 20px;">
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
        
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
        
        const confirmar = () => {
            const valor = input.value.trim();
            overlay.remove();
            resolve(valor || null);
        };
        
        const cancelar = () => {
            overlay.remove();
            resolve(null);
        };
        
        btnOk.onclick = confirmar;
        btnCancelar.onclick = cancelar;
        
        input.onkeypress = (e) => {
            if (e.key === 'Enter') {
                confirmar();
            }
        };
        
        overlay.onkeydown = (e) => {
            if (e.key === 'Escape') {
                cancelar();
            }
        };
    });
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target == modal) {
        fecharModal();
    }
}

console.log('🚀 Produtos JS - VERSÃO CORRIGIDA COM ORDENAÇÃO FUNCIONANDO ✅');
