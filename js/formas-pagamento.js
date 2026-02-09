// =====================================================
// SIRIUS WEB - Formas de Pagamento
// =====================================================

// Detecta se está em desenvolvimento (local) ou produção (Vercel)
const isDev = window.location.hostname === 'localhost' 
           || window.location.hostname === '127.0.0.1'
           || window.location.hostname === ''
           || window.location.protocol === 'file:';

// Configuração da API (automática: local em dev, Vercel em produção)
const API_URL = isDev ? 'http://localhost:3000' : 'https://sirius-web-api-adonis.vercel.app';

console.log('🔍 Ambiente:', isDev ? 'DESENVOLVIMENTO' : 'PRODUÇÃO');
console.log('📡 API URL:', API_URL);

// Estado da aplicação
let formasPagamento = [];
let formasPagamentoFiltradas = [];
let formaPagamentoEditando = null;
let paginaAtual = 1;
const itensPorPagina = 10;
let filtroAtivo = null;
let ordenacaoAtiva = 'codigo';

// =====================================================
// INICIALIZAÇÃO
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacao();
    carregarFormasPagamento();
});

function verificarAutenticacao() {
    const token = localStorage.getItem('sirius_token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
}

// =====================================================
// MENU TOGGLE MOBILE
// =====================================================

function toggleMenu() {
    const toolbar = document.getElementById('toolbar');
    toolbar.classList.toggle('active');
}

// =====================================================
// DROPDOWN
// =====================================================

function toggleDropdown(event, element) {
    event.stopPropagation();
    const dropdown = element.querySelector('.dropdown-content');
    const allDropdowns = document.querySelectorAll('.dropdown-content');
    
    allDropdowns.forEach(d => {
        if (d !== dropdown) {
            d.style.display = 'none';
        }
    });
    
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

document.addEventListener('click', (event) => {
    if (!event.target.closest('.dropdown')) {
        const allDropdowns = document.querySelectorAll('.dropdown-content');
        allDropdowns.forEach(d => d.style.display = 'none');
    }
});

// =====================================================
// CARREGAR FORMAS DE PAGAMENTO
// =====================================================

async function carregarFormasPagamento() {
    const token = localStorage.getItem('sirius_token');
    const empresas = JSON.parse(localStorage.getItem('sirius_empresas') || '[]');
    const idEmpresa = empresas[0]?.id;
    const loading = document.getElementById('loading');
    const tbody = document.getElementById('tbody');
    
    loading.style.display = 'block';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px;">⏳ Carregando...</td></tr>';
    
    try {
        const response = await fetch(`${API_URL}/formas-pagamento`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': idEmpresa
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            formasPagamento = data.data;
            formasPagamentoFiltradas = [...formasPagamento];
            aplicarOrdenacao(ordenacaoAtiva);
            renderizarTabela();
        } else {
            mostrarMensagem(data.message || 'Erro ao carregar formas de pagamento', 'erro');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro ao conectar com o servidor', 'erro');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color: #ef4444;">❌ Erro ao carregar dados</td></tr>';
    } finally {
        loading.style.display = 'none';
    }
}

// =====================================================
// RENDERIZAR TABELA
// =====================================================

function renderizarTabela() {
    const tbody = document.getElementById('tbody');
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const itensPagina = formasPagamentoFiltradas.slice(inicio, fim);
    
    if (itensPagina.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px;">Nenhuma forma de pagamento encontrada</td></tr>';
        atualizarPaginacao();
        return;
    }
    
    tbody.innerHTML = itensPagina.map(fp => `
        <tr>
            <td>${fp.id_forma_pagamento}</td>
            <td><strong>${fp.codigo}</strong></td>
            <td>${fp.descricao}</td>
            <td>${fp.permite_troco ? '✓ Sim' : '✗ Não'}</td>
            <td>
                <span class="badge ${fp.ativo ? 'badge-ativo' : 'badge-inativo'}">
                    ${fp.ativo ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td>
                <button class="btn-icon" onclick="visualizarFormaPagamento(${fp.id_forma_pagamento})" title="Visualizar">👁️</button>
                <button class="btn-icon" onclick="editarFormaPagamento(${fp.id_forma_pagamento})" title="Editar">✏️</button>
                <button class="btn-icon btn-danger" onclick="confirmarExclusao(${fp.id_forma_pagamento})" title="Excluir">🗑️</button>
            </td>
        </tr>
    `).join('');
    
    atualizarPaginacao();
}

// =====================================================
// PAGINAÇÃO
// =====================================================

function atualizarPaginacao() {
    const totalPaginas = Math.ceil(formasPagamentoFiltradas.length / itensPorPagina);
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const pageInfo = document.getElementById('pageInfo');
    
    pageInfo.textContent = `Página ${paginaAtual} de ${totalPaginas || 1}`;
    btnPrev.disabled = paginaAtual === 1;
    btnNext.disabled = paginaAtual >= totalPaginas;
}

function mudarPagina(direcao) {
    const totalPaginas = Math.ceil(formasPagamentoFiltradas.length / itensPorPagina);
    paginaAtual += direcao;
    
    if (paginaAtual < 1) paginaAtual = 1;
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
    
    renderizarTabela();
}

// =====================================================
// FILTROS E ORDENAÇÃO
// =====================================================

async function aplicarFiltro(tipo) {
    let termo;
    
    if (tipo === 'descricao') {
        termo = await mostrarPromptPersonalizado('Digite a descrição para filtrar:');
    } else if (tipo === 'codigo') {
        termo = await mostrarPromptPersonalizado('Digite o código para filtrar:');
    }
    
    if (!termo) return;
    
    filtroAtivo = { tipo, termo };
    
    formasPagamentoFiltradas = formasPagamento.filter(fp => {
        if (tipo === 'descricao') {
            return fp.descricao.toLowerCase().includes(termo.toLowerCase());
        } else if (tipo === 'codigo') {
            return fp.codigo.toLowerCase().includes(termo.toLowerCase());
        }
        return true;
    });
    
    paginaAtual = 1;
    renderizarTabela();
    mostrarFiltroAtivo(tipo, termo);
}

function limparFiltro() {
    filtroAtivo = null;
    formasPagamentoFiltradas = [...formasPagamento];
    aplicarOrdenacao(ordenacaoAtiva);
    paginaAtual = 1;
    renderizarTabela();
    document.getElementById('filtroAtivo').style.display = 'none';
}

function mostrarFiltroAtivo(tipo, termo) {
    const filtroAtivo = document.getElementById('filtroAtivo');
    const textoFiltro = document.getElementById('textoFiltro');
    
    const tipoTexto = tipo === 'descricao' ? 'Descrição' : 'Código';
    textoFiltro.textContent = `${tipoTexto}: "${termo}"`;
    filtroAtivo.style.display = 'flex';
}

function aplicarOrdenacao(tipo) {
    ordenacaoAtiva = tipo;
    
    formasPagamentoFiltradas.sort((a, b) => {
        if (tipo === 'codigo') {
            return a.codigo.localeCompare(b.codigo);
        } else if (tipo === 'descricao') {
            return a.descricao.localeCompare(b.descricao);
        } else if (tipo === 'data_criacao') {
            return new Date(a.created_at) - new Date(b.created_at);
        } else if (tipo === 'ultimos') {
            return new Date(b.created_at) - new Date(a.created_at);
        }
        return 0;
    });
    
    paginaAtual = 1;
    renderizarTabela();
}

// =====================================================
// MODAL
// =====================================================

function abrirModal() {
    formaPagamentoEditando = null;
    document.getElementById('modalTitle').textContent = 'Nova Forma de Pagamento';
    document.getElementById('formaPagamentoForm').reset();
    document.getElementById('modal').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('modal').style.display = 'none';
}

// =====================================================
// SALVAR FORMA DE PAGAMENTO
// =====================================================

async function salvarFormaPagamento(event) {
    event.preventDefault();
    
    const token = localStorage.getItem('sirius_token');
    const empresas = JSON.parse(localStorage.getItem('sirius_empresas') || '[]');
    const idEmpresa = empresas[0]?.id;
    
    const dados = {
        codigo: document.getElementById('codigo').value.trim(),
        descricao: document.getElementById('descricao').value.trim(),
        permite_troco: document.getElementById('permite_troco').checked,
        ativo: document.getElementById('ativo').checked
    };
    
    try {
        const url = formaPagamentoEditando 
            ? `${API_URL}/formas-pagamento/${formaPagamentoEditando}` 
            : `${API_URL}/formas-pagamento`;
        
        const method = formaPagamentoEditando ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': idEmpresa
            },
            body: JSON.stringify(dados)
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarMensagem(data.message, 'sucesso');
            fecharModal();
            carregarFormasPagamento();
        } else {
            mostrarMensagem(data.message || 'Erro ao salvar forma de pagamento', 'erro');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro ao conectar com o servidor', 'erro');
    }
}

// =====================================================
// EDITAR FORMA DE PAGAMENTO
// =====================================================

async function editarFormaPagamento(id) {
    const token = localStorage.getItem('sirius_token');
    const empresas = JSON.parse(localStorage.getItem('sirius_empresas') || '[]');
    const idEmpresa = empresas[0]?.id;
    
    try {
        const response = await fetch(`${API_URL}/formas-pagamento/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': idEmpresa
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const fp = data.data;
            formaPagamentoEditando = id;
            
            document.getElementById('modalTitle').textContent = 'Editar Forma de Pagamento';
            document.getElementById('codigo').value = fp.codigo;
            document.getElementById('descricao').value = fp.descricao;
            document.getElementById('permite_troco').checked = fp.permite_troco;
            document.getElementById('ativo').checked = fp.ativo;
            
            document.getElementById('modal').style.display = 'flex';
        } else {
            mostrarMensagem(data.message || 'Erro ao buscar forma de pagamento', 'erro');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro ao conectar com o servidor', 'erro');
    }
}

// =====================================================
// VISUALIZAR FORMA DE PAGAMENTO
// =====================================================

async function visualizarFormaPagamento(id) {
    const token = localStorage.getItem('sirius_token');
    const empresas = JSON.parse(localStorage.getItem('sirius_empresas') || '[]');
    const idEmpresa = empresas[0]?.id;
    
    try {
        const response = await fetch(`${API_URL}/formas-pagamento/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': idEmpresa
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const fp = data.data;
            
            const detalhesHTML = `
                <div class="detalhes-grid">
                    <div class="detalhe-item">
                        <strong>ID:</strong>
                        <span>${fp.id_forma_pagamento}</span>
                    </div>
                    <div class="detalhe-item">
                        <strong>Código:</strong>
                        <span>${fp.codigo}</span>
                    </div>
                    <div class="detalhe-item">
                        <strong>Descrição:</strong>
                        <span>${fp.descricao}</span>
                    </div>
                    <div class="detalhe-item">
                        <strong>Permite Troco:</strong>
                        <span>${fp.permite_troco ? 'Sim' : 'Não'}</span>
                    </div>
                    <div class="detalhe-item">
                        <strong>Status:</strong>
                        <span class="badge ${fp.ativo ? 'badge-ativo' : 'badge-inativo'}">
                            ${fp.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                    </div>
                    <div class="detalhe-item">
                        <strong>Criado em:</strong>
                        <span>${new Date(fp.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                </div>
            `;
            
            document.getElementById('detalhesConteudo').innerHTML = detalhesHTML;
            document.getElementById('modalDetalhes').style.display = 'flex';
        } else {
            mostrarMensagem(data.message || 'Erro ao buscar forma de pagamento', 'erro');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro ao conectar com o servidor', 'erro');
    }
}

function fecharModalDetalhes() {
    document.getElementById('modalDetalhes').style.display = 'none';
}

function imprimirDetalhes() {
    window.print();
}

// =====================================================
// EXCLUIR FORMA DE PAGAMENTO
// =====================================================

let idFormaPagamentoExcluir = null;

function confirmarExclusao(id) {
    idFormaPagamentoExcluir = id;
    const formaPagamento = formasPagamento.find(fp => fp.id_forma_pagamento === id);
    
    mostrarModalConfirmacao(
        `Deseja realmente excluir a forma de pagamento "${formaPagamento.descricao}"?`,
        excluirFormaPagamento
    );
}

async function excluirFormaPagamento() {
    const token = localStorage.getItem('sirius_token');
    const empresas = JSON.parse(localStorage.getItem('sirius_empresas') || '[]');
    const idEmpresa = empresas[0]?.id;
    
    try {
        const response = await fetch(`${API_URL}/formas-pagamento/${idFormaPagamentoExcluir}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': idEmpresa
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarMensagem(data.message, 'sucesso');
            fecharModalConfirmacao();
            carregarFormasPagamento();
        } else {
            mostrarMensagem(data.message || 'Erro ao excluir forma de pagamento', 'erro');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro ao conectar com o servidor', 'erro');
    }
}

// =====================================================
// MODAL DE CONFIRMAÇÃO PERSONALIZADO
// =====================================================

function mostrarModalConfirmacao(mensagem, callback) {
    document.getElementById('mensagemConfirmacao').textContent = mensagem;
    document.getElementById('modalConfirmacao').style.display = 'flex';
    
    const btnConfirmar = document.getElementById('btnConfirmar');
    btnConfirmar.onclick = callback;
}

function fecharModalConfirmacao() {
    document.getElementById('modalConfirmacao').style.display = 'none';
}

// =====================================================
// MODAL DE INPUT PERSONALIZADO
// =====================================================

function mostrarPromptPersonalizado(mensagem) {
    return new Promise((resolve) => {
        document.getElementById('mensagemInput').textContent = mensagem;
        document.getElementById('inputValor').value = '';
        document.getElementById('modalInput').style.display = 'flex';
        
        // Focar no input
        setTimeout(() => {
            document.getElementById('inputValor').focus();
        }, 100);
        
        const btnConfirmar = document.getElementById('btnConfirmarInput');
        const inputValor = document.getElementById('inputValor');
        
        // Remover listeners antigos
        const novoBtn = btnConfirmar.cloneNode(true);
        btnConfirmar.parentNode.replaceChild(novoBtn, btnConfirmar);
        
        // Adicionar novo listener
        novoBtn.onclick = () => {
            const valor = inputValor.value.trim();
            fecharModalInput();
            resolve(valor || null);
        };
        
        // Enter para confirmar
        inputValor.onkeypress = (e) => {
            if (e.key === 'Enter') {
                const valor = inputValor.value.trim();
                fecharModalInput();
                resolve(valor || null);
            }
        };
    });
}

function fecharModalInput() {
    document.getElementById('modalInput').style.display = 'none';
}

// =====================================================
// MENSAGENS
// =====================================================

function mostrarMensagem(texto, tipo) {
    const mensagem = document.getElementById('mensagem');
    mensagem.textContent = texto;
    mensagem.className = `mensagem ${tipo}`;
    mensagem.style.display = 'block';
    
    setTimeout(() => {
        mensagem.style.display = 'none';
    }, 5000);
}

// =====================================================
// RELATÓRIO
// =====================================================

function gerarRelatorio() {
    window.print();
}

// =====================================================
// FECHAR MODAIS AO CLICAR FORA
// =====================================================

window.onclick = function(event) {
    const modal = document.getElementById('modal');
    const modalDetalhes = document.getElementById('modalDetalhes');
    const modalConfirmacao = document.getElementById('modalConfirmacao');
    
    if (event.target === modal) {
        fecharModal();
    }
    if (event.target === modalDetalhes) {
        fecharModalDetalhes();
    }
    if (event.target === modalConfirmacao) {
        fecharModalConfirmacao();
    }
}

console.log('✅ Módulo Formas de Pagamento carregado');
