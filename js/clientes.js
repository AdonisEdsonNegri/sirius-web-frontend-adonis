// =====================================================
// SIRIUS WEB - Clientes JavaScript
// VERSÃO FINAL CORRIGIDA - TODOS OS PROBLEMAS RESOLVIDOS
// =====================================================

const isDev = window.location.hostname === 'localhost' 
           || window.location.hostname === '127.0.0.1'
           || window.location.hostname === ''
           || window.location.protocol === 'file:';

const API_URL = isDev ? 'http://localhost:3000' : 'https://sirius-web-api-adonis.vercel.app';

let token = null;
let empresaId = null;
let clienteEditando = null;
let paginaAtual = 1;
let totalPaginas = 1;
let filtroAtivo = null;
let valorFiltro = '';
let ordenacaoAtual = 'razao_social';

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacao();
    carregarClientes();
    configurarMascaras();
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
// MÁSCARAS AUTOMÁTICAS
// =====================================================
function configurarMascaras() {
    // Máscara CPF
    document.getElementById('cpf').addEventListener('input', function(e) {
        let valor = e.target.value.replace(/\D/g, '');
        if (valor.length <= 11) {
            valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
            valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
            valor = valor.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        }
        e.target.value = valor;
    });
    
    // Máscara CNPJ
    document.getElementById('cnpj').addEventListener('input', function(e) {
        let valor = e.target.value.replace(/\D/g, '');
        if (valor.length <= 14) {
            valor = valor.replace(/^(\d{2})(\d)/, '$1.$2');
            valor = valor.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
            valor = valor.replace(/\.(\d{3})(\d)/, '.$1/$2');
            valor = valor.replace(/(\d{4})(\d)/, '$1-$2');
        }
        e.target.value = valor;
    });
    
    // Máscara Telefone
    document.getElementById('contato').addEventListener('input', function(e) {
        let valor = e.target.value.replace(/\D/g, '');
        if (valor.length <= 11) {
            if (valor.length <= 10) {
                valor = valor.replace(/^(\d{2})(\d)/, '($1) $2');
                valor = valor.replace(/(\d{4})(\d)/, '$1-$2');
            } else {
                valor = valor.replace(/^(\d{2})(\d)/, '($1) $2');
                valor = valor.replace(/(\d{5})(\d)/, '$1-$2');
            }
        }
        e.target.value = valor;
    });
}

// =====================================================
// VALIDAÇÃO DE CPF
// =====================================================
function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    
    if (cpf.length !== 11) {
        return { valido: false, mensagem: 'CPF deve conter 11 dígitos.' };
    }
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cpf)) {
        return { valido: false, mensagem: 'CPF inválido.' };
    }
    
    // ✅ CÁLCULO CORRETO DO PRIMEIRO DÍGITO VERIFICADOR
    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = soma % 11;
    let digito1 = resto < 2 ? 0 : 11 - resto;
    
    if (digito1 !== parseInt(cpf.charAt(9))) {
        return { valido: false, mensagem: 'CPF inválido! Primeiro dígito verificador incorreto.' };
    }
    
    // ✅ CÁLCULO CORRETO DO SEGUNDO DÍGITO VERIFICADOR
    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = soma % 11;
    let digito2 = resto < 2 ? 0 : 11 - resto;
    
    if (digito2 !== parseInt(cpf.charAt(10))) {
        return { valido: false, mensagem: 'CPF inválido! Segundo dígito verificador incorreto.' };
    }
    
    return { valido: true, mensagem: 'CPF válido!' };
}

// =====================================================
// VALIDAÇÃO DE CNPJ
// =====================================================
function validarCNPJ(cnpj) {
    cnpj = cnpj.replace(/\D/g, '');
    
    if (cnpj.length !== 14) {
        return { valido: false, mensagem: 'CNPJ deve conter 14 dígitos.' };
    }
    
    if (/^(\d)\1{13}$/.test(cnpj)) {
        return { valido: false, mensagem: 'CNPJ inválido.' };
    }
    
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado != digitos.charAt(0)) {
        return { valido: false, mensagem: 'CNPJ inválido! Dígito verificador incorreto.' };
    }
    
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado != digitos.charAt(1)) {
        return { valido: false, mensagem: 'CNPJ inválido! Dígito verificador incorreto.' };
    }
    
    return { valido: true, mensagem: 'CNPJ válido!' };
}

