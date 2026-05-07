/**
 * Focus NFe API Client
 * 
 * Cliente HTTP isolado para comunicação com a API Focus NFe.
 * Toda chamada HTTP para a SEFAZ passa por aqui.
 * O token NUNCA sai do processo principal (Electron).
 * 
 * URLs padrão:
 *   Homologação: https://homologacao.focusnfe.com.br
 *   Produção:    https://api.focusnfe.com.br
 * 
 * O campo api_url em config_fiscal pode sobrescrever estas URLs se preenchido.
 */

const FOCUS_URLS = {
  homologacao: 'https://homologacao.focusnfe.com.br',
  producao: 'https://api.focusnfe.com.br'
};

/**
 * Mapeamento de formas de pagamento do sistema para códigos SEFAZ.
 * Tabela oficial: https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=...
 */
const FORMA_PAGAMENTO_MAP = {
  'dinheiro': '01',
  'cartao': '03',       // cartão crédito
  'cartao_debito': '04',
  'cartao_credito': '03',
  'pix': '17'
};

/**
 * Resolve a URL base da API.
 * Prioridade: api_url customizada > FOCUS_URLS por ambiente > fallback homologação.
 * @param {object} config - config_fiscal row
 * @returns {string} URL base sem trailing slash
 */
function resolveBaseUrl(config) {
  if (config.api_url && config.api_url.trim() !== '') {
    return config.api_url.replace(/\/+$/, '');
  }
  return FOCUS_URLS[config.ambiente] || FOCUS_URLS.homologacao;
}

/**
 * Transforma o payload interno do sistema para o formato JSON da API Focus NFe.
 * Trata produtos (dados fiscais individuais) e serviços (defaults fiscais separados).
 * @param {object} payload - Payload gerado por buildFiscalPayload do fiscalService
 * @returns {object} JSON pronto para envio à Focus NFe
 */
function mapToFocusPayload(payload) {
  const itens = payload.itens.map((item, index) => {
    // codigo_produto: ID real do produto/serviço no sistema
    const codigoProduto = item.tipo_origem === 'servico'
      ? `SV-${item.referencia_id || (index + 1)}`
      : String(item.referencia_id || (index + 1));

    const focusItem = {
      numero_item: index + 1,
      codigo_produto: codigoProduto,
      descricao: item.descricao || 'Item',
      cfop: item.cfop || '5102',
      unidade_comercial: item.unidade_comercial || 'UN',
      quantidade_comercial: parseFloat(item.quantidade) || 1,
      valor_unitario_comercial: parseFloat(item.valor_unitario) || 0,
      valor_bruto: parseFloat(item.valor_total) || 0,
      codigo_ncm: item.ncm || '00000000',
      inclui_no_total: '1',
      icms_origem: '0',
      icms_situacao_tributaria: item.cst_csosn || '102',
      pis_situacao_tributaria: '99',
      pis_base_calculo: '0.00',
      pis_aliquota_porcentual: '0.00',
      pis_valor: '0.00',
      cofins_situacao_tributaria: '99',
      cofins_base_calculo: '0.00',
      cofins_aliquota_porcentual: '0.00',
      cofins_valor: '0.00'
    };

    if (item.codigo_barras && item.codigo_barras !== 'SEM GTIN') {
      focusItem.codigo_barras_comercial = item.codigo_barras;
    }

    return focusItem;
  });

  // Mapeando forma de pagamento
  const formaPgto = FORMA_PAGAMENTO_MAP[payload.forma_pagamento] || '99';

  const focusBody = {
    natureza_operacao: 'VENDA AO CONSUMIDOR',
    data_emissao: payload.data_emissao || new Date().toISOString(),
    presenca_comprador: '1', // operação presencial
    consumidor_final: '1',
    tipo_documento: '1', // saída
    finalidade_emissao: '1', // normal
    modalidade_frete: '9', // sem frete

    itens: itens,

    formas_pagamento: [{
      forma_pagamento: formaPgto,
      valor_pagamento: parseFloat(payload.valor_total) || 0
    }]
  };

  // Destinatário (opcional em NFC-e)
  if (payload.destinatario && payload.destinatario.cpf) {
    focusBody.cpf_destinatario = payload.destinatario.cpf.replace(/\D/g, '');
    if (payload.destinatario.nome) {
      focusBody.nome_destinatario = payload.destinatario.nome;
    }
  }

  return focusBody;
}

/**
 * Envia NFC-e para a API Focus NFe.
 * NFC-e na Focus é SÍNCRONA — a resposta já contém autorização ou rejeição final.
 * 
 * @param {object} config - Configuração fiscal do sistema
 * @param {object} focusPayload - Payload no formato Focus NFe
 * @param {string} referencia - Referência única (venda_id)
 * @returns {object} { httpStatus, data, rawResponse }
 */
async function sendNfce(config, focusPayload, referencia) {
  const baseUrl = resolveBaseUrl(config);
  const token = config.api_token;

  if (!token) {
    throw new Error('Token da API Focus NFe não configurado. Acesse Configurações > Fiscal.');
  }

  const url = `${baseUrl}/v2/nfce?ref=${referencia}`;

  // HTTP Basic Auth: token como username, senha vazia
  const authHeader = 'Basic ' + Buffer.from(`${token}:`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: JSON.stringify(focusPayload)
  });

  const rawText = await response.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    data = { raw: rawText };
  }

  return {
    httpStatus: response.status,
    data: data,
    rawResponse: rawText
  };
}

/**
 * Consulta o status de uma NFC-e já enviada.
 * @param {object} config - Config fiscal
 * @param {string} referencia - Referência única
 * @returns {object} Dados da consulta
 */
async function getNfceStatus(config, referencia) {
  const baseUrl = resolveBaseUrl(config);
  const token = config.api_token;

  const url = `${baseUrl}/v2/nfce/${referencia}`;
  const authHeader = 'Basic ' + Buffer.from(`${token}:`).toString('base64');

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': authHeader }
  });

  const rawText = await response.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    data = { raw: rawText };
  }

  return { httpStatus: response.status, data, rawResponse: rawText };
}

module.exports = {
  mapToFocusPayload,
  sendNfce,
  getNfceStatus,
  resolveBaseUrl,
  FOCUS_URLS,
  FORMA_PAGAMENTO_MAP
};
