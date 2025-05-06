/**
 * index.js - Carregador dinâmico inteligente
 * Detecta a página atual e importa o módulo correspondente
 */

(async () => {
    const path = window.location.pathname;
    
    if (path.includes("clientes")) {
        await import("./clients.js");
    } else if (path.includes("/index.html") || path === "/" || path.endsWith("/")) {
        await import("./dashboard.js");
    } else {
        console.warn("Nenhum módulo correspondente encontrado para:", path);
    }
})();