// =====================================================
// ALTERNAR TIPO DE PESSOA - CORRIGIDO
// =====================================================
function alterarTipoPessoa() {
    const tipo = document.getElementById('tipo').value;
    const campoCPF = document.getElementById('campoCPF');
    const campoCNPJ = document.getElementById('campoCNPJ');
    const labelRazao = document.getElementById('labelRazao');
    const labelFantasia = document.getElementById('labelFantasia');
    const inputCPF = document.getElementById('cpf');
    const inputCNPJ = document.getElementById('cnpj');
    
    if (tipo === 'F') {
        campoCPF.classList.remove('hidden');
        campoCNPJ.classList.add('hidden');
        inputCPF.required = false; // ✅ CORRIGIDO - validação via JavaScript
        inputCNPJ.required = false;
        inputCNPJ.value = '';
        labelRazao.textContent = 'Nome Completo *';
        labelFantasia.textContent = 'Apelido / Nome Social';
    } else if (tipo === 'J') {
        campoCPF.classList.add('hidden');
        campoCNPJ.classList.remove('hidden');
        inputCPF.required = false;
        inputCNPJ.required = false; // ✅ CORRIGIDO - validação via JavaScript
        inputCPF.value = '';
        labelRazao.textContent = 'Razão Social *';
        labelFantasia.textContent = 'Nome Fantasia';
    } else {
        campoCPF.classList.add('hidden');
        campoCNPJ.classList.add('hidden');
        inputCPF.required = false;
        inputCNPJ.required = false;
        labelRazao.textContent = 'Razão Social / Nome *';
        labelFantasia.textContent = 'Nome Fantasia';
    }
}

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

function mudarAba(aba) {
    console.log('Mudando para aba:', aba);
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${aba}"]`).classList.add('active');
    document.getElementById(`tab-${aba}`).classList.add('active');
}

function aplicarOrdenacao(tipo) {
    event.preventDefault();
    ordenacaoAtual = tipo;
    
    const textos = {
        'razao_social': 'Por Razão Social',
        'data_criacao': 'Ordem de Digitação',
        'ultimos': 'Últimos Lançamentos'
    };
    
    console.log('Ordenação aplicada:', tipo);
    mostrarMensagem(`Ordenação: ${textos[tipo]}`, 'success');
    carregarClientes(1);
}

async function carregarClientes(pagina = 1) {
    try {
        mostrarLoading(true);
        
        let url = `${API_URL}/clientes?page=${pagina}&limit=20`;
        
        if (filtroAtivo === 'razao_social' && valorFiltro) {
            url += `&search=${encodeURIComponent(valorFiltro)}`;
        } else if (filtroAtivo === 'cnpj' && valorFiltro) {
            url += `&search=${encodeURIComponent(valorFiltro)}`;
        }
        
        console.log('🔄 Carregando clientes:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId
            }
        });
        
        const data = await response.json();
        console.log('📦 Resposta da API:', data);
        
        if (data.success) {
            let clientes = data.data;
            
            if (clientes.length > 0) {
                console.log('🔍 Estrutura do cliente (primeiro item):', clientes[0]);
            }
            
            clientes = ordenarClientes(clientes);
            
            renderizarTabela(clientes);
            atualizarPaginacao(data.pagination);
            paginaAtual = pagina;
        } else {
            mostrarMensagem(data.message || 'Erro ao carregar clientes', 'error');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar:', error);
        mostrarMensagem('Erro de conexão ao carregar clientes', 'error');
    } finally {
        mostrarLoading(false);
    }
}

function ordenarClientes(clientes) {
    const copia = [...clientes];
    
    switch (ordenacaoAtual) {
        case 'razao_social':
            return copia.sort((a, b) => a.razao_social.localeCompare(b.razao_social));
        case 'data_criacao':
            return copia.sort((a, b) => a.id - b.id);
        case 'ultimos':
            return copia.sort((a, b) => b.id - a.id);
        default:
            return copia;
    }
}

