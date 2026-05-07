/**
 * Serviço Fiscal Isolado — NFC-e
 * 
 * Camada desacoplada do PDV, Caixa e Estoque.
 * Faz emissão real via API Focus NFe (homologação ou produção).
 * 
 * FASE ATUAL: Homologação com API real.
 */

const { getDatabase } = require('../database');
const { mapToFocusPayload, sendNfce } = require('./focusApi');
const { generateDanfeHtml, generateQrCodeDataUrl } = require('./danfeTemplate');

function getFiscalProvider(config) {
  return (config?.api_provider || 'focus').toLowerCase();
}

function getProviderLabel(config) {
  return getFiscalProvider(config) === 'gatewayx' ? 'Gateway-X' : 'Focus NFe';
}

async function sendGatewayXNfce(config, vendaId) {
  const baseUrl = (config.api_url || 'http://localhost:8000/api/fiscal').replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/emitir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ venda_id: vendaId, modelo: '65' })
  });

  const rawResponse = await response.text();
  let motorData;
  try {
    motorData = JSON.parse(rawResponse);
  } catch {
    motorData = { raw: rawResponse };
  }

  if (response.ok && (motorData.sucesso || motorData.contingencia || motorData.status === 'autorizado')) {
    return {
      data: {
        status: 'autorizado',
        chave_nfe: motorData.chave || motorData.chave_nfe || 'CONTINGENCIA',
        protocolo: motorData.protocolo || 'PETWAYMOTOR',
        url_danfe: motorData.danfe_url || motorData.url_danfe || '',
        mensagem_sefaz: motorData.mensagem || motorData.mensagem_sefaz || 'Autorizada via Gateway-X'
      },
      rawResponse,
      httpStatus: response.status
    };
  }

  return {
    httpStatus: response.status,
    data: {
      mensagem_sefaz: motorData.detail || motorData.mensagem || motorData.error || motorData.raw || 'Erro desconhecido do Gateway-X.'
    },
    rawResponse
  };
}

async function sendNfceByProvider(config, focusPayload, referencia, vendaId) {
  const provider = getFiscalProvider(config);
  if (provider === 'gatewayx') {
    return await sendGatewayXNfce(config, vendaId);
  }
  if (provider === 'focus') {
    return await sendNfce(config, focusPayload, referencia);
  }
  throw new Error(`Provedor fiscal nao suportado: ${config.api_provider}`);
}

/**
 * Valida se a configuração fiscal mínima está preenchida.
 */
async function validateFiscalConfig() {
  const db = await getDatabase();
  const cfg = await db.get('SELECT * FROM config_fiscal WHERE id = 1');

  if (!cfg) return { valid: false, errors: ['Nenhuma configuração fiscal encontrada. Acesse Configurações > Fiscal.'] };
  if (!cfg.habilitado) return { valid: false, errors: ['Emissão fiscal desabilitada nas configurações.'] };

  const errors = [];
  const provider = getFiscalProvider(cfg);
  if (!cfg.cnpj || cfg.cnpj.replace(/\D/g, '').length !== 14) errors.push('CNPJ nao preenchido ou invalido.');
  if (provider === 'focus' && (!cfg.api_token || cfg.api_token.trim() === '')) errors.push('Token da API Focus NFe nao preenchido.');
  if (!cfg.csc || cfg.csc.trim() === '') errors.push('CSC (Código de Segurança do Contribuinte) não preenchido.');
  if (!cfg.csc_id || cfg.csc_id.trim() === '') errors.push('CSC ID não preenchido.');
  if (!cfg.serie_nfce || cfg.serie_nfce <= 0) errors.push('Série NFC-e inválida.');
  if (!cfg.proximo_numero_nfce || cfg.proximo_numero_nfce <= 0) errors.push('Próximo número NFC-e inválido.');
  if (!cfg.ie) errors.push('Inscrição Estadual não preenchida.');
  if (!cfg.razao_social) errors.push('Razão Social não preenchida.');
  if (!cfg.uf) errors.push('UF não preenchida.');
  if (!['focus', 'gatewayx'].includes(provider)) errors.push('Provedor fiscal invalido.');
  if (provider === 'gatewayx' && (!cfg.api_url || cfg.api_url.trim() === '')) errors.push('Endpoint da API Fiscal Gateway-X nao preenchido.');

  return { valid: errors.length === 0, errors, config: cfg };
}

