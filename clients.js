/**
 * Dashboard de Projetos por Cliente - SOMOS • CREATORS
 * clients.js - Script para visualização por cliente
 */

const CONFIG = {
  priorityClasses: {
    high: "task-priority-high",
    medium: "task-priority-medium",
    low: "task-priority-low",
  },
  clientColors: {
    SICREDI: "cliente-sicredi",
    SAMSUNG: "cliente-samsung",
    VIVO: "cliente-vivo",
    RD: "cliente-rd",
    AMERICANAS: "cliente-americanas",
    OBOTICARIO: "cliente-oboticario",
    COGNA: "cliente-cogna",
    ENGIE: "cliente-engie",
  }
};

let appState = {
  allData: [],
  filteredData: [],
  timeline: null,
  isLoading: false,
  projects: [], // Array to store projects
  settings: {
    dataSource: localStorage.getItem("dataSource") || "json",
    jsonUrl: localStorage.getItem("jsonUrl") || "dados.json",
  },
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("ano-atual").textContent = new Date().getFullYear();
  setupEventListeners();
  carregarDados();
});

function setupEventListeners() {
  document.getElementById("btn-anterior")?.addEventListener("click", () => moverTimeline(-7));
  document.getElementById("btn-hoje")?.addEventListener("click", () => irParaHoje());
  document.getElementById("btn-proximo")?.addEventListener("click", () => moverTimeline(7));
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => ajustarZoom(0.7));
  document.getElementById("btn-zoom-in")?.addEventListener("click", () => ajustarZoom(1.3));
  document.getElementById("exportar-dados")?.addEventListener("click", exportarCSV);
  
  document.getElementById("cliente-select")?.addEventListener("change", atualizarFiltros);
  document.getElementById("grupo-principal-select")?.addEventListener("change", atualizarFiltros);
  document.getElementById("periodo-select")?.addEventListener("change", atualizarFiltros);
  
  configurarEventoTelaCheia();
}

async function carregarDados() {
  try {
    mostrarLoading(true);
    await carregarDadosDeJSON();
    preencherFiltros();
    processarProjetos(); // Process projects from tasks
    atualizarFiltros();
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    mostrarNotificacao("Erro ao carregar dados", error.message, "error");
  } finally {
    mostrarLoading(false);
  }
}

async function carregarDadosDeJSON() {
  try {
    const response = await fetch(appState.settings.jsonUrl);
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const dadosOriginais = await response.json();
    appState.allData = dadosOriginais.map(preprocessarDados);
  } catch (error) {
    throw new Error(`Falha ao carregar dados do JSON: ${error.message}`);
  }
}

function preprocessarDados(item) {
  const processado = { ...item };

  // Mapear prioridade com base no status
  const statusPriority = {
    "Não iniciada": "low",
    "Backlog": "medium",
    "Em Produção": "high",
  };
  processado.Priority = statusPriority[processado.PipelineStepTitle] || "medium";

  // Lista de grupos principais válidos
  const gruposPrincipais = ["Criação", "Mídia", "Produção", "Operações", "BI", "Estratégia"];
  
  // Inicializar valores
  let grupo = undefined;
  let caminhoCompleto = item.group_subgroup || "";

  // Extrair o grupo principal do caminho completo
  if (caminhoCompleto) {
    // Caso especial para Ana Luisa Andre (sem barra, mas pertence a Produção)
    if (caminhoCompleto.trim() === "Ana Luisa Andre") {
      grupo = "Produção";
    } else {
      const partes = caminhoCompleto.split("/").map(p => p.trim());
      
      // Verificar se a primeira parte é um grupo principal reconhecido
      if (partes.length > 0) {
        if (gruposPrincipais.includes(partes[0])) {
          grupo = partes[0];
        } else if (partes[0] === "Bruno Prosperi") {
          // Caso do "Bruno Prosperi" sem o prefixo "Criação"
          grupo = "Criação";
        } else if (partes[0] === "Carol") {
          // Caso do "Carol" sem o prefixo "Operações"
          grupo = "Operações";
        } else {
          grupo = "Outros";
        }
      }
    }
  }

  // Armazenar grupo principal e caminho completo
  processado.TaskOwnerGroup = grupo;
  processado.TaskOwnerFullPath = caminhoCompleto;
  
  // Normalizar datas
  processado.RequestDate = processado.start || new Date().toISOString();
  processado.TaskClosingDate = processado.end || moment(processado.RequestDate).add(3, 'days').toISOString();
  processado.CurrentDueDate = processado.TaskClosingDate;

  // Garantir que o campo tipo esteja sempre definido
  processado.tipo = processado.tipo || "Tarefa";

  return processado;
}

