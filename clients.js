/**
 * Dashboard de Tarefas - SUNO
 * clients.js - Versão atualizada para visualização por cliente
 */

const CONFIG = {
  priorityClasses: {
    high: "task-priority-high",
    medium: "task-priority-medium",
    low: "task-priority-low"
  }
};

let appState = {
  allData: [],
  filteredData: [],
  timeline: null,
  isLoading: false,
  settings: {
    dataSource: localStorage.getItem("dataSource") || "json",
    jsonUrl: localStorage.getItem("jsonUrl") || "dados.json"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("ano-atual").textContent = new Date().getFullYear();
  setupEventListeners();
  carregarDados();
});

function setupEventListeners() {
  document.getElementById("btn-anterior").addEventListener("click", () => moverTimeline(-7));
  document.getElementById("btn-hoje").addEventListener("click", () => irParaHoje());
  document.getElementById("btn-proximo").addEventListener("click", () => moverTimeline(7));
  document.getElementById("btn-zoom-out").addEventListener("click", () => ajustarZoom(0.7));
  document.getElementById("btn-zoom-in").addEventListener("click", () => ajustarZoom(1.3));
  document.getElementById("exportar-dados").addEventListener("click", exportarCSV);
  document.getElementById("cliente-select").addEventListener("change", atualizarFiltros);
  document.getElementById("periodo-select").addEventListener("change", atualizarFiltros);
  document.getElementById("grupo-principal-select").addEventListener("change", atualizarFiltros);
  
  // Novos event listeners para filtros de tipo de tarefa
  document.getElementById("mostrar-tarefas")?.addEventListener("change", atualizarFiltros);
  document.getElementById("mostrar-subtarefas")?.addEventListener("change", atualizarFiltros);
  
  configurarEventoTelaCheia();
}

async function carregarDados() {
  try {
    mostrarLoading(true);
    await carregarDadosDeJSON();
    preencherFiltros();
    atualizarFiltros();
  } catch (e) {
    console.error(e);
    mostrarNotificacao("Erro", e.message, "error");
  } finally {
    mostrarLoading(false);
  }
}

async function carregarDadosDeJSON() {
  const response = await fetch(appState.settings.jsonUrl);
  if (!response.ok) throw new Error(`Erro ao carregar JSON: ${response.status}`);
  const dados = await response.json();
  appState.allData = dados.map(preprocessarDados);
  mostrarNotificacao("Dados carregados", `${appState.allData.length} tarefas carregadas.`, "success");
}

function preprocessarDados(item) {
  const clone = { ...item };
  
  // Definir prioridade se não estiver presente
  if (!clone.Priority) {
    const p = ["high", "medium", "low"];
    clone.Priority = p[Math.floor(Math.random() * 3)];
  }
  
  // Garantir que o campo tipo esteja sempre definido
  clone.tipo = clone.tipo || "Tarefa";
  
  return clone;
}

function preencherFiltros() {
  const clientes = [...new Set(appState.allData.map(t => t.ClientNickname || t.client).filter(Boolean))].sort();
  const grupos = [...new Set(appState.allData.map(t => t.TaskExecutionFunctionGroupName || t.TaskOwnerGroup).filter(Boolean))].sort();

  const clienteSelect = document.getElementById("cliente-select");
  clienteSelect.innerHTML = '<option value="todos">Todos</option>';
  clientes.forEach(c => {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    clienteSelect.appendChild(o);
  });

  const grupoSelect = document.getElementById("grupo-principal-select");
  const existentes = Array.from(grupoSelect.options).map(o => o.value);
  grupos.forEach(g => {
    if (!existentes.includes(g)) {
      const o = document.createElement("option");
      o.value = g;
      o.textContent = g;
      grupoSelect.appendChild(o);
    }
  });
}

function atualizarFiltros() {
  const cliente = document.getElementById("cliente-select").value;
  const grupo = document.getElementById("grupo-principal-select").value;
  const dias = parseInt(document.getElementById("periodo-select").value);
  const mostrarTarefas = document.getElementById("mostrar-tarefas").checked;
  const mostrarSubtarefas = document.getElementById("mostrar-subtarefas").checked;
  
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);

  let filtrado = appState.allData.filter(item => {
    const dataInicio = item.RequestDate || item.start;
    return dataInicio && new Date(dataInicio) >= limite;
  });
  
  // Filtro por cliente
  if (cliente !== "todos") {
    filtrado = filtrado.filter(i => (i.ClientNickname || i.client) === cliente);
  }
  
  // Filtro por grupo
  if (grupo !== "todos") {
    filtrado = filtrado.filter(i => 
      (i.TaskExecutionFunctionGroupName === grupo) || 
      (i.TaskOwnerGroup === grupo)
    );
  }
  
  // Filtrar por tipo de tarefa
  if (!mostrarTarefas || !mostrarSubtarefas) {
    filtrado = filtrado.filter(item => {
      const isSubtask = item.tipo === "Subtarefa";
      if (!mostrarTarefas && !isSubtask) return false;
      if (!mostrarSubtarefas && isSubtask) return false;
      return true;
    });
  }
  
  appState.filteredData = filtrado;
  criarTimeline(filtrado);
}

