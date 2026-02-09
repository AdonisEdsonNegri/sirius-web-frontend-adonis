// =====================================================
// SIRIUS WEB - Autenticação
// =====================================================

// Configuração da API
const isDev = window.location.hostname === 'localhost' 
           || window.location.hostname === '127.0.0.1'
           || window.location.hostname === ''
           || window.location.protocol === 'file:';

const API_URL = isDev ? 'http://localhost:3000' : 'https://sirius-web-api-adonis.vercel.app';

console.log('🚀 SIRIUS WEB - Sistema iniciado');
console.log('📡 API:', API_URL);

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

// Mostrar mensagem
function showMessage(text, type = 'error') {
    const messageEl = document.getElementById('message');
    if (messageEl) {
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
        messageEl.classList.remove('hidden');
        
        // Auto-ocultar após 5 segundos
        setTimeout(() => {
            messageEl.classList.add('hidden');
        }, 5000);
    } else {
        // Fallback para páginas sem elemento message
        alert(text);
    }
}

// Desabilitar/habilitar botão
function setLoading(loading) {
    const btnLogin = document.getElementById('btnLogin');
    if (btnLogin) {
        btnLogin.disabled = loading;
    }
}

// Salvar dados de autenticação
function saveAuth(token, usuario, empresas) {
    localStorage.setItem('sirius_token', token);
    localStorage.setItem('sirius_usuario', JSON.stringify(usuario));
    localStorage.setItem('sirius_empresas', JSON.stringify(empresas));
}

// Verificar se já está logado (apenas para página de login)
function checkAuth() {
    const token = localStorage.getItem('sirius_token');
    if (token && window.location.pathname.includes('index.html')) {
        // Já está logado e está na página de login, redireciona para dashboard
        window.location.href = 'dashboard.html';
    }
}

// Logout
function logout() {
    localStorage.removeItem('sirius_token');
    localStorage.removeItem('sirius_usuario');
    localStorage.removeItem('sirius_empresas');
    window.location.href = 'index.html';
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
// EVENTOS (apenas se os elementos existirem)
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    // Elementos do DOM (apenas para página de login)
    const loginForm = document.getElementById('loginForm');
    const linkEsqueceuSenha = document.getElementById('linkEsqueceuSenha');
    const emailInput = document.getElementById('email');
    
    // Verificar se já está logado (apenas na página de login)
    checkAuth();
    
    // Configurar eventos apenas se os elementos existirem
    if (loginForm) {
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
    }
    
    if (linkEsqueceuSenha) {
        linkEsqueceuSenha.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Funcionalidade em desenvolvimento!');
        });
    }
    
    if (emailInput) {
        emailInput.focus();
    }
});
