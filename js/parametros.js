// =====================================================
// SIRIUS WEB - Parâmetros JavaScript
// =====================================================

// ===== CONFIGURAÇÃO =====
const isDev = window.location.hostname === 'localhost' 
           || window.location.hostname === '127.0.0.1'
           || window.location.hostname === ''
           || window.location.protocol === 'file:';

const API_URL = isDev ? 'http://localhost:3000' : 'https://sirius-web-api-adonis.vercel.app';

console.log('📍 Ambiente:', isDev ? 'DESENVOLVIMENTO' : 'PRODUÇÃO');
console.log('📡 API URL:', API_URL);

// ===== ESTADO DA APLICAÇÃO =====
let parametros = [];
let parametroEditando = null;
let parametroExcluindo = null;
let parametroDetalhes = null;
let paginaAtual = 1;
let totalPaginas = 1;
let totalRegistros = 0;
const itensPorPagina = 12;

let empresaId = null;
let token = null;

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Parâmetros carregado');
    verificarAutenticacao();
    carregarParametros();
    configurarEventos();
});

// ===== AUTENTICAÇÃO =====
function verificarAutenticacao() {
    token = localStorage.getItem('sirius_token');
    const usuario = JSON.parse(localStorage.getItem('sirius_usuario'));
    const empresas = JSON.parse(localStorage.getItem('sirius_empresas') || '[]');
    
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    
    if (empresas.length > 0) {
        empresaId = empresas[0].id;
        console.log('✅ Empresa ID:', empresaId);
    }
    
    if (usuario) {
        document.getElementById('userName').textContent = usuario.nome;
    }
}

function logout() {
    localStorage.removeItem('sirius_token');
    localStorage.removeItem('sirius_usuario');
    localStorage.removeItem('sirius_empresas');
    window.location.href = 'index.html';
}

// ===== CONFIGURAR EVENTOS =====
function configurarEventos() {
    // Filtro por identificador
    document.getElementById('filtroParametro').addEventListener('input', (e) => {
        if (e.target.value.length === 0 || e.target.value.length >= 2) {
            paginaAtual = 1;
            carregarParametros();
        }
    });
    
    // Filtro por módulo
    document.getElementById('filtroModulo').addEventListener('change', () => {
        paginaAtual = 1;
        carregarParametros();
    });
    
    // Filtro por tabela
    document.getElementById('filtroTabela').addEventListener('input', (e) => {
        if (e.target.value.length === 0 || e.target.value.length >= 2) {
            paginaAtual = 1;
            carregarParametros();
        }
    });
    
    // Fechar modais ao clicar fora
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
}

// ===== CARREGAR PARÂMETROS =====
async function carregarParametros(pagina = paginaAtual) {
    try {
        mostrarLoading(true);
        
        const filtroParametro = document.getElementById('filtroParametro').value.trim();
        const filtroModulo = document.getElementById('filtroModulo').value;
        const filtroTabela = document.getElementById('filtroTabela').value.trim();
        
        let url = `${API_URL}/parametros?page=${pagina}&limit=${itensPorPagina}`;
        
        if (filtroParametro) {
            url += `&parametro=${encodeURIComponent(filtroParametro)}`;
        }
        if (filtroModulo) {
            url += `&modulo=${encodeURIComponent(filtroModulo)}`;
        }
        if (filtroTabela) {
            url += `&tabela=${encodeURIComponent(filtroTabela)}`;
        }
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            parametros = data.data;
            totalPaginas = data.pagination.totalPages;
            totalRegistros = data.pagination.total;
            paginaAtual = data.pagination.page;
            
            renderizarParametros();
            renderizarPaginacao();
            atualizarTotalRegistros();
        } else {
            showMessage(data.message || 'Erro ao carregar parâmetros', 'error');
        }
        
    } catch (error) {
        console.error('Erro ao carregar parâmetros:', error);
        showMessage('Erro ao carregar parâmetros', 'error');
    } finally {
        mostrarLoading(false);
    }
}

