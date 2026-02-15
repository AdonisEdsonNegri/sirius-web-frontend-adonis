// =====================================================
// SIRIUS WEB - Manual do Usuário JavaScript
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    // Carregar nome do usuário
    carregarNomeUsuario();
    
    // Configurar navegação do sidebar
    configurarNavegacao();
    
    // Highlight automático das seções
    configurarScrollSpy();
});

// =====================================================
// CARREGAR NOME DO USUÁRIO
// =====================================================
function carregarNomeUsuario() {
    const usuario = JSON.parse(localStorage.getItem('sirius_usuario'));
    if (usuario) {
        document.getElementById('userName').textContent = usuario.nome;
    }
}

// =====================================================
// CONFIGURAR NAVEGAÇÃO
// =====================================================
function configurarNavegacao() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Remover active de todos
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Adicionar active no clicado
            item.classList.add('active');
        });
    });
}

// =====================================================
// SCROLL SPY (Destacar seção atual no menu)
// =====================================================
function configurarScrollSpy() {
    const sections = document.querySelectorAll('.section');
    const navItems = document.querySelectorAll('.nav-item');
    
    window.addEventListener('scroll', () => {
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 120;
            const sectionHeight = section.clientHeight;
            
            if (window.pageYOffset >= sectionTop) {
                current = section.getAttribute('id');
            }
        });
        
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === `#${current}`) {
                item.classList.add('active');
            }
        });
    });
}

// =====================================================
// BUSCA NO MANUAL (OPCIONAL - IMPLEMENTAR FUTURAMENTE)
// =====================================================
function buscarNoManual(termo) {
    // TODO: Implementar busca de texto nas seções
    console.log('Buscar:', termo);
}
