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
  CONFIG,
  getTimelineOptions
} from './utils.js';

let appState = {
  allData: [],
  filteredData: [],
  timeline: null,
  isLoading: false,
  projects: [], // Array para armazenar projetos
  settings: {
    dataSource: localStorage.getItem("dataSource") || "json",
    jsonUrl: localStorage.getItem("jsonUrl") || "dados.json",
  },
};

// Mapeamento de nomes de equipes para abreviações
const equipesAbreviacao = {
  "Criação": "{CRIA}",
  "Mídia": "{MID}",
  "Produção": "{PROD}",
  "Operações": "{OPEC}",
  "BI": "{BI}",
  "Estratégia": "{ESTR}"
};

// Função para obter abreviação da equipe
function obterAbreviacaoEquipe(nomeEquipe) {
  return equipesAbreviacao[nomeEquipe] || `{${nomeEquipe.substring(0, 4).toUpperCase()}}`;
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM carregado, iniciando dashboard de clientes");
  
  // Atualizar o ano no rodapé
  const anoElement = getEl("ano-atual");
  if (anoElement) {
    anoElement.textContent = new Date().getFullYear();
  }
  
  setupEventListeners();
  carregarDados();
});

function setupEventListeners() {
  console.log("Configurando event listeners");
  
  // Botões de navegação
  getEl("btn-anterior")?.addEventListener("click", () => moverTimeline(appState.timeline, -7));
  getEl("btn-hoje")?.addEventListener("click", () => irParaHoje(appState.timeline));
  getEl("btn-proximo")?.addEventListener("click", () => moverTimeline(appState.timeline, 7));
  getEl("btn-zoom-out")?.addEventListener("click", () => ajustarZoom(appState.timeline, 0.7));
  getEl("btn-zoom-in")?.addEventListener("click", () => ajustarZoom(appState.timeline, 1.3));
  getEl("exportar-dados")?.addEventListener("click", exportarCSV);
  
  // Verificando ambos os possíveis IDs para o select de cliente
  const clienteSelect = getEl("cliente-select") || getEl("cliente-principal-select");
  if (clienteSelect) {
    console.log("Select de cliente encontrado:", clienteSelect.id);
    clienteSelect.addEventListener("change", atualizarFiltros);
  } else {
    console.warn("Select de cliente não encontrado. Verificar IDs no HTML.");
  }
  
  // Verificando ambos os possíveis IDs para o select de grupo
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
    configurarEventoTelaCheia(btnFullscreen, timelineCard, appState.timeline);
  }
}

async function carregarDados() {
  console.log("Iniciando carregamento de dados");
  const timelineContainer = getEl("timeline");
  
  try {
    mostrarLoading(timelineContainer, true);
    appState.isLoading = true;
    
    const response = await fetch(appState.settings.jsonUrl);
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
    }
    
    console.log("Dados JSON obtidos com sucesso");
    const dadosOriginais = await response.json();
    appState.allData = dadosOriginais.map(preprocessarDados);
    
    console.log(`Processados ${appState.allData.length} itens de dados`);
    
    processarProjetos();
    console.log(`Gerados ${appState.projects.length} projetos`);
    
    preencherFiltros();
    atualizarFiltros();
  } catch (error) {
    console.error("Erro ao carregar ou processar dados:", error);
    
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

  // Garantir que o campo tipo esteja sempre definido
  processado.tipo = processado.tipo || "Tarefa";

  return processado;
}

