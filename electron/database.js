const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

let dbPromise = null;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function initDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'petshop.db');

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec('PRAGMA journal_mode = WAL;');
  await db.exec('PRAGMA foreign_keys = ON;');

  // CREATE TABLES
  const createTablesQuery = `
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      login TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'funcionario',
      tipo_usuario TEXT NOT NULL DEFAULT 'operador',
      senha_padrao_alterada INTEGER DEFAULT 0,
      ativo BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT,
      email TEXT,
      cpf TEXT,
      endereco TEXT,
      observacoes TEXT,
      ativo BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      especie TEXT,
      raca TEXT,
      porte TEXT,
      sexo TEXT,
      data_nascimento TEXT,
      observacoes TEXT,
      ativo BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    );

    CREATE TABLE IF NOT EXISTS servicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT,
      categoria TEXT,
      preco_base REAL DEFAULT 0,
      usa_preco_por_porte INTEGER DEFAULT 0,
      preco_pequeno REAL DEFAULT 0,
      preco_medio REAL DEFAULT 0,
      preco_grande REAL DEFAULT 0,
      duracao_minutos INTEGER DEFAULT 30,
      ativo BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agendamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_id INTEGER NOT NULL,
      cliente_id INTEGER NOT NULL,
      servico_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      hora TEXT NOT NULL,
      status TEXT DEFAULT 'agendado', -- agendado, em_atendimento, finalizado, cancelado, faltou
      observacoes TEXT,
      ativo BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(pet_id) REFERENCES pets(id),
      FOREIGN KEY(cliente_id) REFERENCES clientes(id),
      FOREIGN KEY(servico_id) REFERENCES servicos(id)
    );

    CREATE TABLE IF NOT EXISTS atendimentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agendamento_id INTEGER,
      cliente_id INTEGER,
      pet_id INTEGER,
      servico_id INTEGER,
      status TEXT CHECK(status IN ('aguardando', 'em_atendimento', 'finalizado', 'aguardando_pagamento', 'faturado')),
      observacoes TEXT,
      data_inicio DATETIME,
      data_fim DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER,
      pet_id INTEGER,
      atendimento_id INTEGER,
      caixa_id INTEGER,
      subtotal REAL,
      desconto REAL DEFAULT 0,
      valor_total REAL,
      forma_pagamento TEXT CHECK(forma_pagamento IN ('dinheiro', 'pix', 'cartao') OR forma_pagamento IS NULL),
      forma_pagamento_detalhe TEXT,
      status TEXT CHECK(status IN ('pendente', 'pago', 'cancelado')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS venda_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id INTEGER,
      tipo TEXT CHECK(tipo IN ('servico', 'produto')),
      referencia_id INTEGER,
      descricao_snapshot TEXT,
      quantidade REAL,
      valor_unitario REAL,
      subtotal REAL,
      FOREIGN KEY(venda_id) REFERENCES vendas(id)
    );

    CREATE TABLE IF NOT EXISTS config_impressao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      largura_bobina INTEGER DEFAULT 80,
      imprimir_automatico INTEGER DEFAULT 1,
      exibir_dialogo_impressao INTEGER DEFAULT 1,
      imprimir_danfe_automatico INTEGER DEFAULT 0,
      vias_cupom INTEGER DEFAULT 1,
      mensagem_rodape TEXT DEFAULT 'Obrigado pela preferência!',
      nome_impressora TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS config_backup (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caminho_backup TEXT,
      backup_automatico INTEGER DEFAULT 0,
      frequencia_backup TEXT DEFAULT 'manual',
      manter_copias INTEGER DEFAULT 5,
      ultimo_backup DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS caixa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      data DATE,
      data_hora_abertura DATETIME,
      data_hora_fechamento DATETIME,
      valor_abertura REAL,
      valor_fechamento_informado REAL,
      valor_sistema REAL,
      diferenca REAL,
      status TEXT CHECK(status IN ('aberto', 'fechado')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS movimentacoes_caixa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caixa_id INTEGER,
      tipo TEXT CHECK(tipo IN ('entrada', 'saida')),
      valor REAL,
      descricao TEXT,
      referencia_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(caixa_id) REFERENCES caixa(id)
    );

    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      codigo_barras TEXT,
      categoria TEXT,
      fornecedor TEXT,
      custo REAL DEFAULT 0,
      preco REAL NOT NULL CHECK(preco > 0),
      estoque REAL DEFAULT 0,
      estoque_minimo REAL DEFAULT 0,
      vendido_por_peso INTEGER DEFAULT 0,
      unidade_medida TEXT DEFAULT 'un',
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NOT NULL,
      tipo TEXT CHECK(tipo IN ('entrada','saida','ajuste')),
      quantidade REAL NOT NULL,
      motivo TEXT,
      referencia_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(produto_id) REFERENCES produtos(id)
    );
    CREATE TABLE IF NOT EXISTS config_empresa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_fantasia TEXT,
      razao_social TEXT,
      cnpj TEXT,
      telefone TEXT,
      email TEXT,
      endereco TEXT,
      cidade TEXT,
      uf TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS config_pdv (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      permitir_venda_sem_cliente INTEGER DEFAULT 1,
      cliente_padrao TEXT,
      abrir_nova_venda_auto INTEGER DEFAULT 0,
      confirmar_cancelamento INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS config_fiscal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ambiente TEXT CHECK(ambiente IN ('homologacao','producao')) DEFAULT 'homologacao',
      cnpj TEXT,
      ie TEXT,
      razao_social TEXT,
      nome_fantasia TEXT,
      crt TEXT,
      csc TEXT,
      csc_id TEXT,
      serie_nfce INTEGER DEFAULT 1,
      proximo_numero_nfce INTEGER DEFAULT 1,
      uf TEXT,
      cidade TEXT,
      habilitado INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fiscal_vendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id INTEGER NOT NULL,
      status_fiscal TEXT CHECK(status_fiscal IN ('pendente','em_processamento','autorizado','rejeitado','nao_emitido','homologacao_mock','erro_rede','pendente_reenvio')),
      ambiente TEXT CHECK(ambiente IN ('homologacao','producao')),
      numero_nfce INTEGER,
      serie_nfce INTEGER,
      chave_acesso TEXT,
      protocolo TEXT,
      xml_enviado TEXT,
      xml_autorizado TEXT,
      qr_code_url TEXT,
      mensagem_retorno TEXT,
      tentativas INTEGER DEFAULT 0,
      ultima_tentativa DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(venda_id) REFERENCES vendas(id)
    );

    CREATE TABLE IF NOT EXISTS config_hardware (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usar_gaveta INTEGER DEFAULT 0,
      modo_gaveta TEXT DEFAULT 'impressora',
      nome_impressora TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS config_balanca (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ativa INTEGER DEFAULT 0,
      porta TEXT,
      baud_rate INTEGER DEFAULT 9600,
      protocolo TEXT DEFAULT 'simulado',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS config_caixa_financeiro (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exigir_abertura_caixa INTEGER DEFAULT 1,
      apenas_um_caixa_aberto INTEGER DEFAULT 1,
      confirmar_fechamento_caixa INTEGER DEFAULT 1,
      permitir_sangria INTEGER DEFAULT 1,
      permitir_suprimento INTEGER DEFAULT 1,
      desconto_maximo_percentual REAL DEFAULT 10,
      exigir_obs_sangria INTEGER DEFAULT 1,
      exigir_obs_ajuste INTEGER DEFAULT 1,
      pagto_dinheiro_ativo INTEGER DEFAULT 1,
      pagto_pix_ativo INTEGER DEFAULT 1,
      pagto_credito_ativo INTEGER DEFAULT 1,
      pagto_debito_ativo INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS config_sistema (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chave_licenca TEXT,
      licenca_ativa INTEGER DEFAULT 0,
      validade_licenca DATETIME,
      modo_ambiente TEXT DEFAULT 'local',
      ultimo_teste_api DATETIME,
      token_offline TEXT,
      tipo_licenca TEXT DEFAULT 'trial',
      plan_type TEXT DEFAULT 'monthly',
      support_until DATETIME,
      license_status TEXT DEFAULT 'active',
      data_primeira_execucao DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS config_aparencia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tema TEXT DEFAULT 'escuro',
      cor_primaria TEXT DEFAULT '#8257E5',
      cor_secundaria TEXT DEFAULT '#202024',
      cor_destaque TEXT DEFAULT '#9466FF',
      cor_fundo TEXT DEFAULT '#121214',
      cor_card TEXT DEFAULT '#202024',
      cor_texto TEXT DEFAULT '#FFFFFF',
      cor_texto_secundario TEXT DEFAULT '#A1A1AA',
      logo_path TEXT DEFAULT NULL,
      nome_comercio TEXT DEFAULT '',
      exibir_logo_cupom INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await db.exec(createTablesQuery);

  // Migração: adicionar colunas fiscais em produtos (safe para DBs existentes)
  const fiscalColumns = [
    { name: 'ncm', type: 'TEXT' },
    { name: 'cfop', type: 'TEXT' },
    { name: 'cst_csosn', type: 'TEXT' },
    { name: 'unidade_comercial', type: 'TEXT' }
  ];
  for (const col of fiscalColumns) {
    try {
      await db.exec(`ALTER TABLE produtos ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // Coluna já existe — ignorar silenciosamente
    }
  }

  // Migração: adicionar categoria e preço por porte em servicos
  try {
    await db.exec(`ALTER TABLE servicos ADD COLUMN categoria TEXT`);
  } catch (e) {
    // Coluna já existe
  }

  const servicosPrecoCols = [
    { name: 'usa_preco_por_porte', type: 'INTEGER DEFAULT 0' },
    { name: 'preco_pequeno', type: 'REAL DEFAULT 0' },
    { name: 'preco_medio', type: 'REAL DEFAULT 0' },
    { name: 'preco_grande', type: 'REAL DEFAULT 0' }
  ];
  for (const col of servicosPrecoCols) {
    try {
      await db.exec(`ALTER TABLE servicos ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // Colunas já existem
    }
  }

  // Migração: colunas operacionais e hardware em produtos e vendas
  const productCols = [
    { name: 'vendido_por_peso', type: 'INTEGER DEFAULT 0' },
    { name: 'unidade_medida', type: "TEXT DEFAULT 'un'" }
  ];
  for (const col of productCols) {
    try {
      await db.exec(`ALTER TABLE produtos ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // Coluna já existe
    }
  }

  const vendasCols = [
    { name: 'valor_recebido', type: 'REAL' },
    { name: 'troco', type: 'REAL' },
    { name: 'forma_pagamento_detalhe', type: 'TEXT' }
  ];
  for (const col of vendasCols) {
    try {
      await db.exec(`ALTER TABLE vendas ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // Coluna já existe
    }
  }

  // Migração: campos Focus NFe em config_fiscal
  const fiscalConfigCols = [
    { name: 'api_provider', type: "TEXT DEFAULT 'focus'" },
    { name: 'api_token', type: 'TEXT' },
    { name: 'api_url', type: 'TEXT' }
  ];
  for (const col of fiscalConfigCols) {
    try {
      await db.exec(`ALTER TABLE config_fiscal ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // Coluna já existe
    }
  }

  // Migração: colunas de resiliência em fiscal_vendas
  const resilienciaCols = [
    { name: 'tentativas', type: 'INTEGER DEFAULT 0' },
    { name: 'ultima_tentativa', type: 'DATETIME' }
  ];
  for (const col of resilienciaCols) {
    try {
      await db.exec(`ALTER TABLE fiscal_vendas ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // Coluna já existe
    }
  }

  // Migração: tipo_usuario em usuarios
  try {
    const tableInfo = await db.all("PRAGMA table_info(usuarios)");
    const hasTipoUsuario = tableInfo.some(col => col.name === 'tipo_usuario');
    if (!hasTipoUsuario) {
      await db.exec(`ALTER TABLE usuarios ADD COLUMN tipo_usuario TEXT DEFAULT 'operador'`);
      // Update
      await db.exec(`UPDATE usuarios SET tipo_usuario = 'administrador' WHERE tipo = 'admin' OR tipo = 'administrador'`);
      await db.exec(`UPDATE usuarios SET tipo_usuario = 'operador' WHERE tipo_usuario IS NULL OR tipo_usuario != 'administrador'`);
    }
  } catch (e) {
    console.error('Erro na migração de tipo_usuario:', e);
  }

  // Insert default admin
  const adminRow = await db.get("SELECT count(*) as count FROM usuarios WHERE login = 'admin'");
  if (adminRow && adminRow.count === 0) {
    const defaultPassword = hashPassword('admin');
    await db.run("INSERT INTO usuarios (nome, login, senha, tipo, tipo_usuario) VALUES (?, ?, ?, ?, ?)", ['Administrador', 'admin', defaultPassword, 'admin', 'administrador']);
  }

  // Insert default config_impressao
  const printConfigRow = await db.get("SELECT count(*) as count FROM config_impressao");
  if (printConfigRow && printConfigRow.count === 0) {
    await db.run(`INSERT INTO config_impressao 
      (id, largura_bobina, imprimir_automatico, exibir_dialogo_impressao, imprimir_danfe_automatico, vias_cupom, mensagem_rodape) 
      VALUES (1, 80, 1, 1, 0, 1, 'Obrigado pela preferência!')`);
  }

  // Insert default config_backup
  const backupConfigRow = await db.get("SELECT count(*) as count FROM config_backup");
  if (backupConfigRow && backupConfigRow.count === 0) {
    await db.run(`INSERT INTO config_backup 
      (id, caminho_backup, backup_automatico, frequencia_backup, manter_copias) 
      VALUES (1, '', 0, 'manual', 5)`);
  }

  // Insert default service
  const serviceRow = await db.get("SELECT count(*) as count FROM servicos");
  if (serviceRow && serviceRow.count === 0) {
    await db.run("INSERT INTO servicos (nome, preco_base) VALUES (?, ?)", ['Banho', 50.0]);
    await db.run("INSERT INTO servicos (nome, preco_base) VALUES (?, ?)", ['Tosa', 80.0]);
  }

  // Insert default config_hardware
  const hardwareConfigRow = await db.get("SELECT count(*) as count FROM config_hardware");
  if (hardwareConfigRow && hardwareConfigRow.count === 0) {
    await db.run(`INSERT INTO config_hardware (id, usar_gaveta, modo_gaveta) VALUES (1, 0, 'impressora')`);
  }

  // Insert default config_balanca
  const balancaConfigRow = await db.get("SELECT count(*) as count FROM config_balanca");
  if (balancaConfigRow && balancaConfigRow.count === 0) {
    await db.run(`INSERT INTO config_balanca (id, ativa, protocolo, baud_rate) VALUES (1, 0, 'simulado', 9600)`);
  }

  // Insert default config_caixa_financeiro
  const caixaFinanceiroRow = await db.get("SELECT count(*) as count FROM config_caixa_financeiro");
  if (caixaFinanceiroRow && caixaFinanceiroRow.count === 0) {
    await db.run(`INSERT INTO config_caixa_financeiro (id) VALUES (1)`);
  }

  // Insert default config_sistema
  const sistemaRow = await db.get("SELECT count(*) as count FROM config_sistema");
  if (sistemaRow && sistemaRow.count === 0) {
    await db.run(`INSERT INTO config_sistema (id) VALUES (1)`);
  }

  // Insert default config_aparencia
  const aparenciaRow = await db.get("SELECT count(*) as count FROM config_aparencia");
  if (aparenciaRow && aparenciaRow.count === 0) {
    await db.run(`INSERT INTO config_aparencia (id, logo_path) VALUES (1, NULL)`);
  }

  // Migração: novos campos de branding em config_aparencia
  const aparenciaCols = [
    { name: 'nome_comercio', type: "TEXT DEFAULT ''" },
    { name: 'exibir_logo_cupom', type: 'INTEGER DEFAULT 1' }
  ];
  for (const col of aparenciaCols) {
    try {
      await db.exec(`ALTER TABLE config_aparencia ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // Coluna já existe — ignorar silenciosamente
    }
  }

  // ── Fase 7: Agenda Profissional ──────────────────────────────────────
  // Tabela de funcionários (separada de usuarios para flexibilidade)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS funcionarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cor TEXT DEFAULT '#8257E5',
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migração: adicionar funcionario_id e duracao em agendamentos
  const agendaCols = [
    { name: 'funcionario_id', type: 'INTEGER' },
    { name: 'duracao', type: 'INTEGER DEFAULT 30' }
  ];
  for (const col of agendaCols) {
    try {
      await db.exec(`ALTER TABLE agendamentos ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // Coluna já existe
    }
  }

  // ── Fase 10: Licenciamento ──────────────────────────────────────
  const licenseCols = [
    { name: 'token_offline', type: 'TEXT' },
    { name: 'tipo_licenca', type: "TEXT DEFAULT 'trial'" },
    { name: 'plan_type', type: "TEXT DEFAULT 'monthly'" },
    { name: 'support_until', type: 'DATETIME' },
    { name: 'license_status', type: "TEXT DEFAULT 'active'" },
    { name: 'data_primeira_execucao', type: 'DATETIME' }
  ];
  for (const col of licenseCols) {
    try {
      await db.exec(`ALTER TABLE config_sistema ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // Coluna já existe
    }
  }

  return db;
}

function getDatabase() {
  if (!dbPromise) {
    dbPromise = initDatabase();
  }
  return dbPromise;
}

// Helpers for Crypto (for login verification)
function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const checkHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return checkHash === hash;
}

module.exports = { initDatabase, getDatabase, hashPassword, verifyPassword };
