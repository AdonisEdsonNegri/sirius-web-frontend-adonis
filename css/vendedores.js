// =====================================================
// SIRIUS WEB - Vendedores
// =====================================================

// Configuração da API
const API_URL = 'https://sirius-web-api-adonis.vercel.app';

// Estado da aplicação
let vendedores = [];
let vendedoresFiltrados = [];
let vendedorEditando = null;
let paginaAtual = 1;
const itensPorPagina = 10;
let filtroAtivo = null;
let ordenacaoAtiva = 'nome';

// =====================================================
// INICIALIZAÇÃO
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacao();
    carregarVendedores();
    aplicarMascaras();
});

function verificarAutenticacao() {
    const token = localStorage.getItem('sirius_token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
}

// =====================================================
// MÁSCARAS E VALIDAÇÕES
// =====================================================

function aplicarMascaras() {
    const cpfInput = document.getElementById('cpf');
    const foneInput = document.getElementById('fone');
    const cepInput = document.getElementById('cep');
    const ufInput = document.getElementById('uf');
    
    if (cpfInput) {
        cpfInput.addEventListener('input', (e) => {
            e.target.value = mascaraCPF(e.target.value);
        });
    }
    
    if (foneInput) {
        foneInput.addEventListener('input', (e) => {
            e.target.value = mascaraTelefone(e.target.value);
        });
    }
    
    if (cepInput) {
        cepInput.addEventListener('input', (e) => {
            e.target.value = mascaraCEP(e.target.value);
        });
    }
    
    if (ufInput) {
        ufInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }
}

function mascaraCPF(valor) {
    valor = valor.replace(/\D/g, '');
    valor = valor.substring(0, 11);
    valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
    valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
    valor = valor.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return valor;
}

function mascaraTelefone(valor) {
    valor = valor.replace(/\D/g, '');
    valor = valor.substring(0, 11);
    if (valor.length <= 10) {
        valor = valor.replace(/(\d{2})(\d)/, '($1) $2');
        valor = valor.replace(/(\d{4})(\d)/, '$1-$2');
    } else {
        valor = valor.replace(/(\d{2})(\d)/, '($1) $2');
        valor = valor.replace(/(\d{5})(\d)/, '$1-$2');
    }
    return valor;
}

function mascaraCEP(valor) {
    valor = valor.replace(/\D/g, '');
    valor = valor.substring(0, 8);
    valor = valor.replace(/(\d{5})(\d)/, '$1-$2');
    return valor;
}

function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) {
        return false;
    }
    
    let soma = 0;
    let resto;
    
    for (let i = 1; i <= 9; i++) {
        soma += parseInt(cpf.substring(i-1, i)) * (11 - i);
    }
    
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    
    soma = 0;
    for (let i = 1; i <= 10; i++) {
        soma += parseInt(cpf.substring(i-1, i)) * (12 - i);
    }
    
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;
    
    return true;
}

// =====================================================
// BUSCAR CEP
// =====================================================

async function buscarCEP() {
    const cep = document.getElementById('cep').value.replace(/\D/g, '');
    
    if (cep.length !== 8) {
        mostrarMensagem('CEP deve ter 8 dígitos', 'error');
        return;
    }
    
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        
        if (data.erro) {
            mostrarMensagem('CEP não encontrado', 'error');
            return;
        }
        
        document.getElementById('endereco').value = data.logradouro || '';
        document.getElementById('complemento').value = data.complemento || '';
        document.getElementById('cidade').value = data.localidade || '';
        document.getElementById('uf').value = data.uf || '';
        
        mostrarMensagem('CEP encontrado!', 'success');
        
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        mostrarMensagem('Erro ao buscar CEP', 'error');
    }
}

// =====================================================
// CARREGAR VENDEDORES
// =====================================================

async function carregarVendedores() {
    mostrarLoading(true);
    
    try {
        const token = localStorage.getItem('sirius_token');
        const empresas = JSON.parse(localStorage.getItem('sirius_empresas') || '[]');
        const idEmpresa = empresas[0]?.id;
        
        const response = await fetch(`${API_URL}/vendedores`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': idEmpresa
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao carregar vendedores');
        }
        
        const data = await response.json();
        vendedores = data.data || [];
        vendedoresFiltrados = [...vendedores];
        aplicarOrdenacao(ordenacaoAtiva);
        renderizarTabela();
        
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro ao carregar vendedores', 'error');
    } finally {
        mostrarLoading(false);
    }
}

