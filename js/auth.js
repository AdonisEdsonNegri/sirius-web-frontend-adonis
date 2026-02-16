// =====================================================
// SIRIUS WEB - Autenticação
// ✅ ATUALIZADO: Salva parâmetros + Verifica localStorage
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
// VERIFICAR COMPATIBILIDADE DE LOCALSTORAGE
// =====================================================
function verificarLocalStorage() {
    try {
        const teste = '__teste_localstorage__';
        localStorage.setItem(teste, teste);
        localStorage.removeItem(teste);
        return true;
    } catch (e) {
        return false;
    }
}

function mostrarErroCompatibilidade() {
    document.body.innerHTML = `
        <div style="
            max-width: 600px;
            margin: 100px auto;
            padding: 40px;
            background: #fee2e2;
            border: 2px solid #ef4444;
            border-radius: 12px;
            text-align: center;
            font-family: Arial, sans-serif;
        ">
            <h2 style="color: #991b1b; margin-bottom: 20px;">
                ⚠️ Navegador Incompatível
            </h2>
            <p style="color: #7f1d1d; font-size: 16px; margin-bottom: 20px;">
                Seu navegador está com o armazenamento local (localStorage) desabilitado.
            </p>
            <p style="color: #7f1d1d; margin-bottom: 20px;">
                O SIRIUS WEB precisa deste recurso para funcionar corretamente.
            </p>
            <h3 style="color: #991b1b; margin: 20px 0 10px 0;">
                Soluções:
            </h3>
            <ul style="text-align: left; color: #7f1d1d; line-height: 1.8; max-width: 400px; margin: 0 auto;">
                <li><strong>Saia do modo anônimo/privado</strong> e tente novamente</li>
                <li><strong>Habilite cookies</strong> nas configurações do navegador</li>
                <li><strong>Use um navegador moderno:</strong> Chrome, Firefox, Edge ou Safari</li>
                <li><strong>Entre em contato</strong> com o suporte se o problema persistir</li>
            </ul>
            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
                Navegadores compatíveis: Chrome 4+, Firefox 3.5+, Safari 4+, Edge (todos)
            </p>
        </div>
    `;
}

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
// ✅ ATUALIZADO: Agora salva também os parâmetros
function saveAuth(token, usuario, empresas, parametros) {
    try {
        localStorage.setItem('sirius_token', token);
        localStorage.setItem('sirius_usuario', JSON.stringify(usuario));
        localStorage.setItem('sirius_empresas', JSON.stringify(empresas));
        localStorage.setItem('sirius_parametros', JSON.stringify(parametros)); // ✅ NOVO!
        
        console.log('✅ Autenticação salva no localStorage');
        console.log(`✅ ${Object.keys(parametros).length} parâmetros carregados`);
    } catch (error) {
        console.error('❌ Erro ao salvar no localStorage:', error);
        showMessage('Erro ao salvar dados. Tente novamente.', 'error');
    }
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
    localStorage.removeItem('sirius_parametros'); // ✅ Limpar parâmetros também
    window.location.href = 'index.html';
}

// =====================================================
// LOGIN
// ✅ ATUALIZADO: Recebe e salva parâmetros
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
            
            // ✅ ATUALIZADO: Salvar dados + parâmetros
            saveAuth(
                data.data.token, 
                data.data.usuario, 
                data.data.empresas,
                data.data.parametros || {} // ✅ NOVO! Parâmetros da empresa
            );
            
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
    // ✅ VERIFICAR COMPATIBILIDADE DE LOCALSTORAGE
    if (!verificarLocalStorage()) {
        console.error('❌ localStorage não disponível!');
        mostrarErroCompatibilidade();
        return; // Bloqueia execução
    }
    
    console.log('✅ localStorage disponível');
    
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