function renderizarTabela(clientes) {
    const tbody = document.getElementById('tbody');
    
    if (clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px;">Nenhum cliente encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = clientes.map(c => {
        const statusBadge = c.ativo === 'S' ? '🟢 Ativo' : '🔴 Inativo';
        const tipoBadge = c.tipo === 'F' ? '👤 PF' : '🏢 PJ';
        const documento = c.tipo === 'F' ? (c.cpf || '-') : (c.cnpj || '-');
        const clienteId = c.id_cliente || c.id;
        const razaoEscapada = (c.razao_social || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        return `
            <tr>
                <td>${tipoBadge}</td>
                <td>${c.razao_social}</td>
                <td>${c.nome_fantasia || '-'}</td>
                <td>${documento}</td>
                <td>${c.contato || '-'}</td>
                <td>${statusBadge}</td>
                <td style="white-space: nowrap;">
                    <button class="btn-small btn-ficha" 
                            onclick="gerarRelatorioIndividual(${clienteId})" 
                            title="Ficha Completa do Cliente">📄</button>
                    <button class="btn-small btn-edit" 
                            onclick="editarCliente(${clienteId})" 
                            title="Editar Cliente">✏️</button>
                    <button class="btn-small btn-delete" 
                            onclick="confirmarAlteracaoStatus(${clienteId}, '${razaoEscapada}', '${c.ativo}')" 
                            title="Alterar Status">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
    
    console.log('✅ Tabela renderizada:', clientes.length, 'clientes');
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
        carregarClientes(novaPagina);
    }
}

async function aplicarFiltro(tipo) {
    event.preventDefault();
    
    if (tipo === 'razao_social') {
        const valor = await siriusPrompt('Digite parte da razão social:', '', 'Filtrar por Razão Social');
        if (valor) {
            filtroAtivo = 'razao_social';
            valorFiltro = valor;
            mostrarFiltroAtivo(`Razão Social contém: ${valor}`);
            carregarClientes(1);
        }
    } else if (tipo === 'cnpj') {
        const valor = await siriusPrompt('Digite o CNPJ (apenas números):', '', 'Filtrar por CNPJ');
        if (valor) {
            filtroAtivo = 'cnpj';
            valorFiltro = valor.replace(/\D/g, '');
            mostrarFiltroAtivo(`CNPJ: ${valor}`);
            carregarClientes(1);
        }
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
    carregarClientes(1);
}

function abrirModal(cliente = null) {
    const modal = document.getElementById('modal');
    const modalBody = modal.querySelector('.modal-body');
    
    modal.style.display = 'block';
    document.getElementById('modalTitle').textContent = cliente ? 'Editar Cliente' : 'Novo Cliente';
    
    setTimeout(() => {
        modalBody.scrollTop = 0;
    }, 50);
    
    mudarAba('basico');
    
    if (cliente) {
        clienteEditando = cliente;
        preencherFormulario(cliente);
    } else {
        clienteEditando = null;
        document.getElementById('clienteForm').reset();
        document.getElementById('ativo').checked = true;
        alterarTipoPessoa();
    }
}

function fecharModal() {
    document.getElementById('modal').style.display = 'none';
    clienteEditando = null;
}

function preencherFormulario(cliente) {
    console.log('📝 Preenchendo formulário com:', cliente);
    
    document.getElementById('tipo').value = cliente.tipo || '';
    alterarTipoPessoa();
    
    document.getElementById('razao_social').value = cliente.razao_social || '';
    document.getElementById('nome_fantasia').value = cliente.nome_fantasia || '';
    document.getElementById('cpf').value = cliente.cpf || '';
    document.getElementById('cnpj').value = cliente.cnpj || '';
    
    document.getElementById('contato').value = cliente.contato || '';
    document.getElementById('nome_contato').value = cliente.nome_contato || '';
    
    document.getElementById('indicador_ie').value = cliente.indicador_ie || cliente.ind_ie || '';
    document.getElementById('inscricao_estadual').value = cliente.inscricao_estadual || '';
    document.getElementById('inscricao_municipal').value = cliente.inscricao_municipal || '';
    document.getElementById('id_estrangeiro').value = cliente.id_estrangeiro || '';
    
    document.getElementById('ativo').checked = (cliente.ativo === 'S' || cliente.status === 'A');
}

// =====================================================
// SALVAR CLIENTE - COM VALIDAÇÃO CONSUMIDOR FINAL
// =====================================================
async function salvarCliente(event) {
    event.preventDefault();
    
    const tipo = document.getElementById('tipo').value;
    const razao_social = document.getElementById('razao_social').value.trim();
    const cpf = document.getElementById('cpf').value.trim();
    const cnpj = document.getElementById('cnpj').value.trim();
    
    if (!tipo) {
        alertSirius('Por favor, selecione o <strong>tipo de pessoa</strong>!');
        mudarAba('basico');
        document.getElementById('tipo').focus();
        return;
    }
    
    if (!razao_social) {
        alertSirius('Por favor, informe a <strong>razão social / nome</strong>!');
        mudarAba('basico');
        document.getElementById('razao_social').focus();
        return;
    }
    
    // ✅ VALIDAÇÃO ESPECIAL CONSUMIDOR FINAL - CASE INSENSITIVE
    const razao_social_upper = razao_social.toUpperCase();
    const isConsumidorFinal = (razao_social_upper === 'CONSUMIDOR FINAL');
    
    console.log('🔍 Verificando Consumidor Final:', {
        razao_social: razao_social,
        razao_social_upper: razao_social_upper,
        isConsumidorFinal: isConsumidorFinal
    });
    
    // Validar CPF (Pessoa Física) - EXCETO para "Consumidor Final"
    if (tipo === 'F' && !isConsumidorFinal) {
        if (!cpf) {
            alertSirius('Por favor, informe o <strong>CPF</strong>!<br><small>Nota: CPF não é obrigatório apenas para "Consumidor Final"</small>');
            mudarAba('basico');
            document.getElementById('cpf').focus();
            return;
        }
        
        const validacao = validarCPF(cpf);
        if (!validacao.valido) {
            alertSirius(validacao.mensagem);
            mudarAba('basico');
            document.getElementById('cpf').focus();
            return;
        }
    }
    
    // Se for "Consumidor Final" E preencheu CPF, validar o formato
    if (tipo === 'F' && isConsumidorFinal && cpf) {
        const validacao = validarCPF(cpf);
        if (!validacao.valido) {
            alertSirius(validacao.mensagem);
            mudarAba('basico');
            document.getElementById('cpf').focus();
            return;
        }
    }
    
    if (tipo === 'J') {
        if (!cnpj) {
            alertSirius('Por favor, informe o <strong>CNPJ</strong>!');
            mudarAba('basico');
            document.getElementById('cnpj').focus();
            return;
        }
        
        const validacao = validarCNPJ(cnpj);
        if (!validacao.valido) {
            alertSirius(validacao.mensagem);
            mudarAba('basico');
            document.getElementById('cnpj').focus();
            return;
        }
    }
    
    const dados = {
        tipo: tipo,
        razao_social: razao_social,
        nome_fantasia: document.getElementById('nome_fantasia').value.trim() || null,
        cpf: tipo === 'F' && cpf ? cpf.replace(/\D/g, '') : null,
        cnpj: tipo === 'J' ? cnpj.replace(/\D/g, '') : null,
        id_estrangeiro: document.getElementById('id_estrangeiro').value.trim() || null,
        indicador_ie: document.getElementById('indicador_ie').value || null,
        inscricao_estadual: document.getElementById('inscricao_estadual').value.trim() || null,
        inscricao_municipal: document.getElementById('inscricao_municipal').value.trim() || null,
        contato: document.getElementById('contato').value.trim() || null,
        nome_contato: document.getElementById('nome_contato').value.trim() || null,
        ativo: document.getElementById('ativo').checked ? 'S' : 'N'
    };
    
    console.log('💾 Salvando cliente:', dados);
    if (isConsumidorFinal) {
        console.log('🎯 CONSUMIDOR FINAL detectado - CPF não obrigatório');
    }
    
    try {
        const clienteId = clienteEditando ? (clienteEditando.id_cliente || clienteEditando.id) : null;
        
        const url = clienteId 
            ? `${API_URL}/clientes/${clienteId}` 
            : `${API_URL}/clientes`;
        
        const method = clienteId ? 'PUT' : 'POST';
        
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
            carregarClientes(paginaAtual);
        } else {
            alertSirius(data.message || 'Erro ao salvar cliente');
        }
    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        alertSirius('Erro de conexão ao salvar cliente');
    }
}

async function editarCliente(id) {
    console.log('✏️ Editando cliente ID:', id);
    
    if (!id || id === 'undefined') {
        alertSirius('ID do cliente inválido!');
        return;
    }
    
    try {
        const url = `${API_URL}/clientes/${id}`;
        console.log('🔄 Buscando:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId
            }
        });
        
        const data = await response.json();
        console.log('📦 Dados recebidos:', data);
        
        if (data.success) {
            abrirModal(data.data);
        } else {
            mostrarMensagem(data.message || 'Erro ao buscar cliente', 'error');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        mostrarMensagem('Erro de conexão ao buscar cliente', 'error');
    }
}

// =====================================================
// ALTERAR STATUS - NOVA FUNÇÃO
// =====================================================
function confirmarAlteracaoStatus(id, razao_social, statusAtual) {
    const existente = document.getElementById('alertSirius');
    if (existente) existente.remove();
    
    const isAtivo = (statusAtual === 'S');
    const acao = isAtivo ? 'inativar' : 'ativar';
    const corBotao = isAtivo ? '#fa709a 0%, #fee140 100%' : '#48bb78 0%, #38a169 100%';
    
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
        <p style="color: #333; font-size: 1.1em; margin: 0 0 25px 0; line-height: 1.5;">
            Deseja realmente <strong>${acao}</strong> o cliente:<br>"${razao_social}"?
        </p>
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
            <button onclick="document.getElementById('alertSirius').remove(); alterarStatus(${id}, '${statusAtual}');" 
                    style="background: linear-gradient(135deg, ${corBotao}); 
                           color: white; 
                           border: none; 
                           padding: 12px 30px; 
                           border-radius: 8px; 
                           cursor: pointer; 
                           font-size: 16px;
                           font-weight: bold;
                           flex: 1;">
                ${acao.charAt(0).toUpperCase() + acao.slice(1)}
            </button>
        </div>
    `;
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

async function alterarStatus(id, statusAtual) {
    try {
        const novoStatus = (statusAtual === 'S') ? 'N' : 'S';
        
        const response = await fetch(`${API_URL}/clientes/${id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ativo: novoStatus })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const acao = (novoStatus === 'S') ? 'ativado' : 'inativado';
            mostrarMensagem(`Cliente ${acao} com sucesso!`, 'success');
            carregarClientes(paginaAtual);
        } else {
            mostrarMensagem(data.message, 'error');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        mostrarMensagem('Erro ao alterar status do cliente', 'error');
    }
}

async function gerarRelatorio(tipo) {
    try {
        console.log('📊 Gerando relatório:', tipo);
        
        let url = `${API_URL}/clientes?page=1&limit=1000`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId
            }
        });
        
        const data = await response.json();
        
        if (!data.success) {
            alertSirius(data.message || 'Erro ao gerar relatório');
            return;
        }
        
        let clientes = data.data;
        clientes = ordenarClientes(clientes);
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Clientes - SIRIUS WEB</title>
            <style>
                @media print {
                    button { display: none !important; }
                }
                body { font-family: Arial, sans-serif; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { color: #667eea; margin: 0; }
                .info { margin: 10px 0; color: #666; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background: #667eea; color: white; }
                tr:nth-child(even) { background: #f9f9f9; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📋 Relatório de Clientes</h1>
                <div class="info">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
                <div class="info">Total de clientes: ${clientes.length}</div>
            </div>
            ${filtroAtivo ? `<div class="info"><strong>Filtro:</strong> ${document.getElementById('textoFiltro').textContent}</div>` : ''}
            <table>
                <thead>
                    <tr>
                        <th>Tipo</th>
                        <th>Razão Social</th>
                        <th>Nome Fantasia</th>
                        <th>CPF/CNPJ</th>
                        <th>Contato</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${clientes.map(c => `
                        <tr>
                            <td>${c.tipo === 'F' ? 'PF' : 'PJ'}</td>
                            <td>${c.razao_social}</td>
                            <td>${c.nome_fantasia || '-'}</td>
                            <td>${c.tipo === 'F' ? (c.cpf || '-') : (c.cnpj || '-')}</td>
                            <td>${c.contato || '-'}</td>
                            <td>${c.ativo === 'S' || c.status === 'A' ? 'Ativo' : 'Inativo'}</td>
                        </tr>
                    `).join('')}
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
        
    } catch (error) {
        console.error('❌ Erro ao gerar relatório:', error);
        alertSirius('Erro ao gerar relatório: ' + error.message);
    }
}

async function gerarRelatorioIndividual(id) {
    console.log('📄 Gerando ficha do cliente ID:', id);
    
    if (!id || id === 'undefined') {
        alertSirius('ID do cliente inválido!');
        return;
    }
    
    try {
        const url = `${API_URL}/clientes/${id}`;
        console.log('🔄 Buscando cliente:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId
            }
        });
        
        const data = await response.json();
        console.log('📦 Dados recebidos:', data);
        
        if (!data.success) {
            alertSirius(data.message || 'Erro ao buscar cliente');
            return;
        }
        
        const c = data.data;
        const tipoPessoa = c.tipo === 'F' ? 'Pessoa Física' : 'Pessoa Jurídica';
        const documento = c.tipo === 'F' ? (c.cpf || '-') : (c.cnpj || '-');
        const status = c.ativo === 'S' || c.status === 'A' ? 'Ativo' : 'Inativo';
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Ficha do Cliente - ${c.razao_social}</title>
            <style>
                @media print {
                    button { display: none !important; }
                }
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #667eea; padding-bottom: 20px; }
                .header h1 { color: #667eea; margin: 0 0 10px 0; }
                .section { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 8px; }
                .section-title { font-size: 1.2em; color: #667eea; margin-bottom: 15px; font-weight: bold; border-bottom: 2px solid #667eea; padding-bottom: 5px; }
                .field { margin: 8px 0; display: flex; }
                .field strong { width: 200px; color: #666; }
                .field span { flex: 1; color: #333; }
                .status-ativo { color: green; font-weight: bold; }
                .status-inativo { color: red; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📄 Ficha Completa do Cliente</h1>
                <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
            </div>
            
            <div class="section">
                <div class="section-title">👤 Dados Básicos</div>
                <div class="field"><strong>Tipo:</strong> <span>${tipoPessoa}</span></div>
                <div class="field"><strong>Razão Social/Nome:</strong> <span>${c.razao_social}</span></div>
                <div class="field"><strong>Nome Fantasia:</strong> <span>${c.nome_fantasia || '-'}</span></div>
                <div class="field"><strong>CPF/CNPJ:</strong> <span>${documento}</span></div>
                <div class="field"><strong>ID Estrangeiro:</strong> <span>${c.id_estrangeiro || '-'}</span></div>
                <div class="field"><strong>Status:</strong> <span class="${status === 'Ativo' ? 'status-ativo' : 'status-inativo'}">${status}</span></div>
            </div>
            
            <div class="section">
                <div class="section-title">📞 Contato</div>
                <div class="field"><strong>Telefone:</strong> <span>${c.contato || '-'}</span></div>
                <div class="field"><strong>Nome Contato:</strong> <span>${c.nome_contato || '-'}</span></div>
            </div>
            
            <div class="section">
                <div class="section-title">📋 Dados Fiscais</div>
                <div class="field"><strong>Indicador IE:</strong> <span>${c.indicador_ie || c.ind_ie || '-'}</span></div>
                <div class="field"><strong>Inscrição Estadual:</strong> <span>${c.inscricao_estadual || '-'}</span></div>
                <div class="field"><strong>Inscrição Municipal:</strong> <span>${c.inscricao_municipal || '-'}</span></div>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <button onclick="window.print()" style="padding: 12px 30px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; margin-right: 10px;">🖨️ Imprimir</button>
                <button onclick="window.close()" style="padding: 12px 30px; background: #6c757d; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">✖ Fechar</button>
            </div>
        </body>
        </html>
        `;
        
        const janela = window.open('', '_blank');
        janela.document.write(html);
        janela.document.close();
        
    } catch (error) {
        console.error('❌ Erro:', error);
        alertSirius('Erro ao gerar ficha do cliente: ' + error.message);
    }
}

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

function siriusPrompt(mensagem, valorPadrao = '', titulo = 'Digite:') {
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
        
        const inputId = 'siriusPromptInput_' + Date.now();
        
        box.innerHTML = `
            <h3 style="color: #667eea; margin: 0 0 10px 0; font-size: 1.3em;">🔍 ${titulo}</h3>
            <p style="color: #666; margin: 0 0 15px 0;">${mensagem}</p>
            <input type="text" 
                   id="${inputId}"
                   value="${valorPadrao}"
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

window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target == modal) {
        fecharModal();
    }
}

console.log('🚀 Clientes JS - VERSÃO FINAL CORRIGIDA - TODOS OS PROBLEMAS RESOLVIDOS ✅');
