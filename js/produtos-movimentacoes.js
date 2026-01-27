// =====================================================
// SIRIUS WEB - Movimentações de Estoque
// =====================================================

// Configuração
//const API_URL = 'https://sirius-web-api-adonis.vercel.app';
const API_URL = 'http://localhost:3000';

// Estado da aplicação
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

// =====================================================
// AUTENTICAÇÃO
// =====================================================
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

function voltarProdutos() {
    window.location.href = 'produtos.html';
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================
async function init() {
    const token = checkAuth();
    if (!token) return;

    // Atualizar nome do usuário
    const usuario = JSON.parse(localStorage.getItem('sirius_usuario'));
    document.getElementById('userName').textContent = usuario.nome;

    // Pegar ID do produto da URL
    const urlParams = new URLSearchParams(window.location.search);
    state.produtoId = urlParams.get('id');

    if (!state.produtoId) {
        await siriusAlert('Produto não especificado!', 'Erro');
        window.location.href = 'produtos.html';
        return;
    }

    // Carregar movimentações
    await loadMovimentacoes();
}

// =====================================================
// CARREGAR MOVIMENTAÇÕES
// =====================================================
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
            // Atualizar produto
            state.produto = data.data.produto;
            document.getElementById('produtoDescricao').textContent = state.produto.descricao;
            document.getElementById('produtoSaldo').textContent = formatNumber(state.produto.saldo_atual);
            document.getElementById('modalProdutoDescricao').textContent = state.produto.descricao;

            // Atualizar movimentações
            state.movimentacoes = data.data.movimentacoes;
            state.pagination = data.pagination;

            // Renderizar view atual
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

// =====================================================
// RENDERIZAR GRID VIEW
// =====================================================
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

// =====================================================
// RENDERIZAR DETAIL VIEW
// =====================================================
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
                </div>
                <div style="font-size: 14px; color: #6b7280;">
                    ${formatDateTime(mov.data)}
                </div>
            </div>

            <div class="detail-info">
                <div class="detail-field">
                    <span class="detail-label">Quantidade</span>
                    <span class="detail-value" style="font-weight: 600; font-size: 16px;">
                        ${formatNumber(mov.quantidade)}
                    </span>
                </div>

                <div class="detail-field">
                    <span class="detail-label">Saldo Anterior</span>
                    <span class="detail-value">${formatNumber(mov.saldo_anterior)}</span>
                </div>

                <div class="detail-field">
                    <span class="detail-label">Saldo Atual</span>
                    <span class="detail-value" style="font-weight: 600; color: #059669;">
                        ${formatNumber(mov.saldo_atual)}
                    </span>
                </div>

                <div class="detail-field">
                    <span class="detail-label">Usuário</span>
                    <span class="detail-value">${mov.usuario || '-'}</span>
                </div>

                ${mov.nota_fiscal ? `
                    <div class="detail-field">
                        <span class="detail-label">Nota Fiscal</span>
                        <span class="detail-value">${mov.nota_fiscal}</span>
                    </div>
                ` : ''}

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

// =====================================================
// PAGINAÇÃO
// =====================================================
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

// =====================================================
// VIEWS
// =====================================================
function setView(view) {
    state.currentView = view;

    // Atualizar botões
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-view="${view}"]`).classList.add('active');

    // Mostrar/esconder views
    if (view === 'grid') {
        document.getElementById('gridView').style.display = 'block';
        document.getElementById('detailView').style.display = 'none';
    } else {
        document.getElementById('gridView').style.display = 'none';
        document.getElementById('detailView').style.display = 'block';
    }

    // Renderizar
    if (view === 'grid') {
        renderGridView();
    } else {
        renderDetailView();
    }
}

// =====================================================
// ORDENAÇÃO
// =====================================================
async function toggleOrdenacao() {
    state.orderDir = state.orderDir === 'asc' ? 'desc' : 'asc';

    document.getElementById('ordenacaoIcon').textContent = state.orderDir === 'asc' ? '⬆️' : '⬇️';
    document.getElementById('ordenacaoText').textContent = state.orderDir === 'asc' ? 'Crescente' : 'Decrescente';

    await loadMovimentacoes();
}

// =====================================================
// DROPDOWN
// =====================================================
function toggleDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    const menu = dropdown.querySelector('.dropdown-menu');
    
    // Fechar outros dropdowns
    document.querySelectorAll('.dropdown-menu').forEach(m => {
        if (m !== menu) m.classList.remove('show');
    });

    menu.classList.toggle('show');
}

// Fechar dropdown ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    }
});

// =====================================================
// MODAL MOVIMENTAÇÃO
// =====================================================
function abrirModalMovimentacao(tipo) {
    state.tipoMovimentacao = tipo;

    document.getElementById('modalTitle').textContent = tipo === 'ENTRADA' ? 'Entrada de Estoque' : 'Saída de Estoque';
    
    // Mudar cor do botão
    const btnConfirmar = document.getElementById('btnConfirmarModal');
    btnConfirmar.className = tipo === 'ENTRADA' ? 'btn btn-success' : 'btn btn-danger';
    
    // Limpar form
    document.getElementById('formMovimentacao').reset();

    // Mostrar modal
    document.getElementById('modalMovimentacao').classList.add('show');

    // Focar no campo quantidade
    setTimeout(() => {
        document.getElementById('quantidade').focus();
    }, 100);
}

function fecharModal() {
    document.getElementById('modalMovimentacao').classList.remove('show');
    document.getElementById('formMovimentacao').reset();
    state.tipoMovimentacao = null;
}

// =====================================================
// CONFIRMAR MOVIMENTAÇÃO
// =====================================================
async function confirmarMovimentacao() {
    const form = document.getElementById('formMovimentacao');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const quantidade = parseFloat(document.getElementById('quantidade').value);
    const observacao = document.getElementById('observacao').value.trim();

    if (quantidade <= 0) {
        await siriusAlert('Quantidade deve ser maior que zero!');
        return;
    }

    const btnConfirmar = document.getElementById('btnConfirmarModal');
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Processando...';

    const token = checkAuth();
    const empresas = JSON.parse(localStorage.getItem('sirius_empresas'));
    const empresaId = empresas[0].id;

    try {
        console.log('📤 Enviando movimentação:', { tipo: state.tipoMovimentacao, quantidade });
        
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

        console.log('📥 Status da resposta:', response.status, response.statusText);

        // Tentar parsear JSON
        let data;
        try {
            const responseText = await response.text();
            console.log('📄 Resposta recebida:', responseText);
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('❌ Erro ao parsear JSON:', parseError);
            throw new Error('Resposta inválida do servidor');
        }

        console.log('📦 Dados parseados:', data);

        // Verificar se deu certo
        if (response.ok && data.success) {
            console.log('✅ Movimentação criada com sucesso!');
            
            // Fechar modal PRIMEIRO
            fecharModal();
            
            // Aguardar um pouco para garantir que modal fechou
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Mostrar mensagem de sucesso
            await siriusAlert(data.message, 'Sucesso ✅');
            
            // Recarregar movimentações
            try {
                console.log('🔄 Recarregando movimentações...');
                state.pagination.page = 1;
                await loadMovimentacoes();
                console.log('✅ Movimentações recarregadas');
            } catch (reloadError) {
                console.error('⚠️ Erro ao recarregar (movimentação foi criada):', reloadError);
                // NÃO mostra erro para usuário - movimentação foi criada com sucesso
            }

        } else {
            // Resposta indica erro
            console.error('❌ Erro reportado pelo servidor:', data);
            throw new Error(data.message || 'Erro ao criar movimentação');
        }

    } catch (error) {
        console.error('❌ Erro no processo:', error);
        await siriusAlert(error.message || 'Erro ao processar movimentação', 'Erro');

    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar';
    }
}

// =====================================================
// FORMATAÇÃO
// =====================================================
function formatNumber(value) {
    return parseFloat(value).toLocaleString('pt-BR', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3
    });
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// =====================================================
// MODAIS PERSONALIZADOS (Sirius Web Informa)
// =====================================================
function siriusAlert(mensagem, titulo = 'Sirius Web Informa') {
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
        
        box.innerHTML = `
            <h3 style="color: #667eea; margin: 0 0 20px 0; font-size: 1.5em;">🏢 ${titulo}</h3>
            <p style="color: #333; font-size: 1.1em; margin: 0 0 25px 0; line-height: 1.5;">${mensagem}</p>
            <button id="btnOkAlert" 
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
        
        const btnOk = document.getElementById('btnOkAlert');
        
        const fechar = () => {
            overlay.remove();
            resolve(true);
        };
        
        btnOk.onclick = fechar;
        
        // ESC fecha
        overlay.onkeydown = (e) => {
            if (e.key === 'Escape') {
                fechar();
            }
        };
        
        // Focar botão
        setTimeout(() => btnOk.focus(), 100);
    });
}

// =====================================================
// INICIALIZAR
// =====================================================
init();
console.log('🚀 Movimentações carregado');
