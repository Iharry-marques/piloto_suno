/**
 * Dashboard de Projetos por Cliente - SUNO
 * clients.js - Script para visualização por cliente
 */

import {
  getEl,
  moverTimeline,
  irParaHoje,
  ajustarZoom,
  mostrarLoading,
  mostrarNotificacao,
  configurarEventoTelaCheia,
  carregarDadosDeJSON,
  preprocessarDados,
  exportarParaCSV as exportarParaCSVUtil, // Renamed to avoid conflict
  CONFIG,
  getTimelineOptions
} from './utils.js
';

let appState = {
  allData: [], // Raw data after preprocessing (tasks)
  filteredData: [], // Projects filtered for display
  timeline: null,
  isLoading: false,
  projects: [], // Array to store processed projects
  settings: {
    dataSource: localStorage.getItem("dataSource") || "json",
    jsonUrl: localStorage.getItem("jsonUrl") || "dados.json",
  },
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM carregado, iniciando dashboard de clientes");

  const anoElement = getEl("ano-atual");
  if (anoElement) {
    anoElement.textContent = new Date().getFullYear();
  }

  setupEventListeners();
  carregarDados();
});

function setupEventListeners() {
  console.log("Configurando event listeners para clientes");

  getEl("btn-anterior")?.addEventListener("click", () => moverTimeline(appState.timeline, -7));
  getEl("btn-hoje")?.addEventListener("click", () => irParaHoje(appState.timeline));
  getEl("btn-proximo")?.addEventListener("click", () => moverTimeline(appState.timeline, 7));
  getEl("btn-zoom-out")?.addEventListener("click", () => ajustarZoom(appState.timeline, 0.7));
  getEl("btn-zoom-in")?.addEventListener("click", () => ajustarZoom(appState.timeline, 1.3));
  getEl("exportar-dados")?.addEventListener("click", exportarDadosProjetos); // Changed to new function name

  const clienteSelect = getEl("cliente-select") || getEl("cliente-principal-select");
  if (clienteSelect) {
    console.log("Select de cliente encontrado:", clienteSelect.id);
    clienteSelect.addEventListener("change", atualizarFiltros);
  } else {
    console.warn("Select de cliente não encontrado. Verificar IDs no HTML.");
  }

  const grupoSelect = getEl("grupo-principal-select") || getEl("grupo-select");
  if (grupoSelect) {
    console.log("Select de grupo encontrado:", grupoSelect.id);
    grupoSelect.addEventListener("change", atualizarFiltros);
  } else {
    console.warn("Select de grupo não encontrado. Verificar IDs no HTML.");
  }

  getEl("periodo-select")?.addEventListener("change", atualizarFiltros);

  const btnFullscreen = getEl("btn-fullscreen");
  const timelineCard = document.querySelector(".cronograma-card");

  if (btnFullscreen && timelineCard) {
     // Delay attaching fullscreen to timeline until timeline is initialized
    document.addEventListener('timelineReady', () => {
        if (appState.timeline) {
            configurarEventoTelaCheia(btnFullscreen, timelineCard, appState.timeline);
        }
    });
  }
}

async function carregarDados() {
  console.log("Iniciando carregamento de dados para clientes");
  const timelineContainer = getEl("timeline");

  try {
    mostrarLoading(timelineContainer, true);
    appState.isLoading = true;

    // Uses carregarDadosDeJSON and preprocessarDados from utils.js
    appState.allData = await carregarDadosDeJSON(
      appState.settings.jsonUrl,
      preprocessarDados
    );

    console.log(`Processados ${appState.allData.length} itens de dados brutos para clientes`);

    processarProjetos();
    console.log(`Gerados ${appState.projects.length} projetos para clientes`);

    preencherFiltros();
    atualizarFiltros(); // This will call criarTimeline

  } catch (error) {
    console.error("Erro ao carregar ou processar dados para clientes:", error);
    if (timelineContainer) {
      timelineContainer.innerHTML = `
        <div class="alert alert-danger m-3">
          <h5>Erro ao carregar dados</h5>
          <p>${error.message}</p>
          <p>Verifique se o arquivo JSON está disponível e formatado corretamente.</p>
        </div>
      `;
    }
    mostrarNotificacao("Erro ao carregar dados", error.message, "error");
  } finally {
    appState.isLoading = false;
    mostrarLoading(timelineContainer, false);
  }
}

