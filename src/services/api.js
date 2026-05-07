export const api = {
  auth: {
    login: async (login, password) => window.api ? await window.api.login({ login, password }) : {success: false},
    changePassword: async (data) => window.api ? await window.api.changePassword(data) : {success: false}
  },
  usuarios: {
    getAll: async (user) => window.api ? await window.api.usuariosGetAll({ authToken: user?.sessionToken }) : { success: false, data: [] },
    create: async (data) => window.api ? await window.api.usuariosCreate(data) : { success: false },
    update: async (data) => window.api ? await window.api.usuariosUpdate(data) : { success: false },
    updateStatus: async (data) => window.api ? await window.api.usuariosUpdateStatus(data) : { success: false },
    delete: async (data) => window.api ? await window.api.usuariosDelete(data) : { success: false },
    resetAdminPassword: async (data) => window.api ? await window.api.usuariosResetAdminPassword(data) : { success: false }
  },
  dashboard: {
    getStats: async () => window.api ? await window.api.getStats() : { agendamentosHoje: 0, emAndamento: 0, finalizados: 0, faturamentoDia: 0, vendasDia: 0, faturamentoMes: 0, vendasMes: 0, ticketMedio: 0, atendimentosDia: 0, vendasPorDia: [], formasPagamento: [], topProdutos: [], topServicos: [] },
    getClientesRetorno: async () => window.api ? await window.api.dashboardGetClientesRetorno() : []
  },
  clientes: {
    getAll: async () => window.api ? await window.api.getClientes() : [],
    getById: async (id) => window.api ? await window.api.getClienteById(id) : null,
    create: async (data) => window.api ? await window.api.createCliente(data) : {},
    update: async (data) => window.api ? await window.api.updateCliente(data) : {},
    delete: async (id) => window.api ? await window.api.deleteCliente(id) : {},
    getResumo: async (id) => window.api ? await window.api.getClienteResumo(id) : { totalVisitas: 0, ultimaVisita: null, totalGasto: 0, badge: 'Novo' }
  },
  pets: {
    getAll: async () => window.api ? await window.api.getPets() : [],
    getByCliente: async (id) => window.api ? await window.api.getPetsByCliente(id) : [],
    getById: async (id) => window.api ? await window.api.getPetById(id) : null,
    create: async (data) => window.api ? await window.api.createPet(data) : {},
    update: async (data) => window.api ? await window.api.updatePet(data) : {},
    delete: async (id) => window.api ? await window.api.deletePet(id) : {},
    getHistorico: async (petId) => window.api ? await window.api.getPetHistorico(petId) : []
  },
  agenda: {
    getByDate: async (date) => window.api ? await window.api.getAgendamentosByDate(date) : [],
    getByWeek: async (startDate) => window.api ? await window.api.getAgendamentosByWeek(startDate) : [],
    create: async (data) => window.api ? await window.api.createAgendamento(data) : {},
    update: async (data) => window.api ? await window.api.updateAgendamento(data) : {},
    updateStatus: async (id, status) => window.api ? await window.api.updateAgendamentoStatus({id, status}) : {},
    delete: async (id) => window.api ? await window.api.deleteAgendamento(id) : {}
  },
  funcionarios: {
    getAll: async () => window.api ? await window.api.funcionariosGetAll() : [],
    create: async (data) => window.api ? await window.api.funcionariosCreate(data) : {},
    update: async (data) => window.api ? await window.api.funcionariosUpdate(data) : {},
    delete: async (id) => window.api ? await window.api.funcionariosDelete(id) : {}
  },
  caixa: {
    getAberto: async () => window.api ? await window.api.getCaixaAberto() : null,
    abrir: async (data) => window.api ? await window.api.abrirCaixa(data) : {},
    fechar: async (data) => window.api ? await window.api.fecharCaixa(data) : {},
    getMovimentacoes: async (id) => window.api ? await window.api.getMovimentacoes(id) : [],
    addMovimentacao: async (data) => window.api ? await window.api.addMovimentacao(data) : {}
  },
  atendimentos: {
    getList: async () => window.api ? await window.api.getAtendimentosList() : [],
    getByAgendamento: async (id) => window.api ? await window.api.getAtendimentoByAgendamento(id) : null,
    create: async (data) => window.api ? await window.api.createAtendimento(data) : {},
    start: async (id) => window.api ? await window.api.startAtendimento(id) : {},
    finish: async (id) => window.api ? await window.api.finishAtendimento(id) : {}
  },
  vendas: {
    getById: async (id) => window.api ? await window.api.getVendaById(id) : null,
    create: async (data) => window.api ? await window.api.createVenda(data) : {},
    addItem: async (data) => window.api ? await window.api.addVendaItem(data) : {},
    removeItem: async (id) => window.api ? await window.api.removeVendaItem(id) : {},
    updateItemQty: async (data) => window.api ? await window.api.updateVendaItemQty(data) : {},
    finalizar: async (data) => window.api ? await window.api.finalizarVenda(data) : {},
    cancelar: async (id) => window.api ? await window.api.cancelarVenda(id) : {}
  },
  servicos: {
    getAll: async () => window.api ? await window.api.getServicos() : [], // Deprecated alias
    getAtivos: async () => window.api ? await window.api.getServicosAtivos() : [],
    listAll: async () => window.api ? await window.api.listServicos() : [],
    getById: async (id) => window.api ? await window.api.getServicoById(id) : null,
    create: async (data) => window.api ? await window.api.createServico(data) : {},
    update: async (data) => window.api ? await window.api.updateServico(data) : {},
    delete: async (id) => window.api ? await window.api.deleteServico(id) : {}
  },
  produtos: {
    getAll: async () => window.api ? await window.api.getProdutos() : [],
    getById: async (id) => window.api ? await window.api.getProdutoById(id) : null,
    create: async (data) => window.api ? await window.api.createProduto(data) : {},
    update: async (data) => window.api ? await window.api.updateProduto(data) : {},
    delete: async (id) => window.api ? await window.api.deleteProduto(id) : {}
  },
  estoque: {
    entrada: async (data) => window.api ? await window.api.estoqueEntrada(data) : {},
    saida: async (data) => window.api ? await window.api.estoqueSaida(data) : {},
    ajuste: async (data) => window.api ? await window.api.estoqueAjuste(data) : {},
    getMovimentacoes: async (id) => window.api ? await window.api.getEstoqueMovimentacoes(id) : []
  },
  system: {
    backup: async () => window.api ? await window.api.backupDatabase() : { success: false },
    printReceipt: async (args) => window.api ? await window.api.printReceipt(args) : { success: false },
    openExternal: async (url) => window.api ? await window.api.openExternal(url) : { success: false }
  },
  // Licença: o gerenciamento principal é feito pelo LicenseContext via window.api diretamente.
  // Estes aliases são mantidos por retrocompatibilidade com qualquer chamada direta a api.license.
  license: {
    activate: async (chave) => window.api ? await window.api.licenseActivate(chave) : { success: false },
    getLocal: async () => window.api ? await window.api.licenseGetLocal() : { success: false, data: null },
    getHWID: async () => window.api ? await window.api.licenseGetHWID() : ''
  },
  configImpressao: {
    get: async () => window.api ? await window.api.configImpressaoGet() : { 
      largura_bobina: 80, imprimir_automatico: 1, exibir_dialogo_impressao: 1, imprimir_danfe_automatico: 0, vias_cupom: 1, mensagem_rodape: '' 
    },
    save: async (data) => window.api ? await window.api.configImpressaoSave(data) : { success: false }
  },
  config: {
    getEmpresa: async () => window.api ? await window.api.getConfigEmpresa() : null,
    saveEmpresa: async (data) => window.api ? await window.api.saveConfigEmpresa(data) : { success: false },
    getPDV: async () => window.api ? await window.api.getConfigPDV() : null,
    savePDV: async (data) => window.api ? await window.api.saveConfigPDV(data) : { success: false },
    caixaFinanceiro: {
      get: async () => window.api ? await window.api.configCaixaFinanceiroGet() : {},
      save: async (data) => window.api ? await window.api.configCaixaFinanceiroSave(data) : { success: false }
    },
    sistema: {
      get: async () => window.api ? await window.api.configSistemaGet() : {},
      save: async (data) => window.api ? await window.api.configSistemaSave(data) : { success: false }
    },
    integracoes: {
      get: async () => window.api ? await window.api.configIntegracoesGet() : {},
      save: async (data) => window.api ? await window.api.configIntegracoesSave(data) : { success: false }
    },
    aparencia: {
      get: async () => window.api ? await window.api.configAparenciaGet() : {},
      save: async (data) => window.api ? await window.api.configAparenciaSave(data) : { success: false }
    }
  },
  backup: {
    getConfig: async () => window.api ? await window.api.backupGetConfig() : null,
    saveConfig: async (data) => window.api ? await window.api.backupSaveConfig(data) : { success: false },
    executar: async () => window.api ? await window.api.backupExecutar() : { success: false },
    restaurar: async (caminho) => window.api ? await window.api.backupRestaurar(caminho) : { success: false },
    listar: async () => window.api ? await window.api.backupListarArquivos() : { success: false, files: [] }
  },
  dialog: {
    selectDirectory: async () => window.api ? await window.api.dialogSelectDirectory() : null
  },
  fiscal: {
    getConfig: async () => window.api ? await window.api.fiscalGetConfig() : null,
    saveConfig: async (data) => window.api ? await window.api.fiscalSaveConfig(data) : { success: false },
    emitirHomologacao: async (vendaId) => window.api ? await window.api.fiscalEmitirHomologacao(vendaId) : { success: false },
    getStatusByVenda: async (vendaId) => window.api ? await window.api.fiscalGetStatusByVenda(vendaId) : null,
    validarVenda: async (vendaId) => window.api ? await window.api.fiscalValidarVenda(vendaId) : { success: false },
    getPayloadPreview: async (vendaId) => window.api ? await window.api.fiscalGetPayloadPreview(vendaId) : { success: false },
    consultarNfce: async (referencia) => window.api ? await window.api.fiscalConsultarNfce(referencia) : { success: false },
    getPendentes: async () => window.api ? await window.api.fiscalGetPendentes() : [],
    reprocessarPendentes: async () => window.api ? await window.api.fiscalReprocessarPendentes() : { success: false },
    reenviarUnico: async (id) => window.api ? await window.api.fiscalReenviarUnico(id) : { success: false },
    getDetalheByVenda: async (vendaId) => window.api ? await window.api.fiscalGetDetalheByVenda(vendaId) : { success: false },
    gerarDanfeHtml: async (vendaId) => window.api ? await window.api.fiscalGerarDanfeHtml(vendaId) : { success: false },
    printDanfe: async (args) => window.api ? await window.api.fiscalPrintDanfe(args) : { success: false }
  },
  sistema: {
    getInfo: async () => window.api ? await window.api.sistemaGetInfo() : { versao: '1.0.0', dbPath: '' },
    abrirPastaDados: async () => window.api ? await window.api.sistemaAbrirPastaDados() : { success: false },
    selecionarLogo: async () => window.api ? await window.api.sistemaSelecionarLogo() : { success: false }
  },
  hardware: {
    getConfig: async () => window.api ? await window.api.configHardwareGet() : null,
    saveConfig: async (data) => window.api ? await window.api.configHardwareSave(data) : { success: false },
    abrirGaveta: async () => window.api ? await window.api.hwGavetaAbrir() : { success: false }
  },
  balanca: {
    getConfig: async () => window.api ? await window.api.configBalancaGet() : null,
    saveConfig: async (data) => window.api ? await window.api.configBalancaSave(data) : { success: false },
    lerPeso: async () => window.api ? await window.api.hwBalancaLer() : { success: false, peso: null }
  }
};