// =====================================================
// RENDERIZAR TABELA
// =====================================================

function renderizarTabela() {
    const tbody = document.getElementById('tbody');
    
    if (vendedoresFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 40px;">Nenhum vendedor encontrado</td></tr>';
        return;
    }
    
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const vendedoresPagina = vendedoresFiltrados.slice(inicio, fim);
    
    tbody.innerHTML = vendedoresPagina.map(vendedor => `
        <tr>
            <td>${vendedor.id_vendedor}</td>
            <td>${vendedor.nome}</td>
            <td>${vendedor.cpf || '-'}</td>
            <td>${vendedor.fone || '-'}</td>
            <td>${vendedor.email || '-'}</td>
            <td>${vendedor.cidade ? `${vendedor.cidade}/${vendedor.uf}` : '-'}</td>
            <td>
                <span class="badge ${vendedor.status === 'A' ? 'ativo' : 'inativo'}">
                    ${vendedor.status === 'A' ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td>
                <button class="btn-small btn-view" onclick="visualizarDetalhes(${vendedor.id_vendedor})" title="Ver detalhes">📄</button>
                <button class="btn-small btn-edit" onclick="editarVendedor(${vendedor.id_vendedor})" title="Editar">✏️</button>
                <button class="btn-small btn-delete" onclick="confirmarExclusao(${vendedor.id_vendedor})" title="Excluir">🗑️</button>
            </td>
        </tr>
    `).join('');
    
    atualizarPaginacao();
}

function atualizarPaginacao() {
    const totalPaginas = Math.ceil(vendedoresFiltrados.length / itensPorPagina);
    document.getElementById('pageInfo').textContent = `Página ${paginaAtual} de ${totalPaginas}`;
    document.getElementById('btnPrev').disabled = paginaAtual === 1;
    document.getElementById('btnNext').disabled = paginaAtual === totalPaginas;
}

function mudarPagina(direcao) {
    const totalPaginas = Math.ceil(vendedoresFiltrados.length / itensPorPagina);
    paginaAtual += direcao;
    
    if (paginaAtual < 1) paginaAtual = 1;
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
    
    renderizarTabela();
}

// =====================================================
// MODAL
// =====================================================

function abrirModal() {
    vendedorEditando = null;
    document.getElementById('modalTitle').textContent = 'Novo Vendedor';
    document.getElementById('vendedorForm').reset();
    document.getElementById('ativo').checked = true;
    mudarAba('basico');
    document.getElementById('modal').style.display = 'block';
    setTimeout(() => document.getElementById('nome').focus(), 100);
}

function fecharModal() {
    document.getElementById('modal').style.display = 'none';
    vendedorEditando = null;
}

function mudarAba(nomeAba) {
    // Desativar todas as abas
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Ativar aba selecionada
    document.querySelector(`[data-tab="${nomeAba}"]`).classList.add('active');
    document.getElementById(`tab-${nomeAba}`).classList.add('active');
}

// =====================================================
// SALVAR VENDEDOR
// =====================================================