function processarProjetos() {
  console.log("Processando projetos a partir das tarefas (clients.js)");
  const projetosPorCliente = {};

  appState.allData.forEach(tarefa => {
    if (!tarefa.client || !tarefa.project) return;
    const chave = `${tarefa.client}::${tarefa.project}`;

    if (!projetosPorCliente[chave]) {
      projetosPorCliente[chave] = {
        id: chave,
        name: tarefa.project,
        client: tarefa.client,
        tasks: [],
        responsibles: new Set(),
        groups: new Set(),
        start: tarefa.start,
        end: tarefa.end,
        status: tarefa.PipelineStepTitle || "Em andamento", // Default status
        priority: tarefa.Priority || "medium", // Default priority
        progress: 0
      };
    }

    const projeto = projetosPorCliente[chave];
    projeto.tasks.push(tarefa);
    if (tarefa.responsible) projeto.responsibles.add(tarefa.responsible);
    if (tarefa.TaskOwnerGroup) projeto.groups.add(tarefa.TaskOwnerGroup);

    if (!projeto.start || new Date(tarefa.start) < new Date(projeto.start)) {
      projeto.start = tarefa.start;
    }
    if (!projeto.end || (tarefa.end && new Date(tarefa.end) > new Date(projeto.end))) {
      projeto.end = tarefa.end;
    }
     if (projeto.start && !projeto.end) {
        projeto.end = projeto.start; // Ensure end is at least start if only start exists
    }

    if (tarefa.Priority === "high") {
      projeto.priority = "high";
    } else if (tarefa.Priority === "medium" && projeto.priority !== "high") {
      projeto.priority = "medium";
    }
  });

  appState.projects = Object.values(projetosPorCliente).map(projeto => {
    projeto.responsibles = Array.from(projeto.responsibles).sort();
    projeto.groups = Array.from(projeto.groups).sort();
    projeto.mainResponsible = projeto.responsibles[0] || "Não atribuído";

    const tarefasConcluidas = projeto.tasks.filter(t =>
      t.PipelineStepTitle === "Concluída" || t.status === "Concluída"
    ).length;

    projeto.progress = projeto.tasks.length > 0
      ? Math.round((tarefasConcluidas / projeto.tasks.length) * 100)
      : 0;

    if (projeto.progress === 100) {
      projeto.status = "Concluído";
    } else {
        const hoje = new Date();
        const temTarefasAtrasadas = projeto.tasks.some(t =>
            t.end && new Date(t.end) < hoje &&
            !(t.PipelineStepTitle === "Concluída" || t.status === "Concluída")
        );
        if (temTarefasAtrasadas) {
            projeto.status = "Atrasado";
        } else {
            // If not completed and not delayed, it's in progress or another state
            // We keep the initial status or update based on tasks if needed
            // For now, if not Concluído or Atrasado, keep initial or set to Em Andamento
            if(projeto.status !== "Atrasado") {
                 projeto.status = "Em andamento";
            }
        }
    }
    // Ensure dates are valid and logical
    if (!projeto.start) projeto.start = new Date().toISOString();
    if (!projeto.end) projeto.end = moment(projeto.start).add(1, 'days').toISOString(); // Default to 1 day if end is missing
    if (moment(projeto.end).isBefore(moment(projeto.start))) projeto.end = projeto.start; // End cannot be before start

    return projeto;
  });
}

function preencherFiltros() {
  console.log("Preenchendo filtros para clientes");
  if (!appState.projects || appState.projects.length === 0) {
    console.warn("Nenhum projeto disponível para preencher filtros (clients.js)");
    return;
  }

  const clienteSelect = getEl("cliente-select") || getEl("cliente-principal-select");
  const grupoSelect = getEl("grupo-principal-select") || getEl("grupo-select");

  if (clienteSelect) {
    clienteSelect.innerHTML = 	c<option value="todos">Todos Clientes</option>	;
    const clientes = [...new Set(appState.projects.map(p => p.client).filter(Boolean))].sort();
    clientes.forEach(cliente => clienteSelect.add(new Option(cliente, cliente)));
  } else {
    console.error("Select de cliente não encontrado (clients.js).");
  }

  if (grupoSelect) {
    grupoSelect.innerHTML = 	c<option value="todos">Todos Grupos</option>	;
    const grupos = new Set();
    appState.projects.forEach(projeto => projeto.groups.forEach(grupo => grupos.add(grupo)));
    [...grupos].sort().forEach(grupo => grupoSelect.add(new Option(grupo, grupo)));
  } else {
    console.error("Select de grupo não encontrado (clients.js).");
  }
}

