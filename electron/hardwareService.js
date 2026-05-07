const { webContents } = require('electron');

async function abrirGaveta(config) {
  try {
    if (!config || !config.usar_gaveta) {
      return false;
    }

    if (config.modo_gaveta === 'impressora') {
      console.log('[Hardware] Tentando abrir gaveta via impressora...');
      // Procurar pela janela principal para engatilhar a impressão silenciosa
      const allWebContents = webContents.getAllWebContents();
      const mainContent = allWebContents.find(wc => wc.getType() === 'window');
      
      if (mainContent) {
        const printOptions = {
          silent: true,
          margins: { marginType: 'none' } // minimize layout processing
        };
        
        if (config.nome_impressora) {
          printOptions.deviceName = config.nome_impressora;
        }
        
        mainContent.print(printOptions, (success, errorType) => {
          if (!success) {
            console.warn(`[Hardware] Falha silenciosa ao acionar gaveta via impressora: ${errorType}`);
          } else {
            console.log('[Hardware] Sinal de abertura de gaveta enviado com sucesso.');
          }
        });
        return true;
      } else {
        console.warn('[Hardware] Nenhum webContents válido encontrado para emitir o pulso da gaveta.');
        return false;
      }
    }
    
    console.warn(`[Hardware] Modo de gaveta desconhecido: ${config.modo_gaveta}`);
    return false;
  } catch (error) {
    // Resiliência extrema: jamais vaze erro para o caller (Finalizar Venda)
    console.warn('[Hardware] Erro crítico capturado ao tentar abrir gaveta:', error.message);
    return false; 
  }
}

module.exports = { abrirGaveta };