async function salvarVendedor(event) {
    event.preventDefault();
    
    const cpf = document.getElementById('cpf').value;
    if (cpf && !validarCPF(cpf)) {
        mostrarMensagem('CPF inválido!', 'error');
        mudarAba('basico');
        document.getElementById('cpf').focus();
        return;
    }
    
    const vendedor = {
        nome: document.getElementById('nome').value.trim(),
        cpf: cpf.replace(/\D/g, '') || null,
        fone: document.getElementById('fone').value.replace(/\D/g, '') || null,
        email: document.getElementById('email').value.trim() || null,
        endereco: document.getElementById('endereco').value.trim() || null,
        complemento: document.getElementById('complemento').value.trim() || null,
        cidade: document.getElementById('cidade').value.trim() || null,
        uf: document.getElementById('uf').value.trim().toUpperCase() || null,
        cep: document.getElementById('cep').value.replace(/\D/g, '') || null,
        comissao: parseFloat(document.getElementById('comissao').value) || null,
        meta_vendas: parseFloat(document.getElementById('meta_vendas').value) || null,
        observacoes: document.getElementById('observacoes').value.trim() || null,
        status: document.getElementById('ativo').checked ? 'A' : 'I'
    };
    
    try {
        const token = localStorage.getItem('sirius_token');
        const empresas = JSON.parse(localStorage.getItem('sirius_empresas') || '[]');
        const idEmpresa = empresas[0]?.id;
        
        const url = vendedorEditando 
            ? `${API_URL}/vendedores/${vendedorEditando}` 
            : `${API_URL}/vendedores`;
        
        const method = vendedorEditando ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': idEmpresa
            },
            body: JSON.stringify(vendedor)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Erro ao salvar vendedor');
        }
        
        mostrarMensagem(
            vendedorEditando ? 'Vendedor atualizado com sucesso!' : 'Vendedor cadastrado com sucesso!',
            'success'
        );
        
        fecharModal();
        carregarVendedores();
        
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem(error.message || 'Erro ao salvar vendedor', 'error');
    }
}

// =====================================================
// EDITAR VENDEDOR
// =====================================================

async function editarVendedor(id) {
    const vendedor = vendedores.find(v => v.id_vendedor === id);
    
    if (!vendedor) {
        mostrarMensagem('Vendedor não encontrado', 'error');
        return;
    }
    
    vendedorEditando = id;
    document.getElementById('modalTitle').textContent = 'Editar Vendedor';
    
    document.getElementById('nome').value = vendedor.nome || '';
    document.getElementById('cpf').value = vendedor.cpf ? mascaraCPF(vendedor.cpf) : '';
    document.getElementById('fone').value = vendedor.fone ? mascaraTelefone(vendedor.fone) : '';
    document.getElementById('email').value = vendedor.email || '';
    document.getElementById('endereco').value = vendedor.endereco || '';
    document.getElementById('complemento').value = vendedor.complemento || '';
    document.getElementById('cidade').value = vendedor.cidade || '';
    document.getElementById('uf').value = vendedor.uf || '';
    document.getElementById('cep').value = vendedor.cep ? mascaraCEP(vendedor.cep) : '';
    document.getElementById('comissao').value = vendedor.comissao || '';
    document.getElementById('meta_vendas').value = vendedor.meta_vendas || '';
    document.getElementById('observacoes').value = vendedor.observacoes || '';
    document.getElementById('ativo').checked = vendedor.status === 'A';
    
    mudarAba('basico');
    document.getElementById('modal').style.display = 'block';
}

// =====================================================
// EXCLUIR VENDEDOR
// =====================================================

function confirmarExclusao(id) {
    const vendedor = vendedores.find(v => v.id_vendedor === id);
    
    if (!vendedor) {
        mostrarMensagem('Vendedor não encontrado', 'error');
        return;
    }
    
    if (confirm(`Confirma a exclusão do vendedor "${vendedor.nome}"?`)) {
        excluirVendedor(id);
    }
}