function atualizarFiltros() {
  console.log("Atualizando filtros para clientes");
  const timelineContainer = getEl("timeline");

  if (!appState.projects || appState.projects.length === 0) {
    console.warn("Sem projetos para filtrar (clients.js)");
    appState.filteredData = [];
    if (appState.timeline) { appState.timeline.destroy(); appState.timeline = null; }
    if(timelineContainer) timelineContainer.innerHTML = 	c<div class="alert alert-info m-3">Nenhum projeto para exibir.</div>	;
    return;
  }

  const cliente = (getEl("cliente-select") || getEl("cliente-principal-select"))?.value || "todos";
  const grupo = (getEl("grupo-principal-select") || getEl("grupo-select"))?.value || "todos";
  const dias = parseInt(getEl("periodo-select")?.value || "30");
  const limite = moment().subtract(dias, "days");

  appState.filteredData = appState.projects.filter(projeto => {
    const projetoInicio = moment(projeto.start);
    if (!projetoInicio.isValid() || !projetoInicio.isSameOrAfter(limite)) return false;
    if (cliente !== "todos" && projeto.client !== cliente) return false;
    if (grupo !== "todos" && !projeto.groups.includes(grupo)) return false;
    return true;
  });

  console.log(`${appState.filteredData.length} projetos após aplicação dos filtros (clients.js)`);
  criarTimeline(appState.filteredData);
}