// Processar as tarefas e criar projetos agrupados por cliente
function processarProjetos() {
  // Mapa para agrupar tarefas por projeto e cliente
  const projetosMap = new Map();
  
  appState.allData.forEach(tarefa => {
    const cliente = tarefa.client || "Sem Cliente";
    const projeto = tarefa.project || "Projeto Geral";
    const chave = `${cliente}-${projeto}`;
    
    if (!projetosMap.has(chave)) {
      projetosMap.set(chave, {
        id: chave,
        client: cliente,
        name: projeto,
        tasks: [],
        responsibles: new Set(),
        groups: new Set(),
        start: tarefa.start || tarefa.RequestDate,
        end: null,
        status: "Em andamento",
        priority: "medium"
      });
    }
    
    const projetoAtual = projetosMap.get(chave);
    projetoAtual.tasks.push(tarefa);
    
    // Adicionar responsável
    if (tarefa.responsible) {
      projetoAtual.responsibles.add(tarefa.responsible);
    }
    
    // Adicionar grupo
    if (tarefa.TaskOwnerGroup) {
      projetoAtual.groups.add(tarefa.TaskOwnerGroup);
    }
    
    // Atualizar data de início (a mais antiga)
    if (tarefa.start && (!projetoAtual.start || new Date(tarefa.start) < new Date(projetoAtual.start))) {
      projetoAtual.start = tarefa.start;
    }
    
    // Atualizar data de fim (a mais recente)
    if (tarefa.end && (!projetoAtual.end || new Date(tarefa.end) > new Date(projetoAtual.end))) {
      projetoAtual.end = tarefa.end;
    }
    
    // Determinar a prioridade do projeto (a mais alta entre as tarefas)
    if (tarefa.Priority === "high") {
      projetoAtual.priority = "high";
    } else if (tarefa.Priority === "medium" && projetoAtual.priority !== "high") {
      projetoAtual.priority = "medium";
    }
  });
  
  // Converter o mapa para array
  appState.projects = Array.from(projetosMap.values()).map(projeto => {
    // Converter Sets para Arrays
    projeto.responsibles = Array.from(projeto.responsibles).sort();
    projeto.groups = Array.from(projeto.groups).sort();
    
    // Determinar o responsável principal do projeto (o primeiro da lista ordenada)
    projeto.mainResponsible = projeto.responsibles[0] || "Não atribuído";
    
    // Calcular progresso do projeto
    const tarefasConcluidas = projeto.tasks.filter(t => 
      t.PipelineStepTitle === "Concluída" || t.status === "Concluída"
    ).length;
    
    projeto.progress = projeto.tasks.length > 0 
      ? Math.round((tarefasConcluidas / projeto.tasks.length) * 100) 
      : 0;
    
    // Verificar status do projeto
    if (projeto.progress === 100) {
      projeto.status = "Concluído";
    } else {
      // Verificar se há tarefas atrasadas
      const hoje = new Date();
      const temTarefasAtrasadas = projeto.tasks.some(t => 
        t.end && new Date(t.end) < hoje && 
        t.PipelineStepTitle !== "Concluída" && 
        t.status !== "Concluída"
      );
      
      if (temTarefasAtrasadas) {
        projeto.status = "Atrasado";
      }
    }
    
    return projeto;
  });
}

function preencherFiltros() {
  if (!appState.projects || appState.projects.length === 0) return;

  const clienteSelect = document.getElementById("cliente-select");
  const grupoSelect = document.getElementById("grupo-principal-select");

  // Limpar e adicionar opção "Todos"
  clienteSelect.innerHTML = '<option value="todos">Todos</option>';

  // Preencher clientes únicos
  const clientes = [...new Set(appState.projects.map(p => p.client).filter(Boolean))].sort();
  clientes.forEach(cliente => {
    clienteSelect.add(new Option(cliente, cliente));
  });

  // Coletar grupos únicos dos projetos
  const grupos = new Set();
  appState.projects.forEach(projeto => {
    projeto.groups.forEach(grupo => grupos.add(grupo));
  });

  // Manter as opções padrão e adicionar grupos encontrados
  const gruposExistentes = Array.from(grupoSelect.options).map(o => o.value);
  [...grupos].sort().forEach(grupo => {
    if (!gruposExistentes.includes(grupo)) {
      grupoSelect.add(new Option(grupo, grupo));
    }
  });
}

