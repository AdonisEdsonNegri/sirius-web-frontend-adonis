// =====================================================
// SIRIUS WEB - Clientes JavaScript
// =====================================================

//const API_URL = 'http://localhost:3000'; // Trocar para Vercel depois

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
    
    // Validação do primeiro dígito verificador
    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(9))) {
        return { valido: false, mensagem: 'CPF inválido! Dígito verificador incorreto.' };
    }
    
    // Validação do segundo dígito verificador
    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(10))) {
        return { valido: false, mensagem: 'CPF inválido! Dígito verificador incorreto.' };
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
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{13}$/.test(cnpj)) {
        return { valido: false, mensagem: 'CNPJ inválido.' };
    }
    
    // Validação do primeiro dígito verificador
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
    
    // Validação do segundo dígito verificador
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
// ALTERNAR TIPO DE PESSOA
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
        // Pessoa Física
        campoCPF.classList.remove('hidden');
        campoCNPJ.classList.add('hidden');
        inputCPF.required = true;
        inputCNPJ.required = false;
        inputCNPJ.value = '';
        labelRazao.textContent = 'Nome Completo *';
        labelFantasia.textContent = 'Apelido / Nome Social';
    } else if (tipo === 'J') {
        // Pessoa Jurídica
        campoCPF.classList.add('hidden');
        campoCNPJ.classList.remove('hidden');
        inputCPF.required = false;
        inputCNPJ.required = true;
        inputCPF.value = '';
        labelRazao.textContent = 'Razão Social *';
        labelFantasia.textContent = 'Nome Fantasia';
    } else {
        // Nenhum tipo selecionado
        campoCPF.classList.add('hidden');
        campoCNPJ.classList.add('hidden');
        inputCPF.required = false;
        inputCNPJ.required = false;
        labelRazao.textContent = 'Razão Social / Nome *';
        labelFantasia.textContent = 'Nome Fantasia';
    }
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
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${aba}"]`).classList.add('active');
    document.getElementById(`tab-${aba}`).classList.add('active');
}

// Ordenação
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