function criarTimeline(projetos) {
  console.log("Criando timeline de projetos com", projetos?.length || 0, "projetos (clients.js)");
  const container = getEl("timeline");
  if (!container) {
    console.error("Container da timeline não encontrado (clients.js)");
    return;
  }

  if (appState.timeline) {
      appState.timeline.destroy();
      appState.timeline = null;
  }
  container.innerHTML = ""; // Clear previous timeline or messages

  if (!projetos || projetos.length === 0) {
    container.innerHTML = 	c<div class="alert alert-info m-3">Nenhum projeto encontrado para os filtros selecionados.</div>	;
    return;
  }

  try {
    mostrarLoading(container, false); // Ensure loading is off before creating

    const clientes = [...new Set(projetos.map(p => p.client).filter(Boolean))].sort();
    console.log(`Timeline de clientes terá ${clientes.length} grupos (clientes)`);

    if (typeof vis === 'undefined') {
      console.error("Biblioteca vis.js não está carregada! (clients.js)");
      container.innerHTML = `
        <div class="alert alert-danger m-3">
          <h5>Erro ao criar timeline</h5>
          <p>Biblioteca vis.js não está disponível. Verifique se foi carregada corretamente.</p>
        </div>
      `;
      return;
    }

    const items = new vis.DataSet(
      projetos.map((projeto, idx) => {
        const startDate = moment(projeto.start);
        const endDate = projeto.end ? moment(projeto.end) : startDate.clone().add(14, "days");
        if (endDate.isBefore(startDate)) endDate = startDate.clone().add(1, 'days'); // Ensure end is after start

        let statusClass = "status-andamento"; // Default
        if (projeto.status === "Concluído") statusClass = "status-concluido";
        else if (projeto.status === "Atrasado") statusClass = "status-atrasado";

        const priorityClass = CONFIG.priorityClasses[projeto.priority] || "";
        const equipe = projeto.groups.join(" / ") || "Sem equipe";
        const responsavel = projeto.responsibles.join(", ") || "Sem responsável";

        const content = `<div class="timeline-item-content ${priorityClass} ${statusClass}" title="${projeto.name}">
                           <span class="priority-dot ${priorityClass}"></span>
                           <strong>${equipe}</strong> - ${responsavel}
                         </div>`;

        return {
          id: `proj_${idx}`,
          content,
          title: `
            <div class="timeline-tooltip">
              <h5>${projeto.name}</h5>
              <p><strong>Cliente:</strong> ${projeto.client || "N/A"}</p>
              <p><strong>Time:</strong> ${equipe}</p>
              <p><strong>Responsável:</strong> ${responsavel}</p>
              <p><strong>Período:</strong> ${startDate.format("DD/MM/YYYY")} - ${endDate.format("DD/MM/YYYY")}</p>
              <p><strong>Status:</strong> <span class="${statusClass}">${projeto.status}</span></p>
              <p><strong>Progresso:</strong> ${projeto.progress}%</p>
            </div>`,
          start: startDate.toDate(),
          end: endDate.toDate(),
          group: projeto.client,
          className: `${priorityClass} ${statusClass}`,
          projetoData: projeto // Store original project data
        };
      })
    );

    const visGroups = new vis.DataSet(
      clientes.map(cliente => ({
        id: cliente,
        content: `<strong>${cliente}</strong>`,
        className: CONFIG.clientColors[cliente.toUpperCase()] || ""
      }))
    );

    const options = getTimelineOptions();

    console.log("Criando objeto Timeline para clientes");
    appState.timeline = new vis.Timeline(container, items, visGroups, options);
    appState.timeline.fit();
    
    // Dispatch event that timeline is ready for fullscreen setup
    document.dispatchEvent(new CustomEvent('timelineReady'));

    appState.timeline.on("select", function(properties) {
      if (!properties.items.length) return;
      const itemId = properties.items[0];
      const item = items.get(itemId);
      if (!item || !item.projetoData) return;
      const p = item.projetoData;

      const modalContent = `
        <div style="padding: 1rem">
          <h4>${p.name}</h4>
          <p><strong>Cliente:</strong> ${p.client}</p>
          <p><strong>Equipe responsável:</strong> ${p.groups.join(" / ") || "N/A"}</p>
          <p><strong>Responsável(eis):</strong> ${p.responsibles.join(", ") || "N/A"}</p>
          <p><strong>Status:</strong> ${p.status}</p>
          <p><strong>Prioridade:</strong> ${p.priority}</p>
          <p><strong>Progresso:</strong> ${p.progress}%</p>
          <p><strong>Período:</strong> ${moment(p.start).format("DD/MM/YYYY")} - ${moment(p.end).format("DD/MM/YYYY")}</p>
        </div>`;

      const modal = document.createElement('div');
      modal.className = 'modal fade show';
      modal.id = 'projectDetailsModal';
      modal.style.display = 'block';
      modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
      modal.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Detalhes do Projeto</h5>
              <button type="button" class="btn-close" onclick="document.getElementById('projectDetailsModal').remove()"></button>
            </div>
            <div class="modal-body">${modalContent}</div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="document.getElementById('projectDetailsModal').remove()">Fechar</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    });

  } catch (error) {
    console.error("Erro ao criar timeline de clientes:", error);
    container.innerHTML = `
      <div class="alert alert-danger m-3">
        <h5>Erro ao criar timeline</h5>
        <p>${error.message}</p>
        <button class="btn btn-sm btn-outline-danger" onclick="location.reload()">Tentar novamente</button>
      </div>
    `;
  }
}

// Function to export project data to CSV using the utility
function exportarDadosProjetos() {
  console.log("Exportando CSV de Projetos (clients.js)");

  if (!appState.filteredData || appState.filteredData.length === 0) {
    mostrarNotificacao("Exportação", "Não há dados de projetos para exportar.", "warning");
    return;
  }

  const headers = [
    "Cliente",
    "Projeto",
    "Data Início",
    "Data Fim",
    "Equipes",
    "Responsáveis",
    "Prioridade",
    "Status",
    "Progresso (%)"
  ];

  const formatarLinhaProjeto = (projeto) => {
    return [
      projeto.client || "N/A",
      projeto.name || "Sem nome",
      projeto.start ? moment(projeto.start).format("YYYY-MM-DD") : "N/A",
      projeto.end ? moment(projeto.end).format("YYYY-MM-DD") : "N/A",
      projeto.groups.join("; ") || "N/A", // Use semicolon if groups can have commas
      projeto.responsibles.join("; ") || "N/A", // Use semicolon for consistency
      projeto.priority || "N/A",
      projeto.status || "N/A",
      projeto.progress.toString() // Ensure progress is a string
    ];
  };

  exportarParaCSVUtil(appState.filteredData, headers, formatarLinhaProjeto, "projetos_por_cliente");
}