function atualizarFiltros() {
  if (!appState.projects || appState.projects.length === 0) return;

  const cliente = document.getElementById("cliente-select").value;
  const grupo = document.getElementById("grupo-principal-select").value;
  const dias = parseInt(document.getElementById("periodo-select").value);

  const limite = moment().subtract(dias, "days");

  // Aplicar filtros
  appState.filteredData = appState.projects.filter(projeto => {
    // Filtro por período
    const projetoInicio = moment(projeto.start);
    if (!projetoInicio.isValid() || !projetoInicio.isSameOrAfter(limite)) {
      return false;
    }

    // Filtro por cliente
    if (cliente !== "todos" && projeto.client !== cliente) {
      return false;
    }

    // Filtro por grupo
    if (grupo !== "todos" && !projeto.groups.includes(grupo)) {
      return false;
    }

    return true;
  });

  criarTimeline(appState.filteredData);
}

function criarTimeline(projetos) {
  const container = document.getElementById("timeline");
  if (!container || !projetos) return;

  container.innerHTML = "";

  if (projetos.length === 0) {
    container.innerHTML = '<div class="alert alert-info m-3">Nenhum projeto encontrado</div>';
    return;
  }

  try {
    // Agrupar por cliente
    const clientes = [...new Set(projetos.map(p => p.client).filter(Boolean))].sort();

    const items = new vis.DataSet(projetos.map((projeto, idx) => {
      const startDate = moment(projeto.start);
      const endDate = projeto.end ? moment(projeto.end) : startDate.clone().add(14, "days");
      
      // Status color class
      let statusClass = "";
      switch(projeto.status) {
        case "Concluído": 
          statusClass = "status-concluido"; break;
        case "Atrasado": 
          statusClass = "status-atrasado"; break;
        default: 
          statusClass = "status-andamento";
      }
      
      // Priority class
      const priorityClass = CONFIG.priorityClasses[projeto.priority] || "";
      
      return {
        id: idx,
        content: `<div class="timeline-item-content" title="${projeto.name}">
                    <span class="priority-dot ${priorityClass}"></span>
                    ${projeto.name}
                  </div>`,
        start: startDate.toDate(),
        end: endDate.toDate(),
        group: projeto.client,
        title: `
          <div class="timeline-tooltip">
            <h5>${projeto.name}</h5>
            <p><strong>Cliente:</strong> ${projeto.client || "N/A"}</p>
            <p><strong>Responsável:</strong> ${projeto.mainResponsible}</p>
            <p><strong>Período:</strong> ${startDate.format("DD/MM/YYYY")} - ${endDate.format("DD/MM/YYYY")}</p>
            <p><strong>Status:</strong> <span class="${statusClass}">${projeto.status}</span></p>
            <p><strong>Progresso:</strong> ${projeto.progress}%</p>
            <p><strong>Tarefas:</strong> ${projeto.tasks.length}</p>
            <p><strong>Grupos envolvidos:</strong> ${projeto.groups.join(", ")}</p>
          </div>`,
        className: `${priorityClass} ${statusClass}`
      };
    }));

    const visGroups = new vis.DataSet(clientes.map(cliente => ({
      id: cliente,
      content: cliente,
      className: CONFIG.clientColors[cliente.toUpperCase()] || ""
    })));

    const options = {
      orientation: "top",
      stack: true,
      margin: { item: 10 },
      zoomMin: 1000 * 60 * 60 * 24 * 7,
      zoomMax: 1000 * 60 * 60 * 24 * 180,
      start: moment().subtract(1, "weeks"),
      end: moment().add(2, "weeks"),
      groupOrder: (a, b) => a.content.localeCompare(b.content),
      horizontalScroll: true,
      verticalScroll: true,
      height: "600px"
    };

    appState.timeline = new vis.Timeline(container, items, visGroups, options);
    appState.timeline.fit();
    
    // Adicionar evento de clique para expandir/colapsar
    setupTimelineClickHandlers();
    
  } catch (error) {
    console.error("Erro ao criar timeline:", error);
    container.innerHTML = `<div class="alert alert-danger">Erro: ${error.message}</div>`;
  }
}

