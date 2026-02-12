// =====================================================
// SIRIUS WEB - Movimentações de Estoque - VERSÃO CORRIGIDA
// =====================================================

const isDev = window.location.hostname === 'localhost' 
           || window.location.hostname === '127.0.0.1'
           || window.location.hostname === ''
           || window.location.protocol === 'file:';

const API_URL = isDev ? 'http://localhost:3000' : 'https://sirius-web-api-adonis.vercel.app';

let state = {
    produtoId: null,
    produto: null,
    movimentacoes: [],
    pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    },
    orderDir: 'asc',
    currentView: 'grid',
    tipoMovimentacao: null
};

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

// ✅ CORREÇÃO: Navegar direto sem usar history.back()
function voltarProdutos() {
    window.location.href = 'produtos.html';
}

async function init() {
    const token = checkAuth();
    if (!token) return;

    const usuario = JSON.parse(localStorage.getItem('sirius_usuario'));
    document.getElementById('userName').textContent = usuario.nome;

    const urlParams = new URLSearchParams(window.location.search);
    state.produtoId = urlParams.get('id');

    if (!state.produtoId) {
        await siriusAlert('Produto não especificado!', 'Erro');
        window.location.href = 'produtos.html';
        return;
    }

    await loadMovimentacoes();
}

async function loadMovimentacoes() {
    const token = checkAuth();
    const empresas = JSON.parse(localStorage.getItem('sirius_empresas'));
    const empresaId = empresas[0].id;

    try {
        const response = await fetch(
            `${API_URL}/movimentacoes/produto/${state.produtoId}?page=${state.pagination.page}&limit=${state.pagination.limit}&orderDir=${state.orderDir}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Empresa-Id': empresaId
                }
            }
        );

        const data = await response.json();

        if (response.ok && data.success) {
            state.produto = data.data.produto;
            
            // ✅ CORREÇÃO: Verificar se elemento existe E se produto foi carregado
            const descEl = document.getElementById('produtoDescricao');
            if (descEl && state.produto) {
                descEl.textContent = state.produto.descricao;
            }
            
            const saldoEl = document.getElementById('produtoSaldo');
            if (saldoEl && state.produto) {
                saldoEl.textContent = formatNumber(state.produto.saldo_atual);
            }
            
            // ✅ CORREÇÃO: Este elemento pode não existir quando modal está fechado
            const modalDescEl = document.getElementById('modalProdutoDescricao');
            if (modalDescEl && state.produto) {
                modalDescEl.textContent = state.produto.descricao;
            }

            state.movimentacoes = data.data.movimentacoes;
            state.pagination = data.pagination;

            if (state.currentView === 'grid') {
                renderGridView();
            } else {
                renderDetailView();
            }

            renderPagination();

        } else {
            throw new Error(data.message || 'Erro ao carregar movimentações');
        }

    } catch (error) {
        console.error('Erro:', error);
        
        if (state.currentView === 'grid') {
            document.getElementById('tableBody').innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #ef4444; padding: 48px;">
                        ❌ ${error.message}
                    </td>
                </tr>
            `;
        } else {
            document.getElementById('detailCards').innerHTML = `
                <div style="text-align: center; color: #ef4444; padding: 48px;">
                    ❌ ${error.message}
                </div>
            `;
        }
    }
}

