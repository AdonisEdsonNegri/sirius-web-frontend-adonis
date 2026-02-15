// =====================================================
// SIRIUS WEB - Configuração de Parâmetros (Super Admin)
// =====================================================

// Configuração da API
const isDev = window.location.hostname === 'localhost' 
           || window.location.hostname === '127.0.0.1'
           || window.location.hostname === ''
           || window.location.protocol === 'file:';

const API_URL = isDev ? 'http://localhost:3000' : 'https://sirius-web-api-adonis.vercel.app';

console.log('🚀 Configuração de Parâmetros - Super Admin');
console.log('📡 API:', API_URL);

// Estado
let empresaAtual = null;
let parametrosOriginais = [];
let parametrosModificados = new Map(); // id_parametro => novo valor

// =====================================================
// INICIALIZAÇÃO
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
    verificarSuperAdmin();
    
    const usuario = JSON.parse(localStorage.getItem('sirius_usuario'));
    if (usuario) {
        document.getElementById('userName').textContent = usuario.nome;
    }
    
    await carregarEmpresas();
});

// =====================================================
// AUTENTICAÇÃO
// =====================================================
function verificarSuperAdmin() {
    const token = localStorage.getItem('sirius_token');
    if (!token) {
        alert('Você precisa fazer login primeiro!');
        window.location.href = 'index.html';
        return;
    }
    
    // Verificar se usuário é super admin será feito pela API
    // Se não for, a API retornará 403
}

function logout() {
    localStorage.removeItem('sirius_token');
    localStorage.removeItem('sirius_usuario');
    localStorage.removeItem('sirius_empresas');
    window.location.href = 'index.html';
}

// =====================================================
// CARREGAR EMPRESAS
// =====================================================
async function carregarEmpresas() {
    try {
        const token = localStorage.getItem('sirius_token');
        
        const response = await fetch(`${API_URL}/parametros/superadmin/empresas`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 403) {
                alert('Acesso negado! Apenas Super Administradores podem acessar esta página.');
                window.location.href = 'dashboard.html';
                return;
            }
            throw new Error(data.message || 'Erro ao carregar empresas');
        }
        
        if (data.success) {
            preencherSelectEmpresas(data.data);
        }
        
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro ao carregar empresas: ' + error.message, 'error');
    }
}

function preencherSelectEmpresas(empresas) {
    const select = document.getElementById('selectEmpresa');
    select.innerHTML = '<option value="">-- Selecione uma empresa --</option>';
    
    empresas.forEach(empresa => {
        const option = document.createElement('option');
        option.value = empresa.id_empresa;
        option.textContent = `${empresa.razao_social} (${empresa.cnpj})`;
        option.dataset.empresa = JSON.stringify(empresa);
        select.appendChild(option);
    });
}

