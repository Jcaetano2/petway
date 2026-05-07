const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Auth
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  changePassword: (data) => ipcRenderer.invoke('auth:changePassword', data),
  
  // Usuarios (Admin)
  usuariosGetAll: (data) => ipcRenderer.invoke('db:usuarios:getAll', data),
  usuariosCreate: (data) => ipcRenderer.invoke('db:usuarios:create', data),
  usuariosUpdate: (data) => ipcRenderer.invoke('db:usuarios:update', data),
  usuariosUpdateStatus: (data) => ipcRenderer.invoke('db:usuarios:updateStatus', data),
  usuariosDelete: (data) => ipcRenderer.invoke('db:usuarios:delete', data),
  usuariosResetAdminPassword: (data) => ipcRenderer.invoke('db:usuarios:resetAdminPassword', data),

  // Dashboard
  getStats: () => ipcRenderer.invoke('db:dashboard:getStats'),
  
  // Clientes
  getClientes: () => ipcRenderer.invoke('db:clientes:getAll'),
  getClienteById: (id) => ipcRenderer.invoke('db:clientes:getById', id),
  createCliente: (data) => ipcRenderer.invoke('db:clientes:create', data),
  updateCliente: (data) => ipcRenderer.invoke('db:clientes:update', data),
  deleteCliente: (id) => ipcRenderer.invoke('db:clientes:delete', id),
  
  // Pets
  getPets: () => ipcRenderer.invoke('db:pets:getAll'),
  getPetsByCliente: (id) => ipcRenderer.invoke('db:pets:listByCliente', id),
  getPetById: (id) => ipcRenderer.invoke('db:pets:getById', id),
  createPet: (data) => ipcRenderer.invoke('db:pets:create', data),
  updatePet: (data) => ipcRenderer.invoke('db:pets:update', data),
  deletePet: (id) => ipcRenderer.invoke('db:pets:delete', id),
  
  // Servicos
  getServicos: () => ipcRenderer.invoke('db:servicos:getAll'), // Mantido retrocompat compatível
  getServicosAtivos: () => ipcRenderer.invoke('db:servicos:getAtivos'),
  listServicos: () => ipcRenderer.invoke('db:servicos:list'),
  getServicoById: (id) => ipcRenderer.invoke('db:servicos:getById', id),
  createServico: (data) => ipcRenderer.invoke('db:servicos:create', data),
  updateServico: (data) => ipcRenderer.invoke('db:servicos:update', data),
  deleteServico: (id) => ipcRenderer.invoke('db:servicos:delete', id),

  // Agenda
  getAgendamentosByDate: (date) => ipcRenderer.invoke('db:agenda:getByDate', date),
  getAgendamentosByWeek: (startDate) => ipcRenderer.invoke('db:agenda:getByWeek', startDate),
  createAgendamento: (data) => ipcRenderer.invoke('db:agenda:create', data),
  updateAgendamento: (data) => ipcRenderer.invoke('db:agenda:update', data),
  updateAgendamentoStatus: (data) => ipcRenderer.invoke('db:agenda:updateStatus', data),
  deleteAgendamento: (id) => ipcRenderer.invoke('db:agenda:delete', id),

  // Funcionários
  funcionariosGetAll: () => ipcRenderer.invoke('db:funcionarios:getAll'),
  funcionariosCreate: (data) => ipcRenderer.invoke('db:funcionarios:create', data),
  funcionariosUpdate: (data) => ipcRenderer.invoke('db:funcionarios:update', data),
  funcionariosDelete: (id) => ipcRenderer.invoke('db:funcionarios:delete', id),

  // Caixa
  getCaixaAberto: () => ipcRenderer.invoke('db:caixa:getAberto'),
  abrirCaixa: (data) => ipcRenderer.invoke('db:caixa:abrir', data),
  fecharCaixa: (data) => ipcRenderer.invoke('db:caixa:fechar', data),
  getMovimentacoes: (caixa_id) => ipcRenderer.invoke('db:caixa:getMovimentacoes', caixa_id),
  addMovimentacao: (data) => ipcRenderer.invoke('db:caixa:addMovimentacao', data),

  // Atendimentos
  getAtendimentosList: () => ipcRenderer.invoke('db:atendimentos:getList'),
  getAtendimentoByAgendamento: (id) => ipcRenderer.invoke('db:atendimentos:getByAgendamento', id),
  createAtendimento: (data) => ipcRenderer.invoke('db:atendimentos:create', data),
  startAtendimento: (id) => ipcRenderer.invoke('db:atendimentos:start', id),
  finishAtendimento: (id) => ipcRenderer.invoke('db:atendimentos:finish', id),

  // Vendas (PDV)
  getVendaById: (id) => ipcRenderer.invoke('db:vendas:getById', id),
  createVenda: (data) => ipcRenderer.invoke('db:vendas:create', data),
  addVendaItem: (data) => ipcRenderer.invoke('db:vendas:addItem', data),
  removeVendaItem: (id) => ipcRenderer.invoke('db:vendas:removeItem', id),
  updateVendaItemQty: (data) => ipcRenderer.invoke('db:vendas:updateItemQty', data),
  finalizarVenda: (data) => ipcRenderer.invoke('db:vendas:finalizar', data),
  cancelarVenda: (id) => ipcRenderer.invoke('db:vendas:cancelar', id),

  // Produtos
  getProdutos: () => ipcRenderer.invoke('db:produtos:list'),
  getProdutoById: (id) => ipcRenderer.invoke('db:produtos:getById', id),
  createProduto: (data) => ipcRenderer.invoke('db:produtos:create', data),
  updateProduto: (data) => ipcRenderer.invoke('db:produtos:update', data),
  deleteProduto: (id) => ipcRenderer.invoke('db:produtos:delete', id),

  // Estoque
  estoqueEntrada: (data) => ipcRenderer.invoke('db:estoque:entrada', data),
  estoqueSaida: (data) => ipcRenderer.invoke('db:estoque:saida', data),
  estoqueAjuste: (data) => ipcRenderer.invoke('db:estoque:ajuste', data),
  getEstoqueMovimentacoes: (produto_id) => ipcRenderer.invoke('db:estoque:listMovimentacoes', produto_id),

  // System
  backupDatabase: () => ipcRenderer.invoke('system:db:backup'),
  printReceipt: (htmlContent) => ipcRenderer.invoke('system:print:receipt', htmlContent),

  config: {
    getEmpresa: () => ipcRenderer.invoke('config:empresa:get'),
    saveEmpresa: (data) => ipcRenderer.invoke('config:empresa:save', data),
    getPDV: () => ipcRenderer.invoke('config:pdv:get'),
    savePDV: (data) => ipcRenderer.invoke('config:pdv:save', data),
    getImpressao: () => ipcRenderer.invoke('config:impressao:get'),
    saveImpressao: (data) => ipcRenderer.invoke('config:impressao:save', data),
    getFiscal: () => ipcRenderer.invoke('config:fiscal:get'),
    saveFiscal: (data) => ipcRenderer.invoke('config:fiscal:save', data),
    getHardware: () => ipcRenderer.invoke('config:hardware:get'),
    saveHardware: (data) => ipcRenderer.invoke('config:hardware:save', data),
    getBalanca: () => ipcRenderer.invoke('config:balanca:get'),
    saveBalanca: (data) => ipcRenderer.invoke('config:balanca:save', data),
    getCaixaFinanceiro: () => ipcRenderer.invoke('config:caixaFinanceiro:get'),
    saveCaixaFinanceiro: (data) => ipcRenderer.invoke('config:caixaFinanceiro:save', data),
    getSistema: () => ipcRenderer.invoke('config:sistema:get'),
    saveSistema: (data) => ipcRenderer.invoke('config:sistema:save', data),
    getIntegracoes: () => ipcRenderer.invoke('config:integracoes:get'),
    saveIntegracoes: (data) => ipcRenderer.invoke('config:integracoes:save', data)
  },

  sistema: {
    getInfo: () => ipcRenderer.invoke('sistema:getInfo'),
    abrirPastaDados: () => ipcRenderer.invoke('sistema:abrirPastaDados')
  },

  // Configuracoes
  getConfigEmpresa: () => ipcRenderer.invoke('db:config:getEmpresa'),
  saveConfigEmpresa: (data) => ipcRenderer.invoke('db:config:saveEmpresa', data),
  getConfigPDV: () => ipcRenderer.invoke('db:config:getPDV'),
  saveConfigPDV: (data) => ipcRenderer.invoke('db:config:savePDV', data),
  configImpressaoGet: () => ipcRenderer.invoke('config:impressao:get'),
  configImpressaoSave: (data) => ipcRenderer.invoke('config:impressao:save', data),

  // Backup e Restauração
  backupGetConfig: () => ipcRenderer.invoke('backup:getConfig'),
  backupSaveConfig: (data) => ipcRenderer.invoke('backup:saveConfig', data),
  backupExecutar: () => ipcRenderer.invoke('backup:executar'),
  backupRestaurar: (caminho) => ipcRenderer.invoke('backup:restaurar', caminho),
  backupListarArquivos: () => ipcRenderer.invoke('backup:listarArquivos'),
  dialogSelectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),

  // Fiscal (NFC-e)
  fiscalGetConfig: () => ipcRenderer.invoke('fiscal:getConfig'),
  fiscalSaveConfig: (data) => ipcRenderer.invoke('fiscal:saveConfig', data),
  fiscalEmitirHomologacao: (vendaId) => ipcRenderer.invoke('fiscal:emitirHomologacao', vendaId),
  fiscalGetStatusByVenda: (vendaId) => ipcRenderer.invoke('fiscal:getStatusByVenda', vendaId),
  fiscalValidarVenda: (vendaId) => ipcRenderer.invoke('fiscal:validarVenda', vendaId),
  fiscalGetPayloadPreview: (vendaId) => ipcRenderer.invoke('fiscal:getPayloadPreview', vendaId),
  fiscalConsultarNfce: (referencia) => ipcRenderer.invoke('fiscal:consultarNfce', referencia),
  fiscalGetPendentes: () => ipcRenderer.invoke('fiscal:getPendentes'),
  fiscalReprocessarPendentes: () => ipcRenderer.invoke('fiscal:reprocessarPendentes'),
  fiscalReenviarUnico: (id) => ipcRenderer.invoke('fiscal:reenviarUnico', id),
  fiscalGetDetalheByVenda: (vendaId) => ipcRenderer.invoke('fiscal:getDetalheByVenda', vendaId),
  fiscalGerarDanfeHtml: (vendaId) => ipcRenderer.invoke('fiscal:gerarDanfeHtml', vendaId),
  fiscalPrintDanfe: (vendaId) => ipcRenderer.invoke('fiscal:printDanfe', vendaId),

  // Hardware e Balança
  configHardwareGet: () => ipcRenderer.invoke('config:hardware:get'),
  configHardwareSave: (data) => ipcRenderer.invoke('config:hardware:save', data),
  hwGavetaAbrir: () => ipcRenderer.invoke('hw:gaveta:abrir'),
  configBalancaGet: () => ipcRenderer.invoke('config:balanca:get'),
  configBalancaSave: (data) => ipcRenderer.invoke('config:balanca:save', data),
  hwBalancaLer: () => ipcRenderer.invoke('hw:balanca:ler'),

  // Caixa e Financeiro
  configCaixaFinanceiroGet: () => ipcRenderer.invoke('config:caixaFinanceiro:get'),
  configCaixaFinanceiroSave: (data) => ipcRenderer.invoke('config:caixaFinanceiro:save', data),

  // Sistema
  configSistemaGet: () => ipcRenderer.invoke('config:sistema:get'),
  configSistemaSave: (data) => ipcRenderer.invoke('config:sistema:save', data),
  sistemaGetInfo: () => ipcRenderer.invoke('sistema:getInfo'),
  sistemaAbrirPastaDados: () => ipcRenderer.invoke('sistema:abrirPastaDados'),

  // Integrações (wrapper unificado)
  configIntegracoesGet: () => ipcRenderer.invoke('config:integracoes:get'),
  configIntegracoesSave: (data) => ipcRenderer.invoke('config:integracoes:save', data),

  // Aparência e Branding
  configAparenciaGet: () => ipcRenderer.invoke('config:aparencia:get'),
  configAparenciaSave: (data) => ipcRenderer.invoke('config:aparencia:save', data),
  sistemaSelecionarLogo: () => ipcRenderer.invoke('sistema:selecionarLogo'),

  // Inteligência de Negócio
  dashboardGetClientesRetorno: () => ipcRenderer.invoke('db:dashboard:getClientesRetorno'),
  getPetHistorico: (petId) => ipcRenderer.invoke('db:pets:getHistorico', petId),
  getClienteResumo: (clienteId) => ipcRenderer.invoke('db:clientes:getResumo', clienteId),

  // Sistema (WhatsApp / links externos)
  openExternal: (url) => ipcRenderer.invoke('system:openExternal', url),

  // Licenciamento (PetWay Licensing Server)
  licenseGetHWID: () => ipcRenderer.invoke('license:getHWID'),
  licenseActivate: (key) => ipcRenderer.invoke('license:activate', { key }),
  licenseValidate: (key) => ipcRenderer.invoke('license:validate', { key }),
  licenseGetLocal: () => ipcRenderer.invoke('license:getLocal'),
  licenseInitTrial: () => ipcRenderer.invoke('license:initTrial'),
  // BUG #2 FIX: métodos usados pelo LicenseContext que estavam faltando
  licenseGetLocalStatus: () => ipcRenderer.invoke('license:getLocal'),
  licenseSaveLocalStatus: (data) => ipcRenderer.invoke('license:saveLocal', data),

  // Atualizações do Sistema
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterDownload: () => ipcRenderer.invoke('updater:download'),
  updaterInstall: () => ipcRenderer.invoke('updater:install'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data));
    // Retorna função para remover o listener
    return () => ipcRenderer.removeAllListeners('update-status');
  }
});