function renderGridView() {
    const tbody = document.getElementById('tableBody');

    if (state.movimentacoes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <p>Nenhuma movimentação registrada para este produto</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = state.movimentacoes.map(mov => `
        <tr>
            <td>${formatDateTime(mov.data)}</td>
            <td>
                <span class="badge ${mov.tipo === 'ENTRADA' ? 'badge-entrada' : 'badge-saida'}">
                    ${mov.tipo === 'ENTRADA' ? '📥 Entrada' : '📤 Saída'}
                </span>
            </td>
            <td style="text-align: right; font-weight: 600;">${formatNumber(mov.quantidade)}</td>
            <td style="text-align: right;">${formatNumber(mov.saldo_anterior)}</td>
            <td style="text-align: right; font-weight: 600; color: #059669;">${formatNumber(mov.saldo_atual)}</td>
            <td>${mov.usuario || '-'}</td>
            <td>${mov.observacao || '-'}</td>
        </tr>
    `).join('');
}

function renderDetailView() {
    const container = document.getElementById('detailCards');

    if (state.movimentacoes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <p>Nenhuma movimentação registrada para este produto</p>
            </div>
        `;
        return;
    }

    container.innerHTML = state.movimentacoes.map(mov => `
        <div class="detail-card ${mov.tipo.toLowerCase()}">
            <div class="detail-header">
                <div class="detail-title">
                    <span class="badge ${mov.tipo === 'ENTRADA' ? 'badge-entrada' : 'badge-saida'}">
                        ${mov.tipo === 'ENTRADA' ? '📥 Entrada' : '📤 Saída'}
                    </span>
                    <span>${formatDateTime(mov.data)}</span>
                </div>
                <div class="detail-quantidade">
                    ${formatNumber(mov.quantidade)}
                </div>
            </div>
            <div class="detail-body">
                <div class="detail-field">
                    <span class="detail-label">Saldo Anterior</span>
                    <span class="detail-value">${formatNumber(mov.saldo_anterior)}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Saldo Atual</span>
                    <span class="detail-value" style="color: #059669; font-weight: 600;">${formatNumber(mov.saldo_atual)}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Usuário</span>
                    <span class="detail-value">${mov.usuario || '-'}</span>
                </div>
                ${mov.pedido_venda_id ? `
                    <div class="detail-field">
                        <span class="detail-label">Pedido Venda</span>
                        <span class="detail-value">#${mov.pedido_venda_id}</span>
                    </div>
                ` : ''}
                ${mov.pedido_compra_id ? `
                    <div class="detail-field">
                        <span class="detail-label">Pedido Compra</span>
                        <span class="detail-value">#${mov.pedido_compra_id}</span>
                    </div>
                ` : ''}
                ${mov.observacao ? `
                    <div class="detail-field" style="grid-column: 1 / -1;">
                        <span class="detail-label">Observação</span>
                        <span class="detail-value">${mov.observacao}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function renderPagination() {
    const start = (state.pagination.page - 1) * state.pagination.limit + 1;
    const end = Math.min(state.pagination.page * state.pagination.limit, state.pagination.total);
    const info = `Mostrando ${start} a ${end} de ${state.pagination.total} movimentações`;

    document.getElementById('paginationInfo').textContent = info;
    document.getElementById('paginationInfoDetail').textContent = info;
    document.getElementById('currentPageBtn').textContent = state.pagination.page;
    document.getElementById('currentPageBtnDetail').textContent = state.pagination.page;
    document.getElementById('btnPrevious').disabled = !state.pagination.hasPrev;
    document.getElementById('btnPreviousDetail').disabled = !state.pagination.hasPrev;
    document.getElementById('btnNext').disabled = !state.pagination.hasNext;
    document.getElementById('btnNextDetail').disabled = !state.pagination.hasNext;
}

async function previousPage() {
    if (state.pagination.hasPrev) {
        state.pagination.page--;
        await loadMovimentacoes();
    }
}

async function nextPage() {
    if (state.pagination.hasNext) {
        state.pagination.page++;
        await loadMovimentacoes();
    }
}

function setView(view) {
    state.currentView = view;

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-view="${view}"]`).classList.add('active');

    if (view === 'grid') {
        document.getElementById('gridView').style.display = 'block';
        document.getElementById('detailView').style.display = 'none';
    } else {
        document.getElementById('gridView').style.display = 'none';
        document.getElementById('detailView').style.display = 'block';
    }

    if (view === 'grid') {
        renderGridView();
    } else {
        renderDetailView();
    }
}

async function toggleOrdenacao() {
    state.orderDir = state.orderDir === 'asc' ? 'desc' : 'asc';
    document.getElementById('ordenacaoIcon').textContent = state.orderDir === 'asc' ? '⬆️' : '⬇️';
    document.getElementById('ordenacaoText').textContent = state.orderDir === 'asc' ? 'Crescente' : 'Decrescente';
    await loadMovimentacoes();
}

function toggleDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    const menu = dropdown.querySelector('.dropdown-menu');
    
    document.querySelectorAll('.dropdown-menu').forEach(m => {
        if (m !== menu) m.classList.remove('show');
    });

    menu.classList.toggle('show');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    }
});

