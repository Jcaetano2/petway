import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { PdvFocusContext } from '../App';
import { Plus, Trash2, CheckCircle, Search, Package, Scissors, Minus, ShoppingCart, Printer, FileCheck, Eye, XSquare } from 'lucide-react';
import { generateReceiptHtml } from '../utils/printTemplate';
import BrandLogo from '../components/Branding/BrandLogo';
import DetalheFiscalModal from '../components/DetalheFiscalModal';
import { calcularPrecoServico } from '../utils/precoHelpers';
import { useBranding } from '../context/BrandingContext';
import { useLicense } from '../context/LicenseContext';
import { useToast } from '../context/ToastContext';
import ModalConfirm from '../components/Common/ModalConfirm';

export default function PDV() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { isPdvFocused, setIsPdvFocused } = React.useContext(PdvFocusContext) || {};
  const { branding } = useBranding();
  const { license, isValid } = useLicense();
  const { showToast } = useToast();
  
  const searchInputRef = React.useRef(null);
  const valorRecebidoRef = useRef(null);
  const [modalConfirm, setModalConfirm] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: () => {} });

  const [currentVendaId, setCurrentVendaId] = useState(state?.vendaId || null);

  const isInitialLivre = !state?.vendaId;
  const [isVendaLivre, setIsVendaLivre] = useState(isInitialLivre);
  
  const [venda, setVenda] = useState(isInitialLivre ? { id: 'Livre', itens: [], subtotal: 0, cliente_id: '', pet_id: '' } : null);

  const [servicos, setServicos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [clientesList, setClientesList] = useState([]);
  const [petsList, setPetsList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [buscaCatalogo, setBuscaCatalogo] = useState('');

  const [formaPagamentoUI, setFormaPagamentoUI] = useState('');
  const [descontoPerc, setDescontoPerc] = useState(0);
  const [fiscalHabilitado, setFiscalHabilitado] = useState(false);
  const [configImpressao, setConfigImpressao] = useState(null);
  const [configCaixa, setConfigCaixa] = useState({ pagto_dinheiro_ativo: 1, pagto_pix_ativo: 1, pagto_credito_ativo: 1, pagto_debito_ativo: 1, desconto_maximo_percentual: 100 });
  const [logoTs] = useState(Date.now());
  const [fiscalFeedback, setFiscalFeedback] = useState(null);
  const [fiscalModalVendaId, setFiscalModalVendaId] = useState(null);

  const [pesoModalConfig, setPesoModalConfig] = useState({ isOpen: false, item: null });
  const [pesoManual, setPesoManual] = useState('');
  
  const [valorRecebido, setValorRecebido] = useState('');

  // Computeds imediatos
  const descontoCalculado = (venda?.subtotal || 0) * ((parseFloat(descontoPerc) || 0) / 100);
  const totalCalculado = (venda?.subtotal || 0) - descontoCalculado;
  const recebidoNum = parseFloat(valorRecebido) || 0;
  const trocoCalculado = recebidoNum - totalCalculado;
  const isDinheiroValido = formaPagamentoUI === 'dinheiro' ? recebidoNum >= totalCalculado : true;

  // Auto-foco no campo de dinheiro ao selecionar a forma de pagamento
  useEffect(() => {
    if (formaPagamentoUI === 'dinheiro') {
      setTimeout(() => valorRecebidoRef.current?.focus(), 80);
    }
  }, [formaPagamentoUI]);

  async function loadData() {
    setLoading(true);
    const [servicosData, produtosData, clientesData, fiscalCfg, configImp, caixaCfg] = await Promise.all([
      api.servicos.getAtivos(),
      api.produtos.getAll(),
      api.clientes.getAll(),
      api.fiscal.getConfig(),
      api.configImpressao.get(),
      api.config.caixaFinanceiro.get()
    ]);
    
    setServicos(servicosData || []);
    setProdutos((produtosData || []).filter(p => p.ativo === 1));
    setClientesList(clientesData || []);
    setFiscalHabilitado(!!(fiscalCfg && fiscalCfg.habilitado));
    setConfigImpressao(configImp || {
      imprimir_automatico: 1, exibir_dialogo_impressao: 1, vias_cupom: 1, imprimir_danfe_automatico: 0, largura_bobina: 80 
    });
    if (caixaCfg && caixaCfg.id) setConfigCaixa(caixaCfg);

    if (currentVendaId) {
      const vendaData = await api.vendas.getById(currentVendaId);
      if (vendaData && vendaData.status === 'pago') {
        showToast('Esta transação já foi processada.', 'warning');
        navigate('/atendimento', { replace: true });
        return;
      }
      setVenda(vendaData);
      setIsVendaLivre(false);
    } 

    setLoading(false);
  }

  useEffect(() => { loadData(); }, [currentVendaId]);

  useEffect(() => {
    if (setIsPdvFocused) setIsPdvFocused(true);

    const handleKeyDown = (e) => {
      // Modais ou modais fiscais abertos
      const hasModals = document.querySelectorAll('.modal, .modal-overlay, dialog, [role="dialog"]').length > 0;
      
      if (e.key === 'Escape') {
        if (!hasModals && setIsPdvFocused) {
          setIsPdvFocused(false);
        }
      }

      // Atalhos de pagamento (respeitando config_caixa_financeiro)
      if (!hasModals) {
        if (e.key === 'F1' && configCaixa.pagto_dinheiro_ativo) { e.preventDefault(); setFormaPagamentoUI('dinheiro'); }
        if (e.key === 'F2' && configCaixa.pagto_pix_ativo) { e.preventDefault(); setFormaPagamentoUI('pix'); }
        if (e.key === 'F3' && configCaixa.pagto_credito_ativo) { e.preventDefault(); setFormaPagamentoUI('cartao_credito'); }
        if (e.key === 'F4' && configCaixa.pagto_debito_ativo) { e.preventDefault(); setFormaPagamentoUI('cartao_debito'); }

        // Enter para finalizar venda quando método selecionado não é dinheiro
        // (para dinheiro, o Enter fica no próprio input de valorRecebido)
        if (e.key === 'Enter' && formaPagamentoUI && formaPagamentoUI !== 'dinheiro') {
          const activeEl = document.activeElement;
          const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
          if (!isTyping && !hasModals) {
            e.preventDefault();
            handleFinalizar(true);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (setIsPdvFocused) setIsPdvFocused(false);
    }
  }, [setIsPdvFocused, configCaixa, formaPagamentoUI]);

  const handleSairModoFoco = () => {
    if (setIsPdvFocused) setIsPdvFocused(false);
  };

  const focusSearch = () => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleClienteChange = async (cid) => {
    setVenda({ ...venda, cliente_id: cid, pet_id: '' });
    if (cid) {
       const p = await api.pets.getByCliente(cid);
       setPetsList(p || []);
    } else {
       setPetsList([]);
    }
  };

  const handleAddItem = async (item, tipo) => {
    if (tipo === 'produto' && item.estoque <= 0) {
      showToast('Operação Negada: Produto inativo ou sem estoque!', 'error');
      focusSearch();
      return;
    }

    if (tipo === 'produto' && item.vendido_por_peso === 1) {
      const resBalanca = await api.balanca.lerPeso();
      if (resBalanca && resBalanca.success && resBalanca.peso !== null && resBalanca.peso > 0) {
        proceedAddingItem(item, tipo, parseFloat(resBalanca.peso));
      } else {
        setPesoManual('');
        setPesoModalConfig({ isOpen: true, item });
      }
      return;
    }

    proceedAddingItem(item, tipo, 1);
  };

  const proceedAddingItem = async (item, tipo, qty) => {
    if (isVendaLivre) {
      const newItens = [...venda.itens];
      const check = newItens.find(i => i.tipo === tipo && i.referencia_id === item.id);
      
      if (check) {
        if (tipo === 'produto' && check.quantidade + qty > item.estoque) {
           showToast(`Estoque insuficiente! Saldo Disp: ${item.estoque}`, 'warning');
           focusSearch();
           return;
        }
        check.quantidade += qty;
        check.subtotal = check.quantidade * check.valor_unitario;
      } else {
        const pcoFinal = tipo === 'produto' 
          ? item.preco 
          : calcularPrecoServico(item, venda.pet_id ? petsList.find(p => p.id === parseInt(venda.pet_id))?.porte : null);
          
        newItens.push({
          id: 'mem_' + Math.random(),
          tipo,
          referencia_id: item.id,
          descricao_snapshot: item.nome + (item.vendido_por_peso === 1 ? ` (${item.unidade_medida})` : ''),
          quantidade: qty,
          valor_unitario: pcoFinal,
          subtotal: pcoFinal * qty
        });
      }
      const newSub = newItens.reduce((acc, obj) => acc + obj.subtotal, 0);
      setVenda({ ...venda, itens: newItens, subtotal: newSub });
      return;
    }

    if (tipo === 'produto') {
      const inCart = venda.itens.find(i => i.tipo === 'produto' && i.referencia_id === item.id);
      const qtAtual = inCart ? inCart.quantidade : 0;
      if (inCart ? inCart.quantidade + qty > item.estoque : qty > item.estoque) {
        showToast(`Estoque insuficiente! Saldo atual: ${item.estoque}`, 'warning');
        focusSearch();
        return;
      }
    }
    
    const pcoFinal = tipo === 'produto' 
      ? item.preco 
      : calcularPrecoServico(item, venda.pet_id ? petsList.find(p => p.id === parseInt(venda.pet_id))?.porte : null);
      
    await api.vendas.addItem({
      venda_id: venda.id,
      tipo,
      referencia_id: item.id,
      descricao_snapshot: item.nome + (item.vendido_por_peso === 1 ? ` (${item.unidade_medida})` : ''),
      quantidade: qty,
      valor_unitario: pcoFinal
    });
    loadData();
  };

  const confirmPesoManual = () => {
    const val = parseFloat(pesoManual);
    if (!isNaN(val) && val > 0) {
      proceedAddingItem(pesoModalConfig.item, 'produto', val);
      setPesoModalConfig({ isOpen: false, item: null });
      focusSearch();
    } else {
      showToast('Insira um peso numérico válido maior que 0.', 'warning');
    }
  };

  // Scanner EventHandler
  const handleBuscaKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = buscaCatalogo.trim();
      
      // Se a busca estiver vazia e já houver uma forma de pagamento (Pix/Cartão) selecionada, finaliza
      if (!code) {
        if (formaPagamentoUI && formaPagamentoUI !== 'dinheiro') {
          handleFinalizar(true);
        }
        return;
      }

      const codeLower = code.toLowerCase();

      // 1. Tentar por código de barras exato
      const pByBarcode = produtos.find(prod => prod.codigo_barras && prod.codigo_barras === code);
      if (pByBarcode) {
        handleAddItem(pByBarcode, 'produto');
        setBuscaCatalogo('');
        return;
      }

      // 2. Se não achou por código de barras, vamos ver o que está filtrado na tela
      const currentFilteredServicos = servicos.filter(s => s.nome.toLowerCase().includes(codeLower));
      const currentFilteredProdutos = produtos.filter(p => 
        p.nome.toLowerCase().includes(codeLower) || 
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(codeLower))
      );

      const totalFiltered = currentFilteredServicos.length + currentFilteredProdutos.length;

      if (totalFiltered === 1) {
        // Se a busca retornar apenas 1 item, adicione-o
        if (currentFilteredServicos.length === 1) {
          handleAddItem(currentFilteredServicos[0], 'servico');
        } else {
          handleAddItem(currentFilteredProdutos[0], 'produto');
        }
        setBuscaCatalogo('');
        return;
      }

      if (totalFiltered > 1) {
        // Se retornar vários, verifique se algum tem o nome EXATAMENTE igual
        const exactServico = currentFilteredServicos.find(s => s.nome.toLowerCase() === codeLower);
        if (exactServico) {
          handleAddItem(exactServico, 'servico');
          setBuscaCatalogo('');
          return;
        }
        const exactProduto = currentFilteredProdutos.find(p => p.nome.toLowerCase() === codeLower);
        if (exactProduto) {
          handleAddItem(exactProduto, 'produto');
          setBuscaCatalogo('');
          return;
        }

        showToast('Busca retornou múltiplos itens. Clique no botão "+" do item desejado ou digite mais do nome.', 'warning');
        focusSearch();
        return;
      }

      showToast('Nenhum produto ou serviço encontrado com esse termo.', 'error');
      setBuscaCatalogo('');
      focusSearch();
    }
  };

  const handleUpdateQty = async (itemId, newQty, itemSnapshot) => {
    const val = parseInt(newQty);
    if (isNaN(val) || val <= 0) {
      if (val === 0) return handleRemoveItem(itemId);
      return;
    }

    if (itemSnapshot.tipo === 'produto') {
      const prod = produtos.find(p => p.id === itemSnapshot.referencia_id);
      if (prod && val > prod.estoque) {
        showToast(`O limite contábil suporta apenas ${prod.estoque} unidades.`, 'warning');
        focusSearch();
        return;
      }
    }

    if (isVendaLivre) {
       const newItens = venda.itens.map(i => {
          if (i.id === itemId) return { ...i, quantidade: val, subtotal: val * i.valor_unitario };
          return i;
       });
       const newSub = newItens.reduce((acc, obj) => acc + obj.subtotal, 0);
       setVenda({ ...venda, itens: newItens, subtotal: newSub });
       return;
    }

    await api.vendas.updateItemQty({ item_id: itemId, quantidade: val });
    loadData();
  };

  const handleRemoveItem = async (itemId) => {
    if (isVendaLivre) {
       const newItens = venda.itens.filter(i => i.id !== itemId);
       const newSub = newItens.reduce((acc, obj) => acc + obj.subtotal, 0);
       setVenda({ ...venda, itens: newItens, subtotal: newSub });
       return;
    }
    await api.vendas.removeItem(itemId);
    loadData();
  };

  const processVendaLivreDB = async () => {
    let cid = venda.cliente_id;
    let pid = venda.pet_id;

    if (!cid) {
       let padrao = clientesList.find(c => c.nome.toLowerCase() === 'consumidor padrão' || c.nome.toLowerCase() === 'cliente avulso');
       if (!padrao) {
          const rC = await api.clientes.create({ nome: 'Consumidor Padrão' });
          padrao = { id: rC.id };
       }
       cid = padrao.id;
    }
    if (!pid && cid) {
       const allP = await api.pets.getByCliente(cid);
       let padraoP = allP.find(p => p.nome.toLowerCase() === 'padrão');
       if (!padraoP) {
          const rP = await api.pets.create({ cliente_id: cid, nome: 'Padrão' });
          padraoP = { id: rP.id };
       }
       pid = padraoP.id;
    }

    const atRes = await api.atendimentos.create({
       agendamento_id: null, cliente_id: cid, pet_id: pid, servico_id: null, observacoes: 'Venda Livre Rápida'
    });
    if (!atRes.success) throw new Error(atRes.message || 'Falha silenciosa ao envelopar cliente DB.');

    const vRes = await api.vendas.create({ cliente_id: cid, pet_id: pid, atendimento_id: atRes.id });
    if (!vRes.success) throw new Error(vRes.message || 'Falha de gravação.');

    for (const item of venda.itens) {
       await api.vendas.addItem({
          venda_id: vRes.id,
          tipo: item.tipo,
          referencia_id: item.referencia_id,
          descricao_snapshot: item.descricao_snapshot,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario
       });
    }

    return vRes.id;
  };

  const finalizeSessionEnd = () => {
    if (isVendaLivre) {
       setVenda({ id: 'Livre', itens: [], subtotal: 0, cliente_id: '', pet_id: '' });
       setDescontoPerc(0);
       setFormaPagamentoUI('');
       setValorRecebido('');
    } else {
       navigate('/atendimento', { replace: true });
    }
  };

  const handleFinalizar = async (imprimir = false, emitirNfce = false) => {
    if (!isValid) {
      setModalConfirm({
        isOpen: true,
        title: 'Bloqueio de Licença',
        message: 'Seu período de uso expirou ou sua licença é inválida. Por favor, acesse Configurações > Licença para ativar sua cópia e continuar utilizando o PDV.',
        type: 'danger',
        confirmLabel: 'Ir para Licença',
        onConfirm: () => { navigate('/configuracoes', { state: { activeTab: 'licenca' } }); }
      });
      return;
    }

    if (!venda || !venda.itens || venda.itens.length === 0) {
      showToast('Não há transações para faturar.', 'warning');
      focusSearch();
      return;
    }
    if (!formaPagamentoUI) {
      showToast('Por favor, selecione o método de pagamento.', 'warning');
      return;
    }

    if (formaPagamentoUI === 'dinheiro') {
      if (!valorRecebido || recebidoNum < totalCalculado) {
        showToast('Valor Recebido insuficiente para cobrir o total da venda.', 'error');
        return;
      }
    }

    let formaBackend = formaPagamentoUI;
    if (formaPagamentoUI === 'cartao_debito' || formaPagamentoUI === 'cartao_credito') {
       formaBackend = 'cartao';
    }
    
    setFiscalFeedback(null);

    try {
      let targetVendaId = venda.id;
      
      if (isVendaLivre) {
         targetVendaId = await processVendaLivreDB();
      }

      const res = await api.vendas.finalizar({
        id: targetVendaId,
        forma_pagamento: formaBackend,
        forma_pagamento_detalhe: formaPagamentoUI,
        desconto: descontoCalculado,
        valor_recebido: formaPagamentoUI === 'dinheiro' ? recebidoNum : null,
        troco: formaPagamentoUI === 'dinheiro' ? trocoCalculado : null
      });

      if (!res.success) {
        setModalConfirm({
          isOpen: true,
          title: 'Erro na Venda',
          message: res.message || 'Erro desconhecido ao finalizar venda.',
          type: 'danger',
          onConfirm: () => { focusSearch(); }
        });
        return;
      }

      // ABERTURA DE GAVETA E HW
      api.hardware.abrirGaveta().catch(e => console.warn(e));

      // Venda está 100% gravada aqui. Impressão comercial.
      if (imprimir || configImpressao?.imprimir_automatico === 1) {
         const nClienteRaw = venda.cliente_nome || (venda.cliente_id ? clientesList.find(c => c.id == venda.cliente_id)?.nome : 'Consumidor Avulso');
         const nPetRaw = venda.pet_nome || (venda.pet_id ? petsList.find(p => p.id == venda.pet_id)?.nome : '');

         const objCupom = {
            id: targetVendaId,
            lojaNome: branding.nome_comercio || 'PETSHOP SYSTEM',
            logoPath: branding.logo_path || null,
            exibirLogo: (branding.exibir_logo_cupom !== 0) && !!branding.logo_path,
            data: new Date().toLocaleString(),
            cliente_nome_raw: nClienteRaw,
            pet_nome_raw: nPetRaw,
            itens: [...venda.itens],
            subtotal: venda.subtotal,
            desconto: descontoCalculado,
            total: totalCalculado,
            forma_pagamento: formaPagamentoUI,
            configImpressao
         };

         const html = generateReceiptHtml(objCupom);
         const vias = configImpressao?.vias_cupom || 1;
         const silentMode = configImpressao?.exibir_dialogo_impressao === 0;

         for (let i = 0; i < vias; i++) {
            api.system.printReceipt({ htmlContent: html, silent: silentMode }).then(printRes => {
               if (!printRes.success) {
                  console.warn("Falha contornada de impressão comercial: ", printRes.error);
               }
            });
         }
      }

      // Emissão fiscal (NFC-e) — etapa separada, nunca invalida a venda
      if (emitirNfce) {
         try {
            const fiscalRes = await api.fiscal.emitirHomologacao(targetVendaId);
            if (fiscalRes.success) {
               setFiscalFeedback({ type: 'success', message: `NFC-e ${fiscalRes.data.ambiente === 'homologacao' ? '(Homologação) ' : ''}autorizada — Nº ${fiscalRes.data.numero_nfce} | Chave: ${fiscalRes.data.chave_acesso}`, vendaId: targetVendaId });
               
               // Dispara impressão automática do DANFE se autorizado e configurado
               if (configImpressao?.imprimir_danfe_automatico === 1) {
                  const silentMode = configImpressao?.exibir_dialogo_impressao === 0;
                  api.fiscal.printDanfe({ vendaId: targetVendaId, silent: silentMode }).catch(err => console.warn(err));
               }
            } else {
               const isRede = fiscalRes.status_fiscal === 'erro_rede' || fiscalRes.status_fiscal === 'pendente_reenvio';
               setFiscalFeedback({ 
                 type: isRede ? 'warning' : 'error', 
                 message: isRede 
                   ? 'Venda concluída. NFC-e pendente de envio (instabilidade na rede ou Sefaz).' 
                   : `Venda concluída, porém a emissão fiscal foi rejeitada: ${fiscalRes.error}` 
               });
            }
         } catch (fiscalErr) {
            setFiscalFeedback({ type: 'warning', message: 'Venda concluída. NFC-e pendente de envio devido a erro de comunicação.' });
         }

         // Manter na tela pra usuário ver o feedback antes de limpar
          // Feedback amigável
          showToast('Venda processada no painel!', 'success');
          setTimeout(() => {
             if (!fiscalModalVendaId) {
               setFiscalFeedback(null);
               finalizeSessionEnd();
               focusSearch();
             }
          }, 4000);
          return;
       }
      
      showToast('Contabilidade Finalizada e Balanço Efetuado com Êxito!', 'success');
      finalizeSessionEnd();
      focusSearch();

    } catch (e) {
      showToast(e.message, 'error');
      focusSearch();
    }
  };

  const handleCancelar = async () => {
    if (!venda) return;
    
    setModalConfirm({
      isOpen: true,
      title: 'Cancelar Atendimento',
      message: 'Deseja realmente anular os itens e devolver à fila?',
      type: 'warning',
      cancelLabel: 'Não, manter',
      confirmLabel: 'Sim, cancelar',
      onConfirm: () => {
        finalizeSessionEnd();
        focusSearch();
      }
    });
  };

  if (loading && !servicos.length && !produtos.length) return <div>Inicializando Cash Register...</div>;

  const filteredServicos = servicos.filter(s => s.nome.toLowerCase().includes(buscaCatalogo.toLowerCase()));
  const filteredProdutos = produtos.filter(p => 
    p.nome.toLowerCase().includes(buscaCatalogo.toLowerCase()) || 
    (p.codigo_barras && p.codigo_barras.toLowerCase().includes(buscaCatalogo.toLowerCase()))
  );

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        .pdv-wrapper {
          display: grid;
          grid-template-columns: 3fr 4.4fr 2.6fr; /* ~30% 44% 26% of available space */
          gap: 16px;
          height: 100%;
          background-color: #121214;
          width: 100%;
          overflow: hidden;
        }
        
        .pdv-col {
          background-color: #202024;
          border-radius: 12px;
          border: 1px solid #29292E;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0; /* Permite encolher em displays menores */
        }

        .pdv-header {
          padding: 16px 20px;
          border-bottom: 1px solid #29292E;
          background-color: rgba(0, 0, 0, 0.1);
        }

        .pdv-header-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #E1E1E6;
        }

        .catalog-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border: 1px solid #29292E;
          border-radius: 8px;
          background-color: rgba(255, 255, 255, 0.015);
          transition: background-color 0.2s, border-color 0.2s;
        }

        .catalog-item:hover {
          background-color: #29292E;
          border-color: #323238;
        }
        
        .catalog-item.disabled {
          opacity: 0.5;
          pointer-events: none;
        }

        .cart-row {
          border-bottom: 1px solid #29292E;
          transition: background-color 0.15s;
        }

        .cart-row:nth-child(even) {
          background-color: rgba(255, 255, 255, 0.01);
        }

        .cart-row:hover {
          background-color: rgba(255, 255, 255, 0.03);
        }

        .btn-qty {
          background: transparent;
          border: none;
          color: #E1E1E6;
          padding: 6px 12px;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-qty:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .qty-container {
          display: inline-flex;
          align-items: center;
          background: #121214;
          border-radius: 6px;
          border: 1px solid #29292E;
          overflow: hidden;
        }

        .section-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 700;
          color: #8D8D99;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #323238; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #4d4d57; }
        
        .input-dark {
          background-color: #121214;
          border: 1px solid #29292E;
          color: #E1E1E6;
          padding: 10px 12px;
          border-radius: 6px;
          width: 100%;
          outline: none;
          font-size: 14px;
        }
        
        .input-dark:focus {
          border-color: var(--primary);
        }
      `}</style>
      
      <div className="pdv-wrapper">
        
        {/* 1. Catálogo */}
        <div className="pdv-col">
          <div className="pdv-header">
             <h3 className="pdv-header-title">Catálogo</h3>
          </div>
          
          <div style={{ padding: '16px', borderBottom: '1px solid #29292E' }}>
            <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8D8D99' }} />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  className="input-dark" 
                  placeholder="Scan barra USB ou Busca Manual..." 
                  value={buscaCatalogo} 
                  autoFocus
                  onChange={e => setBuscaCatalogo(e.target.value)} 
                  onKeyDown={handleBuscaKeyDown}
                  style={{ paddingLeft: '36px' }}
                />
            </div>
            <div style={{ fontSize: '10px', color: '#8D8D99', marginTop: '6px', textAlign: 'center' }}>Modo Captura Fast habilitado.</div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Servicos */}
            {filteredServicos.length > 0 && (
              <div>
                <div className="section-label">
                  <Scissors size={14} color="var(--primary)"/> Serviços Clínicos
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredServicos.map(s => (
                    <div key={`s-${s.id}`} className="catalog-item">
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#E1E1E6' }}>{s.nome}</div>
                        <div style={{ color: 'var(--success)', fontSize: '13px', marginTop: '4px', fontWeight: '500' }}>R$ {s.preco_base.toFixed(2)}</div>
                      </div>
                      <button className="btn" onClick={() => handleAddItem(s, 'servico')} style={{ padding: '8px', minWidth: '40px' }}><Plus size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Produtos */}
            {filteredProdutos.length > 0 && (
              <div>
                <div className="section-label">
                  <Package size={14} color="var(--primary)"/> Prateleira
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredProdutos.map(p => {
                    const noStock = p.estoque <= 0;
                    return (
                      <div key={`p-${p.id}`} className={`catalog-item ${noStock ? 'disabled' : ''}`}>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '14px', color: '#E1E1E6', display: 'flex', alignItems: 'center', gap: '8px' }}>
                             {p.nome}
                             {noStock && <span style={{ padding: '2px 6px', background: 'rgba(var(--danger-rgb), 0.15)', color: 'var(--danger)', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>ESGOTADO</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                             <span style={{ color: 'var(--success)', fontSize: '13px', fontWeight: '500' }}>R$ {p.preco.toFixed(2)}</span>
                             <span style={{ fontSize: '12px', color: '#8D8D99' }}>Stock: {p.estoque}</span>
                          </div>
                        </div>
                        <button className="btn" onClick={() => handleAddItem(p, 'produto')} style={{ padding: '8px', minWidth: '40px', background: noStock ? '#29292E' : 'var(--primary)', border: 'none' }}><Plus size={16} /></button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredServicos.length === 0 && filteredProdutos.length === 0 && (
               <div style={{ textAlign: 'center', color: '#8D8D99', padding: '24px 0', fontSize: '14px' }}>Item não rastreável.</div>
            )}

          </div>
        </div>

        {/* 2. Carrinho Principal */}
        <div className="pdv-col" style={{ borderColor: 'var(--primary)' }}>
          <div className="pdv-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottomColor: 'var(--primary)', background: 'rgba(var(--primary-rgb), 0.05)' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <BrandLogo 
                size="sm" 
                logoPath={branding.logo_path} 
                logoTs={branding.logoTs} 
                className="pdv-logo-wrapper"
                style={{ width: '32px', height: '32px' }} 
              />
               <h3 className="pdv-header-title" style={{ color: 'var(--primary)' }}>
                  {branding.nome_comercio || (isVendaLivre ? 'PetWay - Frente de Loja' : venda ? `Emissão #${venda.id}` : 'PetWay')}
               </h3>
             </div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
               <div style={{ fontSize: '12px', color: '#8D8D99', fontWeight: '500' }}>
                 {venda?.itens?.length || 0} Registros
               </div>
               {isPdvFocused && (
                 <button onClick={handleSairModoFoco} className="btn-outline" style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'transparent' }}>
                   <XSquare size={14} /> Sair do modo venda
                 </button>
               )}
             </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
             <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#121214', zIndex: 10, boxShadow: '0 1px 0 #29292E' }}>
                 <tr style={{ color: '#8D8D99', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                   <th style={{ padding: '16px 20px', fontWeight: '600' }}>Descrição</th>
                   <th style={{ padding: '16px 12px', fontWeight: '600', width: '110px', textAlign: 'center' }}>Qtd</th>
                   <th style={{ padding: '16px 12px', fontWeight: '600', width: '100px', textAlign: 'right' }}>V. Unit.</th>
                   <th style={{ padding: '16px 20px', fontWeight: '600', width: '110px', textAlign: 'right' }}>Subtotal</th>
                   <th style={{ padding: '16px 16px', fontWeight: '600', width: '60px', textAlign: 'center' }}></th>
                 </tr>
               </thead>
              <tbody>
                {venda && venda.itens && venda.itens.map(item => (
                  <tr key={item.id} className="cart-row">
                    <td style={{ padding: '16px 20px' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '500', color: '#E1E1E6' }}>
                          {item.tipo === 'produto' ? <Package size={16} color="#8D8D99"/> : <Scissors size={16} color="#8D8D99"/>}
                          {item.descricao_snapshot}
                       </div>
                    </td>
                    <td style={{ padding: '16px 12px' }}>
                      <div className="qty-container">
                         <button className="btn-qty" onClick={() => handleUpdateQty(item.id, item.quantidade - 1, item)}><Minus size={14}/></button>
                         <div style={{ minWidth: '32px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#E1E1E6' }}>{item.quantidade}</div>
                         <button className="btn-qty" onClick={() => handleUpdateQty(item.id, item.quantidade + 1, item)}><Plus size={14}/></button>
                      </div>
                    </td>
                    <td style={{ padding: '16px 12px', textAlign: 'right', fontSize: '13px', color: '#8D8D99' }}>
                       R$ {item.valor_unitario.toFixed(2)}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: 'var(--success)' }}>
                       R$ {item.subtotal.toFixed(2)}
                    </td>
                    <td style={{ padding: '16px 16px', textAlign: 'center' }}>
                       <button className="btn-outline" onClick={() => handleRemoveItem(item.id)} style={{ padding: '6px', border: 'none', color: 'var(--danger)', background: 'rgba(var(--danger-rgb), 0.05)', borderRadius: '6px' }} title="Remover">
                          <Trash2 size={16} />
                       </button>
                    </td>
                  </tr>
                ))}
                {(!venda || !venda.itens || venda.itens.length === 0) && (
                   <tr>
                      <td colSpan="5" style={{ padding: '80px 24px', textAlign: 'center', color: '#8D8D99' }}>
                         <ShoppingCart size={40} style={{ opacity: 0.15, margin: '0 auto 16px auto', display: 'block' }} />
                         <div style={{ fontSize: '14px', fontWeight: '500' }}>Área Livre</div>
                         <div style={{ fontSize: '13px', marginTop: '4px', opacity: 0.8 }}>Escaneie seu primeiro item.</div>
                      </td>
                   </tr>
                )}
              </tbody>
             </table>
          </div>
          
          {venda && venda.itens && venda.itens.length > 0 && (
            <div style={{ backgroundColor: '#121214', padding: '20px 24px', borderTop: '1px solid #29292E', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
               <span style={{ color: '#8D8D99', marginRight: '16px', fontSize: '14px', fontWeight: '600' }}>Subtotal Integrado:</span>
               <span style={{ fontSize: '22px', fontWeight: '700', color: '#E1E1E6' }}>R$ {venda.subtotal.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* 3. Fechamento e Resumo Financeiro */}
        <div className="pdv-col">
          <div className="pdv-header">
             <h3 className="pdv-header-title">Finalização</h3>
          </div>
          
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
            
            <div style={{ backgroundColor: '#121214', padding: '16px', borderRadius: '8px', border: '1px solid #29292E', marginBottom: '24px' }}>
              {isVendaLivre ? (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                       <label style={{ fontSize: '11px', color: '#8D8D99', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '6px' }}>Identidade Cliente</label>
                       <select className="input-dark" value={venda?.cliente_id || ''} onChange={e => handleClienteChange(e.target.value)}>
                          <option value="">Não (Consumidor Rápido)</option>
                          {clientesList.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                       </select>
                    </div>
                    {venda?.cliente_id && petsList.length > 0 && (
                       <div>
                          <label style={{ fontSize: '11px', color: '#8D8D99', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '6px' }}>Paciente Acoplado</label>
                          <select className="input-dark" value={venda?.pet_id || ''} onChange={e => setVenda({...venda, pet_id: e.target.value})}>
                             <option value="">Silenciar Vínculo</option>
                             {petsList.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                          </select>
                       </div>
                    )}
                 </div>
              ) : venda ? (
                 <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #29292E' }}>
                      <span style={{ color: '#8D8D99' }}>Status:</span>
                      <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>ATENDIMENTO (MESA)</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#8D8D99' }}>Tutor:</span>
                      <span style={{ color: '#E1E1E6', fontWeight: '600' }}>{venda.cliente_nome}</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8D8D99' }}>Pet:</span>
                      <span style={{ color: '#E1E1E6', fontWeight: '600' }}>{venda.pet_nome}</span>
                   </div>
                 </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px', flex: 1 }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                 <span style={{ color: '#8D8D99', fontWeight: '500' }}>Subtotal Base</span>
                 <span style={{ fontWeight: '600', color: '#E1E1E6' }}>R$ {venda ? venda.subtotal.toFixed(2) : '0.00'}</span>
               </div>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <span style={{ color: '#8D8D99', fontSize: '14px', fontWeight: '500' }}>Condicional %</span>
                 <input 
                    type="number" 
                    min="0" 
                    max={configCaixa.desconto_maximo_percentual || 100} 
                    className="input-dark" 
                    style={{ width: '85px', textAlign: 'right', padding: '6px 12px', fontWeight: '600', borderColor: parseFloat(descontoPerc) > parseFloat(configCaixa.desconto_maximo_percentual || 100) ? 'var(--danger)' : undefined }} 
                    value={descontoPerc} 
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      const max = parseFloat(configCaixa.desconto_maximo_percentual) || 100;
                      if (val > max) {
                        showToast(`Desconto limitado a ${max}% conforme configuração do sistema.`, 'warning');
                        return;
                      }
                      setDescontoPerc(e.target.value);
                    }} 
                    disabled={!venda} 
                 />
               </div>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #29292E' }}>
                 <span style={{ fontSize: '15px', fontWeight: '700', color: '#E1E1E6', textTransform: 'uppercase' }}>Faturamento</span>
                 <span style={{ fontSize: '32px', fontWeight: '800', color: venda ? 'var(--success)' : '#8D8D99', lineHeight: '1' }}>
                    R$ {venda ? totalCalculado.toFixed(2) : '0.00'}
                 </span>
               </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {configCaixa.pagto_dinheiro_ativo ? (
                <button 
                  className="btn-outline"
                  onClick={() => setFormaPagamentoUI('dinheiro')}
                  disabled={!venda}
                  style={{
                    padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px',
                    backgroundColor: formaPagamentoUI === 'dinheiro' ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
                    borderColor: formaPagamentoUI === 'dinheiro' ? 'var(--primary)' : 'var(--border-default)',
                    color: formaPagamentoUI === 'dinheiro' ? 'var(--primary)' : '#E1E1E6'
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>[F1]</span>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Dinheiro</span>
                </button>
                ) : null}
                
                {configCaixa.pagto_pix_ativo ? (
                <button 
                  className="btn-outline"
                  onClick={() => setFormaPagamentoUI('pix')}
                  disabled={!venda}
                  style={{
                    padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px',
                    backgroundColor: formaPagamentoUI === 'pix' ? 'rgba(0, 200, 83, 0.15)' : 'transparent',
                    borderColor: formaPagamentoUI === 'pix' ? 'var(--success)' : 'var(--border-default)',
                    color: formaPagamentoUI === 'pix' ? 'var(--success)' : '#E1E1E6'
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>[F2]</span>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Pix</span>
                </button>
                ) : null}
                
                {configCaixa.pagto_credito_ativo ? (
                <button 
                  className="btn-outline"
                  onClick={() => setFormaPagamentoUI('cartao_credito')}
                  disabled={!venda}
                  style={{
                    padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px',
                    backgroundColor: formaPagamentoUI === 'cartao_credito' ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
                    borderColor: formaPagamentoUI === 'cartao_credito' ? 'var(--primary)' : 'var(--border-default)',
                    color: formaPagamentoUI === 'cartao_credito' ? 'var(--primary)' : '#E1E1E6'
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>[F3]</span>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Crédito</span>
                </button>
                ) : null}

                {configCaixa.pagto_debito_ativo ? (
                <button 
                  className="btn-outline"
                  onClick={() => setFormaPagamentoUI('cartao_debito')}
                  disabled={!venda}
                  style={{
                    padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px',
                    backgroundColor: formaPagamentoUI === 'cartao_debito' ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
                    borderColor: formaPagamentoUI === 'cartao_debito' ? 'var(--primary)' : 'var(--border-default)',
                    color: formaPagamentoUI === 'cartao_debito' ? 'var(--primary)' : '#E1E1E6'
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>[F4]</span>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Débito</span>
                </button>
                ) : null}
              </div>
            </div>

            {formaPagamentoUI === 'dinheiro' && (
              <div style={{ padding: '16px', background: 'rgba(var(--primary-rgb), 0.1)', border: '1px solid var(--primary)', borderRadius: '8px', marginBottom: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--primary)', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '6px' }}>Valor Recebido (R$)*</label>
                    <input 
                      ref={valorRecebidoRef}
                      id="pdv-valor-recebido"
                      type="number" 
                      step="0.01" 
                      className="input-dark" 
                      style={{ width: '100%', borderColor: !isDinheiroValido ? 'var(--danger)' : 'var(--primary)', fontSize: '16px', fontWeight: '600' }} 
                      value={valorRecebido} 
                      onChange={e => setValorRecebido(e.target.value)} 
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleFinalizar(true);
                        }
                      }}
                      placeholder="Ex: 100.00"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '6px' }}>Troco (R$)</label>
                    <input 
                      type="text" 
                      disabled 
                      className="input-dark" 
                      style={{ width: '100%', color: trocoCalculado >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.2)', borderColor: 'transparent' }} 
                      value={trocoCalculado >= 0 ? Number(trocoCalculado).toFixed(2) : 'Insuficiente'} 
                    />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

               {/* Feedback fiscal visual */}
               {fiscalFeedback && (
                 <div style={{
                   padding: '12px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '500',
                   backgroundColor: fiscalFeedback.type === 'success' ? 'rgba(0, 200, 83, 0.1)' : fiscalFeedback.type === 'error' ? 'rgba(255, 82, 82, 0.1)' : 'rgba(255, 193, 7, 0.1)',
                   border: `1px solid ${fiscalFeedback.type === 'success' ? 'var(--success)' : fiscalFeedback.type === 'error' ? 'var(--danger)' : '#ffc107'}`,
                   color: fiscalFeedback.type === 'success' ? 'var(--success)' : fiscalFeedback.type === 'error' ? 'var(--danger)' : '#ffc107'
                 }}>
                   {fiscalFeedback.message}
                   {fiscalFeedback.vendaId && fiscalFeedback.type === 'success' && (
                     <button
                       onClick={() => setFiscalModalVendaId(fiscalFeedback.vendaId)}
                       style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '12px', background: 'transparent', border: '1px solid var(--success)', color: 'var(--success)', padding: '3px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                     >
                       <Eye size={12} /> Ver DANFE
                     </button>
                   )}
                 </div>
               )}

               <button 
                  className="btn" 
                  onClick={() => handleFinalizar(true)} 
                  disabled={!isDinheiroValido}
                  style={{ background: 'var(--success)', padding: '16px', fontSize: '14px', fontWeight: '700', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px', opacity: !isDinheiroValido ? 0.5 : 1 }}
               >
                 <Printer size={18} /> FINALIZAR VENDA
               </button>

               {fiscalHabilitado && (
                 <button 
                    className="btn" 
                    onClick={() => handleFinalizar(false, true)} 
                    disabled={!isDinheiroValido}
                    style={{ background: '#1a6b3c', padding: '14px', fontSize: '13px', fontWeight: '700', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(0,200,83,0.3)', opacity: !isDinheiroValido ? 0.5 : 1 }}
                 >
                   <FileCheck size={18} /> FINALIZAR + EMITIR NFC-e
                 </button>
               )}

               <div style={{ display: 'flex', gap: '12px' }}>

                 <button 
                   className="btn-outline" 
                   onClick={handleCancelar} 
                   style={{ border: '1px solid #29292E', color: '#8D8D99', padding: '12px', justifyContent: 'center', background: '#121214' }}
                 >
                   <Trash2 size={16} /> CANCELAR VENDA
                 </button>
               </div>
            </div>
          </div>
        </div>
      </div>
      <DetalheFiscalModal
        vendaId={fiscalModalVendaId}
        isOpen={!!fiscalModalVendaId}
        onClose={() => {
          setFiscalModalVendaId(null);
          setFiscalFeedback(null);
          finalizeSessionEnd();
        }}
      />

      {pesoModalConfig.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade" style={{ width: '400px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)' }}>Informe o Peso / Medida</h3>
              <Package size={24} color="var(--primary)" />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
              Produto: <strong style={{ color: '#E1E1E6' }}>{pesoModalConfig.item?.nome}</strong>
            </p>
            <div className="input-group">
              <label>Quantidade/Peso medido em <strong>{pesoModalConfig.item?.unidade_medida || 'kg'}</strong></label>
              <input 
                 type="number" 
                 step="0.001" 
                 className="input-dark" 
                 value={pesoManual} 
                 onChange={e => setPesoManual(e.target.value)} 
                 autoFocus 
                 onKeyDown={e => e.key === 'Enter' && confirmPesoManual()}
                 style={{ fontSize: '18px', padding: '12px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button className="btn-outline" onClick={() => setPesoModalConfig({ isOpen: false, item: null })}>Cancelar</button>
              <button className="btn-primary" onClick={confirmPesoManual}>Adicionar ao Carrinho</button>
            </div>
          </div>
        </div>
      )}

      <ModalConfirm
        isOpen={modalConfirm.isOpen}
        title={modalConfirm.title}
        message={modalConfirm.message}
        type={modalConfirm.type}
        confirmLabel={modalConfirm.confirmLabel}
        cancelLabel={modalConfirm.cancelLabel}
        onConfirm={() => {
          modalConfirm.onConfirm();
          setModalConfirm({ ...modalConfirm, isOpen: false });
        }}
        onClose={() => setModalConfirm({ ...modalConfirm, isOpen: false })}
      />
    </>
  );
}