function criarTimeline(dados) {
  const container = document.getElementById("timeline");
  container.innerHTML = "";
  if (!dados || dados.length === 0) {
    container.innerHTML = '<div class="alert alert-info m-3">Nenhuma tarefa encontrada.</div>';
    return;
  }

  const grupos = [...new Set(dados.map(t => {
    return t.TaskExecutionFunctionGroupName || 
           t.TaskOwnerGroup || 
           t.ClientNickname || 
           t.client || 
           "Sem grupo";
  }))].sort();
  
  const items = new vis.DataSet(dados.map((item, i) => {
    const inicio = item.RequestDate || item.start || moment().format('YYYY-MM-DD');
    const fim = item.TaskClosingDate || 
                item.CurrentDueDate || 
                item.end || 
                moment(inicio).add(7, 'days').format('YYYY-MM-DD');
    
    // Verificar se é uma tarefa de curta duração (menos de 24 horas)
    const startDate = moment(inicio);
    const endDate = moment(fim);
    const isShortDuration = endDate.diff(startDate, 'hours') <= 24 || 
                            startDate.format('YYYY-MM-DD') === endDate.format('YYYY-MM-DD');
    
    const titulo = item.TaskTitle || item.name || "Sem título";
    const isSubtask = item.tipo === "Subtarefa";
    const titlePrefix = isSubtask ? "↳ " : "";
    const shortDurationClass = isShortDuration ? "short-duration" : "";
    
    // Para tarefas curtas, mostramos apenas um indicador visual
    const conteudoReduzido = isShortDuration 
      ? `<span title="${titulo}" class="task-dot">${titlePrefix.trim()}</span>`
      : `<span title="${titulo}">${titlePrefix}${titulo.length > 30 ? titulo.slice(0, 27) + '...' : titulo}</span>`;
        
    // Conteúdo completo para quando expandir
    const conteudoCompleto = `<div class="full-content">
                                ${titlePrefix}${titulo}
                              </div>`;
    
    return {
      id: i,
      content: conteudoReduzido,
      _conteudoCompleto: conteudoCompleto, // Armazenamos o conteúdo completo como propriedade
      _conteudoOriginal: conteudoReduzido, // Armazenamos o conteúdo original
      start: inicio,
      end: fim,
      group: item.ClientNickname || item.client || "Outro",
      title: `
        <div class="timeline-tooltip">
          <h5>${titulo}</h5>
          <p><strong>Cliente:</strong> ${item.ClientNickname || item.client || "N/A"}</p>
          <p><strong>Responsável:</strong> ${item.TaskOwner || item.responsible || "N/A"}</p>
          <p><strong>Período:</strong> ${startDate.format("DD/MM/YYYY")} - ${endDate.format("DD/MM/YYYY")}</p>
          <p><strong>Status:</strong> ${item.PipelineStepTitle || item.status || "N/A"}</p>
          <p><strong>Grupo:</strong> ${item.TaskExecutionFunctionGroupName || item.TaskOwnerGroup || "N/A"}</p>
          <p><strong>Tipo:</strong> ${item.tipo || "Tarefa"}</p>
        </div>`,
      className: `${CONFIG.priorityClasses[item.Priority] || ""} ${isSubtask ? 'subtask' : ''} ${shortDurationClass}`
    };
  }));
  
  const visGroups = new vis.DataSet(grupos.map(g => ({ id: g, content: g })));

  appState.timeline = new vis.Timeline(container, items, visGroups, {
    orientation: "top",
    stack: true,
    horizontalScroll: true,
    zoomKey: "ctrlKey",
    height: "700px",
    zoomMin: 1000 * 60 * 60 * 24 * 7,
    zoomMax: 1000 * 60 * 60 * 24 * 90
  });
  
  setTimeout(() => appState.timeline.fit(), 500);
  
  // Adicionar evento de clique para expandir/colapsar
  container.addEventListener('click', (event) => {
    const element = event.target.closest('.vis-item');
    if (element) {
      const itemId = element.getAttribute('data-id');
      
      if (itemId) {
        const item = items.get(itemId);
        
        if (element.classList.contains('expanded')) {
          // Colapsar: restaurar conteúdo reduzido
          element.classList.remove('expanded');
          if (item && item._conteudoOriginal) {
            items.update({
              id: itemId,
              content: item._conteudoOriginal
            });
          }
        } else {
          // Expandir: mostrar conteúdo completo
          
          // Remover classe expanded de todos os outros elementos
          document.querySelectorAll('.vis-item.expanded').forEach(el => {
            if (el !== element) {
              el.classList.remove('expanded');
              const otherId = el.getAttribute('data-id');
              if (otherId) {
                const otherItem = items.get(otherId);
                if (otherItem && otherItem._conteudoOriginal) {
                  items.update({
                    id: otherId,
                    content: otherItem._conteudoOriginal
                  });
                }
              }
            }
          });
          
          // Expandir o item atual
          element.classList.add('expanded');
          
          if (item) {
            // Atualizar com o conteúdo completo
            items.update({
              id: itemId,
              content: item._conteudoCompleto
            });
          }
        }
      }
    }
  });
}

