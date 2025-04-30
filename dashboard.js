/**
 * Dashboard de Tarefas - SUNO
 * dashboard.js - Script principal para visualização por equipe
 */

const CONFIG = {
  clientColors: {
    SICREDI: "danger",
    SAMSUNG: "primary",
    VIVO: "success",
    RD: "warning",
    AMERICANAS: "info",
    OBOTICARIO: "dark",
    COGNA: "secondary",
    ENGIE: "danger",
  },
  fieldMapping: {
    client: "Cliente",
    name: "Título da Tarefa",
    start: "Data Inicial",
    end: "Data Final",
    responsible: "Responsável",
    group_subgroup: "Grupo/Subgrupo",
    project: "Projeto",
    tipo: "Tipo de Tarefa",
    PipelineStepTitle: "Status",
  },
  priorityClasses: {
    high: "task-priority-high",
    medium: "task-priority-medium",
    low: "task-priority-low",
  },
};

let appState = {
  allData: [],
  filteredData: [],
  timeline: null,
  isLoading: false,
  settings: {
    dataSource: localStorage.getItem("dataSource") || "json",
    jsonUrl: localStorage.getItem("jsonUrl") || "dados.json",
    projectId: localStorage.getItem("projectId") || "monday-export",
    dataset: localStorage.getItem("dataset") || "taskrow_views",
    table: localStorage.getItem("table") || "CJT_RD_RTC",
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
  document.getElementById("periodo-select")?.addEventListener("change", atualizarFiltros);
  document.getElementById("grupo-principal-select")?.addEventListener("change", () => {
    atualizarSubgrupos();
    atualizarFiltros();
  });
  document.getElementById("subgrupo-select")?.addEventListener("change", atualizarFiltros);
  
  // Novos event listeners para filtros de tipo de tarefa
  document.getElementById("mostrar-tarefas")?.addEventListener("change", atualizarFiltros);
  document.getElementById("mostrar-subtarefas")?.addEventListener("change", atualizarFiltros);

  configurarEventoTelaCheia();
}

async function carregarDados() {
  try {
    mostrarLoading(true);
    if (appState.settings.dataSource === "json") {
      await carregarDadosDeJSON();
    } else {
      await carregarDadosDeBigQuery();
    }

    preencherFiltros();
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

async function carregarDadosDeBigQuery() {
  try {
    mostrarNotificacao("Conectando ao BigQuery", "Estabelecendo conexão...", "info");
    await new Promise(resolve => setTimeout(resolve, 1500));

    const response = await fetch(appState.settings.jsonUrl);
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const dadosOriginais = await response.json();
    appState.allData = dadosOriginais.map(preprocessarDados);

    mostrarNotificacao(
      "Dados carregados do BigQuery",
      `${appState.allData.length} tarefas carregadas com sucesso.`,
      "success"
    );
  } catch (error) {
    throw new Error(`Falha ao carregar dados do BigQuery: ${error.message}`);
  }
}

function preprocessarDados(item) {
  const processado = { ...item };

  // Mapear prioridade com base no status
  const statusPriority = {
    "Não iniciada": "low",
    Backlog: "medium",
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
          console.warn(`Grupo não reconhecido: ${partes[0]} em ${caminhoCompleto}`);
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

  // Garantir que o campo tipo esteja sempre definido (para distinguir tarefas de subtarefas)
  processado.tipo = processado.tipo || "Tarefa";

  return processado;
}

// Preenche os selects de Grupo Principal e Cliente
function preencherFiltros() {
  if (!appState.allData || appState.allData.length === 0) return;

  const grupoPrincipalSelect = document.getElementById("grupo-principal-select");
  const clienteSelect = document.getElementById("cliente-select");

  grupoPrincipalSelect.innerHTML = '<option value="todos">Todos</option>';
  clienteSelect.innerHTML = '<option value="todos">Todos</option>';

  // Lista de grupos principais válidos
  const gruposPrincipais = ["Criação", "Mídia", "Produção", "Operações", "BI", "Estratégia"];
  
  // Preencher grupos principais
  gruposPrincipais.forEach(grupo => {
    // Verificar se existe pelo menos uma tarefa neste grupo
    if (appState.allData.some(t => t.TaskOwnerGroup === grupo)) {
      grupoPrincipalSelect.add(new Option(grupo, grupo));
    }
  });

  // Preencher clientes únicos
  const clientes = [...new Set(appState.allData.map(t => t.client).filter(Boolean))].sort();
  clientes.forEach(cliente => {
    clienteSelect.add(new Option(cliente, cliente));
  });

  atualizarSubgrupos();
}

// Preenche o select de Subgrupo com base no Grupo selecionado
function atualizarSubgrupos() {
  const grupoSelecionado = document.getElementById("grupo-principal-select").value;
  const subgrupoSelect = document.getElementById("subgrupo-select");

  // Limpar e adicionar a opção "Todos"
  subgrupoSelect.innerHTML = '<option value="todos">Todos</option>';

  // Se "todos" estiver selecionado, não mostrar subgrupos
  if (grupoSelecionado === "todos") {
    return;
  }

  // Filtrar tarefas pelo grupo selecionado
  const tarefasDoGrupo = appState.allData.filter(item => item.TaskOwnerGroup === grupoSelecionado);
  
  // Coletar todos os caminhos completos únicos para este grupo
  const caminhos = new Set();
  
  tarefasDoGrupo.forEach(item => {
    if (item.TaskOwnerFullPath) {
      caminhos.add(item.TaskOwnerFullPath);
    }
  });
  
  // Extrair subgrupos destes caminhos
  const subgrupos = new Set();
  const membrosDiretos = new Set();
  
  caminhos.forEach(caminho => {
    // Ignorar o caso "Ana Luisa Andre" que é tratado como membro direto
    if (caminho === "Ana Luisa Andre") {
      membrosDiretos.add(caminho);
      return;
    }
    
    const partes = caminho.split("/").map(p => p.trim());
    
    // Se o caminho começa com o grupo principal
    if (partes[0] === grupoSelecionado) {
      // Remover o grupo principal para extrair o subgrupo
      const subgrupo = partes.slice(1).join(" / ");
      if (subgrupo) {
        subgrupos.add(subgrupo);
      }
    } 
    // Casos especiais sem prefixo de grupo principal
    else if ((grupoSelecionado === "Criação" && partes[0] === "Bruno Prosperi") || 
             (grupoSelecionado === "Operações" && partes[0] === "Carol")) {
      // Todo o caminho é considerado subgrupo
      subgrupos.add(caminho);
    }
  });
  
  // Adicionar subgrupos ao select
  if (subgrupos.size > 0) {
    // Adicionar cabeçalho de subgrupos
    const headerOption = document.createElement("option");
    headerOption.disabled = true;
    headerOption.textContent = "--- Subgrupos ---";
    subgrupoSelect.appendChild(headerOption);
    
    // Ordenar e adicionar subgrupos
    [...subgrupos].sort().forEach(sub => {
      subgrupoSelect.add(new Option(sub, sub));
    });
  }
  
  // Adicionar membros diretos (tarefas atribuídas diretamente a membros sem subgrupo)
  if (membrosDiretos.size > 0) {
    // Adicionar cabeçalho de membros diretos
    const headerOption = document.createElement("option");
    headerOption.disabled = true;
    headerOption.textContent = "--- Membros Diretos ---";
    subgrupoSelect.appendChild(headerOption);
    
    // Ordenar e adicionar membros diretos
    [...membrosDiretos].sort().forEach(membro => {
      subgrupoSelect.add(new Option(membro, membro));
    });
  }
}

function atualizarFiltros() {
  if (!appState.allData || appState.allData.length === 0) return;

  const cliente = document.getElementById("cliente-select").value;
  const dias = parseInt(document.getElementById("periodo-select").value);
  const grupo = document.getElementById("grupo-principal-select").value;
  const subgrupo = document.getElementById("subgrupo-select").value;
  const mostrarTarefas = document.getElementById("mostrar-tarefas").checked;
  const mostrarSubtarefas = document.getElementById("mostrar-subtarefas").checked;

  const limite = moment().subtract(dias, "days");

  // Filtro base: por período
  appState.filteredData = appState.allData.filter(item => {
    return moment(item.start).isSameOrAfter(limite);
  });

  // Filtro por cliente
  if (cliente !== "todos") {
    appState.filteredData = appState.filteredData.filter(item => item.client === cliente);
  }

  // Filtro por grupo
  if (grupo !== "todos") {
    appState.filteredData = appState.filteredData.filter(item => item.TaskOwnerGroup === grupo);
  }

  // Filtro por subgrupo
  if (subgrupo !== "todos") {
    appState.filteredData = appState.filteredData.filter(item => {
      // Se for o caso especial "Ana Luisa Andre"
      if (subgrupo === "Ana Luisa Andre" && item.TaskOwnerFullPath === "Ana Luisa Andre") {
        return true;
      }
      
      // Verificar se o caminho completo contém ou termina com o subgrupo selecionado
      const fullPath = item.TaskOwnerFullPath;
      if (fullPath) {
        // Se o caminho começa com o grupo principal
        if (fullPath.startsWith(grupo)) {
          // Remover o grupo principal e verificar se o resto começa com o subgrupo
          const restPath = fullPath.replace(`${grupo} / `, "");
          return restPath === subgrupo || restPath.startsWith(`${subgrupo} / `);
        } 
        // Casos especiais sem prefixo de grupo principal
        else if ((grupo === "Criação" && fullPath.startsWith("Bruno Prosperi")) || 
                 (grupo === "Operações" && fullPath.startsWith("Carol"))) {
          // Verificar se o caminho completo começa com o subgrupo
          return fullPath === subgrupo || fullPath.startsWith(`${subgrupo} / `);
        }
      }
      
      return false;
    });
  }

  // Filtrar por tipo de tarefa (novo)
  if (!mostrarTarefas || !mostrarSubtarefas) {
    appState.filteredData = appState.filteredData.filter(item => {
      const isSubtask = item.tipo === "Subtarefa";
      if (!mostrarTarefas && !isSubtask) return false;
      if (!mostrarSubtarefas && isSubtask) return false;
      return true;
    });
  }

  // Agrupar por responsável e criar a timeline
  criarTimeline(appState.filteredData);
}

function criarTimeline(dados) {
  const container = document.getElementById("timeline");
  if (!container || !dados) return;

  container.innerHTML = "";

  if (dados.length === 0) {
    container.innerHTML = '<div class="alert alert-info m-3">Nenhuma tarefa encontrada</div>';
    return;
  }

  try {
    // Agrupar por responsável
    const responsaveis = [...new Set(dados.map(t => t.responsible).filter(Boolean))].sort();

    const items = new vis.DataSet(dados.map((item, idx) => {
      const startDate = moment(item.start);
      const endDate = item.end ? moment(item.end) : startDate.clone().add(3, "days");
      
      // Verificar se é uma tarefa de curta duração (menos de 24 horas)
      const isShortDuration = endDate.diff(startDate, 'hours') <= 24 || 
                              startDate.format('YYYY-MM-DD') === endDate.format('YYYY-MM-DD');

      const isSubtask = item.tipo === "Subtarefa";
      const titlePrefix = isSubtask ? "↳ " : "";
      const taskClass = CONFIG.priorityClasses[item.Priority] || "";
      const shortDurationClass = isShortDuration ? "short-duration" : "";

      return {
        id: idx,
        content: `<div class="timeline-item-content ${isSubtask ? 'subtask' : ''}" title="${item.name}">
                    <span class="priority-dot ${CONFIG.priorityClasses[item.Priority]}"></span>
                    ${titlePrefix}${item.name.substring(0, 25)}${item.name.length > 25 ? "..." : ""}
                  </div>`,
        start: startDate.toDate(),
        end: endDate.toDate(),
        group: item.responsible,
        title: `
          <div class="timeline-tooltip">
            <h5>${item.name}</h5>
            <p><strong>Cliente:</strong> ${item.client || "N/A"}</p>
            <p><strong>Responsável:</strong> ${item.responsible || "N/A"}</p>
            <p><strong>Período:</strong> ${startDate.format("DD/MM/YYYY")} - ${endDate.format("DD/MM/YYYY")}</p>
            <p><strong>Status:</strong> ${item.PipelineStepTitle || "N/A"}</p>
            <p><strong>Grupo:</strong> ${item.TaskOwnerFullPath || "N/A"}</p>
            <p><strong>Tipo:</strong> ${item.tipo || "Tarefa"}</p>
          </div>`,
        className: `${taskClass} ${isSubtask ? 'subtask' : ''} ${shortDurationClass}`
      };
    }));

    const visGroups = new vis.DataSet(responsaveis.map(resp => ({
      id: resp,
      content: resp,
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
      height: "800px"
    };

    appState.timeline = new vis.Timeline(container, items, visGroups, options);
    appState.timeline.fit();
    
    // Adicionar evento de clique para expandir/colapsar
    container.addEventListener('click', (event) => {
      const element = event.target.closest('.vis-item');
      if (element) {
        // Toggle da classe expanded
        if (element.classList.contains('expanded')) {
          element.classList.remove('expanded');
        } else {
          // Remover a classe expanded de todos os outros elementos
          document.querySelectorAll('.vis-item.expanded').forEach(el => {
            if (el !== element) el.classList.remove('expanded');
          });
          element.classList.add('expanded');
        }
      }
    });
    
  } catch (error) {
    console.error("Erro ao criar timeline:", error);
    container.innerHTML = `<div class="alert alert-danger">Erro: ${error.message}</div>`;
  }
}

// Navegar para frente/atrás na timeline
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
    "Cliente", "Projeto", "Tarefa", "Tipo",
    "Data Início", "Data Fim", "Responsável",
    "Grupo", "Subgrupo", "Membro", "Prioridade"
  ];

  const linhas = appState.filteredData.map(item => [
    item.client || "N/A",
    item.project || "N/A",
    item.name || "Sem título",
    item.tipo || "Tarefa",
    item.start ? moment(item.start).format("DD/MM/YYYY") : "-",
    item.end ? moment(item.end).format("DD/MM/YYYY") : "-",
    item.responsible || "N/A",
    item.TaskOwnerGroup || "N/A",
    item.TaskOwnerSubgroup || "N/A",
    item.TaskOwnerMember || "N/A",
    item.Priority === "high" ? "Alta" : item.Priority === "medium" ? "Média" : "Baixa"
  ]);

  const csvContent = [
    headers.join(","),
    ...linhas.map(row => row.map(cell => `"${cell}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `tarefas_${moment().format("YYYY-MM-DD")}.csv`);
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
      document.getElementById("timeline").style.height = document.fullscreenElement ? `${window.innerHeight - 150}px` : "800px";
      appState.timeline.redraw();
    }, 100);
  });

  document.addEventListener("fullscreenchange", () => {
    document.getElementById("timeline").style.height = document.fullscreenElement ? `${window.innerHeight - 150}px` : "800px";
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