async function lerPeso(config) {
  try {
    // Se não estiver ativa ou não houver config, recusa silenciosamente o hardware e o front pede ao usuário
    if (!config || !config.ativa) {
      return null;
    }

    if (config.protocolo === 'simulado') {
      console.log('[Balanca] Requisitando leitura de peso no modo SIMULADO...');
      return new Promise((resolve) => {
        // Simula o tempo de handshake da porta COM
        setTimeout(() => {
          const fakeWeight = 0.500; // Retorna sempre 500 gramas
          console.log(`[Balanca] Leitura concluída. Peso simulado retornado: ${fakeWeight}`);
          resolve(fakeWeight);
        }, 800);
      });
    }

    // Futuras implementações de protocolos reais (Toledo, Filizola, Ramuza etc.) 
    // entrarão em `case` aqui fazendo uso do pacote 'serialport'.
    
    console.warn(`[Balanca] Protocolo requisitado '${config.protocolo}' não reconhecido ou suportado.`);
    return null;
  } catch (error) {
    // Falha silenciosa para que o PDV não congele
    console.warn('[Balanca] Erro crítico capturado durante leitura:', error.message);
    return null; 
  }
}

module.exports = { lerPeso };
