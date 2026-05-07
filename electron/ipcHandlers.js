const { app, dialog, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getDatabase, verifyPassword, hashPassword } = require('./database');
const fiscalService = require('./fiscal/fiscalService');
const backupService = require('./backupService');
const hardwareService = require('./hardwareService');
const balancaService = require('./balancaService');
const licenseService = require('./licenseService');

const sessions = new Map();

function createSession(user) {
  const token = crypto.randomUUID();
  sessions.set(token, {
    id: user.id,
    login: user.login,
    tipo_usuario: user.tipo_usuario
  });
  return token;
}

function getSession(payload = {}) {
  return payload.authToken ? sessions.get(payload.authToken) : null;
}

function isPrivilegedSession(payload = {}) {
  const session = getSession(payload);
  return ['administrador', 'master'].includes(session?.tipo_usuario);
}

function isMasterSession(payload = {}) {
  const session = getSession(payload);
  return session?.tipo_usuario === 'master';
}

function isMasterUser(user) {
  return user?.login === 'master' || user?.tipo_usuario === 'master';
}

function isMaster(session) {
  return session?.tipo_usuario === 'master';
}

function normalizeUserType(tipoUsuario) {
  return tipoUsuario === 'administrador' ? 'administrador' : 'operador';
}

function legacyUserType(tipoUsuario) {
  return tipoUsuario === 'administrador' ? 'admin' : 'funcionario';
}

async function ensureConfigFiscal(db) {
  let cfg = await db.get('SELECT * FROM config_fiscal WHERE id = 1');
  if (!cfg) {
    await db.run("INSERT INTO config_fiscal (id, ambiente, api_provider) VALUES (1, 'homologacao', 'focus')");
    cfg = await db.get('SELECT * FROM config_fiscal WHERE id = 1');
  }
  return cfg;
}