/**
 * Valida se uma venda possui todos os dados fiscais nos itens.
 */
async function validateVendaForFiscal(vendaId) {
  const db = await getDatabase();
  const venda = await db.get('SELECT * FROM vendas WHERE id = ?', [vendaId]);
  if (!venda) return { valid: false, errors: ['Venda não encontrada.'] };
  if (venda.status !== 'pago') return { valid: false, errors: ['A venda precisa estar com status "pago" antes de emitir NFC-e.'] };

  const itens = await db.all('SELECT * FROM venda_itens WHERE venda_id = ?', [vendaId]);
  if (!itens || itens.length === 0) return { valid: false, errors: ['Venda sem itens.'] };

  const errors = [];
  for (const item of itens) {
    if (item.tipo === 'produto') {
      const prod = await db.get('SELECT id, nome, ncm, cfop, cst_csosn, unidade_comercial FROM produtos WHERE id = ?', [item.referencia_id]);
      if (!prod) {
        errors.push(`Produto #${item.referencia_id} (${item.descricao_snapshot}) não encontrado na base.`);
        continue;
      }
      if (!prod.ncm || prod.ncm.trim() === '') errors.push(`Produto "${prod.nome}" sem NCM preenchido.`);
      if (!prod.cfop || prod.cfop.trim() === '') errors.push(`Produto "${prod.nome}" sem CFOP preenchido.`);
      if (!prod.cst_csosn || prod.cst_csosn.trim() === '') errors.push(`Produto "${prod.nome}" sem CST/CSOSN preenchido.`);
      if (!prod.unidade_comercial || prod.unidade_comercial.trim() === '') errors.push(`Produto "${prod.nome}" sem Unidade Comercial preenchida.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Monta o objeto fiscal completo para uma venda.
 * Trata produto e serviço.
 */
async function buildFiscalPayload(vendaId) {
  const db = await getDatabase();
  const cfg = await db.get('SELECT * FROM config_fiscal WHERE id = 1');
  const venda = await db.get(`
    SELECT v.*, c.nome as cliente_nome, c.cpf as cliente_cpf 
    FROM vendas v 
    LEFT JOIN clientes c ON v.cliente_id = c.id 
    WHERE v.id = ?
  `, [vendaId]);
  const itens = await db.all('SELECT * FROM venda_itens WHERE venda_id = ?', [vendaId]);

  const itensFiscais = [];
  for (const item of itens) {
    const baseFiscal = {
      numero_item: itensFiscais.length + 1,
      descricao: item.descricao_snapshot,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      valor_total: item.subtotal,
      tipo_origem: item.tipo,
      referencia_id: item.referencia_id
    };

    if (item.tipo === 'produto') {
      const prod = await db.get('SELECT ncm, cfop, cst_csosn, unidade_comercial, codigo_barras FROM produtos WHERE id = ?', [item.referencia_id]);
      baseFiscal.ncm = prod?.ncm || '';
      baseFiscal.cfop = prod?.cfop || '';
      baseFiscal.cst_csosn = prod?.cst_csosn || '';
      baseFiscal.unidade_comercial = prod?.unidade_comercial || 'UN';
      baseFiscal.codigo_barras = prod?.codigo_barras || 'SEM GTIN';
    } else {
      baseFiscal.ncm = '00000000';
      baseFiscal.cfop = '5933';
      baseFiscal.cst_csosn = '102';
      baseFiscal.unidade_comercial = 'SV';
      baseFiscal.codigo_barras = 'SEM GTIN';
    }

    itensFiscais.push(baseFiscal);
  }

  return {
    ambiente: cfg.ambiente,
    serie: cfg.serie_nfce,
    numero: cfg.proximo_numero_nfce,
    
    emitente: {
      cnpj: cfg.cnpj,
      ie: cfg.ie,
      razao_social: cfg.razao_social,
      nome_fantasia: cfg.nome_fantasia,
      crt: cfg.crt,
      uf: cfg.uf,
      cidade: cfg.cidade
    },

    destinatario: {
      nome: venda.cliente_nome || null,
      cpf: venda.cliente_cpf || null
    },

    itens: itensFiscais,

    valor_produtos: venda.subtotal,
    valor_desconto: venda.desconto || 0,
    valor_total: venda.valor_total,
    forma_pagamento: venda.forma_pagamento_detalhe || venda.forma_pagamento,

    csc: cfg.csc,
    csc_id: cfg.csc_id,

    venda_id: vendaId,
    data_emissao: new Date().toISOString()
  };
}

/**
 * Emite NFC-e via API Focus NFe.
 * 
 * Fluxo:
 * 1. Valida config + venda
 * 2. Monta payload interno
 * 3. Transforma para formato Focus
 * 4. Envia via HTTP POST
 * 5. Persiste resultado em fiscal_vendas
 * 6. Incrementa número NFC-e se autorizada
 * 
 * @param {number} vendaId
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
async function emitirNfce(vendaId) {
  const db = await getDatabase();

  // 1. Validar config
  const cfgResult = await validateFiscalConfig();
  if (!cfgResult.valid) {
    return { success: false, error: cfgResult.errors.join(' | ') };
  }

  // 2. Validar venda
  const vendaResult = await validateVendaForFiscal(vendaId);
  if (!vendaResult.valid) {
    return { success: false, error: vendaResult.errors.join(' | ') };
  }

  // 3. Verificar duplicata
  const existing = await db.get('SELECT * FROM fiscal_vendas WHERE venda_id = ? AND status_fiscal IN ("autorizado", "em_processamento")', [vendaId]);
  if (existing) {
    return { success: false, error: `Esta venda já possui registro fiscal (Status: ${existing.status_fiscal}, NFC-e #${existing.numero_nfce}).` };
  }

  // 4. Montar payload interno e transformar para Focus
  const payload = await buildFiscalPayload(vendaId);
  const cfg = cfgResult.config;
  const focusPayload = mapToFocusPayload(payload);
  const referencia = `v${vendaId}_${Date.now()}`;

  // Auditoria: gravar ambos os payloads (interno + Focus) como JSON
  const payloadAuditoria = JSON.stringify({
    payload_interno: payload,
    payload_focus: focusPayload,
    referencia: referencia,
    timestamp: new Date().toISOString()
  }, null, 2);

  // 5. Verificação de duplicidade de numeração (segurança crítica)
  const duplicata = await db.get(
    'SELECT COUNT(*) as count FROM fiscal_vendas WHERE numero_nfce = ? AND serie_nfce = ?',
    [cfg.proximo_numero_nfce, cfg.serie_nfce]
  );
  if (duplicata && duplicata.count > 0) {
    console.error(`[FISCAL CRÍTICO] Duplicidade de numeração detectada! NFC-e nº ${cfg.proximo_numero_nfce} série ${cfg.serie_nfce} já existe na fiscal_vendas.`);
    return { success: false, error: `Erro interno: número NFC-e ${cfg.proximo_numero_nfce} já foi utilizado. Verifique a configuração fiscal.` };
  }

  // 6. Registrar como em_processamento antes de enviar
  const insertResult = await db.run(`
    INSERT INTO fiscal_vendas (venda_id, status_fiscal, ambiente, numero_nfce, serie_nfce, xml_enviado, mensagem_retorno)
    VALUES (?, 'em_processamento', ?, ?, ?, ?, ?)
  `, [vendaId, cfg.ambiente, cfg.proximo_numero_nfce, cfg.serie_nfce, payloadAuditoria, `Enviando para API fiscal (${getProviderLabel(cfg)})...`]);
  const fiscalVendaId = insertResult.lastID;

  // 7. Consumir número NFC-e IMEDIATAMENTE (antes da chamada HTTP)
  // O número é considerado "usado" no momento da tentativa, não na autorização.
  // Números perdidos por falhas serão tratados via inutilização na fase de produção.
  await db.run('UPDATE config_fiscal SET proximo_numero_nfce = proximo_numero_nfce + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [cfg.id]);

  try {
    // 8. Enviar pelo provedor fiscal configurado.
    const result = await sendNfceByProvider(cfg, focusPayload, referencia, vendaId);
    
    if (result.data && result.data.status === 'autorizado') {
      // Autorizada — persistir retorno completo
      await db.run(`
        UPDATE fiscal_vendas SET 
          status_fiscal = 'autorizado',
          chave_acesso = ?,
          protocolo = ?,
          xml_autorizado = ?,
          qr_code_url = ?,
          mensagem_retorno = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        result.data.chave_nfe || result.data.chave || '',
        result.data.protocolo || '',
        result.rawResponse || JSON.stringify(result.data, null, 2),
        result.data.caminho_danfe || result.data.url_danfe || '',
        result.data.mensagem_sefaz || 'Autorizada',
        fiscalVendaId
      ]);

      return {
        success: true,
        data: {
          numero_nfce: cfg.proximo_numero_nfce,
          serie_nfce: cfg.serie_nfce,
          chave_acesso: result.data.chave_nfe || result.data.chave || '',
          protocolo: result.data.protocolo || '',
          ambiente: cfg.ambiente,
          status_fiscal: 'autorizado',
          url_danfe: result.data.caminho_danfe || result.data.url_danfe || '',
          api_response: result.data
        }
      };

    } else {
      // Falha API — verificar se é temporário
      const httpStatus = result.httpStatus || 0;
      const isTemporary = httpStatus >= 500 || httpStatus === 429 || httpStatus === 408;
      const finalStatus = isTemporary ? 'pendente_reenvio' : 'rejeitado';
      const mensagemErro = result.data?.mensagem_sefaz || result.data?.mensagem || result.data?.erros?.[0]?.mensagem || JSON.stringify(result.data);

      await db.run(`
        UPDATE fiscal_vendas SET 
          status_fiscal = ?,
          xml_autorizado = ?,
          mensagem_retorno = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        finalStatus,
        result.rawResponse || JSON.stringify(result.data, null, 2),
        mensagemErro,
        fiscalVendaId
      ]);

      return {
        success: false,
        error: `Rejeicao da API fiscal (${getProviderLabel(cfg)}): ${mensagemErro}`,
        data: result.data,
        status_fiscal: finalStatus
      };
    }

  } catch (networkError) {
    // Erro de rede — classificar e registrar sem corromper a venda
    const msg = networkError.message || '';
    const isNetworkError = msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('fetch failed') || msg.includes('ENOTFOUND');
    const newStatus = isNetworkError ? 'erro_rede' : 'pendente_reenvio';

    await db.run(`
      UPDATE fiscal_vendas SET 
        status_fiscal = ?,
        mensagem_retorno = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newStatus, `Erro de comunicação: ${networkError.message}`, fiscalVendaId]);

    return { success: false, error: `Falha de comunicacao com API fiscal (${getProviderLabel(cfg)}): ${networkError.message}`, status_fiscal: newStatus };
  }
}

/**
 * Busca o registro fiscal de uma venda.
 */
async function getStatusByVenda(vendaId) {
  const db = await getDatabase();
  return await db.get('SELECT * FROM fiscal_vendas WHERE venda_id = ? ORDER BY id DESC LIMIT 1', [vendaId]);
}

/**
 * Retorna o payload fiscal sem persistir — para preview/depuração.
 */
async function getPayloadPreview(vendaId) {
  try {
    const cfgResult = await validateFiscalConfig();
    if (!cfgResult.valid) return { success: false, error: cfgResult.errors.join(' | ') };

    const vendaResult = await validateVendaForFiscal(vendaId);
    if (!vendaResult.valid) return { success: false, error: vendaResult.errors.join(' | ') };

    const payload = await buildFiscalPayload(vendaId);
    const focusPayload = mapToFocusPayload(payload);
    
    return { success: true, data: { payload_interno: payload, payload_focus: focusPayload } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Busca todas as notas que precisam de reenvio manual ou automático.
 */
async function getPendentesReenvio() {
  const db = await getDatabase();
  return await db.all(`
    SELECT fv.*, v.valor_total, v.forma_pagamento, v.forma_pagamento_detalhe
    FROM fiscal_vendas fv
    JOIN vendas v ON fv.venda_id = v.id
    WHERE fv.status_fiscal IN ('erro_rede', 'pendente_reenvio')
    ORDER BY fv.created_at ASC
  `);
}

let isProcessandoFila = false;

/**
 * Processa a fila de notas pendentes (automático)
 */
async function processarFilaReenvio() {
  if (isProcessandoFila) return { success: false, message: 'Já existe um processamento em andamento.' };
  
  isProcessandoFila = true;
  try {
    const pendentes = await getPendentesReenvio();
    if (pendentes.length === 0) {
      isProcessandoFila = false;
      return { success: true, message: 'Fila vazia.' };
    }

    let processados = 0;

    for (const nota of pendentes) {
      await reenviarUnico(nota.id);
      processados++;
      // Pausa para evitar rate limit
      await new Promise(r => setTimeout(r, 1000));
    }

    return { success: true, message: `Processou ${processados} notas pendentes.` };
  } catch(e) {
    return { success: false, message: `Falha: ${e.message}` };
  } finally {
    isProcessandoFila = false;
  }
}

/**
 * Reenvia uma nota específica pelo ID da tabela fiscal_vendas.
 */
async function reenviarUnico(fiscalVendaId) {
  const db = await getDatabase();
  const fiscalVenda = await db.get('SELECT * FROM fiscal_vendas WHERE id = ?', [fiscalVendaId]);
  
  if (!fiscalVenda) return { success: false, error: 'Registro fiscal não encontrado.' };
  if (!['erro_rede', 'pendente_reenvio'].includes(fiscalVenda.status_fiscal)) {
    return { success: false, error: 'Apenas notas pendentes ou com erro de rede podem ser reenviadas.' };
  }

  const vendaId = fiscalVenda.venda_id;
  const cfgResult = await validateFiscalConfig();
  if (!cfgResult.valid) return { success: false, error: cfgResult.errors.join(' | ') };
  const cfg = cfgResult.config;

  const payload = await buildFiscalPayload(vendaId);
  // Sobrescrever série e número pelo original
  payload.serie = fiscalVenda.serie_nfce;
  payload.numero = fiscalVenda.numero_nfce;

  const focusPayload = mapToFocusPayload(payload);
  
  let referencia = `v${vendaId}_${Date.now()}`;
  try {
    if (fiscalVenda.xml_enviado) {
      const auditoria = JSON.parse(fiscalVenda.xml_enviado);
      if (auditoria.referencia) referencia = auditoria.referencia;
    }
  } catch {
    // Mantem nova referencia quando o payload de auditoria antigo nao puder ser lido.
  }

  await db.run('UPDATE fiscal_vendas SET status_fiscal = "em_processamento", tentativas = tentativas + 1, ultima_tentativa = CURRENT_TIMESTAMP WHERE id = ?', [fiscalVendaId]);

  try {
    const result = await sendNfceByProvider(cfg, focusPayload, referencia, vendaId);

    if (result.data && result.data.status === 'autorizado') {
      await db.run(`
        UPDATE fiscal_vendas SET 
          status_fiscal = 'autorizado',
          chave_acesso = ?,
          protocolo = ?,
          xml_autorizado = ?,
          qr_code_url = ?,
          mensagem_retorno = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        result.data.chave_nfe || result.data.chave || '',
        result.data.protocolo || '',
        result.rawResponse || JSON.stringify(result.data, null, 2),
        result.data.caminho_danfe || result.data.url_danfe || '',
        result.data.mensagem_sefaz || 'Autorizada',
        fiscalVendaId
      ]);

      return { success: true, message: 'NFC-e autorizada com sucesso!' };
    } else {
      const isTemporary = result.httpStatus >= 500 || result.httpStatus === 429 || result.httpStatus === 408;
      const finalStatus = isTemporary ? 'pendente_reenvio' : 'rejeitado';
      const mensagemErro = result.data?.mensagem_sefaz || result.data?.mensagem || result.data?.erros?.[0]?.mensagem || JSON.stringify(result.data);

      await db.run(`
        UPDATE fiscal_vendas SET 
          status_fiscal = ?,
          xml_autorizado = ?,
          mensagem_retorno = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        finalStatus,
        result.rawResponse || JSON.stringify(result.data, null, 2),
        mensagemErro,
        fiscalVendaId
      ]);

      return { success: false, error: `Falha no reenvio: ${mensagemErro}`, status_fiscal: finalStatus };
    }
  } catch (networkError) {
    const msg = networkError.message || '';
    const isNetworkError = msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('fetch failed') || msg.includes('ENOTFOUND');
    const newStatus = isNetworkError ? 'erro_rede' : 'pendente_reenvio';

    await db.run(`
      UPDATE fiscal_vendas SET 
        status_fiscal = ?,
        mensagem_retorno = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newStatus, `Erro de comunicação no reenvio: ${networkError.message}`, fiscalVendaId]);

    return { success: false, error: `Rede: ${networkError.message}`, status_fiscal: newStatus };
  }
}

/**
 * Retorna detalhe fiscal completo de uma venda, incluindo dados da venda, empresa e itens.
 */
async function getDetalheByVenda(vendaId) {
  const db = await getDatabase();
  const fiscal = await db.get('SELECT * FROM fiscal_vendas WHERE venda_id = ? ORDER BY id DESC LIMIT 1', [vendaId]);
  if (!fiscal) return { success: false, error: 'Nenhum registro fiscal encontrado para esta venda.' };

  const venda = await db.get(`
    SELECT v.*, c.nome as cliente_nome, c.cpf as cliente_cpf, p.nome as pet_nome
    FROM vendas v
    LEFT JOIN clientes c ON v.cliente_id = c.id
    LEFT JOIN pets p ON v.pet_id = p.id
    WHERE v.id = ?
  `, [vendaId]);
  const itens = await db.all('SELECT * FROM venda_itens WHERE venda_id = ?', [vendaId]);

  const cfgFiscal = await db.get('SELECT * FROM config_fiscal WHERE id = 1');
  const cfgEmpresa = await db.get('SELECT * FROM config_empresa ORDER BY id DESC LIMIT 1');
  const cfgImpressao = await db.get('SELECT * FROM config_impressao WHERE id = 1');

  return {
    success: true,
    data: {
      fiscal,
      venda: { ...venda, itens },
      empresa: { ...cfgEmpresa, ...cfgFiscal },
      configImpressao: cfgImpressao || { largura_bobina: 80 }
    }
  };
}

/**
 * Gera HTML do DANFE NFC-e para uma venda autorizada. Inclui QR Code embutido como base64.
 */
async function gerarDanfeHtml(vendaId) {
  const detalhe = await getDetalheByVenda(vendaId);
  if (!detalhe.success) return detalhe;

  const { fiscal, venda, empresa, configImpressao } = detalhe.data;

  if (fiscal.status_fiscal !== 'autorizado') {
    return { success: false, error: `DANFE só pode ser gerado para NFC-e autorizada. Status atual: ${fiscal.status_fiscal}` };
  }

  // Gerar QR Code a partir da URL retornada pela API ou da chave de acesso
  const qrData = fiscal.qr_code_url || fiscal.chave_acesso || '';
  const qrCodeDataUrl = await generateQrCodeDataUrl(qrData);

  const html = generateDanfeHtml({ empresa, fiscal, venda, qrCodeDataUrl, configImpressao });

  return { success: true, html };
}

module.exports = {
  validateFiscalConfig,
  validateVendaForFiscal,
  buildFiscalPayload,
  emitirNfce,
  getStatusByVenda,
  getPayloadPreview,
  getPendentesReenvio,
  processarFilaReenvio,
  reenviarUnico,
  getDetalheByVenda,
  gerarDanfeHtml,
  isFiscalJobRunning: () => isProcessandoFila
};