function abrirModalMovimentacao(tipo) {
    state.tipoMovimentacao = tipo;
    document.getElementById('modalTitle').textContent = tipo === 'ENTRADA' ? 'Entrada de Estoque' : 'Saída de Estoque';
    
    const btnConfirmar = document.getElementById('btnConfirmarModal');
    btnConfirmar.className = tipo === 'ENTRADA' ? 'btn btn-success' : 'btn btn-danger';
    
    document.getElementById('formMovimentacao').reset();
    document.getElementById('modalMovimentacao').classList.add('show');

    // ✅ CORREÇÃO: Atualizar descrição do produto no modal
    const modalDescEl = document.getElementById('modalProdutoDescricao');
    if (modalDescEl && state.produto) {
        modalDescEl.textContent = state.produto.descricao;
    }

    setTimeout(() => {
        document.getElementById('quantidade').focus();
    }, 100);
}

function fecharModal() {
    document.getElementById('modalMovimentacao').classList.remove('show');
    document.getElementById('formMovimentacao').reset();
    state.tipoMovimentacao = null;
}

async function confirmarMovimentacao() {
    const form = document.getElementById('formMovimentacao');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const quantidade = parseFloat(document.getElementById('quantidade').value);
    const observacao = document.getElementById('observacao').value.trim();

    if (quantidade <= 0) {
        await siriusAlert('Quantidade deve ser maior que zero!', 'Erro');
        return;
    }

    const btnConfirmar = document.getElementById('btnConfirmarModal');
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Processando...';

    const token = checkAuth();
    const empresas = JSON.parse(localStorage.getItem('sirius_empresas'));
    const empresaId = empresas[0].id;

    try {
        const response = await fetch(
            `${API_URL}/movimentacoes/produto/${state.produtoId}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Empresa-Id': empresaId,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tipo: state.tipoMovimentacao,
                    quantidade: quantidade,
                    observacao: observacao || null
                })
            }
        );

        const data = await response.json();

        if (response.ok && data.success) {
            fecharModal();
            await siriusAlert(data.message, 'Sucesso ✅');
            state.pagination.page = 1;
            await loadMovimentacoes();
        } else {
            throw new Error(data.message || 'Erro ao criar movimentação');
        }

    } catch (error) {
        console.error('❌ Erro:', error);
        await siriusAlert(error.message || 'Erro ao processar movimentação', 'Erro');
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar';
    }
}

function formatNumber(value) {
    return parseFloat(value).toFixed(3).replace('.', ',');
}

function formatDateTime(datetime) {
    if (!datetime) return '-';
    const date = new Date(datetime);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function siriusAlert(mensagem, titulo = 'Atenção') {
    return new Promise((resolve) => {
        const existente = document.getElementById('siriusAlert');
        if (existente) existente.remove();
        
        const overlay = document.createElement('div');
        overlay.id = 'siriusAlert';
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
            <h3 style="color: #2563eb; margin: 0 0 20px 0; font-size: 1.5em;">${titulo}</h3>
            <p style="color: #333; font-size: 1.1em; margin: 0 0 25px 0; line-height: 1.5;">${mensagem}</p>
            <button onclick="document.getElementById('siriusAlert').remove()" 
                    style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); 
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
            if (e.target === overlay) {
                overlay.remove();
                resolve();
            }
        });
        
        box.querySelector('button').addEventListener('click', () => {
            overlay.remove();
            resolve();
        });
    });
}

document.addEventListener('DOMContentLoaded', init);

console.log('🚀 Movimentações carregado - VERSÃO CORRIGIDA ✅');
