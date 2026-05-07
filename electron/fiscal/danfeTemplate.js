/**
 * DANFE NFC-e — Template HTML simplificado
 * 
 * Gera HTML estático pronto para impressão via Electron BrowserWindow.
 * Inclui QR Code como imagem base64 embutida.
 * 
 * Segue layout padrão DANFE NFC-e:
 *   Cabeçalho empresa → Dados NFC-e → Itens → Totais → Pagamento → QR Code → Rodapé
 */

const QRCode = require('qrcode');

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCnpj(cnpj) {
  if (!cnpj) return '';
  const nums = cnpj.replace(/\D/g, '');
  if (nums.length !== 14) return cnpj;
  return nums.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatChave(chave) {
  if (!chave) return '';
  const nums = chave.replace(/\D/g, '');
  return nums.replace(/(.{4})/g, '$1 ').trim();
}

const FORMA_PAGAMENTO_LABEL = {
  'dinheiro': 'Dinheiro',
  'pix': 'PIX',
  'cartao': 'Cartão',
  'cartao_debito': 'Cartão Débito',
  'cartao_credito': 'Cartão Crédito',
  '01': 'Dinheiro',
  '03': 'Cartão Crédito',
  '04': 'Cartão Débito',
  '17': 'PIX',
  '99': 'Outros'
};

/**
 * Gera o HTML completo do DANFE NFC-e.
 * 
 * @param {object} params
 * @param {object} params.empresa - config_empresa + config_fiscal merged
 * @param {object} params.fiscal - fiscal_vendas row
 * @param {object} params.venda - vendas row com itens e nomes
 * @param {string} params.qrCodeDataUrl - Data URL base64 do QR Code
 * @param {object} params.configImpressao - config_impressao row
 * @returns {string} HTML completo
 */
function generateDanfeHtml({ empresa, fiscal, venda, qrCodeDataUrl, configImpressao }) {
  const isHomologacao = fiscal.ambiente === 'homologacao';
  const dataEmissao = fiscal.created_at ? new Date(fiscal.created_at).toLocaleString('pt-BR') : '';
  
  const bobinaWidth = configImpressao?.largura_bobina === 58 ? '220px' : '300px';
  const pageSize = configImpressao?.largura_bobina === 58 ? '58mm auto' : '80mm auto';

  const itensHtml = (venda.itens || []).map((item, idx) => `
    <tr>
      <td style="padding:3px 0;font-size:11px;border-bottom:1px dotted #ddd;">${idx + 1}</td>
      <td style="padding:3px 4px;font-size:11px;border-bottom:1px dotted #ddd;">${escapeHtml(item.descricao_snapshot)}</td>
      <td style="padding:3px 4px;font-size:11px;text-align:center;border-bottom:1px dotted #ddd;">${item.quantidade}</td>
      <td style="padding:3px 4px;font-size:11px;text-align:right;border-bottom:1px dotted #ddd;">${parseFloat(item.valor_unitario).toFixed(2)}</td>
      <td style="padding:3px 0;font-size:11px;text-align:right;border-bottom:1px dotted #ddd;">${parseFloat(item.subtotal).toFixed(2)}</td>
    </tr>
  `).join('');

  const formaPagamento = venda.forma_pagamento_detalhe || venda.forma_pagamento;
  const formaPgtoLabel = FORMA_PAGAMENTO_LABEL[formaPagamento] || formaPagamento || 'N/I';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 0; size: ${pageSize}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: #000;
      background: #fff;
      width: ${bobinaWidth};
      margin: 0 auto;
      padding: 8px;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .divider {
      border: none;
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
    .divider-double {
      border: none;
      border-top: 2px solid #000;
      margin: 8px 0;
    }
    table { width: 100%; border-collapse: collapse; }
    .flex-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
    }
    .homologacao-banner {
      background: #ff0;
      color: #000;
      font-weight: bold;
      font-size: 14px;
      text-align: center;
      padding: 6px;
      margin-bottom: 8px;
      border: 2px solid #000;
    }
    .chave-box {
      font-size: 9px;
      word-break: break-all;
      text-align: center;
      padding: 4px;
      border: 1px solid #000;
      margin: 6px 0;
      font-family: monospace;
    }
    .qr-container {
      text-align: center;
      margin: 10px 0;
    }
    .qr-container img {
      width: 180px;
      height: 180px;
    }
  </style>
</head>
<body>
  ${isHomologacao ? '<div class="homologacao-banner">SEM VALOR FISCAL<br/>HOMOLOGAÇÃO</div>' : ''}

  <!-- CABEÇALHO EMPRESA -->
  <div class="center bold" style="font-size:14px;margin-bottom:4px;">
    ${escapeHtml(empresa.nome_fantasia || empresa.razao_social || 'EMPRESA')}
  </div>
  <div class="center" style="font-size:10px;margin-bottom:2px;">
    ${empresa.razao_social && empresa.razao_social !== empresa.nome_fantasia ? escapeHtml(empresa.razao_social) + '<br/>' : ''}
    CNPJ: ${formatCnpj(empresa.cnpj)}<br/>
    ${empresa.ie ? 'IE: ' + escapeHtml(empresa.ie) + '<br/>' : ''}
    ${empresa.endereco ? escapeHtml(empresa.endereco) + '<br/>' : ''}
    ${empresa.cidade ? escapeHtml(empresa.cidade) : ''}${empresa.uf ? ' - ' + escapeHtml(empresa.uf) : ''}
  </div>

  <hr class="divider-double"/>

  <div class="center bold" style="font-size:13px;margin-bottom:4px;">
    DANFE NFC-e - Documento Auxiliar<br/>
    da Nota Fiscal Eletrônica para Consumidor Final
  </div>

  ${isHomologacao ? '<div class="center bold" style="font-size:11px;color:#c00;margin-bottom:4px;">EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL</div>' : ''}

  <hr class="divider"/>

  <!-- DADOS NFC-e -->
  <div style="font-size:11px;margin-bottom:6px;">
    <div class="flex-row"><span>NFC-e nº:</span><span class="bold">${fiscal.numero_nfce || '-'}</span></div>
    <div class="flex-row"><span>Série:</span><span>${fiscal.serie_nfce || '-'}</span></div>
    <div class="flex-row"><span>Data/Hora:</span><span>${dataEmissao}</span></div>
    <div class="flex-row"><span>Protocolo:</span><span>${escapeHtml(fiscal.protocolo) || '-'}</span></div>
  </div>

  <!-- CONSUMIDOR -->
  ${venda.cliente_nome ? `
  <hr class="divider"/>
  <div style="font-size:11px;">
    <div class="flex-row"><span>Consumidor:</span><span>${escapeHtml(venda.cliente_nome)}</span></div>
    ${venda.cliente_cpf ? `<div class="flex-row"><span>CPF:</span><span>${escapeHtml(venda.cliente_cpf)}</span></div>` : ''}
  </div>
  ` : `
  <hr class="divider"/>
  <div style="font-size:11px;" class="center">CONSUMIDOR NÃO IDENTIFICADO</div>
  `}

  <hr class="divider"/>

  <!-- ITENS -->
  <table>
    <thead>
      <tr style="border-bottom:1px solid #000;">
        <th style="font-size:10px;text-align:left;padding:3px 0;">#</th>
        <th style="font-size:10px;text-align:left;padding:3px 4px;">Descrição</th>
        <th style="font-size:10px;text-align:center;padding:3px 4px;">Qtd</th>
        <th style="font-size:10px;text-align:right;padding:3px 4px;">Unit</th>
        <th style="font-size:10px;text-align:right;padding:3px 0;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itensHtml}
    </tbody>
  </table>

  <hr class="divider"/>

  <!-- TOTAIS -->
  <div style="font-size:12px;">
    <div class="flex-row"><span>Qtde. Itens:</span><span>${(venda.itens || []).length}</span></div>
    <div class="flex-row"><span>Subtotal:</span><span>R$ ${parseFloat(venda.subtotal || 0).toFixed(2)}</span></div>
    ${(venda.desconto && venda.desconto > 0) ? `<div class="flex-row"><span>Desconto:</span><span>- R$ ${parseFloat(venda.desconto).toFixed(2)}</span></div>` : ''}
    <div class="flex-row bold" style="font-size:14px;margin-top:4px;padding-top:4px;border-top:1px solid #000;">
      <span>TOTAL:</span><span>R$ ${parseFloat(venda.valor_total || 0).toFixed(2)}</span>
    </div>
  </div>

  <hr class="divider"/>

  <!-- PAGAMENTO -->
  <div style="font-size:12px;">
    <div class="flex-row"><span>Forma de Pagamento:</span><span class="bold">${escapeHtml(formaPgtoLabel)}</span></div>
    <div class="flex-row"><span>Valor Pago:</span><span>R$ ${parseFloat(venda.valor_total || 0).toFixed(2)}</span></div>
  </div>

  <hr class="divider-double"/>

  <!-- CHAVE DE ACESSO -->
  <div class="center bold" style="font-size:10px;margin-bottom:4px;">CHAVE DE ACESSO</div>
  <div class="chave-box">${formatChave(fiscal.chave_acesso)}</div>

  <!-- QR CODE -->
  ${qrCodeDataUrl ? `
  <div class="qr-container">
    <div style="font-size:10px;margin-bottom:4px;">Consulte pela chave de acesso em:</div>
    <div style="font-size:9px;margin-bottom:6px;">www.nfce.fazenda.gov.br/portal</div>
    <img src="${qrCodeDataUrl}" alt="QR Code NFC-e"/>
  </div>
  ` : `
  <div class="center" style="font-size:10px;padding:10px;border:1px dashed #999;">QR Code indisponível</div>
  `}

  <hr class="divider"/>

  <div class="center" style="font-size:9px;margin-top:4px;">
    ${isHomologacao ? 'EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL' : 'Documento auxiliar da NFC-e'}
  </div>
</body>
</html>`;
}

/**
 * Gera Data URL base64 do QR Code a partir de uma URL ou texto.
 * @param {string} data - URL ou texto para codificar
 * @returns {Promise<string>} Data URL (data:image/png;base64,...)
 */
async function generateQrCodeDataUrl(data) {
  if (!data || data.trim() === '') return null;
  try {
    return await QRCode.toDataURL(data, {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch (e) {
    console.error('Erro ao gerar QR Code:', e.message);
    return null;
  }
}

module.exports = {
  generateDanfeHtml,
  generateQrCodeDataUrl,
  escapeHtml,
  formatCnpj,
  formatChave,
  FORMA_PAGAMENTO_LABEL
};