// Carregar Clientes
async function carregarClientes(pagina = 1) {
    try {
        mostrarLoading(true);
        
        let url = `${API_URL}/clientes?page=${pagina}&limit=20`;
        
        // Aplicar filtros
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
            
            // Ordenação client-side
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
            return copia.sort((a, b) => a.id - b.id); // ASC
        case 'ultimos':
            return copia.sort((a, b) => b.id - a.id); // DESC
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
        const clienteId = c.id;
        
        // Escapar aspas
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
                            onclick="confirmarExclusao(${clienteId}, '${razaoEscapada}')" 
                            title="Inativar Cliente">🗑️</button>
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

// Filtros
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

// Alert Customizado "Sirius Web informa:"
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
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}
// =====================================================
// PARTE 2 - CRUD, MODAL E RELATÓRIOS
// =====================================================

// Relatório Geral
function gerarRelatorio() {
    event.preventDefault();
    
    const tbody = document.getElementById('tbody');
    const rows = tbody.querySelectorAll('tr');
    
    if (rows.length === 0 || (rows.length === 1 && rows[0].cells.length === 1)) {
        alert('Nenhum cliente para gerar relatório');
        return;
    }
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Clientes - SIRIUS WEB</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #667eea; text-align: center; }
                .info { text-align: center; color: #666; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #667eea; color: white; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                @media print {
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>🏢 SIRIUS WEB - Relatório de Clientes</h1>
            <div class="info">
                <strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')} 
                <strong>Hora:</strong> ${new Date().toLocaleTimeString('pt-BR')}
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
                    ${Array.from(rows).map(row => {
                        const cells = Array.from(row.cells);
                        if (cells.length === 1) return '';
                        return `
                            <tr>
                                ${cells.slice(0, 6).map(cell => `<td>${cell.textContent}</td>`).join('')}
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

// Relatório Individual do Cliente (FICHA)
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
        const documento = c.tipo === 'F' ? `CPF: ${c.cpf || '-'}` : `CNPJ: ${c.cnpj || '-'}`;
        
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Ficha do Cliente - ${c.razao_social}</title>
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
                <h1>🏢 SIRIUS WEB - Ficha do Cliente</h1>
                <div class="info">
                    <strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')} 
                    <strong>Hora:</strong> ${new Date().toLocaleTimeString('pt-BR')}
                </div>
                
                <div class="section">
                    <div class="section-title">📋 Dados Básicos</div>
                    <div class="field"><strong>Tipo:</strong> <span>${tipoPessoa}</span></div>
                    <div class="field"><strong>Razão Social / Nome:</strong> <span>${c.razao_social}</span></div>
                    <div class="field"><strong>Nome Fantasia:</strong> <span>${c.nome_fantasia || '-'}</span></div>
                    <div class="field"><strong>${documento}</strong></div>
                    <div class="field"><strong>ID Estrangeiro:</strong> <span>${c.id_estrangeiro || '-'}</span></div>
                    <div class="field"><strong>Status:</strong> <span>${c.ativo === 'S' ? '🟢 Ativo' : '🔴 Inativo'}</span></div>
                </div>
                
                <div class="section">
                    <div class="section-title">📞 Contato</div>
                    <div class="field"><strong>Telefone / WhatsApp:</strong> <span>${c.contato || '-'}</span></div>
                    <div class="field"><strong>Nome do Contato:</strong> <span>${c.nome_contato || '-'}</span></div>
                </div>
                
                <div class="section">
                    <div class="section-title">📄 Dados Fiscais</div>
                    <div class="field"><strong>Indicador de IE:</strong> <span>${c.indicador_ie || '-'}</span></div>
                    <div class="field"><strong>Inscrição Estadual:</strong> <span>${c.inscricao_estadual || '-'}</span></div>
                    <div class="field"><strong>Inscrição Municipal:</strong> <span>${c.inscricao_municipal || '-'}</span></div>
                </div>
                
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
        alterarTipoPessoa(); // Reseta os campos de CPF/CNPJ
    }
}

function fecharModal() {
    document.getElementById('modal').style.display = 'none';
    clienteEditando = null;
}

function preencherFormulario(cliente) {
    console.log('📝 Preenchendo formulário com:', cliente);
    
    // Tipo
    document.getElementById('tipo').value = cliente.tipo || '';
    alterarTipoPessoa();
    
    // Dados básicos
    document.getElementById('razao_social').value = cliente.razao_social || '';
    document.getElementById('nome_fantasia').value = cliente.nome_fantasia || '';
    document.getElementById('cpf').value = cliente.cpf || '';
    document.getElementById('cnpj').value = cliente.cnpj || '';
    
    // Contato
    document.getElementById('contato').value = cliente.contato || '';
    document.getElementById('nome_contato').value = cliente.nome_contato || '';
    
    // Dados fiscais
    document.getElementById('indicador_ie').value = cliente.indicador_ie || '';
    document.getElementById('inscricao_estadual').value = cliente.inscricao_estadual || '';
    document.getElementById('inscricao_municipal').value = cliente.inscricao_municipal || '';
    document.getElementById('id_estrangeiro').value = cliente.id_estrangeiro || '';
    
    // Configurações
    document.getElementById('ativo').checked = cliente.ativo === 'S';
}

// Salvar Cliente (COM VALIDAÇÕES COMPLETAS)
async function salvarCliente(event) {
    event.preventDefault();
    
    // ========== VALIDAÇÕES OBRIGATÓRIAS ==========
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
    
    // Validar CPF (Pessoa Física)
    if (tipo === 'F') {
        if (!cpf) {
            alertSirius('Por favor, informe o <strong>CPF</strong>!');
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
    
    // Validar CNPJ (Pessoa Jurídica)
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
    
    // ========== PREPARAR DADOS NO FORMATO DA API ==========
    const dados = {
        tipo: tipo,
        razao_social: razao_social,
        nome_fantasia: document.getElementById('nome_fantasia').value.trim() || null,
        cpf: tipo === 'F' ? cpf.replace(/\D/g, '') : null,
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
    
    try {
        const clienteId = clienteEditando ? clienteEditando.id : null;
        
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

// Editar Cliente
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

// Excluir Cliente
function confirmarExclusao(id, razao_social) {
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
        <p style="color: #333; font-size: 1.1em; margin: 0 0 25px 0; line-height: 1.5;">Deseja realmente inativar o cliente:<br><strong>"${razao_social}"</strong>?</p>
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
            <button onclick="document.getElementById('alertSirius').remove(); excluirCliente(${id});" 
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

async function excluirCliente(id) {
    try {
        const response = await fetch(`${API_URL}/clientes/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Empresa-Id': empresaId
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarMensagem(data.message, 'success');
            carregarClientes(paginaAtual);
        } else {
            mostrarMensagem(data.message, 'error');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        mostrarMensagem('Erro ao excluir cliente', 'error');
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

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target == modal) {
        fecharModal();
    }
}

// =====================================================
// ATALHOS DE TECLADO - UX MELHORADO
// =====================================================
// Permite digitar F/J para Tipo de Pessoa
// Permite digitar 1/2/9 para Indicador IE

document.addEventListener('DOMContentLoaded', function() {
    // Atalho para Tipo de Pessoa (F = Física, J = Jurídica)
    const campoTipo = document.getElementById('tipo');
    if (campoTipo) {
        campoTipo.addEventListener('keypress', function(e) {
            const tecla = e.key.toUpperCase();
            
            if (tecla === 'F') {
                e.preventDefault();
                this.value = 'F';
                alterarTipoPessoa(); // Trigger da função existente
                console.log('✅ Tipo Pessoa: F (atalho teclado)');
            } else if (tecla === 'J') {
                e.preventDefault();
                this.value = 'J';
                alterarTipoPessoa(); // Trigger da função existente
                console.log('✅ Tipo Pessoa: J (atalho teclado)');
            }
        });
        
        // Dica visual ao focar
        campoTipo.addEventListener('focus', function() {
            campoTipo.setAttribute('title', 'Digite F para Física ou J para Jurídica');
        });
    }
    
    // Atalho para Indicador IE (1, 2 ou 9)
    const campoIE = document.getElementById('indicador_ie');
    if (campoIE) {
        campoIE.addEventListener('keypress', function(e) {
            const tecla = e.key;
            
            if (tecla === '1') {
                e.preventDefault();
                this.value = '1';
                console.log('✅ Indicador IE: 1 - Contribuinte (atalho teclado)');
            } else if (tecla === '2') {
                e.preventDefault();
                this.value = '2';
                console.log('✅ Indicador IE: 2 - Isento (atalho teclado)');
            } else if (tecla === '9') {
                e.preventDefault();
                this.value = '9';
                console.log('✅ Indicador IE: 9 - Não Contribuinte (atalho teclado)');
            }
        });
        
        // Dica visual ao focar
        campoIE.addEventListener('focus', function() {
            campoIE.setAttribute('title', 'Digite 1 (Contribuinte), 2 (Isento) ou 9 (Não Contribuinte)');
        });
    }
    
    console.log('⌨️ Atalhos de teclado ativados: F/J para Tipo Pessoa, 1/2/9 para IE');
});

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

console.log('🚀 Clientes JS - VERSÃO COMPLETA COM VALIDAÇÕES ✅');