// Função unificada para gerenciar cliques na timeline
function setupTimelineClickHandlers() {
  const container = document.getElementById("timeline");
  if (!container) return;
  
  container.addEventListener('click', (event) => {
    const element = event.target.closest('.vis-item');
    if (!element) return;
    
    // Toggle expanded class
    if (element.classList.contains('expanded')) {
      element.classList.remove('expanded');
    } else {
      // Remove expanded class from all other elements first
      document.querySelectorAll('.vis-item.expanded').forEach(el => {
        if (el !== element) el.classList.remove('expanded');
      });
      
      element.classList.add('expanded');
      
      // Additional handling for expanded view can be added here
      const itemId = element.getAttribute('data-id');
      if (itemId && appState.timeline) {
        const items = appState.timeline.itemsData;
        const item = items.get(itemId);
        
        if (item && item.fullContent) {
          // Use complete content for expanded view if available
          items.update({
            id: itemId,
            content: item.fullContent
          });
        }
      }
    }
  });
}

// Navegar na timeline
function moverTimeline(dias) {
  if (!appState.timeline) return;

  const range = appState.timeline.getWindow();
  appState.timeline.setWindow({
    start: moment(range.start).add(dias, "days").valueOf(),
    end: moment(range.end).add(dias, "days").valueOf(),
  });
}

// Ir para a data atual
function irParaHoje() {
  if (!appState.timeline) return;

  const range = appState.timeline.getWindow();
  const intervalo = range.end - range.start;
  const hoje = moment().valueOf();

  appState.timeline.setWindow({
    start: hoje - intervalo / 2,
    end: hoje + intervalo / 2,
  });
}

// Ajustar zoom da timeline
function ajustarZoom(fator) {
  if (!appState.timeline) return;

  const range = appState.timeline.getWindow();
  const centro = new Date((range.end.getTime() + range.start.getTime()) / 2);
  const novoIntervalo = (range.end - range.start) / fator;

  appState.timeline.setWindow({
    start: new Date(centro.getTime() - novoIntervalo / 2),
    end: new Date(centro.getTime() + novoIntervalo / 2),
  });
}

// Exportar os dados para CSV
function exportarCSV() {
  if (!appState.filteredData || appState.filteredData.length === 0) {
    mostrarNotificacao("Exportação", "Não há dados para exportar.", "warning");
    return;
  }

  const headers = [
    "Cliente", "Projeto", "Responsável Principal", "Grupos Envolvidos",
    "Data Início", "Data Fim", "Status", "Progresso", "Prioridade", "Quantidade de Tarefas"
  ];

  const linhas = appState.filteredData.map(projeto => [
    projeto.client || "N/A",
    projeto.name || "Sem título",
    projeto.mainResponsible || "N/A",
    projeto.groups.join(", "),
    projeto.start ? moment(projeto.start).format("DD/MM/YYYY") : "-",
    projeto.end ? moment(projeto.end).format("DD/MM/YYYY") : "-",
    projeto.status || "Em andamento",
    `${projeto.progress}%`,
    projeto.priority === "high" ? "Alta" : projeto.priority === "medium" ? "Média" : "Baixa",
    projeto.tasks.length
  ]);

  const csvContent = [
    headers.join(","),
    ...linhas.map(row => row.map(cell => `"${cell}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `projetos_${moment().format("YYYY-MM-DD")}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  mostrarNotificacao("Exportação", "Arquivo CSV gerado com sucesso!", "success");
}

// Tela cheia
function configurarEventoTelaCheia() {
  const btnFullscreen = document.getElementById("btn-fullscreen");
  const timelineCard = document.querySelector(".cronograma-card");

  if (!btnFullscreen || !timelineCard) return;

  btnFullscreen.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      (timelineCard.requestFullscreen || timelineCard.webkitRequestFullscreen || timelineCard.msRequestFullscreen).call(timelineCard);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
    }

    setTimeout(() => {
      document.getElementById("timeline").style.height = document.fullscreenElement ? `${window.innerHeight - 150}px` : "600px";
      appState.timeline.redraw();
    }, 100);
  });

  document.addEventListener("fullscreenchange", () => {
    document.getElementById("timeline").style.height = document.fullscreenElement ? `${window.innerHeight - 150}px` : "600px";
    appState.timeline.redraw();
  });
}

// Toast de notificação
function mostrarNotificacao(titulo, mensagem, tipo = "info") {
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

function mostrarLoading(mostrar) {
  appState.isLoading = mostrar;

  const container = document.getElementById("timeline");
  if (!container) return;

  if (mostrar) {
    container.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p class="mt-3">Carregando dados...</p>
      </div>
    `;
  }
}