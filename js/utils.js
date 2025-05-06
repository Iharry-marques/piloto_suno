/**
 * Dashboard de Tarefas - SUNO
 * utils.js - Funções utilitárias compartilhadas entre módulos
 */

// Funções DOM e utilitárias
export const getEl = (id) => document.getElementById(id);

/**
 * Move a timeline para frente ou para trás em dias
 * @param {object} timeline - Instância da timeline
 * @param {number} dias - Número de dias para mover (positivo = futuro, negativo = passado)
 */
export function moverTimeline(timeline, dias) {
  if (!timeline) return;

  const range = timeline.getWindow();
  timeline.setWindow({
    start: moment(range.start).add(dias, "days").valueOf(),
    end: moment(range.end).add(dias, "days").valueOf(),
  });
}

/**
 * Centraliza a timeline na data atual
 * @param {object} timeline - Instância da timeline
 */
export function irParaHoje(timeline) {
  if (!timeline) return;

  const range = timeline.getWindow();
  const intervalo = range.end - range.start;
  const hoje = moment().valueOf();

  timeline.setWindow({
    start: hoje - intervalo / 2,
    end: hoje + intervalo / 2,
  });
}

/**
 * Ajusta o zoom da timeline
 * @param {object} timeline - Instância da timeline
 * @param {number} fator - Fator de zoom (>1 = zoom in, <1 = zoom out)
 */
export function ajustarZoom(timeline, fator) {
  if (!timeline) return;

  const range = timeline.getWindow();
  const centro = new Date((range.end.getTime() + range.start.getTime()) / 2);
  const novoIntervalo = (range.end - range.start) / fator;

  timeline.setWindow({
    start: new Date(centro.getTime() - novoIntervalo / 2),
    end: new Date(centro.getTime() + novoIntervalo / 2),
  });
}

/**
 * Exibe ou oculta indicador de carregamento
 * @param {HTMLElement} container - Elemento HTML onde mostrar o loading
 * @param {boolean} mostrar - Se true, mostra o loading; se false, limpa o container
 */
export function mostrarLoading(container, mostrar) {
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

/**
 * Exibe uma notificação toast
 * @param {string} titulo - Título da notificação
 * @param {string} mensagem - Texto da mensagem
 * @param {string} tipo - Tipo da notificação: "info", "success", "warning" ou "error"
 */
export function mostrarNotificacao(titulo, mensagem, tipo = "info") {
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

/**
 * Configura eventos de tela cheia para o container da timeline
 * @param {HTMLElement} btnFullscreen - Botão para ativar modo tela cheia
 * @param {HTMLElement} timelineCard - Container da timeline que será expandido
 * @param {object} timeline - Instância da timeline para redimensionar
 */
export function configurarEventoTelaCheia(btnFullscreen, timelineCard, timeline) {
  if (!btnFullscreen || !timelineCard || !timeline) return;

  btnFullscreen.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      (timelineCard.requestFullscreen || timelineCard.webkitRequestFullscreen || timelineCard.msRequestFullscreen).call(timelineCard);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
    }

    setTimeout(() => {
      document.getElementById("timeline").style.height = document.fullscreenElement ? `${window.innerHeight - 150}px` : "600px";
      timeline.redraw();
    }, 100);
  });

  document.addEventListener("fullscreenchange", () => {
    document.getElementById("timeline").style.height = document.fullscreenElement ? `${window.innerHeight - 150}px` : "600px";
    timeline.redraw();
  });
}

/**
 * Carrega dados do JSON
 * @param {string} jsonUrl - URL do arquivo JSON
 * @param {function} preprocessador - Função para processar cada item do JSON
 * @returns {Promise<Array>} - Dados processados
 */
export async function carregarDadosDeJSON(jsonUrl, preprocessador) {
  try {
    const response = await fetch(jsonUrl);
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const dadosOriginais = await response.json();
    return dadosOriginais.map(preprocessador);
  } catch (error) {
    throw new Error(`Falha ao carregar dados do JSON: ${error.message}`);
  }
}

/**
 * Preprocessa dados para normalizar campos
 * @param {object} item - Item a ser processado
 * @returns {object} - Item processado
 */
export function preprocessarDados(item) {
  const processado = { ...item };

  // Mapear prioridade com base no status
  const statusPriority = {
    "Não iniciada": "low",
    Backlog: "medium",
    "Em Produção": "high",
  };
  processado.Priority = statusPriority[processado.PipelineStepTitle] || "medium";

  // Lista de grupos principais válidos
  const gruposPrincipais = [
    "Criação",
    "Mídia",
    "Produção",
    "Operações",
    "BI",
    "Estratégia",
  ];

  // Inicializar valores
  let grupo = undefined;
  let caminhoCompleto = item.group_subgroup || "";

  // Extrair o grupo principal do caminho completo
  if (caminhoCompleto) {
    // Caso especial para Ana Luisa Andre (sem barra, mas pertence a Produção)
    if (caminhoCompleto.trim() === "Ana Luisa Andre") {
      grupo = "Produção";
    } else {
      const partes = caminhoCompleto.split("/").map((p) => p.trim());

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
          console.warn(
            `Grupo não reconhecido: ${partes[0]} em ${caminhoCompleto}`
          );
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
  processado.TaskClosingDate =
    processado.end ||
    moment(processado.RequestDate).add(3, "days").toISOString();
  processado.CurrentDueDate = processado.TaskClosingDate;

  // Garantir que o campo tipo esteja sempre definido
  processado.tipo = processado.tipo || "Tarefa";

  return processado;
}

/**
 * Exporta dados filtrados para CSV
 * @param {Array} dados - Dados a serem exportados
 * @param {Array} headers - Cabeçalhos do CSV
 * @param {function} formatarLinha - Função para formatar cada linha
 * @param {string} nomeArquivo - Nome do arquivo a ser gerado
 */
export function exportarParaCSV(dados, headers, formatarLinha, nomeArquivo) {
  if (!dados || dados.length === 0) {
    mostrarNotificacao("Exportação", "Não há dados para exportar.", "warning");
    return;
  }

  const linhas = dados.map(formatarLinha);

  const csvContent = [
    headers.join(","),
    ...linhas.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `${nomeArquivo}_${moment().format("YYYY-MM-DD")}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  mostrarNotificacao(
    "Exportação",
    "Arquivo CSV gerado com sucesso!",
    "success"
  );
}

// Configurações globais compartilhadas
export const CONFIG = {
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

// Timeline options compartilhadas
export function getTimelineOptions() {
  return {
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
}