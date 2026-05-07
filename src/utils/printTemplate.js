export function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

export function generateReceiptHtml(vendaInfo) {
    const { 
       lojaNome = 'PETSHOP SYSTEM',
       logoPath = null,
       exibirLogo = false,
       id,
       data,
       operador = 'Caixa Base',
       cliente_nome_raw,
       pet_nome_raw,
       itens,
       subtotal,
       desconto,
       total,
       forma_pagamento,
       configImpressao
    } = vendaInfo;


    const cliente_nome = escapeHtml(cliente_nome_raw);
    const pet_nome = escapeHtml(pet_nome_raw);
    
    const bobinaWidth = configImpressao?.largura_bobina === 58 ? '210px' : '280px';
    const rodapeMsg = configImpressao?.mensagem_rodape || 'Obrigado pela preferência!';

    const itensHtml = (itens || []).map(i => `
       <tr>
         <td style="padding-bottom: 4px;">${escapeHtml(i.descricao_snapshot)}</td>
         <td style="text-align: center; padding-bottom: 4px;">${escapeHtml(i.quantidade)}</td>
         <td style="text-align: right; padding-bottom: 4px;">${parseFloat(i.subtotal).toFixed(2)}</td>
       </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              @page { margin: 0; }
              body {
                  margin: 0;
                  padding: 10px;
                  font-family: 'Courier New', Courier, monospace;
                  font-size: 12px;
                  color: #000;
                  background-color: #fff;
                  width: ${bobinaWidth};
                  /* Evita quebras grosseiras */
                  box-sizing: border-box;
              }
              .center { text-align: center; }
              .right { text-align: right; }
              .bold { font-weight: bold; }
              .divider { 
                 border-top: 1px dashed #000; 
                 margin: 8px 0; 
                 border-bottom: none;
              }
              table { width: 100%; font-size: 11px; border-collapse: collapse; }
              th { text-align: left; padding-bottom: 4px; }
              .flex-between { display: flex; justify-content: space-between; margin-bottom: 4px; }
          </style>
      </head>
      <body>
          ${exibirLogo && logoPath ? `
          <div class="center" style="margin-bottom: 8px;">
            <img src="brand-logo://${logoPath}" alt="Logo" style="max-height: 60px; max-width: 180px; object-fit: contain;" />
          </div>
          ` : ''}
          <h2 class="center" style="margin: 0 0 10px 0; font-size: 16px;">${escapeHtml(lojaNome)}</h2>

          <div class="center" style="font-size: 12px; margin-bottom: 10px;">
              <div>Data: ${escapeHtml(data)}</div>
              <div>Venda: #${escapeHtml(id)}</div>
              <div>Operador: ${escapeHtml(operador)}</div>
              ${cliente_nome ? `<div>Tutor/Cliente: ${cliente_nome}</div>` : ''}
              ${pet_nome ? `<div>Pet: ${pet_nome}</div>` : ''}
          </div>
          
          <div class="divider"></div>
          
          <table>
             <thead>
               <tr>
                 <th>Item</th>
                 <th style="text-align: center;">Qt</th>
                 <th class="right">R$</th>
               </tr>
             </thead>
             <tbody>
                ${itensHtml}
             </tbody>
          </table>
          
          <div class="divider"></div>
          
          <div class="flex-between">
             <span>Subtotal:</span>
             <span>R$ ${parseFloat(subtotal).toFixed(2)}</span>
          </div>
          ${desconto > 0 ? `
          <div class="flex-between">
             <span>Desconto:</span>
             <span>- R$ ${parseFloat(desconto).toFixed(2)}</span>
          </div>
          ` : ''}
          <div class="flex-between bold" style="font-size: 15px; margin-top: 8px; padding-top: 4px; border-top: 1px solid #000;">
             <span>TOTAL:</span>
             <span>R$ ${parseFloat(total).toFixed(2)}</span>
          </div>
          
          <div class="center" style="margin-top: 20px; font-size: 11px;">
              Pago via: ${escapeHtml(forma_pagamento).toUpperCase()}<br/><br/>
              ${escapeHtml(rodapeMsg).replace(/\n/g, '<br/>')}
          </div>
      </body>
      </html>
    `;
}