// =====================================================
// CARREGAR PARÂMETROS DA EMPRESA
// =====================================================
async function carregarParametrosEmpresa() {
    const select = document.getElementById('selectEmpresa');
    const empresaId = select.value;
    
    if (!empresaId) {
        // Limpar tela
        document.getElementById('empresaInfo').style.display = 'none';
        document.getElementById('parametrosContainer').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        parametrosModificados.clear();
        return;
    }
    
    // Pegar dados da empresa
    const option = select.options[select.selectedIndex];
    const empresa = JSON.parse(option.dataset.empresa);
    empresaAtual = empresa;
    
    // Mostrar info da empresa
    document.getElementById('empresaRazao').textContent = empresa.razao_social;
    document.getElementById('empresaCnpj').textContent = empresa.cnpj;
    document.getElementById('empresaPlano').textContent = empresa.plano;
    document.getElementById('empresaInfo').style.display = 'flex';
    
    // Carregar parâmetros
    document.getElementById('loading').style.display = 'block';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('parametrosContainer').style.display = 'none';
    
    try {
        const token = localStorage.getItem('sirius_token');
        
        const response = await fetch(`${API_URL}/parametros/superadmin/empresa/${empresaId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            parametrosOriginais = data.data;
            parametrosModificados.clear();
            renderizarParametros(data.porModulo);
            document.getElementById('parametrosContainer').style.display = 'block';
        } else {
            throw new Error(data.message);
        }
        
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro ao carregar parâmetros: ' + error.message, 'error');
        document.getElementById('emptyState').style.display = 'block';
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

// =====================================================
// RENDERIZAR PARÂMETROS
// =====================================================
function renderizarParametros(porModulo) {
    const grid = document.getElementById('parametrosGrid');
    grid.innerHTML = '';
    
    const icones = {
        'PDV': '🛒',
        'NFCe': '🧾',
        'Estoque': '📦',
        'Financeiro': '💰',
        'Vendas': '💼',
        'Geral': '⚙️'
    };
    
    Object.keys(porModulo).forEach(modulo => {
        const section = document.createElement('div');
        section.className = 'modulo-section';
        
        section.innerHTML = `
            <div class="modulo-header">
                <span class="modulo-icon">${icones[modulo] || '⚙️'}</span>
                <h3 class="modulo-title">${modulo}</h3>
            </div>
            <div class="parametros-list" id="modulo-${modulo}"></div>
        `;
        
        grid.appendChild(section);
        
        const lista = section.querySelector('.parametros-list');
        
        porModulo[modulo].forEach(param => {
            const item = criarItemParametro(param);
            lista.appendChild(item);
        });
    });
}

function criarItemParametro(param) {
    const div = document.createElement('div');
    div.className = 'parametro-item';
    div.dataset.idParametro = param.id_parametro;
    
    const opcoes = param.opcoes || [];
    const opcoesHtml = opcoes.map(op => 
        `<option value="${op}" ${op === param.valor_atual ? 'selected' : ''}>${op}</option>`
    ).join('');
    
    const badgeClass = param.tem_valor_customizado ? 'badge-customizado' : 'badge-padrao';
    const badgeText = param.tem_valor_customizado ? 'CUSTOMIZADO' : 'PADRÃO';
    
    div.innerHTML = `
        <div class="parametro-header">
            <div class="parametro-info">
                <div class="parametro-codigo">${param.codigo}</div>
                <div class="parametro-descricao">${param.descricao}</div>
                ${param.descricao_complementar ? `<div class="parametro-complementar">${param.descricao_complementar}</div>` : ''}
            </div>
            <div class="parametro-control">
                <span class="badge ${badgeClass}">${badgeText}</span>
                <div class="parametro-valor">
                    <select class="valor-select" 
                            data-id="${param.id_parametro}" 
                            data-valor-original="${param.valor_atual}"
                            onchange="marcarComoModificado(${param.id_parametro}, this.value)">
                        ${opcoesHtml}
                    </select>
                    ${param.tem_valor_customizado ? `
                        <button class="btn-reset" 
                                onclick="resetarValor(${param.id_parametro})"
                                title="Resetar para padrão (${param.valor_padrao})">
                            🔄
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    return div;
}

// =====================================================
// MARCAR COMO MODIFICADO
// =====================================================
function marcarComoModificado(idParametro, novoValor) {
    const select = document.querySelector(`select[data-id="${idParametro}"]`);
    const valorOriginal = select.dataset.valorOriginal;
    
    if (novoValor !== valorOriginal) {
        select.classList.add('modificado');
        parametrosModificados.set(idParametro, novoValor);
    } else {
        select.classList.remove('modificado');
        parametrosModificados.delete(idParametro);
    }
    
    atualizarContadorModificacoes();
}

function atualizarContadorModificacoes() {
    const total = parametrosModificados.size;
    const btnSalvar = document.querySelector('.btn-success');
    
    if (total > 0) {
        btnSalvar.textContent = `💾 Salvar ${total} Alteraç${total > 1 ? 'ões' : 'ão'}`;
        btnSalvar.style.animation = 'pulse 1s infinite';
    } else {
        btnSalvar.textContent = '💾 Salvar Todas Alterações';
        btnSalvar.style.animation = 'none';
    }
}

// =====================================================
// SALVAR ALTERAÇÕES
// =====================================================
async function salvarTodasAlteracoes() {
    if (parametrosModificados.size === 0) {
        mostrarMensagem('Nenhuma alteração para salvar', 'info');
        return;
    }
    
    if (!confirm(`Salvar ${parametrosModificados.size} alteração(ões) para ${empresaAtual.razao_social}?`)) {
        return;
    }
    
    const token = localStorage.getItem('sirius_token');
    let sucessos = 0;
    let erros = 0;
    
    for (const [idParametro, valor] of parametrosModificados) {
        try {
            const response = await fetch(`${API_URL}/parametros/superadmin/valor`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id_empresa: empresaAtual.id_empresa,
                    id_parametro: parseInt(idParametro),
                    valor: valor
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                sucessos++;
            } else {
                erros++;
                console.error('Erro ao salvar:', data.message);
            }
            
        } catch (error) {
            erros++;
            console.error('Erro:', error);
        }
    }
    
    if (erros === 0) {
        mostrarMensagem(`✅ ${sucessos} parâmetro(s) salvo(s) com sucesso!`, 'success');
        parametrosModificados.clear();
        await carregarParametrosEmpresa(); // Recarregar
    } else {
        mostrarMensagem(`⚠️ ${sucessos} salvo(s), ${erros} erro(s)`, 'error');
    }
}

// =====================================================
// RESETAR VALOR
// =====================================================
async function resetarValor(idParametro) {
    const param = parametrosOriginais.find(p => p.id_parametro === idParametro);
    
    if (!confirm(`Resetar "${param.descricao}" para o valor padrão (${param.valor_padrao})?`)) {
        return;
    }
    
    try {
        const token = localStorage.getItem('sirius_token');
        
        const response = await fetch(
            `${API_URL}/parametros/superadmin/valor/${empresaAtual.id_empresa}/${idParametro}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        const data = await response.json();
        
        if (data.success) {
            mostrarMensagem('Valor resetado para o padrão!', 'success');
            await carregarParametrosEmpresa();
        } else {
            throw new Error(data.message);
        }
        
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro ao resetar: ' + error.message, 'error');
    }
}

// =====================================================
// RESETAR TODOS
// =====================================================
async function resetarTodosValores() {
    const customizados = parametrosOriginais.filter(p => p.tem_valor_customizado);
    
    if (customizados.length === 0) {
        mostrarMensagem('Nenhum parâmetro customizado para resetar', 'info');
        return;
    }
    
    if (!confirm(`Resetar TODOS os ${customizados.length} parâmetros customizados de ${empresaAtual.razao_social} para os valores padrão?`)) {
        return;
    }
    
    const token = localStorage.getItem('sirius_token');
    let sucessos = 0;
    
    for (const param of customizados) {
        try {
            const response = await fetch(
                `${API_URL}/parametros/superadmin/valor/${empresaAtual.id_empresa}/${param.id_parametro}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            if (response.ok) {
                sucessos++;
            }
            
        } catch (error) {
            console.error('Erro:', error);
        }
    }
    
    mostrarMensagem(`${sucessos} parâmetro(s) resetado(s)!`, 'success');
    await carregarParametrosEmpresa();
}

// =====================================================
// MENSAGENS
// =====================================================
function mostrarMensagem(texto, tipo = 'info') {
    const div = document.getElementById('mensagem');
    div.textContent = texto;
    div.className = `mensagem ${tipo}`;
    div.style.display = 'block';
    
    setTimeout(() => {
        div.style.display = 'none';
    }, 5000);
}
