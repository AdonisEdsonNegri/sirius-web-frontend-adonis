// =====================================================
// SIRIUS WEB - Autenticação
// =====================================================

// Configuração da API
const API_URL = 'https://sirius-web-api-adonis.vercel.app';

// Elementos do DOM
const loginForm = document.getElementById('loginForm');
const btnLogin = document.getElementById('btnLogin');
const messageEl = document.getElementById('message');
const linkEsqueceuSenha = document.getElementById('linkEsqueceuSenha');

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

// Mostrar mensagem
function showMessage(text, type = 'error') {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.classList.remove('hidden');
    
    // Auto-ocultar após 5 segundos
    setTimeout(() => {
        messageEl.classList.add('hidden');
    }, 5000);
}

// Desabilitar/habilitar botão
function setLoading(loading) {
    btnLogin.disabled = loading;
}

// Salvar dados de autenticação
function saveAuth(token, usuario, empresas) {
    localStorage.setItem('sirius_token', token);
    localStorage.setItem('sirius_usuario', JSON.stringify(usuario));
    localStorage.setItem('sirius_empresas', JSON.stringify(empresas));
}

// Verificar se já está logado
function checkAuth() {
    const token = localStorage.getItem('sirius_token');
    if (token) {
        // Já está logado, redireciona para dashboard
        window.location.href = 'dashboard.html';
    }
}

// =====================================================
// LOGIN
// =====================================================

async function login(email, senha) {
    setLoading(true);
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, senha })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Login bem-sucedido
            showMessage('Login realizado com sucesso!', 'success');
            
            // Salvar dados
            saveAuth(data.data.token, data.data.usuario, data.data.empresas);
            
            // Redirecionar após 1 segundo
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
            
        } else {
            // Erro na resposta
            showMessage(data.message || 'Erro ao fazer login. Verifique suas credenciais.');
        }
        
    } catch (error) {
        console.error('Erro:', error);
        showMessage('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
        setLoading(false);
    }
}

// =====================================================
// EVENTOS
// =====================================================

// Submit do formulário
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    
    // Validações básicas
    if (!email || !senha) {
        showMessage('Preencha todos os campos!');
        return;
    }
    
    if (!email.includes('@')) {
        showMessage('E-mail inválido!');
        return;
    }
    
    // Fazer login
    await login(email, senha);
});

// Links (implementar depois)
linkEsqueceuSenha.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Funcionalidade em desenvolvimento!');
});

// =====================================================
// INICIALIZAÇÃO
// =====================================================

// Verificar se já está logado ao carregar a página
checkAuth();

// Focar no campo de email
document.getElementById('email').focus();

console.log('🚀 SIRIUS WEB - Sistema iniciado');
console.log('📡 API:', API_URL);
