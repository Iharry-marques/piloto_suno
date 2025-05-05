/**
 * Dashboard de Tarefas - SUNO
 * timeline-click-handler.js - Handler para cliques em itens da timeline
 */

// Função para configurar handlers de clique na timeline
function setupTimelineClickHandlers(timeline, itemsData) {
    const container = document.getElementById("timeline");
    if (!container) return;
    
    // Remover event listeners existentes para evitar duplicação
    const cloneNode = container.cloneNode(true);
    container.parentNode.replaceChild(cloneNode, container);
    
    // Adicionar o novo event listener
    cloneNode.addEventListener('click', (event) => {
      const element = event.target.closest('.vis-item');
      if (!element) return;
      
      // Toggle da classe expanded
      if (element.classList.contains('expanded')) {
        // Colapsar o item
        element.classList.remove('expanded');
        
        // Restaurar conteúdo original se necessário
        const itemId = element.getAttribute('data-id');
        if (itemId && timeline && timeline.itemsData) {
          const item = timeline.itemsData.get(itemId);
          
          if (item && item._conteudoOriginal) {
            timeline.itemsData.update({
              id: itemId,
              content: item._conteudoOriginal
            });
          }
        }
      } else {
        // Remover a classe expanded de todos os outros elementos primeiro
        document.querySelectorAll('.vis-item.expanded').forEach(el => {
          if (el !== element) {
            el.classList.remove('expanded');
            
            // Restaurar conteúdo original dos outros itens
            const otherId = el.getAttribute('data-id');
            if (otherId && timeline && timeline.itemsData) {
              const otherItem = timeline.itemsData.get(otherId);
              if (otherItem && otherItem._conteudoOriginal) {
                timeline.itemsData.update({
                  id: otherId,
                  content: otherItem._conteudoOriginal
                });
              }
            }
          }
        });
        
        // Expandir o item atual
        element.classList.add('expanded');
        
        // Usar conteúdo completo para o item expandido
        const itemId = element.getAttribute('data-id');
        if (itemId && timeline && timeline.itemsData) {
          const item = timeline.itemsData.get(itemId);
          
          if (item && item._conteudoCompleto) {
            timeline.itemsData.update({
              id: itemId,
              content: item._conteudoCompleto
            });
          }
        }
      }
    });
    
    return cloneNode;
  }
  
  // Versão simplificada que apenas adiciona/remove a classe 'expanded'
  // Útil quando o conteúdo expandido é controlado apenas via CSS
  function setupSimpleTimelineClickHandlers() {
    const container = document.getElementById("timeline");
    if (!container) return;
    
    // Remover event listeners existentes para evitar duplicação
    const cloneNode = container.cloneNode(true);
    container.parentNode.replaceChild(cloneNode, container);
    
    // Adicionar o novo event listener
    cloneNode.addEventListener('click', (event) => {
      const element = event.target.closest('.vis-item');
      if (!element) return;
      
      // Toggle da classe expanded
      if (element.classList.contains('expanded')) {
        element.classList.remove('expanded');
      } else {
        // Remover a classe expanded de todos os outros elementos primeiro
        document.querySelectorAll('.vis-item.expanded').forEach(el => {
          if (el !== element) el.classList.remove('expanded');
        });
        
        element.classList.add('expanded');
      }
    });
    
    return cloneNode;
  }