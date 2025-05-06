/**
 * Dashboard de Tarefas - SUNO
 * dashboard.js - Script principal para visualização por equipe
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
  exportarParaCSV,
  CONFIG,
  getTimelineOptions,
} from "./utils.js";

let appState = {
  allData: [],
  filteredData: [],
  timeline: null,
  isLoading: false,
  settings: {
    dataSource: localStorage.getItem("dataSource") || "json",
    jsonUrl: localStorage.getItem("jsonUrl") || "dados.json",
  },
};

document.addEventListener("DOMContentLoaded", () => {
  getEl("ano-atual").textContent = new Date().getFullYear();
  setupEventListeners();
  carregarDados();
});

function setupEventListeners() {
  getEl("btn-anterior")?.addEventListener("click", () =>
    moverTimeline(appState.timeline, -7)
  );
  getEl("btn-hoje")?.addEventListener("click", () =>
    irParaHoje(appState.timeline)
  );
  getEl("btn-proximo")?.addEventListener("click", () =>
    moverTimeline(appState.timeline, 7)
  );
  getEl("btn-zoom-out")?.addEventListener("click", () =>
    ajustarZoom(appState.timeline, 0.7)
  );
  getEl("btn-zoom-in")?.addEventListener("click", () =>
    ajustarZoom(appState.timeline, 1.3)
  );
  getEl("exportar-dados")?.addEventListener("click", exportarCSV);

  getEl("cliente-principal-select")?.addEventListener(
    "change",
    atualizarFiltros
  );
  getEl("periodo-select")?.addEventListener("change", atualizarFiltros);
  getEl("grupo-select")?.addEventListener("change", () => {
    atualizarSubgrupos();
    atualizarFiltros();
  });
  getEl("subgrupo-select")?.addEventListener("change", atualizarFiltros);

  // Event listeners para filtros de tipo de tarefa
  getEl("mostrar-tarefas")?.addEventListener("change", atualizarFiltros);
  getEl("mostrar-subtarefas")?.addEventListener("change", atualizarFiltros);

  const btnFullscreen = getEl("btn-fullscreen");
  const timelineCard = document.querySelector(".cronograma-card");

  if (btnFullscreen && timelineCard) {
    configurarEventoTelaCheia(btnFullscreen, timelineCard, appState.timeline);
  }
}

async function carregarDados() {
  try {
    mostrarLoading(getEl("timeline"), true);

    appState.allData = await carregarDadosDeJSON(
      appState.settings.jsonUrl,
      preprocessarDados
    );

    preencherFiltros();
    atualizarFiltros();
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    mostrarNotificacao("Erro ao carregar dados", error.message, "error");
  } finally {
    mostrarLoading(getEl("timeline"), false);
  }
}

// Preenche os selects de Grupo Principal e Cliente
function preencherFiltros() {
  if (!appState.allData || appState.allData.length === 0) return;

  const grupoPrincipalSelect = getEl("grupo-select");
  const clienteSelect = getEl("cliente-principal-select");

  if (grupoPrincipalSelect) {
    grupoPrincipalSelect.innerHTML = '<option value="todos">Todos</option>';
  }

  if (clienteSelect) {
    clienteSelect.innerHTML = '<option value="todos">Todos</option>';
  }

  // Lista de grupos principais válidos
  const gruposPrincipais = [
    "Criação",
    "Mídia",
    "Produção",
    "Operações",
    "BI",
    "Estratégia",
  ];

  // Preencher grupos principais
  if (grupoPrincipalSelect) {
    gruposPrincipais.forEach((grupo) => {
      // Verificar se existe pelo menos uma tarefa neste grupo
      if (appState.allData.some((t) => t.TaskOwnerGroup === grupo)) {
        grupoPrincipalSelect.add(new Option(grupo, grupo));
      }
    });
  }

  // Preencher clientes únicos
  if (clienteSelect) {
    const clientes = [
      ...new Set(appState.allData.map((t) => t.client).filter(Boolean)),
    ].sort();
    clientes.forEach((cliente) => {
      clienteSelect.add(new Option(cliente, cliente));
    });
  }

  atualizarSubgrupos();
}

// Preenche o select de Subgrupo com base no Grupo selecionado
function atualizarSubgrupos() {
  const grupoSelecionado = getEl("grupo-select")?.value || "todos";
  const subgrupoSelect = getEl("subgrupo-select");

  if (!subgrupoSelect) return;

  // Limpar e adicionar a opção "Todos"
  subgrupoSelect.innerHTML = '<option value="todos">Todos</option>';

  // Se "todos" estiver selecionado, não mostrar subgrupos
  if (grupoSelecionado === "todos") {
    return;
  }

  // Filtrar tarefas pelo grupo selecionado
  const tarefasDoGrupo = appState.allData.filter(
    (item) => item.TaskOwnerGroup === grupoSelecionado
  );

  // Coletar todos os caminhos completos únicos para este grupo
  const caminhos = new Set();

  tarefasDoGrupo.forEach((item) => {
    if (item.TaskOwnerFullPath) {
      caminhos.add(item.TaskOwnerFullPath);
    }
  });

  // Extrair subgrupos destes caminhos
  const subgrupos = new Set();
  const membrosDiretos = new Set();

  caminhos.forEach((caminho) => {
    // Ignorar o caso "Ana Luisa Andre" que é tratado como membro direto
    if (caminho === "Ana Luisa Andre") {
      membrosDiretos.add(caminho);
      return;
    }

    const partes = caminho.split("/").map((p) => p.trim());

    // Se o caminho começa com o grupo principal
    if (partes[0] === grupoSelecionado) {
      // Remover o grupo principal para extrair o subgrupo
      const subgrupo = partes.slice(1).join(" / ");
      if (subgrupo) {
        subgrupos.add(subgrupo);
      }
    }
    // Casos especiais sem prefixo de grupo principal
    else if (
      (grupoSelecionado === "Criação" && partes[0] === "Bruno Prosperi") ||
      (grupoSelecionado === "Operações" && partes[0] === "Carol")
    ) {
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
    [...subgrupos].sort().forEach((sub) => {
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
    [...membrosDiretos].sort().forEach((membro) => {
      subgrupoSelect.add(new Option(membro, membro));
    });
  }
}

function atualizarFiltros() {
  if (!appState.allData || appState.allData.length === 0) return;

  const cliente = getEl("cliente-principal-select")?.value || "todos";
  const dias = parseInt(getEl("periodo-select")?.value || "30");
  const grupo = getEl("grupo-select")?.value || "todos";
  const subgrupo = getEl("subgrupo-select")?.value || "todos";
  const mostrarTarefas = getEl("mostrar-tarefas")?.checked !== false;
  const mostrarSubtarefas = getEl("mostrar-subtarefas")?.checked !== false;

  const limite = moment().subtract(dias, "days");

  // Filtro base: por período
  appState.filteredData = appState.allData.filter((item) => {
    return moment(item.start).isSameOrAfter(limite);
  });

  // Filtro por cliente
  if (cliente !== "todos") {
    appState.filteredData = appState.filteredData.filter(
      (item) => item.client === cliente
    );
  }

  // Filtro por grupo
  if (grupo !== "todos") {
    appState.filteredData = appState.filteredData.filter(
      (item) => item.TaskOwnerGroup === grupo
    );
  }

  // Filtro por subgrupo
  if (subgrupo !== "todos") {
    appState.filteredData = appState.filteredData.filter((item) => {
      // Se for o caso especial "Ana Luisa Andre"
      if (
        subgrupo === "Ana Luisa Andre" &&
        item.TaskOwnerFullPath === "Ana Luisa Andre"
      ) {
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
        else if (
          (grupo === "Criação" && fullPath.startsWith("Bruno Prosperi")) ||
          (grupo === "Operações" && fullPath.startsWith("Carol"))
        ) {
          // Verificar se o caminho completo começa com o subgrupo
          return fullPath === subgrupo || fullPath.startsWith(`${subgrupo} / `);
        }
      }

      return false;
    });
  }

  // Filtrar por tipo de tarefa
  if (!mostrarTarefas || !mostrarSubtarefas) {
    appState.filteredData = appState.filteredData.filter((item) => {
      const isSubtask = item.tipo === "Subtarefa";
      if (!mostrarTarefas && !isSubtask) return false;
      if (!mostrarSubtarefas && isSubtask) return false;
      return true;
    });
  }

  // Agrupar por responsável e criar a timeline
  criarTimeline(appState.filteredData);
}

// Modificação para a função criarTimeline no dashboard.js
function criarTimeline(dados) {
  const container = getEl("timeline");
  if (!container || !dados) return;

  container.innerHTML = "";

  if (dados.length === 0) {
    container.innerHTML =
      '<div class="alert alert-info m-3">Nenhuma tarefa encontrada</div>';
    return;
  }

  try {
    // Agrupar por responsável
    const responsaveis = [
      ...new Set(dados.map((t) => t.responsible).filter(Boolean)),
    ].sort();

    const items = new vis.DataSet(
      dados.map((item, idx) => {
        const startDate = moment(item.start);
        const endDate = item.end
          ? moment(item.end)
          : startDate.clone().add(3, "days");

        // Verificar se é uma tarefa de curta duração (menos de 3 dias)
        // Verificar se é uma tarefa de curta duração (menos de 3 dias)
        const duration = endDate.diff(startDate, "days");
        const isShortDuration = duration <= 2;
        
        const isSubtask = item.tipo === "Subtarefa";
        const titlePrefix = isSubtask ? "↳ " : "";
        const taskClass = CONFIG.priorityClasses[item.Priority] || "";

        // Conteúdo com base na duração da tarefa
        let content;
        if (isShortDuration) {
          // Tarefa curta - agora mostra texto com estilo adaptado
          content = `<div class="mini-task ${taskClass} ${isSubtask ? "subtask" : ""}" data-type="curta" title="${item.name}">
                        <span class="priority-dot ${taskClass} mini-dot"></span>
                        ${titlePrefix}${item.name.substring(0, 15)}${
            item.name.length > 15 ? "..." : ""
          }
                      </div>`;
        } else {
          // Tarefa longa - formato normal
          content = `<div class="timeline-item-content ${isSubtask ? "subtask" : ""}" data-type="longa" title="${item.name}">
                        <span class="priority-dot ${taskClass}"></span>
                        ${titlePrefix}${item.name.substring(0, 25)}${
            item.name.length > 25 ? "..." : ""
          }
                      </div>`;
        }

        return {
          id: idx,
          content: content,
          start: startDate.toDate(),
          end: endDate.toDate(),
          group: item.responsible,
          title: `
          <div class="timeline-tooltip">
            <h5>${item.name}</h5>
            <p><strong>Cliente:</strong> ${item.client || "N/A"}</p>
            <p><strong>Responsável:</strong> ${item.responsible || "N/A"}</p>
            <p><strong>Período:</strong> ${startDate.format(
              "DD/MM/YYYY"
            )} - ${endDate.format("DD/MM/YYYY")}</p>
            <p><strong>Status:</strong> ${item.PipelineStepTitle || "N/A"}</p>
            <p><strong>Grupo:</strong> ${item.TaskOwnerFullPath || "N/A"}</p>
            <p><strong>Tipo:</strong> ${item.tipo || "Tarefa"}</p>
          </div>`,
          className: `${taskClass} ${isSubtask ? "subtask" : ""} ${
            isShortDuration ? "curta" : "longa"
          }`,
          isShortDuration: isShortDuration, // Flag para identificar o tipo de tarefa
          itemData: item, // Armazenar o item original para uso no modal
        };
      })
    );

    const visGroups = new vis.DataSet(
      responsaveis.map((resp) => ({
        id: resp,
        content: resp,
      }))
    );

    const options = getTimelineOptions();
    options.height = "800px";

    appState.timeline = new vis.Timeline(container, items, visGroups, options);
    appState.timeline.fit();

    // EVENTO NATIVO de clique da timeline para tarefas curtas e longas
    appState.timeline.on("click", function (properties) {
      if (!properties.item) return;

      const id = properties.item;
      const item = items.get(id);

      if (!item) return;

      // Se for uma tarefa curta, mostrar o modal
      if (item.isShortDuration) {
        const tarefaData = item.itemData;
        const content = `
          <div style="padding: 1rem">
            <h4>${tarefaData.name}</h4>
            <p><strong>Cliente:</strong> ${tarefaData.client || "N/A"}</p>
            <p><strong>Responsável:</strong> ${
              tarefaData.responsible || "N/A"
            }</p>
            <p><strong>Status:</strong> ${
              tarefaData.PipelineStepTitle || "N/A"
            }</p>
            <p><strong>Prioridade:</strong> ${tarefaData.Priority || "N/A"}</p>
            <p><strong>Tipo:</strong> ${tarefaData.tipo || "Tarefa"}</p>
            <p><strong>Período:</strong> ${moment(tarefaData.start).format(
              "DD/MM/YYYY"
            )} - ${moment(tarefaData.end).format("DD/MM/YYYY")}</p>
            <p><strong>Grupo:</strong> ${
              tarefaData.TaskOwnerFullPath || "N/A"
            }</p>
          </div>`;

        const modal = document.createElement("div");
        modal.className = "modal fade show";
        modal.style.display = "block";
        modal.style.backgroundColor = "rgba(0,0,0,0.5)";
        modal.innerHTML = `
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Detalhes da Tarefa</h5>
                <button type="button" class="btn-close" onclick="this.closest('.modal').remove()"></button>
              </div>
              <div class="modal-body">${content}</div>
              <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Fechar</button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(modal);
      } else {
        // Se for uma tarefa longa, trocar a classe 'expanded'
        const element = document.querySelector(`.vis-item[data-id="${id}"]`);
        if (!element) return;

        if (element.classList.contains("expanded")) {
          element.classList.remove("expanded");
        } else {
          // Remove expanded class from all other elements first
          document.querySelectorAll(".vis-item.expanded").forEach((el) => {
            if (el !== element) {
              el.classList.remove("expanded");
            }
          });

          element.classList.add("expanded");
        }
      }
    });
  } catch (error) {
    console.error("Erro ao criar timeline:", error);
    container.innerHTML = `<div class="alert alert-danger">Erro: ${error.message}</div>`;
  }
}

// Exportar os dados para CSV
function exportarCSV() {
  const headers = [
    "Cliente",
    "Projeto",
    "Tarefa",
    "Tipo",
    "Data Início",
    "Data Fim",
    "Responsável",
    "Grupo",
    "Subgrupo",
    "Prioridade",
    "Status",
  ];

  const formatarLinha = (item) => {
    // Extrair subgrupo do caminho completo
    let subgrupo = "";
    if (item.TaskOwnerFullPath) {
      const partes = item.TaskOwnerFullPath.split("/").map((p) => p.trim());
      if (partes.length > 1) {
        subgrupo = partes.slice(1).join(" / ");
      }
    }

    return [
      item.client || "N/A",
      item.project || "N/A",
      item.name || "Sem título",
      item.tipo || "Tarefa",
      item.start ? moment(item.start).format("DD/MM/YYYY") : "-",
      item.end ? moment(item.end).format("DD/MM/YYYY") : "-",
      item.responsible || "N/A",
      item.TaskOwnerGroup || "N/A",
      subgrupo || "N/A",
      item.Priority === "high"
        ? "Alta"
        : item.Priority === "medium"
        ? "Média"
        : "Baixa",
      item.PipelineStepTitle || "N/A",
    ];
  };

  exportarParaCSV(appState.filteredData, headers, formatarLinha, "tarefas");
}

export default {
  carregarDados,
  atualizarFiltros,
};