function processarProjetos() {
  console.log("Processando projetos a partir das tarefas");
  
  // Objeto para agrupar por cliente+projeto 
  const projetosPorCliente = {};
  
  // Agrupar tarefas por combinação de cliente e projeto
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
        status: tarefa.PipelineStepTitle || "Em andamento",
        priority: tarefa.Priority || "medium",
        progress: 0
      };
    }
    
    // Adicionar tarefa ao projeto
    const projeto = projetosPorCliente[chave];
    projeto.tasks.push(tarefa);
    
    // Adicionar responsável e grupo
    if (tarefa.responsible) projeto.responsibles.add(tarefa.responsible);
    if (tarefa.TaskOwnerGroup) projeto.groups.add(tarefa.TaskOwnerGroup);
    
    // Ajustar datas (início mais antigo, fim mais recente)
    if (!projeto.start || new Date(tarefa.start) < new Date(projeto.start)) {
      projeto.start = tarefa.start;
    }
    
    if (!projeto.end || (tarefa.end && new Date(tarefa.end) > new Date(projeto.end))) {
      projeto.end = tarefa.end;
    }
    
    // Atualizar prioridade (usar a mais alta)
    if (tarefa.Priority === "high") {
      projeto.priority = "high";
    } else if (tarefa.Priority === "medium" && projeto.priority !== "high") {
      projeto.priority = "medium";
    }
  });
  
  // Processar projetos após agrupamento
  appState.projects = Object.values(projetosPorCliente).map(projeto => {
    // Converter Sets para Arrays
    projeto.responsibles = Array.from(projeto.responsibles).sort();
    projeto.groups = Array.from(projeto.groups).sort();
    
    // Determinar o responsável principal
    projeto.mainResponsible = projeto.responsibles[0] || "Não atribuído";
    
    // Calcular progresso do projeto
    const tarefasConcluidas = projeto.tasks.filter(t => 
      t.PipelineStepTitle === "Concluída" || t.status === "Concluída"
    ).length;
    
    projeto.progress = projeto.tasks.length > 0 
      ? Math.round((tarefasConcluidas / projeto.tasks.length) * 100) 
      : 0;
    
    // Determinar status do projeto
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
  console.log("Preenchendo filtros");
  
  if (!appState.projects || appState.projects.length === 0) {
    console.warn("Nenhum projeto disponível para preencher filtros");
    return;
  }

  // Verificar ambos os possíveis IDs para os selects
  const clienteSelect = getEl("cliente-select") || getEl("cliente-principal-select");
  const grupoSelect = getEl("grupo-principal-select") || getEl("grupo-select");

  if (!clienteSelect) {
    console.error("Select de cliente não encontrado. Verificar IDs no HTML.");
  }
  
  if (!grupoSelect) {
    console.error("Select de grupo não encontrado. Verificar IDs no HTML.");
  }

  // Limpar e adicionar opção "Todos"
  if (clienteSelect) {
    clienteSelect.innerHTML = '<option value="todos">Todos</option>';
  }
  
  if (grupoSelect) {
    grupoSelect.innerHTML = '<option value="todos">Todos</option>';
  }

  // Preencher clientes únicos
  if (clienteSelect) {
    const clientes = [...new Set(appState.projects.map(p => p.client).filter(Boolean))].sort();
    console.log(`Preenchendo ${clientes.length} clientes no select`);
    
    clientes.forEach(cliente => {
      clienteSelect.add(new Option(cliente, cliente));
    });
  }

  // Coletar grupos únicos dos projetos
  if (grupoSelect) {
    const grupos = new Set();
    appState.projects.forEach(projeto => {
      projeto.groups.forEach(grupo => grupos.add(grupo));
    });

    console.log(`Preenchendo ${grupos.size} grupos no select`);
    
    // Adicionar grupos encontrados
    [...grupos].sort().forEach(grupo => {
      grupoSelect.add(new Option(grupo, grupo));
    });
  }
}

function atualizarFiltros() {
  console.log("Atualizando filtros");
  
  if (!appState.projects || appState.projects.length === 0) {
    console.warn("Sem projetos para filtrar");
    return;
  }

  // Verificar ambos os possíveis IDs
  const cliente = (getEl("cliente-select") || getEl("cliente-principal-select"))?.value || "todos";
  const grupo = (getEl("grupo-principal-select") || getEl("grupo-select"))?.value || "todos";
  const dias = parseInt(getEl("periodo-select")?.value || "30");

  console.log(`Filtros selecionados - Cliente: ${cliente}, Grupo: ${grupo}, Período: ${dias} dias`);

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

  console.log(`${appState.filteredData.length} projetos após aplicação dos filtros`);
  criarTimeline(appState.filteredData);
}

function criarTimeline(projetos) {
  console.log("Criando timeline com", projetos?.length || 0, "projetos");
  
  const container = getEl("timeline");
  if (!container) {
    console.error("Container da timeline não encontrado");
    return;
  }
  
  if (!projetos || projetos.length === 0) {
    container.innerHTML = '<div class="alert alert-info m-3">Nenhum projeto encontrado</div>';
    return;
  }

  try {
    // Remover spinner de carregamento
    mostrarLoading(container, false);
    container.innerHTML = "";
    
    // Agrupar por cliente
    const clientes = [...new Set(projetos.map(p => p.client).filter(Boolean))].sort();
    console.log(`Timeline terá ${clientes.length} grupos (clientes)`);

    // Verificar se a biblioteca vis.js está disponível
    if (typeof vis === 'undefined') {
      console.error("Biblioteca vis.js não está carregada!");
      container.innerHTML = `
        <div class="alert alert-danger m-3">
          <h5>Erro ao criar timeline</h5>
          <p>Biblioteca vis.js não está disponível. Verifique se foi carregada corretamente.</p>
        </div>
      `;
      return;
    }

    // Criação dos itens da timeline - projetos mostram EQUIPE e RESPONSÁVEL
    const items = new vis.DataSet(
      projetos.map((projeto, idx) => {
        const startDate = moment(projeto.start);
        const endDate = projeto.end 
          ? moment(projeto.end) 
          : startDate.clone().add(14, "days");
        
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
        
        // Obter abreviações para as equipes e o título do projeto
        const equipeFormatada = projeto.groups.map(grupo => obterAbreviacaoEquipe(grupo)).join(" / ") || "Sem equipe";
        const tituloProjeto = projeto.name || "Sem título";
        
        const content = `<div class="timeline-item-content ${priorityClass} ${statusClass}" title="${projeto.name}">
                           <span class="priority-dot ${priorityClass}"></span>
                           <strong>${equipeFormatada}</strong> - ${tituloProjeto}
                         </div>`;

        return {
          id: idx,
          content,
          title: `
            <div class="timeline-tooltip">
              <h5>${projeto.name}</h5>
              <p><strong>Cliente:</strong> ${projeto.client || "N/A"}</p>
              <p><strong>Time:</strong> ${equipeFormatada}</p>
              <p><strong>Período:</strong> ${startDate.format("DD/MM/YYYY")} - ${endDate.format("DD/MM/YYYY")}</p>
              <p><strong>Status:</strong> <span class="${statusClass}">${projeto.status}</span></p>
            </div>`,
          start: startDate.toDate(),
          end: endDate.toDate(),
          group: projeto.client,
          className: `${priorityClass} ${statusClass}`,
          projeto
        };
      })
    );

    // Clientes em negrito
    const visGroups = new vis.DataSet(
      clientes.map(cliente => ({
        id: cliente,
        content: `<strong>${cliente}</strong>`,
        className: CONFIG.clientColors[cliente.toUpperCase()] || ""
      }))
    );

    // Definir opções
    const options = getTimelineOptions();

    console.log("Criando objeto Timeline");
    appState.timeline = new vis.Timeline(container, items, visGroups, options);
    
    console.log("Ajustando timeline para exibir todos os itens");
    appState.timeline.fit();

    // USAR o evento "select" da timeline para capturar cliques
    appState.timeline.on("select", function(properties) {
      if (!properties.items.length) return;
      
      const id = properties.items[0];
      const item = items.get(id);
      
      if (!item || !item.projeto) return;
      
      const p = item.projeto;
      const equipeFormatada = p.groups.map(grupo => obterAbreviacaoEquipe(grupo)).join(" / ");
      
      const content = `
        <div style="padding: 1rem">
          <h4>${p.name}</h4>
          <p><strong>Cliente:</strong> ${p.client}</p>
          <p><strong>Equipe responsável:</strong> ${equipeFormatada}</p>
          <p><strong>Responsável:</strong> ${p.responsibles.join(", ")}</p>
          <p><strong>Status:</strong> ${p.status}</p>
          <p><strong>Prioridade:</strong> ${p.priority}</p>
          <p><strong>Progresso:</strong> ${p.progress}%</p>
          <p><strong>Período:</strong> ${moment(p.start).format("DD/MM/YYYY")} - ${moment(p.end || p.start).format("DD/MM/YYYY")}</p>
        </div>`;
      
      const modal = document.createElement('div');
      modal.className = 'modal fade show';
      modal.style.display = 'block';
      modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Detalhes do Projeto</h5>
              <button type="button" class="btn-close" onclick="this.closest('.modal').remove()"></button>
            </div>
            <div class="modal-body">${content}</div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Fechar</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    });
    
  } catch (error) {
    console.error("Erro ao criar timeline:", error);
    container.innerHTML = `
      <div class="alert alert-danger m-3">
        <h5>Erro ao criar timeline</h5>
        <p>${error.message}</p>
        <button class="btn btn-sm btn-outline-danger" onclick="location.reload()">Tentar novamente</button>
      </div>
    `;
  }
}

// Exportar os dados para CSV
function exportarCSV() {
  console.log("Exportando CSV");
  
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

export default {
  carregarDados,
  atualizarFiltros
};