async function excluirVendedor(id) {
    try {
        const token = localStorage.getItem('sirius_token');
        const empresas = JSON.parse(localStorage.getItem('sirius_empresas') || '[]');
        const idEmpresa = empresas[0]?.id;
        
        const response = await fetch(`${API_URL}/vendedores/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': idEmpresa
            }
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Erro ao excluir vendedor');
        }
        
        mostrarMensagem('Vendedor excluído com sucesso!', 'success');
        carregarVendedores();
        
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem(error.message || 'Erro ao excluir vendedor', 'error');
    }
}

// =====================================================
// FILTROS E ORDENAÇÃO
// =====================================================

function aplicarFiltro(tipo) {
    let valorFiltro = '';
    
    if (tipo === 'nome') {
        valorFiltro = prompt('Digite o nome do vendedor:');
        if (!valorFiltro) return;
        
        vendedoresFiltrados = vendedores.filter(v => 
            v.nome.toLowerCase().includes(valorFiltro.toLowerCase())
        );
        
        document.getElementById('textoFiltro').textContent = `Nome contém "${valorFiltro}"`;
        
    } else if (tipo === 'id') {
        valorFiltro = prompt('Digite o ID do vendedor:');
        if (!valorFiltro) return;
        
        vendedoresFiltrados = vendedores.filter(v => 
            v.id_vendedor.toString() === valorFiltro
        );
        
        document.getElementById('textoFiltro').textContent = `ID = ${valorFiltro}`;
    }
    
    filtroAtivo = tipo;
    document.getElementById('filtroAtivo').style.display = 'flex';
    paginaAtual = 1;
    renderizarTabela();
}

function limparFiltro() {
    filtroAtivo = null;
    vendedoresFiltrados = [...vendedores];
    document.getElementById('filtroAtivo').style.display = 'none';
    aplicarOrdenacao(ordenacaoAtiva);
    renderizarTabela();
}

function aplicarOrdenacao(tipo) {
    ordenacaoAtiva = tipo;
    
    switch (tipo) {
        case 'nome':
            vendedoresFiltrados.sort((a, b) => a.nome.localeCompare(b.nome));
            break;
        case 'data_criacao':
            vendedoresFiltrados.sort((a, b) => a.id_vendedor - b.id_vendedor);
            break;
        case 'ultimos':
            vendedoresFiltrados.sort((a, b) => b.id_vendedor - a.id_vendedor);
            break;
    }
    
    paginaAtual = 1;
    renderizarTabela();
}

// =====================================================
// VISUALIZAR DETALHES
// =====================================================

function visualizarDetalhes(id) {
    const vendedor = vendedores.find(v => v.id_vendedor === id);
    
    if (!vendedor) {
        mostrarMensagem('Vendedor não encontrado', 'error');
        return;
    }
    
    const detalhes = `
        <div style="padding: 20px;">
            <h3 style="color: #667eea; margin-bottom: 20px;">📋 Informações Gerais</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 30px;">
                <div><strong>ID:</strong> ${vendedor.id_vendedor}</div>
                <div><strong>Status:</strong> <span class="badge ${vendedor.status === 'A' ? 'ativo' : 'inativo'}">${vendedor.status === 'A' ? 'Ativo' : 'Inativo'}</span></div>
                <div><strong>Nome:</strong> ${vendedor.nome}</div>
                <div><strong>CPF:</strong> ${vendedor.cpf ? mascaraCPF(vendedor.cpf) : '-'}</div>
                <div><strong>Telefone:</strong> ${vendedor.fone ? mascaraTelefone(vendedor.fone) : '-'}</div>
                <div><strong>E-mail:</strong> ${vendedor.email || '-'}</div>
            </div>
            
            <h3 style="color: #667eea; margin-bottom: 20px;">📍 Endereço</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 30px;">
                <div><strong>CEP:</strong> ${vendedor.cep ? mascaraCEP(vendedor.cep) : '-'}</div>
                <div><strong>Cidade/UF:</strong> ${vendedor.cidade && vendedor.uf ? `${vendedor.cidade}/${vendedor.uf}` : '-'}</div>
                <div style="grid-column: 1 / -1;"><strong>Endereço:</strong> ${vendedor.endereco || '-'}</div>
                <div style="grid-column: 1 / -1;"><strong>Complemento:</strong> ${vendedor.complemento || '-'}</div>
            </div>
            
            <h3 style="color: #667eea; margin-bottom: 20px;">💼 Informações Comerciais</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 30px;">
                <div><strong>Comissão:</strong> ${vendedor.comissao ? vendedor.comissao + '%' : '-'}</div>
                <div><strong>Meta de Vendas:</strong> ${vendedor.meta_vendas ? 'R$ ' + parseFloat(vendedor.meta_vendas).toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '-'}</div>
            </div>
            
            ${vendedor.observacoes ? `
                <h3 style="color: #667eea; margin-bottom: 20px;">📝 Observações</h3>
                <div style="padding: 15px; background: #f9f9f9; border-radius: 8px; margin-bottom: 20px;">
                    ${vendedor.observacoes}
                </div>
            ` : ''}
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #eee; color: #999; font-size: 12px;">
                <div><strong>Cadastrado em:</strong> ${new Date(vendedor.created_at).toLocaleString('pt-BR')}</div>
                ${vendedor.updated_at && vendedor.updated_at !== vendedor.created_at ? `
                    <div style="margin-top: 5px;"><strong>Última atualização:</strong> ${new Date(vendedor.updated_at).toLocaleString('pt-BR')}</div>
                ` : ''}
            </div>
        </div>
    `;
    
    document.getElementById('detalhesConteudo').innerHTML = detalhes;
    document.getElementById('modalDetalhes').style.display = 'block';
}

function fecharModalDetalhes() {
    document.getElementById('modalDetalhes').style.display = 'none';
}

function imprimirDetalhes() {
    window.print();
}

// =====================================================
// RELATÓRIO
// =====================================================

function gerarRelatorio() {
    if (vendedoresFiltrados.length === 0) {
        mostrarMensagem('Nenhum vendedor para imprimir', 'error');
        return;
    }
    
    const empresas = JSON.parse(localStorage.getItem('sirius_empresas') || '[]');
    const empresa = empresas[0];
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Relatório de Vendedores</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #667eea; text-align: center; }
                .empresa { text-align: center; margin-bottom: 30px; color: #666; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                th { background-color: #667eea; color: white; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .rodape { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
                @media print {
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>📊 Relatório de Vendedores</h1>
            <div class="empresa">
                <strong>${empresa.nome_fantasia || empresa.razao_social}</strong><br>
                Gerado em: ${new Date().toLocaleString('pt-BR')}
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nome</th>
                        <th>CPF</th>
                        <th>Telefone</th>
                        <th>E-mail</th>
                        <th>Cidade/UF</th>
                        <th>Comissão</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    vendedoresFiltrados.forEach(vendedor => {
        html += `
            <tr>
                <td>${vendedor.id_vendedor}</td>
                <td>${vendedor.nome}</td>
                <td>${vendedor.cpf ? mascaraCPF(vendedor.cpf) : '-'}</td>
                <td>${vendedor.fone ? mascaraTelefone(vendedor.fone) : '-'}</td>
                <td>${vendedor.email || '-'}</td>
                <td>${vendedor.cidade && vendedor.uf ? `${vendedor.cidade}/${vendedor.uf}` : '-'}</td>
                <td>${vendedor.comissao ? vendedor.comissao + '%' : '-'}</td>
                <td>${vendedor.status === 'A' ? 'Ativo' : 'Inativo'}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
            
            <div class="rodape">
                Total de vendedores: ${vendedoresFiltrados.length}
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
                <button onclick="window.print()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
                    🖨️ Imprimir
                </button>
                <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; margin-left: 10px;">
                    Fechar
                </button>
            </div>
        </body>
        </html>
    `;
    
    const janelaImpressao = window.open('', '', 'width=800,height=600');
    janelaImpressao.document.write(html);
    janelaImpressao.document.close();
}

// =====================================================
// UTILITÁRIOS
// =====================================================

function mostrarLoading(mostrar) {
    document.getElementById('loading').style.display = mostrar ? 'block' : 'none';
}

function mostrarMensagem(texto, tipo = 'success') {
    const mensagemEl = document.getElementById('mensagem');
    mensagemEl.textContent = texto;
    mensagemEl.className = `mensagem ${tipo}`;
    mensagemEl.style.display = 'block';
    
    setTimeout(() => {
        mensagemEl.style.display = 'none';
    }, 5000);
}

function toggleMenu() {
    const toolbar = document.getElementById('toolbar');
    toolbar.classList.toggle('active');
}

function toggleDropdown(event, elemento) {
    event.stopPropagation();
    elemento.classList.toggle('active');
}

// Fechar dropdown ao clicar fora
document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown').forEach(dropdown => {
        dropdown.classList.remove('active');
    });
});

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('modal');
    const modalDetalhes = document.getElementById('modalDetalhes');
    
    if (event.target === modal) {
        fecharModal();
    }
    if (event.target === modalDetalhes) {
        fecharModalDetalhes();
    }
}