// ===== RENDERIZAR GRID =====
function renderizarParametros() {
    const grid = document.getElementById('parametrosGrid');
    
    if (parametros.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">⚙️</div>
                <p>Nenhum parâmetro encontrado</p>
                <button class="btn btn-primary" onclick="abrirModalNovo()" style="margin-top: 16px;">
                    ➕ Criar Primeiro Parâmetro
                </button>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = parametros.map(p => `
        <div class="parametro-card" onclick="abrirDetalhes(${p.id_parametro})">
            <div class="parametro-header">
                <span class="parametro-id">#${p.id_parametro}</span>
                <div class="parametro-actions" onclick="event.stopPropagation()">
                    <button class="btn-icon" onclick="editarParametro(${p.id_parametro})" title="Editar">
                        ✏️
                    </button>
                    <button class="btn-icon" onclick="abrirModalExcluir(${p.id_parametro})" title="Excluir">
                        🗑️
                    </button>
                </div>
            </div>
            <div class="parametro-nome">${p.parametro || '-'}</div>
            <div class="parametro-descricao">${p.descricao || 'Sem descrição'}</div>
            <div class="parametro-info">
                ${p.modulo ? `<span class="info-badge badge-modulo">📦 ${p.modulo}</span>` : ''}
                ${p.tabela ? `<span class="info-badge badge-tabela">🗃️ ${p.tabela}</span>` : ''}
            </div>
        </div>
    `).join('');
}

// ===== PAGINAÇÃO =====
function renderizarPaginacao() {
    const container = document.getElementById('paginacao');
    
    if (totalPaginas <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = `
        <button class="page-btn" ${paginaAtual === 1 ? 'disabled' : ''} onclick="carregarParametros(1)">
            ⏮️ Primeira
        </button>
        <button class="page-btn" ${paginaAtual === 1 ? 'disabled' : ''} onclick="carregarParametros(${paginaAtual - 1})">
            ⬅️ Anterior
        </button>
        <span class="page-info">Página ${paginaAtual} de ${totalPaginas}</span>
        <button class="page-btn" ${paginaAtual === totalPaginas ? 'disabled' : ''} onclick="carregarParametros(${paginaAtual + 1})">
            Próxima ➡️
        </button>
        <button class="page-btn" ${paginaAtual === totalPaginas ? 'disabled' : ''} onclick="carregarParametros(${totalPaginas})">
            Última ⏭️
        </button>
    `;
    
    container.innerHTML = html;
}

function atualizarTotalRegistros() {
    document.getElementById('totalRegistros').textContent = 
        `${totalRegistros} ${totalRegistros === 1 ? 'parâmetro encontrado' : 'parâmetros encontrados'}`;
}

// ===== LIMPAR FILTROS =====
function limparFiltros() {
    document.getElementById('filtroParametro').value = '';
    document.getElementById('filtroModulo').value = '';
    document.getElementById('filtroTabela').value = '';
    paginaAtual = 1;
    carregarParametros();
}

// ===== MODAL NOVO =====
function abrirModalNovo() {
    parametroEditando = null;
    document.getElementById('modalTitulo').textContent = 'Novo Parâmetro';
    document.getElementById('formParametro').reset();
    document.getElementById('id_parametro').value = '';
    document.getElementById('modalParametro').classList.add('show');
    document.getElementById('parametro').focus();
}

// ===== EDITAR =====
function editarParametro(id) {
    const parametro = parametros.find(p => p.id_parametro === id);
    if (!parametro) return;
    
    parametroEditando = parametro;
    document.getElementById('modalTitulo').textContent = 'Editar Parâmetro';
    document.getElementById('id_parametro').value = parametro.id_parametro;
    document.getElementById('parametro').value = parametro.parametro || '';
    document.getElementById('descricao').value = parametro.descricao || '';
    document.getElementById('descricaocomplementar').value = parametro.descricaocomplementar || '';
    document.getElementById('opcoes').value = parametro.opcoes || '';
    document.getElementById('modulo').value = parametro.modulo || '';
    document.getElementById('tabela').value = parametro.tabela || '';
    
    document.getElementById('modalParametro').classList.add('show');
    document.getElementById('parametro').focus();
}

// ===== SALVAR =====
async function salvarParametro(event) {
    event.preventDefault();
    
    const id = document.getElementById('id_parametro').value;
    const dados = {
        parametro: document.getElementById('parametro').value.trim(),
        descricao: document.getElementById('descricao').value.trim() || null,
        descricaocomplementar: document.getElementById('descricaocomplementar').value.trim() || null,
        opcoes: document.getElementById('opcoes').value.trim() || null,
        modulo: document.getElementById('modulo').value || null,
        tabela: document.getElementById('tabela').value.trim() || null
    };
    
    // Validações
    if (!dados.parametro) {
        showMessage('Informe o identificador do parâmetro', 'error');
        return;
    }
    
    try {
        const url = id ? `${API_URL}/parametros/${id}` : `${API_URL}/parametros`;
        const method = id ? 'PUT' : 'POST';
        
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
        
        if (data.success) {
            showMessage(
                id ? 'Parâmetro atualizado com sucesso!' : 'Parâmetro criado com sucesso!',
                'success'
            );
            fecharModal();
            carregarParametros();
        } else {
            showMessage(data.message || 'Erro ao salvar parâmetro', 'error');
        }
        
    } catch (error) {
        console.error('Erro ao salvar parâmetro:', error);
        showMessage('Erro ao salvar parâmetro', 'error');
    }
}

// ===== EXCLUIR =====
function abrirModalExcluir(id) {
    const parametro = parametros.find(p => p.id_parametro === id);
    if (!parametro) return;
    
    parametroExcluindo = parametro;
    document.getElementById('excluir_parametro').textContent = parametro.parametro;
    document.getElementById('modalExcluir').classList.add('show');
}

async function confirmarExclusao() {
    if (!parametroExcluindo) return;
    
    try {
        const response = await fetch(`${API_URL}/parametros/${parametroExcluindo.id_parametro}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Parâmetro excluído com sucesso!', 'success');
            fecharModalExcluir();
            carregarParametros();
        } else {
            showMessage(data.message || 'Erro ao excluir parâmetro', 'error');
        }
        
    } catch (error) {
        console.error('Erro ao excluir parâmetro:', error);
        showMessage('Erro ao excluir parâmetro', 'error');
    }
}

// ===== DETALHES =====
function abrirDetalhes(id) {
    const parametro = parametros.find(p => p.id_parametro === id);
    if (!parametro) return;
    
    parametroDetalhes = parametro;
    
    document.getElementById('detalhe_id').textContent = parametro.id_parametro;
    document.getElementById('detalhe_parametro').textContent = parametro.parametro || '-';
    document.getElementById('detalhe_descricao').textContent = parametro.descricao || '-';
    document.getElementById('detalhe_descricaocomplementar').textContent = parametro.descricaocomplementar || '-';
    document.getElementById('detalhe_modulo').textContent = parametro.modulo || '-';
    document.getElementById('detalhe_tabela').textContent = parametro.tabela || '-';
    document.getElementById('detalhe_opcoes').textContent = parametro.opcoes || '-';
    
    // Datas
    const createdAt = parametro.created_at ? 
        new Date(parametro.created_at).toLocaleString('pt-BR') : '-';
    const updatedAt = parametro.updated_at ? 
        new Date(parametro.updated_at).toLocaleString('pt-BR') : '-';
    
    document.getElementById('detalhe_created_at').textContent = createdAt;
    document.getElementById('detalhe_updated_at').textContent = updatedAt;
    
    document.getElementById('modalDetalhes').classList.add('show');
}

function editarDoDetalhes() {
    if (parametroDetalhes) {
        fecharModalDetalhes();
        editarParametro(parametroDetalhes.id_parametro);
    }
}

// ===== FECHAR MODALS =====
function fecharModal() {
    document.getElementById('modalParametro').classList.remove('show');
    parametroEditando = null;
}

function fecharModalExcluir() {
    document.getElementById('modalExcluir').classList.remove('show');
    parametroExcluindo = null;
}

function fecharModalDetalhes() {
    document.getElementById('modalDetalhes').classList.remove('show');
    parametroDetalhes = null;
}

function fecharModalMensagem() {
    document.getElementById('modalMensagem').classList.remove('show');
}

// ===== MENSAGENS =====
function showMessage(mensagem, tipo = 'info') {
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
}

// ===== LOADING =====
function mostrarLoading(show) {
    const grid = document.getElementById('parametrosGrid');
    if (show) {
        grid.innerHTML = '<div class="loading">Carregando parâmetros...</div>';
    }
}
