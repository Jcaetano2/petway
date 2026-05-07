/**
 * whatsappHelper.js — Gerador de links diretos para WhatsApp
 * 
 * Usa wa.me (API oficial sem custo, apenas abre conversa).
 * Nenhuma API externa necessária.
 */

/**
 * Gera link de confirmação de agendamento.
 */
export function gerarLinkConfirmacao({ telefone, petNome, data, hora, servico, nomeComercio }) {
  const tel = limparTelefone(telefone);
  if (!tel) return null;
  
  const dataFormatada = formatarData(data);
  const loja = nomeComercio || 'PetWay';
  
  const msg = `Olá! 🐾\n\nConfirmamos seu agendamento na *${loja}*:\n\n` +
    `🐶 Pet: *${petNome}*\n` +
    `✂️ Serviço: *${servico}*\n` +
    `📅 Data: *${dataFormatada}*\n` +
    `🕐 Horário: *${hora}*\n\n` +
    `Caso precise reagendar, entre em contato conosco. Até lá! 😊`;

  return `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`;
}

/**
 * Gera link de aviso "Pet pronto para retirada".
 */
export function gerarLinkPetPronto({ telefone, petNome, nomeComercio }) {
  const tel = limparTelefone(telefone);
  if (!tel) return null;

  const loja = nomeComercio || 'PetWay';

  const msg = `Olá! 🐾\n\n` +
    `O(a) *${petNome}* já está pronto(a) para retirada na *${loja}*! 🎉\n\n` +
    `Estamos te esperando. Até já! 😊`;

  return `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`;
}

/**
 * Gera link de lembrete de retorno.
 */
export function gerarLinkLembrete({ telefone, petNome, diasSemVisita, nomeComercio }) {
  const tel = limparTelefone(telefone);
  if (!tel) return null;

  const loja = nomeComercio || 'PetWay';

  const msg = `Olá! 🐾\n\n` +
    `Sentimos saudade do(a) *${petNome}*! Já faz *${diasSemVisita} dias* desde a última visita na *${loja}*.\n\n` +
    `Que tal agendar um novo atendimento? Estamos prontos para cuidar do seu pet com muito carinho! 💜\n\n` +
    `Aguardamos seu retorno! 😊`;

  return `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`;
}

// ── Helpers internos ─────────────────────────────────────────────

function limparTelefone(tel) {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, '');
  // Aceita 10 ou 11 dígitos (DDD + número)
  if (digits.length < 10 || digits.length > 11) return null;
  return digits;
}

function formatarData(dateStr) {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}