function setupIpcHandlers(ipcMain) {
  // ======= AUTHENTICATION =======
  ipcMain.handle('auth:login', async (event, { login, password }) => {
    try {
      const db = await getDatabase();
      const user = await db.get('SELECT * FROM usuarios WHERE login = ? AND ativo = 1', [login]);
      if (!user) return { success: false, message: 'Usuário não encontrado ou inativo.' };

      const valid = verifyPassword(password, user.senha);
      if (!valid) return { success: false, message: 'Senha incorreta.' };

      const safeUser = { ...user };
      delete safeUser.senha;
      safeUser.sessionToken = createSession(user);
      return { success: true, user: safeUser };
    } catch (error) {
      console.error(error);
      return { success: false, message: 'Erro interno.' };
    }
  });

  ipcMain.handle('auth:changePassword', async (event, { login, currentPassword, newPassword }) => {
    try {
      const db = await getDatabase();
      const user = await db.get('SELECT * FROM usuarios WHERE login = ? AND ativo = 1', [login]);
      if (!user) return { success: false, message: 'Usuário não encontrado.' };

      const valid = verifyPassword(currentPassword, user.senha);
      if (!valid) return { success: false, message: 'Senha atual incorreta.' };

      const newHash = hashPassword(newPassword);
      await db.run('UPDATE usuarios SET senha = ?, senha_padrao_alterada = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, user.id]);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // ======= GESTÃO DE USUÁRIOS (ADMIN ONLY) =======
  ipcMain.handle('db:usuarios:getAll', async (event, payload = {}) => {
    if (!isPrivilegedSession(payload)) return { success: false, message: 'Acesso negado.' };
    try {
      const db = await getDatabase();
      const session = getSession(payload);
      const rows = session?.tipo_usuario === 'master'
        ? await db.all('SELECT id, nome, login, tipo_usuario, ativo FROM usuarios ORDER BY nome ASC')
        : await db.all("SELECT id, nome, login, tipo_usuario, ativo FROM usuarios WHERE tipo_usuario != 'master' AND login != 'master' ORDER BY nome ASC");
      return { success: true, data: rows };
    } catch (e) { return { success: false, message: e.message }; }
  });

  ipcMain.handle('db:usuarios:create', async (event, { authToken, nome, login, senha, tipo_usuario }) => {
    if (!isPrivilegedSession({ authToken })) return { success: false, message: 'Acesso negado.' };
    try {
      const tipoNormalizado = normalizeUserType(tipo_usuario);
      const db = await getDatabase();
      const exist = await db.get('SELECT id FROM usuarios WHERE login = ?', [login]);
      if (exist) return { success: false, message: 'Login já está em uso.' };
      const hash = hashPassword(senha);
      // Aqui usamos os dois campos para não quebrar compatibilidade
      await db.run('INSERT INTO usuarios (nome, login, senha, tipo, tipo_usuario) VALUES (?, ?, ?, ?, ?)', [nome, login, hash, legacyUserType(tipoNormalizado), tipoNormalizado]);
      return { success: true };
    } catch (e) { return { success: false, message: e.message }; }
  });

  ipcMain.handle('db:usuarios:update', async (event, { authToken, requesterLogin, id, nome, login, senha, tipo_usuario }) => {
    if (!isPrivilegedSession({ authToken })) return { success: false, message: 'Acesso negado.' };
    const session = getSession({ authToken });
    requesterLogin = session.login;
    const tipoNormalizado = normalizeUserType(tipo_usuario);
    try {
      const db = await getDatabase();
      const targetUser = await db.get('SELECT id, login, tipo_usuario FROM usuarios WHERE id = ?', [id]);

      if (!targetUser) return { success: false, message: 'UsuÃ¡rio nÃ£o encontrado.' };

      if (isMasterUser(targetUser) && !isMaster(session)) {
        return { success: false, message: 'O usuário master é protegido e não pode ser visualizado ou editado por administradores comuns.' };
      }

      if (targetUser.login === 'admin') {
        if (requesterLogin !== 'admin' && !isMaster(session)) {
          return { success: false, message: 'Acesso negado: Apenas o usuário admin original ou um Master podem modificar esta conta.' };
        }
        if (login !== 'admin') {
          return { success: false, message: 'O login do usuário admin original não pode ser alterado.' };
        }
        if (tipoNormalizado !== 'administrador') {
          return { success: false, message: 'O usuário admin original não pode perder o status de administrador.' };
        }
      }

      if (senha) {
        const hash = hashPassword(senha);
        await db.run('UPDATE usuarios SET nome=?, login=?, senha=?, senha_padrao_alterada=0, tipo=?, tipo_usuario=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [nome, login, hash, legacyUserType(tipoNormalizado), tipoNormalizado, id]);
      } else {
        await db.run('UPDATE usuarios SET nome=?, login=?, tipo=?, tipo_usuario=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [nome, login, legacyUserType(tipoNormalizado), tipoNormalizado, id]);
      }
      return { success: true };
    } catch (e) { return { success: false, message: e.message }; }
  });

  ipcMain.handle('db:usuarios:updateStatus', async (event, { authToken, requesterLogin, id, ativo }) => {
    if (!isPrivilegedSession({ authToken })) return { success: false, message: 'Acesso negado.' };
    const session = getSession({ authToken });
    requesterLogin = session.login;
    try {
      const db = await getDatabase();
      const targetUser = await db.get('SELECT id, login, tipo_usuario FROM usuarios WHERE id = ?', [id]);

      if (!targetUser) return { success: false, message: 'Usuario nao encontrado.' };

      if (isMasterUser(targetUser)) {
        return { success: false, message: 'O usuario master e permanente e nao pode ser inativado.' };
      }

      if (targetUser.login === 'admin' && requesterLogin !== 'admin') {
        return { success: false, message: 'Acesso negado: O usuário admin original não pode ser inativado por outros usuários.' };
      }
      if (targetUser.login === 'admin' && !ativo) {
        return { success: false, message: 'O usuário admin original é permanente e não pode ser inativado.' };
      }

      await db.run('UPDATE usuarios SET ativo=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [ativo ? 1 : 0, id]);
      return { success: true };
    } catch (e) { return { success: false, message: e.message }; }
  });

  ipcMain.handle('db:usuarios:delete', async (event, { authToken, requesterLogin, id }) => {
    if (!isPrivilegedSession({ authToken })) return { success: false, message: 'Acesso negado.' };
    const session = getSession({ authToken });
    requesterLogin = session.login;
    try {
      const db = await getDatabase();
      const targetUser = await db.get('SELECT id, login, tipo_usuario FROM usuarios WHERE id = ?', [id]);

      if (isMasterUser(targetUser)) {
        return { success: false, message: 'O usuario master e permanente e nao pode ser excluido.' };
      }

      if (!targetUser) return { success: false, message: 'Usuário não encontrado.' };

      // Proteção absoluta: o usuário 'admin' é intocável por qualquer um
      if (targetUser.login === 'admin') {
        return { success: false, message: 'O usuário "admin" é permanente e não pode ser excluído.' };
      }

      // Impede auto-exclusão
      if (targetUser.login === requesterLogin) {
        return { success: false, message: 'Você não pode excluir a si mesmo.' };
      }

      await db.run('DELETE FROM usuarios WHERE id = ?', [id]);
      return { success: true };
    } catch (e) { return { success: false, message: e.message }; }
  });



  ipcMain.handle('db:usuarios:resetAdminPassword', async (event, { authToken, newPassword }) => {
    if (!isMasterSession({ authToken })) return { success: false, message: 'Acesso negado.' };
    if (typeof newPassword !== 'string' || newPassword.length < 5) {
      return { success: false, message: 'A senha temporaria deve ter no minimo 5 caracteres.' };
    }

    try {
      const db = await getDatabase();
      const admin = await db.get("SELECT id FROM usuarios WHERE login = 'admin'");
      if (!admin) return { success: false, message: 'Usuario admin nao encontrado.' };

      const hash = hashPassword(newPassword);
      await db.run(
        'UPDATE usuarios SET senha=?, senha_padrao_alterada=0, ativo=1, tipo=?, tipo_usuario=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
        [hash, 'admin', 'administrador', admin.id]
      );
      return { success: true };
    } catch (e) { return { success: false, message: e.message }; }
  });

  // ======= DASHBOARD =======
  ipcMain.handle('db:dashboard:getStats', async () => {
    try {
      const db = await getDatabase();
      const today = new Date().toISOString().split('T')[0];
      const mesAtual = today.substring(0, 7); // YYYY-MM

      // KPIs básicos de agenda (manter retrocompatibilidade)
      const agRow = await db.get("SELECT count(*) as count FROM agendamentos WHERE data = ? AND status='agendado' AND ativo = 1", [today]);
      const emRow = await db.get("SELECT count(*) as count FROM agendamentos WHERE data = ? AND status='em_atendimento' AND ativo = 1", [today]);
      const fnRow = await db.get("SELECT count(*) as count FROM agendamentos WHERE data = ? AND status='finalizado' AND ativo = 1", [today]);

      // Faturamento do dia
      const fatDia = await db.get(
        "SELECT IFNULL(SUM(valor_total), 0) as total, COUNT(*) as count FROM vendas WHERE status='pago' AND DATE(created_at) = ?", [today]
      );

      // Faturamento do mês
      const fatMes = await db.get(
        "SELECT IFNULL(SUM(valor_total), 0) as total, COUNT(*) as count FROM vendas WHERE status='pago' AND strftime('%Y-%m', created_at) = ?", [mesAtual]
      );

      // Ticket médio do mês
      const ticketMedio = fatMes.count > 0 ? (fatMes.total / fatMes.count) : 0;

      // Total de atendimentos do dia
      const atendDia = await db.get(
        "SELECT COUNT(*) as count FROM atendimentos WHERE DATE(created_at) = ?", [today]
      );

      // Vendas por dia (últimos 7 dias)
      const vendasPorDia = await db.all(`
        SELECT DATE(created_at) as data, IFNULL(SUM(valor_total), 0) as total, COUNT(*) as count
        FROM vendas WHERE status='pago' AND created_at >= DATE('now', '-7 days')
        GROUP BY DATE(created_at)
        ORDER BY data ASC
      `);

      // Formas de pagamento do mês (%)
      const formasPagamento = await db.all(`
        SELECT COALESCE(NULLIF(forma_pagamento_detalhe, ''), forma_pagamento) as forma_pagamento, COUNT(*) as count, IFNULL(SUM(valor_total), 0) as total
        FROM vendas WHERE status='pago' AND strftime('%Y-%m', created_at) = ?
        GROUP BY COALESCE(NULLIF(forma_pagamento_detalhe, ''), forma_pagamento)
      `, [mesAtual]);

      // Top 5 produtos mais vendidos (mês)
      const topProdutos = await db.all(`
        SELECT vi.descricao_snapshot as nome, SUM(vi.quantidade) as qtd, SUM(vi.subtotal) as total
        FROM venda_itens vi
        JOIN vendas v ON vi.venda_id = v.id
        WHERE v.status='pago' AND vi.tipo='produto' AND strftime('%Y-%m', v.created_at) = ?
        GROUP BY vi.referencia_id
        ORDER BY qtd DESC
        LIMIT 5
      `, [mesAtual]);

      // Top 5 serviços mais vendidos (mês)
      const topServicos = await db.all(`
        SELECT vi.descricao_snapshot as nome, SUM(vi.quantidade) as qtd, SUM(vi.subtotal) as total
        FROM venda_itens vi
        JOIN vendas v ON vi.venda_id = v.id
        WHERE v.status='pago' AND vi.tipo='servico' AND strftime('%Y-%m', v.created_at) = ?
        GROUP BY vi.referencia_id
        ORDER BY qtd DESC
        LIMIT 5
      `, [mesAtual]);

      return {
        // Retrocompatibilidade
        agendamentosHoje: agRow?.count || 0,
        emAndamento: emRow?.count || 0,
        finalizados: fnRow?.count || 0,
        // Novos KPIs
        faturamentoDia: fatDia?.total || 0,
        vendasDia: fatDia?.count || 0,
        faturamentoMes: fatMes?.total || 0,
        vendasMes: fatMes?.count || 0,
        ticketMedio,
        atendimentosDia: atendDia?.count || 0,
        // Dados para gráficos
        vendasPorDia,
        formasPagamento,
        topProdutos,
        topServicos
      };
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
      return { agendamentosHoje: 0, emAndamento: 0, finalizados: 0, faturamentoDia: 0, vendasDia: 0, faturamentoMes: 0, vendasMes: 0, ticketMedio: 0, atendimentosDia: 0, vendasPorDia: [], formasPagamento: [], topProdutos: [], topServicos: [] };
    }
  });

  // ======= CLIENTES =======
  ipcMain.handle('db:clientes:getAll', async () => {
    const db = await getDatabase();
    return await db.all('SELECT * FROM clientes WHERE ativo = 1 ORDER BY nome ASC');
  });

  ipcMain.handle('db:clientes:getById', async (event, id) => {
    const db = await getDatabase();
    return await db.get('SELECT * FROM clientes WHERE id = ? AND ativo = 1', [id]);
  });

  ipcMain.handle('db:clientes:create', async (event, { nome, telefone, email, cpf, endereco, observacoes }) => {
    const db = await getDatabase();
    const result = await db.run(
      'INSERT INTO clientes (nome, telefone, email, cpf, endereco, observacoes) VALUES (?, ?, ?, ?, ?, ?)',
      [nome, telefone, email, cpf, endereco, observacoes]
    );
    return { success: true, id: result.lastID };
  });

  ipcMain.handle('db:clientes:update', async (event, { id, nome, telefone, email, cpf, endereco, observacoes }) => {
    const db = await getDatabase();
    await db.run(
      'UPDATE clientes SET nome=?, telefone=?, email=?, cpf=?, endereco=?, observacoes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [nome, telefone, email, cpf, endereco, observacoes, id]
    );
    return { success: true };
  });

  ipcMain.handle('db:clientes:delete', async (event, id) => {
    const db = await getDatabase();
    const linkedPets = await db.get('SELECT count(*) as count FROM pets WHERE cliente_id = ? AND ativo = 1', [id]);
    if (linkedPets && linkedPets.count > 0) {
      return { success: false, message: 'Não é possível excluir um cliente que possui pets ativos vinculados.' };
    }
    await db.run('UPDATE clientes SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    return { success: true };
  });

  // ======= PETS =======
  ipcMain.handle('db:pets:getAll', async () => {
    const db = await getDatabase();
    return await db.all(`
      SELECT pets.*, clientes.nome as cliente_nome
      FROM pets JOIN clientes ON pets.cliente_id = clientes.id
      WHERE pets.ativo = 1 AND clientes.ativo = 1 ORDER BY pets.nome ASC
    `);
  });

  ipcMain.handle('db:pets:listByCliente', async (event, cliente_id) => {
    const db = await getDatabase();
    return await db.all('SELECT * FROM pets WHERE cliente_id = ? AND ativo = 1 ORDER BY nome ASC', [cliente_id]);
  });

  ipcMain.handle('db:pets:getById', async (event, id) => {
    const db = await getDatabase();
    return await db.get('SELECT * FROM pets WHERE id = ? AND ativo = 1', [id]);
  });

  ipcMain.handle('db:pets:create', async (event, { cliente_id, nome, especie, raca, porte, sexo, data_nascimento, observacoes }) => {
    const db = await getDatabase();
    const result = await db.run(
      'INSERT INTO pets (cliente_id, nome, especie, raca, porte, sexo, data_nascimento, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [cliente_id, nome, especie, raca, porte, sexo, data_nascimento, observacoes]
    );
    return { success: true, id: result.lastID };
  });

  ipcMain.handle('db:pets:update', async (event, { id, cliente_id, nome, especie, raca, porte, sexo, data_nascimento, observacoes }) => {
    const db = await getDatabase();
    await db.run(
      'UPDATE pets SET cliente_id=?, nome=?, especie=?, raca=?, porte=?, sexo=?, data_nascimento=?, observacoes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [cliente_id, nome, especie, raca, porte, sexo, data_nascimento, observacoes, id]
    );
    return { success: true };
  });

  ipcMain.handle('db:pets:delete', async (event, id) => {
    const db = await getDatabase();
    const linkedAgendamentos = await db.get('SELECT count(*) as count FROM agendamentos WHERE pet_id = ? AND ativo = 1', [id]);
    if (linkedAgendamentos && linkedAgendamentos.count > 0) {
      return { success: false, message: 'Não é possível inativar o pet pois possui agendamentos no histórico.' };
    }
    await db.run('UPDATE pets SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    return { success: true };
  });

  // ======= FUNCIONÁRIOS =======
  ipcMain.handle('db:funcionarios:getAll', async () => {
    const db = await getDatabase();
    return await db.all('SELECT * FROM funcionarios WHERE ativo = 1 ORDER BY nome ASC');
  });

  ipcMain.handle('db:funcionarios:create', async (event, { nome, cor }) => {
    const db = await getDatabase();
    const result = await db.run('INSERT INTO funcionarios (nome, cor) VALUES (?, ?)', [nome, cor || '#8257E5']);
    return { success: true, id: result.lastID };
  });

  ipcMain.handle('db:funcionarios:update', async (event, { id, nome, cor }) => {
    const db = await getDatabase();
    await db.run('UPDATE funcionarios SET nome=?, cor=? WHERE id=?', [nome, cor || '#8257E5', id]);
    return { success: true };
  });

  ipcMain.handle('db:funcionarios:delete', async (event, id) => {
    const db = await getDatabase();
    await db.run('UPDATE funcionarios SET ativo = 0 WHERE id = ?', [id]);
    return { success: true };
  });

  // ======= AGENDA =======
  ipcMain.handle('db:agenda:getByDate', async (event, date) => {
    const db = await getDatabase();
    return await db.all(`
      SELECT a.*, p.nome as pet_nome, c.nome as cliente_nome, c.telefone as cliente_telefone,
             s.nome as servico_nome, s.duracao_minutos,
             f.nome as funcionario_nome, f.cor as funcionario_cor
      FROM agendamentos a
      JOIN pets p ON a.pet_id = p.id
      JOIN clientes c ON a.cliente_id = c.id
      JOIN servicos s ON a.servico_id = s.id
      LEFT JOIN funcionarios f ON a.funcionario_id = f.id
      WHERE a.data = ? AND a.ativo = 1
      ORDER BY a.hora ASC
    `, [date]);
  });

  ipcMain.handle('db:agenda:getByWeek', async (event, startDate) => {
    const db = await getDatabase();
    return await db.all(`
      SELECT a.*, p.nome as pet_nome, c.nome as cliente_nome, c.telefone as cliente_telefone,
             s.nome as servico_nome, s.duracao_minutos,
             f.nome as funcionario_nome, f.cor as funcionario_cor
      FROM agendamentos a
      JOIN pets p ON a.pet_id = p.id
      JOIN clientes c ON a.cliente_id = c.id
      JOIN servicos s ON a.servico_id = s.id
      LEFT JOIN funcionarios f ON a.funcionario_id = f.id
      WHERE a.data >= ? AND a.data <= DATE(?, '+6 days') AND a.ativo = 1
      ORDER BY a.data ASC, a.hora ASC
    `, [startDate, startDate]);
  });

  ipcMain.handle('db:agenda:create', async (event, { pet_id, cliente_id, servico_id, data, hora, observacoes, funcionario_id, duracao }) => {
    const db = await getDatabase();
    const conflict = await db.get('SELECT id FROM agendamentos WHERE data=? AND hora=? AND pet_id=? AND ativo=1 AND status NOT IN ("cancelado", "faltou")', [data, hora, pet_id]);
    if (conflict) return { success: false, message: 'Este pet já possui um agendamento neste mesmo horário e data!' };

    // BUG-09 FIX: verificar conflito de funcionário no mesmo horário
    if (funcionario_id) {
      const funcConflict = await db.get(
        'SELECT id FROM agendamentos WHERE data=? AND hora=? AND funcionario_id=? AND ativo=1 AND status NOT IN ("cancelado", "faltou")',
        [data, hora, funcionario_id]
      );
      if (funcConflict) return { success: false, message: 'Este funcionário já possui um agendamento neste horário!' };
    }

    const result = await db.run(
      'INSERT INTO agendamentos (pet_id, cliente_id, servico_id, data, hora, observacoes, funcionario_id, duracao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [pet_id, cliente_id, servico_id, data, hora, observacoes, funcionario_id || null, duracao || 30]
    );
    return { success: true, id: result.lastID };
  });

  ipcMain.handle('db:agenda:update', async (event, { id, pet_id, cliente_id, servico_id, data, hora, observacoes, funcionario_id, duracao }) => {
    const db = await getDatabase();
    await db.run(
      'UPDATE agendamentos SET pet_id=?, cliente_id=?, servico_id=?, data=?, hora=?, observacoes=?, funcionario_id=?, duracao=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [pet_id, cliente_id, servico_id, data, hora, observacoes, funcionario_id || null, duracao || 30, id]
    );
    return { success: true };
  });

  ipcMain.handle('db:agenda:updateStatus', async (event, { id, status }) => {
    // Only simple state.
    const db = await getDatabase();
    await db.run('UPDATE agendamentos SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [status, id]);
    return { success: true };
  });

  ipcMain.handle('db:agenda:delete', async (event, id) => {
    const db = await getDatabase();
    await db.run('UPDATE agendamentos SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    return { success: true };
  });

  // ======= SERVICOS =======
  ipcMain.handle('db:servicos:list', async () => {
    const db = await getDatabase();
    return await db.all('SELECT * FROM servicos ORDER BY nome ASC');
  });

  ipcMain.handle('db:servicos:getAll', async () => {
    // Retorna apenas ATIVOS para PDV e Agenda (alias getAtivos)
    const db = await getDatabase();
    return await db.all('SELECT * FROM servicos WHERE ativo = 1 ORDER BY nome ASC');
  });

  ipcMain.handle('db:servicos:getAtivos', async () => {
    const db = await getDatabase();
    return await db.all('SELECT * FROM servicos WHERE ativo = 1 ORDER BY nome ASC');
  });

  ipcMain.handle('db:servicos:getById', async (event, id) => {
    const db = await getDatabase();
    return await db.get('SELECT * FROM servicos WHERE id = ?', [id]);
  });

  ipcMain.handle('db:servicos:create', async (event, data) => {
    const db = await getDatabase();
    if (!data.nome) return { success: false, message: 'Nome é obrigatório.' };
    if (!data.preco_base || data.preco_base <= 0) return { success: false, message: 'O preço base deve ser estritamente maior que 0.' };

    const result = await db.run(
      `INSERT INTO servicos (
        nome, descricao, categoria, preco_base, 
        usa_preco_por_porte, preco_pequeno, preco_medio, preco_grande, 
        duracao_minutos, ativo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.nome, data.descricao || '', data.categoria || '', data.preco_base,
        data.usa_preco_por_porte ? 1 : 0, data.preco_pequeno || 0, data.preco_medio || 0, data.preco_grande || 0,
        data.duracao_minutos || 30, data.ativo !== undefined ? data.ativo : 1
      ]
    );
    return { success: true, id: result.lastID };
  });

  ipcMain.handle('db:servicos:update', async (event, data) => {
    const db = await getDatabase();
    if (!data.nome) return { success: false, message: 'Nome é obrigatório.' };
    if (!data.preco_base || data.preco_base <= 0) return { success: false, message: 'O preço base deve ser estritamente maior que 0.' };

    await db.run(
      `UPDATE servicos SET 
        nome=?, descricao=?, categoria=?, preco_base=?, 
        usa_preco_por_porte=?, preco_pequeno=?, preco_medio=?, preco_grande=?, 
        duracao_minutos=?, ativo=?, updated_at=CURRENT_TIMESTAMP 
      WHERE id=?`,
      [
        data.nome, data.descricao || '', data.categoria || '', data.preco_base,
        data.usa_preco_por_porte ? 1 : 0, data.preco_pequeno || 0, data.preco_medio || 0, data.preco_grande || 0,
        data.duracao_minutos || 30, data.ativo !== undefined ? data.ativo : 1, data.id
      ]
    );
    return { success: true };
  });

  ipcMain.handle('db:servicos:delete', async (event, id) => {
    const db = await getDatabase();
    // Soft Delete para manter o histórico íntegro
    await db.run('UPDATE servicos SET ativo=0, updated_at=CURRENT_TIMESTAMP WHERE id=?', [id]);
    return { success: true };
  });

  // ==========================================
  // ======= FASE 3: CAIXA, ATEND, PDV ========
  // ==========================================

  // ======= CAIXA =======
  ipcMain.handle('db:caixa:getAberto', async () => {
    const db = await getDatabase();
    return await db.get('SELECT * FROM caixa WHERE status = "aberto"');
  });

  ipcMain.handle('db:caixa:abrir', async (event, { usuario_id, valor_abertura }) => {
    const db = await getDatabase();
    const aberto = await db.get('SELECT * FROM caixa WHERE status = "aberto"');
    if (aberto) return { success: false, message: 'Já existe um caixa aberto.' };

    const result = await db.run(
      'INSERT INTO caixa (usuario_id, data, data_hora_abertura, valor_abertura, status) VALUES (?, date("now", "localtime"), datetime("now", "localtime"), ?, "aberto")',
      [usuario_id || 1, valor_abertura || 0]
    );

    return { success: true, id: result.lastID };
  });

  ipcMain.handle('db:caixa:fechar', async (event, { id, valor_fechamento_informado }) => {
    const db = await getDatabase();
    if (valor_fechamento_informado === undefined || valor_fechamento_informado === null || isNaN(valor_fechamento_informado)) {
      return { success: false, message: 'O valor informado de fechamento não pode ser nulo.' };
    }

    const entriesRow = await db.get("SELECT IFNULL(SUM(valor), 0) as ttl FROM movimentacoes_caixa WHERE caixa_id = ? AND tipo = 'entrada'", [id]);
    const exitsRow = await db.get("SELECT IFNULL(SUM(valor), 0) as ttl FROM movimentacoes_caixa WHERE caixa_id = ? AND tipo = 'saida'", [id]);
    const caixaInfo = await db.get("SELECT valor_abertura FROM caixa WHERE id = ?", [id]);

    const valor_sistema = (caixaInfo?.valor_abertura || 0) + entriesRow.ttl - exitsRow.ttl;
    const diferenca = valor_fechamento_informado - valor_sistema;

    await db.run(
      'UPDATE caixa SET data_hora_fechamento=datetime("now", "localtime"), status="fechado", valor_fechamento_informado=?, valor_sistema=?, diferenca=? WHERE id=?',
      [valor_fechamento_informado, valor_sistema, diferenca, id]
    );
    return { success: true };
  });

  ipcMain.handle('db:caixa:getMovimentacoes', async (event, caixa_id) => {
    const db = await getDatabase();
    return await db.all('SELECT * FROM movimentacoes_caixa WHERE caixa_id = ? ORDER BY id DESC', [caixa_id]);
  });

  ipcMain.handle('db:caixa:addMovimentacao', async (event, { caixa_id, tipo, valor, descricao, referencia_id }) => {
    const db = await getDatabase();
    const result = await db.run('INSERT INTO movimentacoes_caixa (caixa_id, tipo, valor, descricao, referencia_id) VALUES (?, ?, ?, ?, ?)', [caixa_id, tipo, valor, descricao, referencia_id]);
    return { success: true, id: result.lastID };
  });

  // ======= ATENDIMENTOS =======
  ipcMain.handle('db:atendimentos:getByAgendamento', async (event, agendamento_id) => {
    const db = await getDatabase();
    return await db.get('SELECT * FROM atendimentos WHERE agendamento_id = ? ORDER BY id DESC LIMIT 1', [agendamento_id]);
  });

  ipcMain.handle('db:atendimentos:getList', async () => {
    // Gets open atendimentos for the day overview or queued from Agenda
    const db = await getDatabase();
    return await db.all(`
      SELECT att.*, a.hora, c.nome as cliente_nome, p.nome as pet_nome, s.nome as servico_nome, s.preco_base
      FROM atendimentos att
      LEFT JOIN agendamentos a ON att.agendamento_id = a.id
      LEFT JOIN clientes c ON att.cliente_id = c.id
      LEFT JOIN pets p ON att.pet_id = p.id
      LEFT JOIN servicos s ON att.servico_id = s.id
      ORDER BY att.id DESC
    `);
  });

  ipcMain.handle('db:atendimentos:create', async (event, { agendamento_id, cliente_id, pet_id, servico_id, observacoes }) => {
    const db = await getDatabase();
    const result = await db.run(
      'INSERT INTO atendimentos (agendamento_id, cliente_id, pet_id, servico_id, observacoes, status) VALUES (?, ?, ?, ?, ?, "aguardando")',
      [agendamento_id, cliente_id, pet_id, servico_id, observacoes]
    );
    return { success: true, id: result.lastID };
  });

  ipcMain.handle('db:atendimentos:start', async (event, id) => {
    const db = await getDatabase();
    const atendimento = await db.get('SELECT * FROM atendimentos WHERE id=?', [id]);
    if (!atendimento) return { success: false, message: 'Agendamento/Atendimento não encontrado!' };

    // Validating block (only start if "agendado" logically, but here it has standard mapping "aguardando")
    const agendamento = await db.get('SELECT status FROM agendamentos WHERE id=?', [atendimento.agendamento_id]);
    if (agendamento && agendamento.status !== 'agendado') {
      return { success: false, message: 'O agendamento não consta como "agendado". Não é possível iniciar 2x ou iniciar finalizado.' };
    }

    await db.run('UPDATE atendimentos SET status="em_atendimento", data_inicio=datetime("now", "localtime"), updated_at=CURRENT_TIMESTAMP WHERE id=?', [id]);
    // BUG #11 FIX: só atualiza agendamento se tiver vínculo (walk-ins não têm)
    if (atendimento.agendamento_id) {
      await db.run('UPDATE agendamentos SET status="em_atendimento", updated_at=CURRENT_TIMESTAMP WHERE id=?', [atendimento.agendamento_id]);
    }
    return { success: true };
  });

  ipcMain.handle('db:atendimentos:finish', async (event, id) => {
    const db = await getDatabase();
    const atendimento = await db.get('SELECT * FROM atendimentos WHERE id=?', [id]);
    if (atendimento.status !== 'em_atendimento') return { success: false, message: 'Apenas atendimentos em andamento podem ser finalizados.' };

    await db.run('UPDATE atendimentos SET status="aguardando_pagamento", data_fim=datetime("now", "localtime"), updated_at=CURRENT_TIMESTAMP WHERE id=?', [id]);
    // BUG #11 FIX: só atualiza agendamento se tiver vínculo (walk-ins não têm)
    if (atendimento.agendamento_id) {
      await db.run('UPDATE agendamentos SET status="finalizado", updated_at=CURRENT_TIMESTAMP WHERE id=?', [atendimento.agendamento_id]);
    }
    return { success: true };
  });

  // ======= VENDAS =======
  ipcMain.handle('db:vendas:getById', async (event, id) => {
    const db = await getDatabase();
    const venda = await db.get(`
      SELECT v.*, c.nome as cliente_nome, p.nome as pet_nome 
      FROM vendas v 
      LEFT JOIN clientes c ON v.cliente_id=c.id 
      LEFT JOIN pets p ON v.pet_id=p.id 
      WHERE v.id = ?`, [id]);
    if (!venda) return null;
    venda.itens = await db.all('SELECT * FROM venda_itens WHERE venda_id = ?', [id]);
    return venda;
  });

  ipcMain.handle('db:vendas:create', async (event, { cliente_id, pet_id, atendimento_id }) => {
    const db = await getDatabase();
    if (!cliente_id || !pet_id || !atendimento_id) return { success: false, message: 'cliente, pet e atendimento são propriedades estritamente obrigatórias para abrir venda.' };

    // BUG #7 FIX: respeitar configuração exigir_abertura_caixa
    const cfgCaixa = await db.get('SELECT exigir_abertura_caixa FROM config_caixa_financeiro WHERE id=1');
    const exigirCaixa = !cfgCaixa || cfgCaixa.exigir_abertura_caixa !== 0; // padrão: exige

    const caixaAberto = await db.get('SELECT id FROM caixa WHERE status="aberto"');
    if (exigirCaixa && !caixaAberto) {
      return { success: false, message: 'Não é possível abrir faturamento: O Caixa está Fechado.' };
    }

    const result = await db.run(
      'INSERT INTO vendas (cliente_id, pet_id, atendimento_id, caixa_id, subtotal, desconto, valor_total, status) VALUES (?, ?, ?, ?, 0, 0, 0, "pendente")',
      [cliente_id, pet_id, atendimento_id, caixaAberto ? caixaAberto.id : null]
    );
    return { success: true, id: result.lastID };
  });

  ipcMain.handle('db:vendas:addItem', async (event, { venda_id, tipo, referencia_id, descricao_snapshot, quantidade, valor_unitario }) => {
    if (quantidade <= 0) return { success: false, message: 'A Quantidade estipulada deve ser maior que ZERO.' };
    const db = await getDatabase();

    // ESTOQUE VALIDATION ON ADD
    if (tipo === 'produto') {
      const prod = await db.get('SELECT estoque, ativo FROM produtos WHERE id = ?', [referencia_id]);
      if (!prod || prod.ativo === 0) return { success: false, message: 'Produto não existe ou está inativo (bloqueado para venda).' };

      // Check if product is already in the cart to avoid duplication and sum up their intent
      const checkCart = await db.get('SELECT id, quantidade FROM venda_itens WHERE venda_id = ? AND tipo = "produto" AND referencia_id = ?', [venda_id, referencia_id]);
      const futureTotalQty = checkCart ? (checkCart.quantidade + quantidade) : quantidade;

      if (futureTotalQty > prod.estoque) {
        return { success: false, message: `O estoque do produto "${descricao_snapshot}" é insuficiente. Saldo atual: ${prod.estoque} | Tentativa: ${futureTotalQty}` };
      }

      if (checkCart) {
        // Update instead of Insert
        const nSub = futureTotalQty * valor_unitario;
        await db.run('UPDATE venda_itens SET quantidade = ?, subtotal = ? WHERE id = ?', [futureTotalQty, nSub, checkCart.id]);
        await db.run('UPDATE vendas SET subtotal = (SELECT IFNULL(SUM(subtotal), 0) FROM venda_itens WHERE venda_id=?), valor_total = ((SELECT IFNULL(SUM(subtotal), 0) FROM venda_itens WHERE venda_id=?) - desconto) WHERE id=?', [venda_id, venda_id, venda_id]);
        return { success: true };
      }
    }

    const sub = quantidade * valor_unitario;
    await db.run(
      'INSERT INTO venda_itens (venda_id, tipo, referencia_id, descricao_snapshot, quantidade, valor_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [venda_id, tipo, referencia_id, descricao_snapshot, quantidade, valor_unitario, sub]
    );
    await db.run('UPDATE vendas SET subtotal = (SELECT IFNULL(SUM(subtotal), 0) FROM venda_itens WHERE venda_id=?), valor_total = ((SELECT IFNULL(SUM(subtotal), 0) FROM venda_itens WHERE venda_id=?) - desconto) WHERE id=?', [venda_id, venda_id, venda_id]);
    return { success: true };
  });

  ipcMain.handle('db:vendas:removeItem', async (event, id) => {
    const db = await getDatabase();
    const item = await db.get('SELECT venda_id FROM venda_itens WHERE id=?', [id]);
    if (!item) return { success: false };
    await db.run('DELETE FROM venda_itens WHERE id=?', [id]);
    await db.run('UPDATE vendas SET subtotal = (SELECT IFNULL(SUM(subtotal), 0) FROM venda_itens WHERE venda_id=?), valor_total = ((SELECT IFNULL(SUM(subtotal), 0) FROM venda_itens WHERE venda_id=?) - desconto) WHERE id=?', [item.venda_id, item.venda_id, item.venda_id]);
    return { success: true };
  });

  // Alterar qtde direto da cartilha se necessario (PDV improvement)
  ipcMain.handle('db:vendas:updateItemQty', async (event, { item_id, quantidade }) => {
    if (quantidade <= 0) return { success: false, message: 'A quantidade precisa ser maior que 0.' };
    const db = await getDatabase();
    const item = await db.get('SELECT * FROM venda_itens WHERE id = ?', [item_id]);
    if (!item) return { success: false, message: 'Item abortado' };

    if (item.tipo === 'produto') {
      const prod = await db.get('SELECT estoque FROM produtos WHERE id = ?', [item.referencia_id]);
      if (quantidade > prod.estoque) return { success: false, message: `Estoque insuficiente do item. Físico Máximo Disponível: ${prod.estoque}` };
    }

    const nSub = quantidade * item.valor_unitario;
    await db.run('UPDATE venda_itens SET quantidade = ?, subtotal = ? WHERE id = ?', [quantidade, nSub, item_id]);
    await db.run('UPDATE vendas SET subtotal = (SELECT IFNULL(SUM(subtotal), 0) FROM venda_itens WHERE venda_id=?), valor_total = ((SELECT IFNULL(SUM(subtotal), 0) FROM venda_itens WHERE venda_id=?) - desconto) WHERE id=?', [item.venda_id, item.venda_id, item.venda_id]);
    return { success: true };
  });

  ipcMain.handle('db:vendas:finalizar', async (event, { id, forma_pagamento, forma_pagamento_detalhe, desconto, valor_recebido, troco }) => {
    const db = await getDatabase();
    const cx = await db.get('SELECT id FROM caixa WHERE status="aberto"');
    if (!cx) return { success: false, message: 'Erro: O Caixa Encontra-se Fechado.' };

    const checkItens = await db.all('SELECT * FROM venda_itens WHERE venda_id = ?', [id]);
    if (checkItens.length === 0) return { success: false, message: 'Bloqueio de sistema: Não existe nenhum item atrelado para concluir a venda!' };
    if (!forma_pagamento) return { success: false, message: 'Obrigatoriedade pendente: Selecione a forma de pagamento (Pix, Dinheiro ou Cartão).' };

    // STRICT CHECKOUT VALIDATION (PRE-CHECK)
    for (const item of checkItens) {
      if (item.tipo === 'produto') {
        const prod = await db.get('SELECT estoque, id, nome, ativo FROM produtos WHERE id = ?', [item.referencia_id]);
        if (!prod || prod.ativo === 0) return { success: false, message: `Produto Inválido/Inativo encontrado no carrinho -> RefID: ${item.referencia_id}` };
        if (item.quantidade > prod.estoque) {
          return { success: false, message: `BLINDAGEM DE ESTOQUE ATIVADA: Operação Abortada devio ao produto [${prod.nome}] não possuir Saldo Físico! Requisições: ${item.quantidade} / Disp: ${prod.estoque}` };
        }
      }
    }

    await db.exec('BEGIN IMMEDIATE TRANSACTION');
    try {
      // CHECKOUT PROCESS (ESTOQUE)
      // Decreasing inventory
      for (const item of checkItens) {
        if (item.tipo === 'produto') {
          // Subtraindo
          await db.run('UPDATE produtos SET estoque = estoque - ? WHERE id = ?', [item.quantidade, item.referencia_id]);
          // Gerar Ledger de Movimentação Logistica (auditing)
          await db.run(
            'INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, motivo, referencia_id) VALUES (?, "saida", ?, "venda", ?)',
            [item.referencia_id, item.quantidade, id]
          );
        }
      }

      const desc = desconto ? parseFloat(desconto) : 0;
      const sub = await db.get('SELECT IFNULL(SUM(subtotal), 0) as s FROM venda_itens WHERE venda_id = ?', [id]);
      const total = sub.s - desc;

      await db.run(
        'UPDATE vendas SET desconto=?, valor_total=?, forma_pagamento=?, forma_pagamento_detalhe=?, status="pago", valor_recebido=?, troco=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
        [desc, total, forma_pagamento, forma_pagamento_detalhe || forma_pagamento, valor_recebido || null, troco || null, id]
      );

      // Entrada caixa cascaded
      await db.run('INSERT INTO movimentacoes_caixa (caixa_id, tipo, valor, descricao, referencia_id) VALUES (?, "entrada", ?, ?, ?)',
        [cx.id, total, `Venda Faturada #${id} - Pay: ${forma_pagamento}`, id]);

      // O status do atendimento vinculado vira "faturado".
      const vda = await db.get('SELECT atendimento_id FROM vendas WHERE id=?', [id]);
      if (vda && vda.atendimento_id) {
        await db.run('UPDATE atendimentos SET status="faturado" WHERE id=?', [vda.atendimento_id]);
        
        // Sincronizar com a agenda (Fila e Consultório)
        const attInfo = await db.get('SELECT agendamento_id FROM atendimentos WHERE id=?', [vda.atendimento_id]);
        if (attInfo && attInfo.agendamento_id) {
           await db.run('UPDATE agendamentos SET status="faturado", updated_at=CURRENT_TIMESTAMP WHERE id=?', [attInfo.agendamento_id]);
        }
      }

      await db.exec('COMMIT');
      return { success: true };
    } catch (error) {
      await db.exec('ROLLBACK');
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:vendas:cancelar', async (event, id) => {
    const db = await getDatabase();
    const venda = await db.get('SELECT status FROM vendas WHERE id = ?', [id]);
    await db.exec('BEGIN IMMEDIATE TRANSACTION');
    try {

      // BUG-08 FIX: se a venda já foi paga, reverter o estoque dos produtos
      if (venda && venda.status === 'pago') {
        const itens = await db.all('SELECT * FROM venda_itens WHERE venda_id = ? AND tipo = "produto"', [id]);
        for (const item of itens) {
          await db.run('UPDATE produtos SET estoque = estoque + ? WHERE id = ?', [item.quantidade, item.referencia_id]);
          await db.run(
            'INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, motivo, referencia_id) VALUES (?, "entrada", ?, "cancelamento de venda", ?)',
            [item.referencia_id, item.quantidade, id]
          );
        }
      }

      await db.run('UPDATE vendas SET status="cancelado", updated_at=CURRENT_TIMESTAMP WHERE id=?', [id]);
      await db.exec('COMMIT');
      return { success: true };
    } catch (error) {
      await db.exec('ROLLBACK');
      return { success: false, message: error.message };
    }
  });

  // ==========================================
  // ======= PRODUTOS E ESTOQUE (FASE 5) ======
  // ==========================================

  // ======= PRODUTOS =======
  ipcMain.handle('db:produtos:list', async () => {
    const db = await getDatabase();
    // Return all (including inativos optionally by frontend filtration or here filtering)
    // The prompt says "Lista de produtos com estoque", let's return all. 
    return await db.all('SELECT * FROM produtos ORDER BY nome ASC');
  });

  ipcMain.handle('db:produtos:getById', async (event, id) => {
    const db = await getDatabase();
    return await db.get('SELECT * FROM produtos WHERE id = ?', [id]);
  });

  ipcMain.handle('db:produtos:create', async (event, data) => {
    const db = await getDatabase();
    if (!data.nome) return { success: false, message: 'Bloqueio: Nome do produto é obrigatório.' };
    if (!data.preco || data.preco <= 0) return { success: false, message: 'Bloqueio: O Preço deve ser estritamente maior que 0.' };

    const result = await db.run(`
      INSERT INTO produtos (nome, codigo_barras, categoria, fornecedor, custo, preco, estoque, estoque_minimo, ncm, cfop, cst_csosn, unidade_comercial, vendido_por_peso, unidade_medida) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [data.nome, data.codigo_barras || '', data.categoria || '', data.fornecedor || '', data.custo || 0, data.preco, data.estoque || 0, data.estoque_minimo || 0, data.ncm || '', data.cfop || '', data.cst_csosn || '', data.unidade_comercial || '', data.vendido_por_peso ? 1 : 0, data.unidade_medida || (data.vendido_por_peso ? 'kg' : 'un')]);

    // Inject initial positive discrepancy tracking logic if created with stock > 0
    if (data.estoque && data.estoque > 0) {
      await db.run('INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, motivo) VALUES (?, "entrada", ?, "cadastro inicial")', [result.lastID, data.estoque]);
    }

    return { success: true, id: result.lastID };
  });

  ipcMain.handle('db:produtos:update', async (event, data) => {
    const db = await getDatabase();
    if (!data.nome) return { success: false, message: 'Bloqueio: Nome do produto é obrigatório.' };
    if (!data.preco || data.preco <= 0) return { success: false, message: 'Bloqueio: O Preço deve ser estritamente maior que 0.' };

    await db.run(`
      UPDATE produtos SET 
      nome=?, codigo_barras=?, categoria=?, fornecedor=?, custo=?, preco=?, estoque_minimo=?, ativo=?, ncm=?, cfop=?, cst_csosn=?, unidade_comercial=?, vendido_por_peso=?, unidade_medida=?, updated_at=CURRENT_TIMESTAMP 
      WHERE id=?
    `, [data.nome, data.codigo_barras || '', data.categoria || '', data.fornecedor || '', data.custo || 0, data.preco, data.estoque_minimo || 0, data.ativo !== undefined ? data.ativo : 1, data.ncm || '', data.cfop || '', data.cst_csosn || '', data.unidade_comercial || '', data.vendido_por_peso ? 1 : 0, data.unidade_medida || (data.vendido_por_peso ? 'kg' : 'un'), data.id]);
    return { success: true };
  });

  ipcMain.handle('db:produtos:delete', async (event, id) => {
    const db = await getDatabase();
    // Soft Delete (Inativação para perder vínculo de frente de loja e continuar os dados históricos limpos em relatórios)
    await db.run('UPDATE produtos SET ativo = 0, updated_at=CURRENT_TIMESTAMP WHERE id = ?', [id]);
    return { success: true };
  });

  // ======= ESTOQUE LOGISTICA =======
  ipcMain.handle('db:estoque:entrada', async (event, { produto_id, quantidade, motivo }) => {
    if (quantidade <= 0) return { success: false, message: 'Entrada exige valor líquido > 0.' };
    const db = await getDatabase();

    await db.run('UPDATE produtos SET estoque = estoque + ?, updated_at=CURRENT_TIMESTAMP WHERE id = ?', [quantidade, produto_id]);
    await db.run('INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, motivo) VALUES (?, "entrada", ?, ?)', [produto_id, quantidade, motivo || 'entrada manual']);
    return { success: true };
  });

  ipcMain.handle('db:estoque:saida', async (event, { produto_id, quantidade, motivo }) => {
    if (quantidade <= 0) return { success: false, message: 'Saída manual exige valor líquido > 0.' };
    const db = await getDatabase();
    const prod = await db.get('SELECT estoque, nome FROM produtos WHERE id = ?', [produto_id]);
    if (quantidade > prod.estoque) return { success: false, message: `Saldo insuficiente para avaria/quebra de [${prod.nome}]` };

    await db.run('UPDATE produtos SET estoque = estoque - ?, updated_at=CURRENT_TIMESTAMP WHERE id = ?', [quantidade, produto_id]);
    await db.run('INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, motivo) VALUES (?, "saida", ?, ?)', [produto_id, quantidade, motivo || 'saida manual - quebra/validade']);
    return { success: true };
  });

  ipcMain.handle('db:estoque:ajuste', async (event, { produto_id, quantidade, motivo }) => {
    // Quantidade here works as absolute set point
    if (quantidade < 0) return { success: false, message: 'O Ajuste Cego / Saldo Virtual Total não pode cair abaixo de 0.' };
    const db = await getDatabase();

    const curr = await db.get('SELECT estoque FROM produtos WHERE id = ?', [produto_id]);
    const dif = quantidade - curr.estoque;

    if (dif === 0) return { success: false, message: 'Valor contábil inalterado.' };

    // BUG #10 FIX: registrar delta (diferença) e não a quantidade absoluta
    const deltaAbs = Math.abs(dif);
    await db.run('UPDATE produtos SET estoque = ?, updated_at=CURRENT_TIMESTAMP WHERE id = ?', [quantidade, produto_id]);
    await db.run('INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, motivo) VALUES (?, "ajuste", ?, ?)', [produto_id, deltaAbs, motivo || 'balanço contábil cego']);

    return { success: true };
  });

  ipcMain.handle('db:estoque:listMovimentacoes', async (event, produto_id) => {
    const db = await getDatabase();
    return await db.all('SELECT * FROM movimentacoes_estoque WHERE produto_id = ? ORDER BY id DESC LIMIT 50', [produto_id]);
  });

  // ======= SYSTEM =======
  // ... (Removed backup function implementation view inside to save space, but keeping it standard block)
  ipcMain.handle('system:db:backup', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'petshop.db');

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Exportar Backup',
        defaultPath: path.join(app.getPath('documents'), `petshop_backup_${Date.now()}.db`),
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
      });

      if (!canceled && filePath) {
        fs.copyFileSync(dbPath, filePath);
        return { success: true, filePath };
      }
      return { success: false, message: 'Cancelado.' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('system:print:receipt', async (event, args) => {
    try {
      const htmlContent = typeof args === 'object' ? args.htmlContent : args;
      const silent = typeof args === 'object' && args.silent !== undefined ? args.silent : false;

      let printWindow = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      });

      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
      await printWindow.loadURL(dataUrl);

      return new Promise((resolve) => {
        printWindow.webContents.on('did-finish-load', () => {
          printWindow.webContents.print({ silent: silent, printBackground: true, margins: { marginType: 'printableArea' } }, (success, errorType) => {
            if (printWindow && !printWindow.isDestroyed()) {
              printWindow.close();
            }
            if (success) {
              resolve({ success: true });
            } else {
              resolve({ success: false, error: errorType || 'Cancelado ou Falha na impressão' });
            }
          });
        });
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ======= CONFIGURAÇÕES =======

  ipcMain.handle('config:impressao:get', async () => {
    const db = await getDatabase();
    let config = await db.get('SELECT * FROM config_impressao WHERE id = 1');
    if (!config) {
      await db.run(`INSERT INTO config_impressao (id, largura_bobina, imprimir_automatico, exibir_dialogo_impressao, imprimir_danfe_automatico, vias_cupom, mensagem_rodape) VALUES (1, 80, 1, 1, 0, 1, 'Obrigado pela preferência!')`);
      config = await db.get('SELECT * FROM config_impressao WHERE id = 1');
    }
    return config;
  });

  ipcMain.handle('config:impressao:save', async (event, data) => {
    try {
      const db = await getDatabase();
      await db.run(`
        UPDATE config_impressao 
        SET largura_bobina = ?, imprimir_automatico = ?, exibir_dialogo_impressao = ?, imprimir_danfe_automatico = ?, vias_cupom = ?, mensagem_rodape = ?, nome_impressora = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `, [data.largura_bobina, data.imprimir_automatico ? 1 : 0, data.exibir_dialogo_impressao ? 1 : 0, data.imprimir_danfe_automatico ? 1 : 0, data.vias_cupom, data.mensagem_rodape || '', data.nome_impressora || null]);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // ======= CONFIGURAÇÕES: BACKUP =======

  ipcMain.handle('backup:getConfig', async () => {
    return await backupService.getConfigBackup();
  });

  ipcMain.handle('backup:saveConfig', async (event, data) => {
    return await backupService.saveConfigBackup(data);
  });

  ipcMain.handle('backup:executar', async () => {
    return await backupService.realizarBackupManual();
  });

  ipcMain.handle('backup:listarArquivos', async () => {
    return await backupService.listarArquivosBackup();
  });

  ipcMain.handle('backup:restaurar', async (event, caminhoArquivo) => {
    return await backupService.restaurarBackup(caminhoArquivo);
  });

  ipcMain.handle('dialog:selectDirectory', async () => {
    const window = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
      buttonLabel: 'Selecionar Pasta de Backup'
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('db:config:getEmpresa', async () => {
    const db = await getDatabase();
    let emp = await db.get('SELECT * FROM config_empresa ORDER BY id DESC LIMIT 1');
    if (!emp) {
      await db.run('INSERT INTO config_empresa (nome_fantasia) VALUES (?)', ['']);
      emp = await db.get('SELECT * FROM config_empresa ORDER BY id DESC LIMIT 1');
    }
    return emp;
  });

  ipcMain.handle('db:config:saveEmpresa', async (event, data) => {
    try {
      const db = await getDatabase();
      await db.run(`
        UPDATE config_empresa 
        SET nome_fantasia = ?, razao_social = ?, cnpj = ?, telefone = ?, email = ?, endereco = ?, cidade = ?, uf = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [data.nome_fantasia, data.razao_social, data.cnpj, data.telefone, data.email, data.endereco, data.cidade, data.uf, data.id]);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:config:getPDV', async () => {
    const db = await getDatabase();
    let cfg = await db.get('SELECT * FROM config_pdv ORDER BY id DESC LIMIT 1');
    if (!cfg) {
      await db.run('INSERT INTO config_pdv (permitir_venda_sem_cliente, abrir_nova_venda_auto, confirmar_cancelamento) VALUES (1, 0, 1)');
      cfg = await db.get('SELECT * FROM config_pdv ORDER BY id DESC LIMIT 1');
    }
    return cfg;
  });

  ipcMain.handle('db:config:savePDV', async (event, data) => {
    try {
      const db = await getDatabase();
      await db.run(`
        UPDATE config_pdv 
        SET permitir_venda_sem_cliente = ?, cliente_padrao = ?, abrir_nova_venda_auto = ?, confirmar_cancelamento = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [data.permitir_venda_sem_cliente ? 1 : 0, data.cliente_padrao || '', data.abrir_nova_venda_auto ? 1 : 0, data.confirmar_cancelamento ? 1 : 0, data.id]);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('config:empresa:get', async () => {
    const db = await getDatabase();
    let emp = await db.get('SELECT * FROM config_empresa ORDER BY id DESC LIMIT 1');
    if (!emp) {
      await db.run('INSERT INTO config_empresa (nome_fantasia) VALUES (?)', ['']);
      emp = await db.get('SELECT * FROM config_empresa ORDER BY id DESC LIMIT 1');
    }
    return emp;
  });

  ipcMain.handle('config:empresa:save', async (event, data) => {
    try {
      const db = await getDatabase();
      await db.run(`
        UPDATE config_empresa 
        SET nome_fantasia = ?, razao_social = ?, cnpj = ?, telefone = ?, email = ?, endereco = ?, cidade = ?, uf = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [data.nome_fantasia, data.razao_social, data.cnpj, data.telefone, data.email, data.endereco, data.cidade, data.uf, data.id]);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('config:pdv:get', async () => {
    const db = await getDatabase();
    let cfg = await db.get('SELECT * FROM config_pdv ORDER BY id DESC LIMIT 1');
    if (!cfg) {
      await db.run('INSERT INTO config_pdv (permitir_venda_sem_cliente, abrir_nova_venda_auto, confirmar_cancelamento) VALUES (1, 0, 1)');
      cfg = await db.get('SELECT * FROM config_pdv ORDER BY id DESC LIMIT 1');
    }
    return cfg;
  });

  ipcMain.handle('config:pdv:save', async (event, data) => {
    try {
      const db = await getDatabase();
      await db.run(`
        UPDATE config_pdv 
        SET permitir_venda_sem_cliente = ?, cliente_padrao = ?, abrir_nova_venda_auto = ?, confirmar_cancelamento = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [data.permitir_venda_sem_cliente ? 1 : 0, data.cliente_padrao || '', data.abrir_nova_venda_auto ? 1 : 0, data.confirmar_cancelamento ? 1 : 0, data.id]);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('config:fiscal:get', async () => {
    const db = await getDatabase();
    return await ensureConfigFiscal(db);
  });

  ipcMain.handle('config:fiscal:save', async (event, data) => {
    try {
      const db = await getDatabase();
      const cfg = await ensureConfigFiscal(db);
      await db.run(`
        UPDATE config_fiscal SET
          ambiente=?, cnpj=?, ie=?, razao_social=?, nome_fantasia=?, crt=?, csc=?, csc_id=?,
          serie_nfce=?, proximo_numero_nfce=?, uf=?, cidade=?, habilitado=?,
          api_provider=?, api_token=?, api_url=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `, [
        data.ambiente || 'homologacao', data.cnpj || '', data.ie || '', data.razao_social || '',
        data.nome_fantasia || '', data.crt || '', data.csc || '', data.csc_id || '',
        data.serie_nfce || 1, data.proximo_numero_nfce || 1, data.uf || '', data.cidade || '',
        data.habilitado ? 1 : 0,
        data.api_provider || 'focus', data.api_token || '', data.api_url || '',
        data.id || cfg.id
      ]);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // ========= FISCAL (NFC-e) =================
  // ==========================================

  ipcMain.handle('fiscal:getConfig', async () => {
    const db = await getDatabase();
    return await ensureConfigFiscal(db);
  });

  ipcMain.handle('fiscal:saveConfig', async (event, data) => {
    try {
      const db = await getDatabase();
      const cfg = await ensureConfigFiscal(db);
      await db.run(`
        UPDATE config_fiscal SET
          ambiente=?, cnpj=?, ie=?, razao_social=?, nome_fantasia=?, crt=?, csc=?, csc_id=?,
          serie_nfce=?, proximo_numero_nfce=?, uf=?, cidade=?, habilitado=?,
          api_provider=?, api_token=?, api_url=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `, [
        data.ambiente || 'homologacao', data.cnpj || '', data.ie || '', data.razao_social || '',
        data.nome_fantasia || '', data.crt || '', data.csc || '', data.csc_id || '',
        data.serie_nfce || 1, data.proximo_numero_nfce || 1, data.uf || '', data.cidade || '',
        data.habilitado ? 1 : 0,
        data.api_provider || 'focus', data.api_token || '', data.api_url || '',
        data.id || cfg.id
      ]);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fiscal:emitirHomologacao', async (event, vendaId) => {
    return await fiscalService.emitirNfce(vendaId);
  });

  ipcMain.handle('fiscal:getStatusByVenda', async (event, vendaId) => {
    return await fiscalService.getStatusByVenda(vendaId);
  });

  ipcMain.handle('fiscal:validarVenda', async (event, vendaId) => {
    const cfgResult = await fiscalService.validateFiscalConfig();
    if (!cfgResult.valid) return { success: false, errors: cfgResult.errors };
    const vendaResult = await fiscalService.validateVendaForFiscal(vendaId);
    return { success: vendaResult.valid, errors: vendaResult.errors };
  });

  ipcMain.handle('fiscal:getPayloadPreview', async (event, vendaId) => {
    return await fiscalService.getPayloadPreview(vendaId);
  });

  ipcMain.handle('fiscal:consultarNfce', async (event, referencia) => {
    try {
      const db = await getDatabase();
      const cfg = await ensureConfigFiscal(db);
      if (!cfg || !cfg.api_token) return { success: false, error: 'Configuração fiscal ou token não encontrado.' };

      const { getNfceStatus } = require('./fiscal/focusApi');
      const result = await getNfceStatus(cfg, referencia);
      return { success: true, data: result.data, httpStatus: result.httpStatus };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fiscal:getPendentes', async () => {
    return await fiscalService.getPendentesReenvio();
  });

  ipcMain.handle('fiscal:reprocessarPendentes', async () => {
    return await fiscalService.processarFilaReenvio();
  });

  ipcMain.handle('fiscal:reenviarUnico', async (event, fiscalVendaId) => {
    return await fiscalService.reenviarUnico(fiscalVendaId);
  });

  ipcMain.handle('fiscal:getDetalheByVenda', async (event, vendaId) => {
    return await fiscalService.getDetalheByVenda(vendaId);
  });

  ipcMain.handle('fiscal:gerarDanfeHtml', async (event, vendaId) => {
    return await fiscalService.gerarDanfeHtml(vendaId);
  });

  ipcMain.handle('fiscal:printDanfe', async (event, args) => {
    try {
      const vendaId = typeof args === 'object' ? args.vendaId : args;
      const silent = typeof args === 'object' && args.silent !== undefined ? args.silent : false;

      const result = await fiscalService.gerarDanfeHtml(vendaId);
      if (!result.success) return result;

      let printWindow = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      });

      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(result.html);
      await printWindow.loadURL(dataUrl);

      return new Promise((resolve) => {
        printWindow.webContents.on('did-finish-load', () => {
          printWindow.webContents.print({ silent: silent, printBackground: true, margins: { marginType: 'printableArea' } }, (success, errorType) => {
            if (printWindow && !printWindow.isDestroyed()) {
              printWindow.close();
            }
            if (success) {
              resolve({ success: true });
            } else {
              resolve({ success: false, error: errorType || 'Cancelado ou Falha na impressão do DANFE' });
            }
          });
        });
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // ======== HARDWARE E BALANÇA ==============
  // ==========================================

  // HARDWARE (GAVETA)
  ipcMain.handle('config:hardware:get', async () => {
    const db = await getDatabase();
    return await db.get('SELECT * FROM config_hardware WHERE id = 1');
  });

  ipcMain.handle('config:hardware:save', async (event, data) => {
    const db = await getDatabase();
    const modoGaveta = data.modo_gaveta === 'serial' ? 'impressora' : (data.modo_gaveta || 'impressora');
    await db.run(
      'UPDATE config_hardware SET usar_gaveta=?, modo_gaveta=?, nome_impressora=?, updated_at=CURRENT_TIMESTAMP WHERE id=1',
      [data.usar_gaveta ? 1 : 0, modoGaveta, data.nome_impressora]
    );
    return { success: true };
  });

  // ==========================================
  // CONFIG : CAIXA E FINANCEIRO
  // ==========================================
  ipcMain.handle('config:caixaFinanceiro:get', async () => {
    const db = await getDatabase();
    const config = await db.get('SELECT * FROM config_caixa_financeiro WHERE id=1');
    return config || {};
  });

  ipcMain.handle('config:caixaFinanceiro:save', async (event, data) => {
    const db = await getDatabase();
    await db.run(
      `UPDATE config_caixa_financeiro SET 
        exigir_abertura_caixa=?, apenas_um_caixa_aberto=?, confirmar_fechamento_caixa=?, 
        permitir_sangria=?, permitir_suprimento=?, desconto_maximo_percentual=?, 
        exigir_obs_sangria=?, exigir_obs_ajuste=?, pagto_dinheiro_ativo=?, 
        pagto_pix_ativo=?, pagto_credito_ativo=?, pagto_debito_ativo=?, 
        updated_at=CURRENT_TIMESTAMP WHERE id=1`,
      [
        data.exigir_abertura_caixa ? 1 : 0, data.apenas_um_caixa_aberto ? 1 : 0,
        data.confirmar_fechamento_caixa ? 1 : 0, data.permitir_sangria ? 1 : 0,
        data.permitir_suprimento ? 1 : 0, data.desconto_maximo_percentual || 10,
        data.exigir_obs_sangria ? 1 : 0, data.exigir_obs_ajuste ? 1 : 0,
        data.pagto_dinheiro_ativo ? 1 : 0, data.pagto_pix_ativo ? 1 : 0,
        data.pagto_credito_ativo ? 1 : 0, data.pagto_debito_ativo ? 1 : 0
      ]
    );
    return { success: true };
  });

  // ==========================================
  // CONFIG : SISTEMA
  // ==========================================
  ipcMain.handle('config:sistema:get', async () => {
    const db = await getDatabase();
    const config = await db.get('SELECT * FROM config_sistema WHERE id=1');
    return config || {};
  });

  // BUG #8 FIX: config:sistema:save NÃO deve gravar campos de licença (gerenciados pelo electron-store)
  ipcMain.handle('config:sistema:save', async (event, data) => {
    const db = await getDatabase();
    await db.run(
      `UPDATE config_sistema SET 
        modo_ambiente=?, 
        ultimo_teste_api=?,
        updated_at=CURRENT_TIMESTAMP WHERE id=1`,
      [data.modo_ambiente, data.ultimo_teste_api]
    );
    return { success: true };
  });

  ipcMain.handle('sistema:getInfo', async () => {
    const userDataPath = app.getPath('userData');
    return {
      versao: app.getVersion(),
      dbPath: require('path').join(userDataPath, 'petshop.db')
    };
  });

  ipcMain.handle('sistema:abrirPastaDados', async () => {
    const userDataPath = app.getPath('userData');
    await shell.openPath(userDataPath);
    return { success: true };
  });

  // ==========================================
  // CONFIG : INTEGRAÇÕES (WRAPPER UNIFICADO)
  // ==========================================
  ipcMain.handle('config:integracoes:get', async () => {
    const db = await getDatabase();
    await ensureConfigFiscal(db);
    const [fiscal, hardware, balanca] = await Promise.all([
      db.get('SELECT api_provider, api_url, api_token, ambiente FROM config_fiscal WHERE id=1'),
      db.get('SELECT usar_gaveta, modo_gaveta FROM config_hardware WHERE id=1'),
      db.get('SELECT ativa as balanca_ativa, porta as porta_balanca, protocolo as protocolo_balanca, baud_rate FROM config_balanca WHERE id=1')
    ]);

    return {
      api_provider: fiscal?.api_provider || 'focus',
      api_url: fiscal?.api_url || '',
      api_token: fiscal?.api_token || '',
      api_ambiente: fiscal?.ambiente || 'homologacao',
      api_timeout: 30, // static for now
      usar_gaveta: hardware?.usar_gaveta || 0,
      modo_gaveta: hardware?.modo_gaveta || 'impressora',
      balanca_ativa: balanca?.balanca_ativa || 0,
      porta_balanca: balanca?.porta_balanca || 'COM1',
      protocolo_balanca: 'simulado',
      baud_rate: balanca?.baud_rate || 9600
    };
  });

  ipcMain.handle('config:integracoes:save', async (event, data) => {
    const db = await getDatabase();
    await ensureConfigFiscal(db);
    const apiProvider = ['focus', 'gatewayx'].includes(data.api_provider) ? data.api_provider : 'focus';
    const modoGaveta = data.modo_gaveta === 'serial' ? 'impressora' : (data.modo_gaveta || 'impressora');
    const protocoloBalanca = 'simulado';

    await Promise.all([
      db.run(
        'UPDATE config_fiscal SET api_provider=?, api_url=?, api_token=?, ambiente=?, updated_at=CURRENT_TIMESTAMP WHERE id=1',
        [apiProvider, data.api_url || '', data.api_token || '', data.api_ambiente || 'homologacao']
      ),
      db.run(
        'UPDATE config_hardware SET usar_gaveta=?, modo_gaveta=?, updated_at=CURRENT_TIMESTAMP WHERE id=1',
        [data.usar_gaveta ? 1 : 0, modoGaveta]
      ),
      db.run(
        'UPDATE config_balanca SET ativa=?, porta=?, protocolo=?, baud_rate=?, updated_at=CURRENT_TIMESTAMP WHERE id=1',
        [data.balanca_ativa ? 1 : 0, data.porta_balanca, protocoloBalanca, data.baud_rate || 9600]
      )
    ]);
    return { success: true };
  });

  ipcMain.handle('hw:gaveta:abrir', async () => {
    const db = await getDatabase();
    const config = await db.get('SELECT * FROM config_hardware WHERE id = 1');
    const result = await hardwareService.abrirGaveta(config);
    return { success: result };
  });

  // BALANÇA
  ipcMain.handle('config:balanca:get', async () => {
    const db = await getDatabase();
    return await db.get('SELECT * FROM config_balanca WHERE id = 1');
  });

  ipcMain.handle('config:balanca:save', async (event, data) => {
    try {
      const db = await getDatabase();
      await db.run(
        'UPDATE config_balanca SET ativa = ?, porta = ?, baud_rate = ?, protocolo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
        [data.ativa ? 1 : 0, data.porta || '', data.baud_rate || 9600, 'simulado']
      );
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('hw:balanca:ler', async () => {
    const db = await getDatabase();
    const config = await db.get('SELECT * FROM config_balanca WHERE id = 1');
    const peso = await balancaService.lerPeso(config);
    if (peso === null || peso === undefined) return { success: false, message: 'Balanca inativa ou protocolo nao suportado.', peso: null };
    return { success: true, peso };
  });

  // ==========================================
  // CONFIG : APARÊNCIA E BRANDING
  // ==========================================
  ipcMain.handle('config:aparencia:get', async () => {
    const db = await getDatabase();
    const config = await db.get('SELECT * FROM config_aparencia WHERE id=1');
    return config || {};
  });

  ipcMain.handle('config:aparencia:save', async (event, data) => {
    const db = await getDatabase();
    await db.run(
      `UPDATE config_aparencia SET 
        tema=?, cor_primaria=?, cor_secundaria=?, cor_destaque=?,
        cor_fundo=?, cor_card=?, cor_texto=?, cor_texto_secundario=?,
        logo_path=?, nome_comercio=?, exibir_logo_cupom=?,
        updated_at=CURRENT_TIMESTAMP WHERE id=1`,
      [
        data.tema, data.cor_primaria, data.cor_secundaria, data.cor_destaque,
        data.cor_fundo, data.cor_card, data.cor_texto, data.cor_texto_secundario,
        data.logo_path || null,
        data.nome_comercio || '',
        data.exibir_logo_cupom !== undefined ? (data.exibir_logo_cupom ? 1 : 0) : 1
      ]
    );
    return { success: true };
  });

  ipcMain.handle('sistema:selecionarLogo', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      title: 'Selecionar Logo do Comércio',
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, message: 'Seleção cancelada.' };
    }

    const srcPath = result.filePaths[0];
    const stats = fs.statSync(srcPath);

    if (stats.size > 2 * 1024 * 1024) {
      return { success: false, message: 'Arquivo excede o tamanho máximo de 2 MB.' };
    }

    // Validação de extensão
    const ext = path.extname(srcPath).toLowerCase();
    const allowedExts = ['.png', '.jpg', '.jpeg', '.webp'];
    if (!allowedExts.includes(ext)) {
      return { success: false, message: `Formato inválido. Aceitos: PNG, JPG, JPEG, WEBP.` };
    }

    const brandDir = path.join(app.getPath('userData'), 'brand');
    if (!fs.existsSync(brandDir)) {
      fs.mkdirSync(brandDir, { recursive: true });
    }

    // Salva sempre como 'logo' + ext para simplificar (sobrescreve logo anterior)
    const destFileName = `logo${ext}`;
    const destPath = path.join(brandDir, destFileName);
    fs.copyFileSync(srcPath, destPath);

    // Retorna caminho RELATIVO ao userData
    const relativePath = `brand/${destFileName}`;

    return { success: true, logoPath: relativePath };
  });
  // ==========================================
  // ======== INTELIGÊNCIA DE NEGÓCIO ==========
  // ==========================================

  // Clientes para retorno (pets sem atendimento há 30+ dias)
  ipcMain.handle('db:dashboard:getClientesRetorno', async () => {
    try {
      const db = await getDatabase();
      const rows = await db.all(`
        SELECT c.id as cliente_id, c.nome as cliente_nome, c.telefone,
               p.id as pet_id, p.nome as pet_nome,
               MAX(a.created_at) as ultima_visita,
               CAST(julianday('now') - julianday(MAX(a.created_at)) AS INTEGER) as dias_sem_visita
        FROM clientes c
        JOIN pets p ON p.cliente_id = c.id AND p.ativo = 1
        JOIN atendimentos a ON a.pet_id = p.id AND a.status IN ('finalizado','faturado')
        WHERE c.ativo = 1
        GROUP BY c.id, p.id
        HAVING dias_sem_visita >= 30
        ORDER BY dias_sem_visita DESC
        LIMIT 20
      `);
      return rows || [];
    } catch (error) {
      console.error('Erro ao buscar clientes para retorno:', error);
      return [];
    }
  });

  // Histórico de atendimentos de um pet (fidelização)
  ipcMain.handle('db:pets:getHistorico', async (event, petId) => {
    try {
      const db = await getDatabase();
      const historico = await db.all(`
        SELECT a.id, a.created_at as data, a.observacoes, a.status,
               s.nome as servico_nome,
               v.valor_total, v.forma_pagamento, v.id as venda_id
        FROM atendimentos a
        LEFT JOIN servicos s ON a.servico_id = s.id
        LEFT JOIN vendas v ON v.atendimento_id = a.id
        WHERE a.pet_id = ? AND a.status IN ('finalizado','faturado','aguardando_pagamento')
        ORDER BY a.created_at DESC
        LIMIT 50
      `, [petId]);
      return historico || [];
    } catch (error) {
      console.error('Erro ao buscar histórico do pet:', error);
      return [];
    }
  });

  // Resumo de um cliente (total visitas, gasto, frequência)
  ipcMain.handle('db:clientes:getResumo', async (event, clienteId) => {
    try {
      const db = await getDatabase();

      const totalVisitas = await db.get(`
        SELECT COUNT(DISTINCT a.id) as count
        FROM atendimentos a
        WHERE a.cliente_id = ? AND a.status IN ('finalizado','faturado')
      `, [clienteId]);

      const ultimaVisita = await db.get(`
        SELECT MAX(a.created_at) as data
        FROM atendimentos a
        WHERE a.cliente_id = ? AND a.status IN ('finalizado','faturado')
      `, [clienteId]);

      const totalGasto = await db.get(`
        SELECT IFNULL(SUM(v.valor_total), 0) as total
        FROM vendas v
        WHERE v.cliente_id = ? AND v.status = 'pago'
      `, [clienteId]);

      const visitas = totalVisitas?.count || 0;

      return {
        totalVisitas: visitas,
        ultimaVisita: ultimaVisita?.data || null,
        totalGasto: totalGasto?.total || 0,
        badge: visitas >= 10 ? 'VIP' : visitas >= 5 ? 'Frequente' : visitas >= 1 ? 'Recorrente' : 'Novo'
      };
    } catch (error) {
      console.error('Erro ao buscar resumo do cliente:', error);
      return { totalVisitas: 0, ultimaVisita: null, totalGasto: 0, badge: 'Novo' };
    }
  });

  // Abrir URL externa (para WhatsApp)
  ipcMain.handle('system:openExternal', async (event, url) => {
    try {
      if (!url || (!url.startsWith('https://') && !url.startsWith('http://'))) {
        return { success: false, message: 'URL inválida.' };
      }
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // ==========================================
  // ======== LICENCIAMENTO (PetWay API Integration) =======
  // ==========================================

  // BUG-07 FIX: usar VITE_API_URL (disponível via dotenv no processo Electron) ou LICENSE_API_URL
  const API_BASE_URL = process.env.LICENSE_API_URL || process.env.VITE_API_URL || 'http://137.131.216.152:3333/api/v1';

  ipcMain.handle('license:activate', async (event, { key }) => {
    try {
      const hwid = licenseService.getHWID();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let response;
      try {
        response = await fetch(`${API_BASE_URL}/license/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, hwid, deviceName: require('os').hostname() }),
          signal: controller.signal
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        return { success: false, error: `Servidor inacessível: ${fetchErr.message}` };
      }
      clearTimeout(timeoutId);

      // Leitura segura: servidor pode retornar HTML em vez de JSON (URL errada ou erro 404)
      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        console.error('[license:activate] Servidor retornou resposta não-JSON:', rawText.substring(0, 200));
        return { success: false, error: `O servidor retornou uma resposta inválida (não-JSON). Verifique se o endpoint é correto: ${API_BASE_URL}/license/activate` };
      }

      if (!response.ok) throw new Error(data.error || data.message || 'Falha ao ativar licença');

      const licenseData = {
        key,
        token: data.token,
        expiresAt: data.expiresAt || null,
        type: data.type,
        planType: data.planType,
        supportUntil: data.supportUntil,
        status: data.status || 'active',
        lastOnlineDate: Date.now()
      };

      await licenseService.saveLocalLicense(licenseData);
      return { success: true, ...licenseData };
    } catch (error) {
      console.error('IPC license:activate error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('license:validate', async (event, { key }) => {
    const hwid = licenseService.getHWID();
    const localData = await licenseService.getLocalLicense();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      let response;
      try {
        response = await fetch(`${API_BASE_URL}/license/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, hwid }),
          signal: controller.signal
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        throw fetchErr; // Vai para o bloco offline abaixo
      }
      clearTimeout(timeoutId);

      // Leitura segura: servidor pode retornar HTML em vez de JSON
      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        console.error('[license:validate] Servidor retornou não-JSON:', rawText.substring(0, 200));
        throw new Error(`Servidor retornou resposta inválida. Verifique a URL: ${API_BASE_URL}`);
      }

      if (!response.ok) {
        // Servidor confirmou explicitamente que a licença é inválida
        await licenseService.saveLocalLicense({ status: 'revoked' });
        return { success: false, error: data.error || data.message || 'Licença inválida' };
      }

      const licenseData = {
        key,
        token: data.token,
        expiresAt: data.expiresAt || null,
        status: data.status || 'active',
        type: data.type,
        planType: data.planType,
        supportUntil: data.supportUntil,
        lastOnlineDate: Date.now()
      };

      await licenseService.saveLocalLicense(licenseData);
      return { success: true, ...licenseData };
    } catch (error) {
      // Modo offline: servidor inacessível ou timeout
      console.warn('[license:validate] Offline mode:', error.message);

      if (!localData || !localData.token) {
        return { success: false, error: 'Nenhuma licença local encontrada para uso offline.' };
      }

      // Anti-fraude: checar adulteração de relógio e máximo offline
      const fraudCheck = licenseService.checkOfflineFraud(localData);
      if (!fraudCheck.valid) {
        await licenseService.saveLocalLicense({ status: 'revoked' });
        return { success: false, error: `Bloqueio Antifraude: ${fraudCheck.reason}` };
      }

      // CORREÇÃO PRINCIPAL: expiresAt null = licença vitalicia (nunca expira)
      // Apenas bloqueia se expiresAt for uma data válida E já passou
      if (localData.expiresAt) {
        const now = new Date();
        const expiry = new Date(localData.expiresAt);
        if (now > expiry) {
          return { success: false, error: 'Licença Expirada (Offline)' };
        }
      }
      // Se expiresAt é null (vitalicio) ou ainda não venceu: liberar

      return { success: true, ...localData, offline: true };
    }
  });

  ipcMain.handle('license:getLocal', async () => {
    const data = await licenseService.getLocalLicense();
    return { success: !!data, data };
  });

  ipcMain.handle('license:getHWID', async () => {
    return licenseService.getHWID();
  });

  ipcMain.handle('license:initTrial', async () => {
    return await licenseService.initTrial();
  });
  // BUG #9 FIX: handler para salvar licença localmente via IPC
  ipcMain.handle('license:saveLocal', async (event, data) => {
    try {
      const saved = await licenseService.saveLocalLicense(data);
      return { success: saved };
    } catch (error) {
      console.error('IPC license:saveLocal error:', error);
      return { success: false, error: error.message };
    }
  });

  // ===========================
  // ======= AUTO-UPDATER =======
  // ===========================

  ipcMain.handle('updater:check', async () => {
    const updater = global.autoUpdater;
    if (!updater) return { success: false, message: 'Updater não disponível no modo desenvolvimento.' };
    if (process.env.VITE_DEV_SERVER_URL) {
      return { success: false, message: 'Atualizações indisponíveis no modo desenvolvimento. Build o app para testar.' };
    }
    try {
      await updater.checkForUpdates();
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('updater:download', async () => {
    const updater = global.autoUpdater;
    if (!updater) return { success: false, message: 'Updater não disponível.' };
    try {
      await updater.downloadUpdate();
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('updater:install', async () => {
    const updater = global.autoUpdater;
    if (!updater) return { success: false };
    updater.quitAndInstall(false, true);
    return { success: true };
  });
}

module.exports = { setupIpcHandlers };