function moverTimeline(dias) {
  if (!appState.timeline) return;
  const range = appState.timeline.getWindow();
  appState.timeline.setWindow({
    start: moment(range.start).add(dias, 'days'),
    end: moment(range.end).add(dias, 'days')
  });
}

function irParaHoje() {
  if (!appState.timeline) return;
  const range = appState.timeline.getWindow();
  const meio = (range.end - range.start) / 2;
  const hoje = moment().valueOf();
  appState.timeline.setWindow({ start: hoje - meio, end: hoje + meio });
}

function ajustarZoom(fator) {
  if (!appState.timeline) return;
  const range = appState.timeline.getWindow();
  const inicio = new Date(range.start);
  const fim = new Date(range.end);
  const intervalo = fim - inicio;
  const centro = new Date((fim.getTime() + inicio.getTime()) / 2);
  const novo = intervalo / fator;
  appState.timeline.setWindow({
    start: new Date(centro.getTime() - novo / 2),
    end: new Date(centro.getTime() + novo / 2)
  });
}

function exportarCSV() {
  if (!appState.filteredData.length) {
    return mostrarNotificacao("Exportação", "Sem dados para exportar", "warning");
  }
  
  const linhas = appState.filteredData.map(i => [
    i.ClientNickname || i.client || "N/A",
    i.TaskTitle || i.name || "Sem título",
    i.tipo || "Tarefa",
    i.RequestDate || i.start || "",
    i.CurrentDueDate || i.TaskClosingDate || i.end || "",
    i.TaskExecutionFunctionGroupName || i.TaskOwnerGroup || "N/A",
    i.Priority || "medium"
  ]);
  
  const conteudo = [
    ["Cliente", "Tarefa", "Tipo", "Início", "Fim", "Grupo", "Prioridade"],
    ...linhas
  ].map(l => l.map(c => `"${c}"`).join(",")).join("\n");
  
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tarefas_exportadas_${moment().format("YYYY-MM-DD")}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  mostrarNotificacao("Exportado", "Arquivo CSV gerado com sucesso.", "success");
}

function configurarEventoTelaCheia() {
  const btn = document.getElementById("btn-fullscreen");
  const card = document.querySelector(".cronograma-card");
  if (!btn || !card) return;
  
  btn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      card.requestFullscreen();
      setTimeout(() => {
        document.getElementById("timeline").style.height = window.innerHeight - 150 + "px";
        appState.timeline.redraw();
      }, 300);
    } else {
      document.exitFullscreen();
      setTimeout(() => {
        document.getElementById("timeline").style.height = "700px";
        appState.timeline.redraw();
      }, 300);
    }
  });
}

function mostrarLoading(mostrar) {
  appState.isLoading = mostrar;
  const container = document.getElementById("timeline");
  if (mostrar) {
    container.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p class="mt-3">Carregando dados...</p>
      </div>
    `;
  }
}

function mostrarNotificacao(titulo, mensagem, tipo = 'info') {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container position-fixed bottom-0 end-0 p-3";
    container.style.zIndex = "1050";
    document.body.appendChild(container);
  }

  const toastId = `toast-${Date.now()}`;
  const html = `
    <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header ${tipo === "error" ? "bg-danger text-white" :
        tipo === "success" ? "bg-success text-white" :
        tipo === "warning" ? "bg-warning" :
        "bg-info text-white"}">
        <strong class="me-auto">${titulo}</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
      </div>
      <div class="toast-body">${mensagem}</div>
    </div>
  `;

  container.insertAdjacentHTML("beforeend", html);
  const toastElement = document.getElementById(toastId);
  new bootstrap.Toast(toastElement, { delay: 5000 }).show();

  toastElement.addEventListener("hidden.bs.toast", () => {
    toastElement.remove();
  });
}