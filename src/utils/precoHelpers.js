export function normalizePorte(rawPorte) {
  const str = (rawPorte || '').toLowerCase();
  if (['pequeno', 'mini'].some(p => str.includes(p))) return 'pequeno';
  if (['grande', 'gigante'].some(p => str.includes(p))) return 'grande';
  return 'medio';
}

export function calcularPrecoServico(servico, porteRaw) {
  if (!servico) return 0;
  // Fallback: se não usar preço por porte ou não tiver porte informado (excl. validação rigorosa), usa preco_base
  if (!servico.usa_preco_por_porte || !porteRaw) return servico.preco_base;
  
  const porte = normalizePorte(porteRaw);
  if (porte === 'pequeno') return servico.preco_pequeno || servico.preco_base;
  if (porte === 'grande') return servico.preco_grande || servico.preco_base;
  return servico.preco_medio || servico.preco_base;
}
