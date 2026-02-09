// =====================================================
// SIRIUS WEB - Regimes Tributários
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
let regimesTributarios = [];
let regimesTributariosFiltrados = [];
let regimeTributarioEditando = null;
let paginaAtual = 1;
const itensPorPagina = 10;
let filtroAtivo = null;
let ordenacaoAtiva = 'nome';

// =====================================================
// INICIALIZAÇÃO
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacao();
    carregarRegimesTributarios();
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
// CARREGAR REGIMES TRIBUTÁRIOS
// =====================================================

async function carregarRegimesTributarios() {
    const token = localStorage.getItem('sirius_token');
    const loading = document.getElementById('loading');
    const tbody = document.getElementById('tbody');
    
    loading.style.display = 'block';
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px;">⏳ Carregando...</td></tr>';
    
    try {
        const response = await fetch(`${API_URL}/regimes-tributarios`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            regimesTributarios = data.data;
            regimesTributariosFiltrados = [...regimesTributarios];
            aplicarOrdenacao(ordenacaoAtiva);
            renderizarTabela();
        } else {
            mostrarMensagem(data.message || 'Erro ao carregar regimes tributários', 'erro');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro ao conectar com o servidor', 'erro');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px; color: #ef4444;">❌ Erro ao carregar dados</td></tr>';
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
    const itensPagina = regimesTributariosFiltrados.slice(inicio, fim);
    
    if (itensPagina.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px;">Nenhum regime tributário encontrado</td></tr>';
        atualizarPaginacao();
        return;
    }
    
    tbody.innerHTML = itensPagina.map(rt => `
        <tr>
            <td>${rt.id_rt}</td>
            <td><strong>${rt.nome}</strong></td>
            <td>${rt.descricao || '-'}</td>
            <td>
                <button class="btn-icon" onclick="visualizarRegimeTributario(${rt.id_rt})" title="Visualizar">👁️</button>
                <button class="btn-icon" onclick="editarRegimeTributario(${rt.id_rt})" title="Editar">✏️</button>
                <button class="btn-icon btn-danger" onclick="confirmarExclusao(${rt.id_rt})" title="Excluir">🗑️</button>
            </td>
        </tr>
    `).join('');
    
    atualizarPaginacao();
}

// =====================================================
// PAGINAÇÃO
// =====================================================

function atualizarPaginacao() {
    const totalPaginas = Math.ceil(regimesTributariosFiltrados.length / itensPorPagina);
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const pageInfo = document.getElementById('pageInfo');
    
    pageInfo.textContent = `Página ${paginaAtual} de ${totalPaginas || 1}`;
    btnPrev.disabled = paginaAtual === 1;
    btnNext.disabled = paginaAtual >= totalPaginas;
}

function mudarPagina(direcao) {
    const totalPaginas = Math.ceil(regimesTributariosFiltrados.length / itensPorPagina);
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
    
    if (tipo === 'nome') {
        termo = await mostrarPromptPersonalizado('Digite o nome para filtrar:');
    } else if (tipo === 'id') {
        termo = await mostrarPromptPersonalizado('Digite o ID para filtrar:');
    }
    
    if (!termo) return;
    
    filtroAtivo = { tipo, termo };
    
    regimesTributariosFiltrados = regimesTributarios.filter(rt => {
        if (tipo === 'nome') {
            return rt.nome.toLowerCase().includes(termo.toLowerCase());
        } else if (tipo === 'id') {
            return rt.id_rt.toString() === termo;
        }
        return true;
    });
    
    paginaAtual = 1;
    renderizarTabela();
    mostrarFiltroAtivo(tipo, termo);
}

function limparFiltro() {
    filtroAtivo = null;
    regimesTributariosFiltrados = [...regimesTributarios];
    aplicarOrdenacao(ordenacaoAtiva);
    paginaAtual = 1;
    renderizarTabela();
    document.getElementById('filtroAtivo').style.display = 'none';
}

function mostrarFiltroAtivo(tipo, termo) {
    const filtroAtivo = document.getElementById('filtroAtivo');
    const textoFiltro = document.getElementById('textoFiltro');
    
    const tipoTexto = tipo === 'nome' ? 'Nome' : 'ID';
    textoFiltro.textContent = `${tipoTexto}: "${termo}"`;
    filtroAtivo.style.display = 'flex';
}

function aplicarOrdenacao(tipo) {
    ordenacaoAtiva = tipo;
    
    regimesTributariosFiltrados.sort((a, b) => {
        if (tipo === 'nome') {
            return a.nome.localeCompare(b.nome);
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
    regimeTributarioEditando = null;
    document.getElementById('modalTitle').textContent = 'Novo Regime Tributário';
    document.getElementById('regimeTributarioForm').reset();
    document.getElementById('modal').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('modal').style.display = 'none';
}

// =====================================================
// SALVAR REGIME TRIBUTÁRIO
// =====================================================

async function salvarRegimeTributario(event) {
    event.preventDefault();
    
    const token = localStorage.getItem('sirius_token');
    
    const dados = {
        nome: document.getElementById('nome').value.trim(),
        descricao: document.getElementById('descricao').value.trim()
    };
    
    try {
        const url = regimeTributarioEditando 
            ? `${API_URL}/regimes-tributarios/${regimeTributarioEditando}` 
            : `${API_URL}/regimes-tributarios`;
        
        const method = regimeTributarioEditando ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dados)
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarMensagem(data.message, 'sucesso');
            fecharModal();
            carregarRegimesTributarios();
        } else {
            mostrarMensagem(data.message || 'Erro ao salvar regime tributário', 'erro');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro ao conectar com o servidor', 'erro');
    }
}

// =====================================================
// EDITAR REGIME TRIBUTÁRIO
// =====================================================

async function editarRegimeTributario(id) {
    const token = localStorage.getItem('sirius_token');
    
    try {
        const response = await fetch(`${API_URL}/regimes-tributarios/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const rt = data.data;
            regimeTributarioEditando = id;
            
            document.getElementById('modalTitle').textContent = 'Editar Regime Tributário';
            document.getElementById('nome').value = rt.nome;
            document.getElementById('descricao').value = rt.descricao || '';
            
            document.getElementById('modal').style.display = 'flex';
        } else {
            mostrarMensagem(data.message || 'Erro ao buscar regime tributário', 'erro');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro ao conectar com o servidor', 'erro');
    }
}

// =====================================================
// VISUALIZAR REGIME TRIBUTÁRIO
// =====================================================

async function visualizarRegimeTributario(id) {
    const token = localStorage.getItem('sirius_token');
    
    try {
        const response = await fetch(`${API_URL}/regimes-tributarios/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const rt = data.data;
            
            const detalhesHTML = `
                <div class="detalhes-grid">
                    <div class="detalhe-item">
                        <strong>ID:</strong>
                        <span>${rt.id_rt}</span>
                    </div>
                    <div class="detalhe-item">
                        <strong>Nome:</strong>
                        <span>${rt.nome}</span>
                    </div>
                    <div class="detalhe-item" style="grid-column: 1 / -1;">
                        <strong>Descrição:</strong>
                        <span>${rt.descricao || 'Não informada'}</span>
                    </div>
                    <div class="detalhe-item">
                        <strong>Criado em:</strong>
                        <span>${new Date(rt.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                </div>
            `;
            
            document.getElementById('detalhesConteudo').innerHTML = detalhesHTML;
            document.getElementById('modalDetalhes').style.display = 'flex';
        } else {
            mostrarMensagem(data.message || 'Erro ao buscar regime tributário', 'erro');
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
// EXCLUIR REGIME TRIBUTÁRIO
// =====================================================

let idRegimeTributarioExcluir = null;

function confirmarExclusao(id) {
    idRegimeTributarioExcluir = id;
    const regimeTributario = regimesTributarios.find(rt => rt.id_rt === id);
    
    mostrarModalConfirmacao(
        `Deseja realmente excluir o regime tributário "${regimeTributario.nome}"?`,
        excluirRegimeTributario
    );
}

async function excluirRegimeTributario() {
    const token = localStorage.getItem('sirius_token');
    
    try {
        const response = await fetch(`${API_URL}/regimes-tributarios/${idRegimeTributarioExcluir}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarMensagem(data.message, 'sucesso');
            fecharModalConfirmacao();
            carregarRegimesTributarios();
        } else {
            mostrarMensagem(data.message || 'Erro ao excluir regime tributário', 'erro');
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

console.log('✅ Módulo Regimes Tributários carregado');
