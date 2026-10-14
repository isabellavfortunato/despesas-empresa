/* Núcleo de cálculo do painel. Não toca na tela: recebe texto e devolve números,
   para poder ser testado sozinho e para a interface ficar só com a apresentação.

   O extrato é lido inteiro, com todos os meses que vierem no arquivo, e o painel
   de cada mês é montado sob demanda por painelDoMes. Assim um extrato de janeiro
   a outubro vira dez meses navegáveis, em vez de a página escolher um só. */

const CONTA_PESSOAL = ['isabella venceslau fortunato', 'jalma maria de souza barros'];
const REGRA_EMPRESA = /isabella fortunato traducoes/;
/* Código do banco de quem está do outro lado do pix, como aparece no extrato
   ("Cp :31872495-..."). É o que separa as contas da própria empresa. */
const BANCO_C6 = '31872495';
const BANCO_CORA = '37880206';
const CARTAO_C6 = 'Cartão de crédito (link C6)';
const RETORNO_CORA = 'Retorno do Cora';
const OUTRA_CONTA = 'Conta da empresa em outro banco';
const NAO_RECEITA = ['Repasse para o Cora', 'Transferência para o C6', 'Devolução', 'Pagamento de cartão', RETORNO_CORA];
const VALORES_TRANSPORTE = [5, 6, 1.5];

/* A primeira regra que casa vence, então as específicas vêm antes. */
const REGRAS = [
  [/devol/, 'Devolução'],
  [REGRA_EMPRESA, 'Repasse para o Cora'],
  [/mercado pago|portoseg/, 'Pagamento de cartão'],
  [/gabrielly andrade silva|luna fortunato oliveira/, 'Salário'],
  [/fernanda alminhana freitas|leandro deivson lopes/, 'Acordo Fernanda'],
  [/juliana do couto/, 'Acordo Lucas Pereira'],
  [/vr gente/, 'Ponto eletrônico'],
  [/segdir/, 'Medicina e segurança do trabalho'],
  [/correios e telegrafos|dialog correios|dlknet|alia express/, 'Envios'],
  [/jaine ribeiro segal/, 'Tradução externa'],
  [/joice torres de oliveira/, 'Cartório'],
  [/wagner gomes de aguiar/, 'JUCERJA'],
  [/cambioreal|world company/, 'Parceiros'],
  [/drummond e rangel|ana beatriz drummond/, 'Jurídico'],
  [/quintino contabilidade/, 'Contabilidade'],
  [/telefonica bras/, 'Telefonia e internet'],
  [/google cloud|omiexperience|nic br|bytedance/, 'Tecnologia e software'],
  [/pix marketplace|kalunga/, 'Papelaria e limpeza'],
  [/ifood pago/, 'Alimentação'],
  [/99 tecnologia|maismobi|uber/, 'Transporte'],
  [/itau unibanco/, 'Itaú'],
  [/mabrime/, 'Mabrime'],
];

const CATEGORIAS = [
  'A confirmar', 'Salário', 'Acordo Fernanda', 'Acordo Lucas Pereira',
  'Ponto eletrônico', 'Medicina e segurança do trabalho', 'Envios',
  'Tradução externa', 'Cartório', 'JUCERJA', 'Parceiros', 'Jurídico',
  'Contabilidade', 'Telefonia e internet', 'Tecnologia e software',
  'Papelaria e limpeza', 'Alimentação', 'Transporte', 'Itaú', 'Mabrime',
  'Aluguel', 'Impostos e tarifas', 'Pagamento de cartão', 'Repasse para o Cora',
  'Transferência para o C6', 'Devolução', 'Antecipação de lucros', 'Outros',
];

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const ABAS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const semAcento = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const arred = n => Math.round(n * 100) / 100;
const chaveDe = (ano, mes) => ano + '-' + String(mes).padStart(2, '0');
const nomeDoMes = chave => { const [a, m] = chave.split('-'); return MESES[Number(m) - 1] + ' de ' + a; };

/* ---------- leitura do extrato ---------- */

/* O Inter exporta ora em UTF-8, ora em ANSI (windows-1252). Lido como UTF-8, o
   arquivo ANSI vira texto com caracteres de substituição e o cabeçalho deixa de
   ser reconhecido, então testamos a codificação em vez de supor. */
function decodificar(bytes) {
  if (typeof bytes === 'string') return bytes;
  const dados = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(dados);
  } catch (e) {
    return new TextDecoder('windows-1252').decode(dados);
  }
}

/* O cabeçalho pode vir com ou sem acento, e o acento pode ter chegado corrompido.
   Por isso procuramos as peças do nome, e não o nome exato. */
function pareceCabecalho(linha) {
  const t = semAcento(linha);
  return /\bdata\b/.test(t) && /lan[a-zÀ-ÿ�]*amento/.test(t);
}

/* O extrato do Inter sempre sai com ponto e vírgula, porque a vírgula é o
   separador decimal. Se o arquivo chegou com vírgula separando os campos, ele
   passou pelo Excel e os valores ficaram ambíguos: R$ 38.899,40 vira três
   pedaços. Nesse caso é mais honesto recusar do que entregar número errado. */
function conferirSeparador(linha) {
  const pontoEVirgula = (linha.match(/;/g) || []).length;
  if (pontoEVirgula >= 3) return;
  throw new Error('Este CSV está com vírgula separando as colunas, o que acontece quando o ' +
    'arquivo é aberto e salvo de novo pelo Excel. Os valores ficam ambíguos e eu prefiro ' +
    'não adivinhar. Baixe o extrato de novo no Inter e carregue sem abrir no Excel, ou use o OFX.');
}

/* "Cp :31872495-NOME" traz o código do banco da outra ponta. */
const bancoDe = texto => ((String(texto).match(/Cp\s*:\s*(\d{6,8})/) || [])[1] || '');

function lerCSV(bytes) {
  const texto = decodificar(bytes).replace(/^﻿/, '');
  const linhas = texto.split(/\r?\n/);
  const inicio = linhas.findIndex(pareceCabecalho);
  if (inicio < 0) {
    const amostra = linhas.filter(l => l.trim()).slice(0, 3).join(' / ').slice(0, 120);
    throw new Error('Não achei a linha de cabeçalho com Data e Lançamento. ' +
      'Confira se é o extrato da conta corrente, e não a fatura do cartão. ' +
      'As primeiras linhas do arquivo são: ' + (amostra || '(arquivo vazio)'));
  }

  conferirSeparador(linhas[inicio]);
  const saida = [];
  for (const linha of linhas.slice(inicio + 1)) {
    if (!linha.trim()) continue;
    const p = linha.split(';');
    if (p.length < 4) continue;
    const bruto = p[3].trim();
    if (!bruto) continue;
    const valor = Number(bruto.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(valor)) continue;
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(p[0].trim())) continue;
    saida.push({ data: p[0].trim(), hist: p[1].trim(), desc: p[2].trim(), valor,
      banco: bancoDe(p[1] + ' ' + p[2]) });
  }
  if (!saida.length) {
    throw new Error('Achei o cabeçalho, mas nenhuma linha de lançamento depois dele. ' +
      'O arquivo pode estar vazio ou ter sido salvo em outro formato pelo Excel.');
  }
  return saida;
}

function lerOFX(bytes) {
  const texto = decodificar(bytes);
  const campo = (bloco, tag) => {
    const achado = bloco.match(new RegExp('<' + tag + '>(.*?)[\\r\\n<]'));
    return achado ? achado[1].trim() : '';
  };
  const saida = [];
  const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g) || [];
  for (const bloco of blocos) {
    const data = campo(bloco, 'DTPOSTED').slice(0, 8);
    const valor = campo(bloco, 'TRNAMT');
    if (data.length !== 8 || !valor) continue;
    const memo = campo(bloco, 'MEMO');
    // O histórico do CSV corresponde ao que vem antes dos dois pontos no MEMO.
    const hist = memo.includes(':') ? memo.split(':')[0].trim() : memo.trim();
    saida.push({
      data: `${data.slice(6, 8)}/${data.slice(4, 6)}/${data.slice(0, 4)}`,
      hist, desc: campo(bloco, 'NAME') || memo, valor: Number(valor), banco: bancoDe(memo),
    });
  }
  if (!saida.length) throw new Error('Não achei nenhum lançamento nesse OFX.');
  return saida;
}

function lerExtrato(nome, bytes) {
  if (/\.(xlsx|xls|pdf|docx|zip)$/i.test(nome)) {
    throw new Error('Este formato não serve para o extrato. Baixe no Inter em CSV ou OFX.');
  }
  return /\.ofx$/i.test(nome) ? lerOFX(bytes) : lerCSV(bytes);
}

/* ---------- regras de tratamento ---------- */

/* Movimentação dentro da própria conta. A verificação é pelo histórico, nunca
   pelo nome do destinatário: o nome completo da Portoseg contém a palavra
   investimento e causaria falso positivo. */
function interno(reg) {
  const hist = semAcento(reg.hist);
  const desc = semAcento(reg.desc);
  if (hist === 'aplicacao' || hist === 'resgate') return true;
  if (hist === 'estorno' && desc.trim() === 'aplicacao') return true;
  return desc.includes('cdb') || desc.includes('cofrinho');
}

/* Remove a reversão junto com o lançamento original. Deixar só um dos lados
   infla entrada ou saída. O que sobra sem par pode ser devolução parcial.
   Roda sobre o arquivo inteiro, porque a devolução pode cair no mês seguinte ao
   do pagamento original, e nesse caso os dois saem, cada um do seu mês. O par
   escolhido é o original mais próximo antes da devolução. */
function tirarEstornos(regs) {
  const fora = new Set();
  const orfaos = [];
  const dia = r => Number(ordena(r));
  regs.forEach((reg, i) => {
    if (!semAcento(reg.hist).includes('devolvid') || fora.has(i)) return;
    let par = -1, melhor = Infinity;
    for (let j = 0; j < regs.length; j++) {
      if (j === i || fora.has(j)) continue;
      const o = regs[j];
      if (semAcento(o.hist).includes('devolvid')) continue;
      if (o.desc === reg.desc && Math.abs(Math.abs(o.valor) - Math.abs(reg.valor)) < 0.005 && o.valor * reg.valor < 0) {
        const distancia = dia(reg) - dia(o);
        if (distancia >= 0 && distancia < melhor) { melhor = distancia; par = j; }
      }
    }
    if (par < 0) { orfaos.push(reg); return; }
    fora.add(i); fora.add(par);
  });
  return { limpos: regs.filter((_, i) => !fora.has(i)), removidos: fora.size, orfaos };
}

function categorizar(reg) {
  if (VALORES_TRANSPORTE.includes(Math.abs(reg.valor)) && semAcento(reg.hist).includes('pix')) return 'Transporte';
  const alvo = semAcento(reg.desc);
  // A conta da empresa no C6 recebendo é transferência, e não repasse para o Cora.
  if (REGRA_EMPRESA.test(alvo) && reg.banco === BANCO_C6) return 'Transferência para o C6';
  for (const [padrao, cat] of REGRAS) if (padrao.test(alvo)) return cat;
  return 'A confirmar';
}

const ordena = r => { const [d, m, a] = r.data.split('/'); return a + m + d; };
const chaveDoRegistro = r => { const [, m, a] = r.data.split('/'); return a + '-' + m; };

/* Lê o arquivo inteiro e deixa pronto para montar qualquer mês. O que sai daqui
   é o que fica guardado no navegador. */
function prepararExtrato(nome, bytes) {
  const todos = lerExtrato(nome, bytes);
  const operacionais = todos.filter(r => !interno(r));
  const { limpos, removidos, orfaos } = tirarEstornos(operacionais);
  limpos.sort((a, b) => ordena(a) < ordena(b) ? -1 : ordena(a) > ordena(b) ? 1 : 0);
  const meses = [...new Set(todos.map(chaveDoRegistro))].sort();
  const ultimo = todos.map(ordena).sort().pop();
  return {
    formato: 2,
    registros: limpos,
    orfaos,
    meses,
    ultimoDia: `${ultimo.slice(6, 8)}/${ultimo.slice(4, 6)}/${ultimo.slice(0, 4)}`,
    diagnostico: { lidos: todos.length, internos: todos.length - operacionais.length, estornos: removidos },
  };
}

/* O mês fica parcial quando o extrato termina antes do último dia dele. */
function parcialAte(base, chave) {
  const [d, m, a] = base.ultimoDia.split('/');
  if (a + '-' + m !== chave) return '';
  const fimDoMes = new Date(Number(a), Number(m), 0).getDate();
  return Number(d) < fimDoMes ? base.ultimoDia.slice(0, 5) : '';
}

/* Monta o painel de um mês a partir do extrato preparado. As categorias que a
   Isabella escolheu à mão valem mais do que qualquer regra. */
function painelDoMes(base, chave, aprendidas = {}) {
  const doMes = base.registros.filter(r => chaveDoRegistro(r) === chave);
  const saidas = [], entradas = [], pessoal = [];
  for (const reg of doMes) {
    const item = { data: reg.data, desc: reg.desc, hist: reg.hist, valor: arred(Math.abs(reg.valor)) };
    const alvo = semAcento(reg.desc);
    if (CONTA_PESSOAL.some(n => alvo.includes(n))) {
      item.sentido = reg.valor < 0 ? 'saida' : 'entrada';
      pessoal.push(item);
    } else if (reg.valor < 0) {
      item.cat = aprendidas[item.desc] || categorizar(reg);
      saidas.push(item);
    } else {
      let cat = categorizar(reg);
      item.via = 'pix';
      if (REGRA_EMPRESA.test(alvo)) {
        // Entrando com o nome da empresa, o banco diz de onde veio. Do C6 é cliente
        // pagando no cartão pelo link; do Cora é dinheiro da própria empresa voltando.
        // Sem o código do banco, como no CSV antigo, vale a regra de sempre: C6.
        if (reg.banco === BANCO_CORA) cat = RETORNO_CORA;
        else if (!reg.banco || reg.banco === BANCO_C6) { cat = CARTAO_C6; item.via = 'cartao'; }
        else { cat = OUTRA_CONTA; item.via = 'outra'; item.banco = reg.banco; }
      }
      item.obs = NAO_RECEITA.includes(cat) ? cat : '';
      entradas.push(item);
    }
  }

  const soma = l => arred(l.reduce((a, b) => a + b.valor, 0));
  const idas = pessoal.filter(i => i.sentido === 'saida');
  const voltas = pessoal.filter(i => i.sentido === 'entrada');
  const naoReceita = entradas.filter(i => i.obs);
  const noCartao = entradas.filter(i => i.via === 'cartao');
  const [ano, mesNum] = chave.split('-');
  const orfaos = base.orfaos.filter(o => chaveDoRegistro(o) === chave);

  return {
    chave, mes: nomeDoMes(chave), ano: Number(ano), mesNum: Number(mesNum),
    parcial: parcialAte(base, chave),
    cats: CATEGORIAS, saidas, entradas, pessoal, orfaos,
    totais: {
      entradas: soma(entradas), saidas: soma(saidas),
      receitaCliente: arred(soma(entradas) - soma(naoReceita)), receitaCartao: soma(noCartao),
      naoReceita: soma(naoReceita), qtdNaoReceita: naoReceita.length,
      pessoalIda: soma(idas), pessoalVolta: soma(voltas),
      qtdEntradas: entradas.length, qtdSaidas: saidas.length, qtdPessoalIda: idas.length,
    },
  };
}

/* Compatibilidade com o uso antigo: devolve o painel do último mês do arquivo. */
function processarExtrato(nome, bytes, aprendidas = {}) {
  const base = prepararExtrato(nome, bytes);
  return painelDoMes(base, base.meses[base.meses.length - 1], aprendidas);
}

/* ---------- planilha de status de clientes ---------- */

const COL = { apr: 1, cli: 3, orc: 4, status: 6, origem: 10, cart: 13, trad: 14,
  dilcart: 15, dilenv: 16, correio: 17, total: 18, pgto: 20 };

/* Quando cada venda vira dinheiro na conta. O pagamento acontece na aprovação,
   com duas exceções: o parceiro acerta no mês seguinte e o cartão pelo link do
   C6 cai 14 dias depois. */
function regime(origem, forma) {
  if (semAcento(origem).startsWith('parceiro')) return 'parceiro';
  const f = semAcento(forma);
  if (f.includes('cart') && !f.includes('pix')) return 'cartao';
  if (f.includes('fatur')) return 'faturado';
  return 'pix';
}

/* problemas recebe as linhas com data de aprovação preenchida mas ilegível, para
   a página avisar em vez de deixar a venda sumir em silêncio. */
function lerPlanilha(livro, XLSX, problemas = []) {
  const linhas = [];
  for (const aba of livro.SheetNames) {
    const idx = ABAS.indexOf(aba.slice(0, 3).toUpperCase());
    if (idx < 0 || !/^\w{3}\s*\d{2}$/.test(aba.trim())) continue;
    const grade = XLSX.utils.sheet_to_json(livro.Sheets[aba], { header: 1, raw: true });
    grade.slice(1).forEach((linha, i) => {
      if (!linha) return;
      const bruto = linha[COL.apr];
      const data = comoData(bruto);
      if (!data) {
        const preenchida = bruto != null && String(bruto).trim() && !/^[-–—\s]*$/.test(String(bruto));
        if (preenchida) problemas.push({ aba, linha: i + 2, valor: String(bruto), cli: String(linha[COL.cli] || ''), orc: linha[COL.orc] });
        return;
      }
      if (semAcento(linha[COL.status] || '').includes('ancel')) return;
      const n = c => typeof linha[c] === 'number' ? linha[c] : 0;
      const venda = arred(n(COL.trad) + n(COL.dilcart) + n(COL.dilenv));
      linhas.push({
        aba, cli: String(linha[COL.cli] || ''), orc: linha[COL.orc],
        ano: data.ano, mes: data.mes, dia: data.dia,
        origem: String(linha[COL.origem] || ''), pgto: String(linha[COL.pgto] || 'Não informado'),
        regime: regime(String(linha[COL.origem] || ''), String(linha[COL.pgto] || '')),
        traducao: n(COL.trad), dilCartorio: n(COL.dilcart), dilEnvio: n(COL.dilenv),
        correio: n(COL.correio), cartorio: n(COL.cart), venda,
      });
    });
  }
  // O mesmo orçamento às vezes aparece em duas abas com os mesmos valores.
  const vistos = new Set(), limpas = [];
  for (const l of linhas.sort((a, b) => (a.ano * 10000 + a.mes * 100 + a.dia) - (b.ano * 10000 + b.mes * 100 + b.dia))) {
    const chave = [l.orc, l.venda, l.ano, l.mes, l.dia].join('|');
    if (vistos.has(chave)) continue;
    vistos.add(chave); limpas.push(l);
  }
  return limpas;
}

/* O xlsx pode trazer a data como objeto, como texto ou como número de série.
   Devolve dia, mês e ano já separados. A data em objeto chega da biblioteca com
   alguns segundos ou minutos de desvio por causa do fuso histórico do Brasil, e
   perto da meia-noite isso pode jogar o dia 1 para o mês anterior; por isso a
   data é arredondada para o dia mais próximo antes de ser lida. */
function comoData(bruto) {
  if (bruto instanceof Date && !isNaN(bruto)) {
    const d = new Date(bruto.getTime() + 12 * 3600 * 1000);
    return { ano: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
  }
  if (typeof bruto === 'number' && bruto > 20000 && bruto < 80000) {
    // Número de série do Excel: conta em UTC e lê em UTC, para o fuso não mudar o dia.
    const d = new Date(Date.UTC(1899, 11, 30 + Math.floor(bruto)));
    return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
  }
  if (typeof bruto === 'string') {
    const m = bruto.trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[1]) >= 1 && Number(m[1]) <= 31) {
      return { ano: Number(m[3]), mes: Number(m[2]), dia: Number(m[1]) };
    }
  }
  return null;
}

function vendasDoMes(linhas, ano, mes) {
  const doMes = linhas.filter(l => l.ano === ano && l.mes === mes);
  if (!doMes.length) return null;
  const s = k => arred(doMes.reduce((a, b) => a + b[k], 0));
  const regimes = {};
  for (const l of doMes) {
    regimes[l.regime] = regimes[l.regime] || { qtd: 0, valor: 0 };
    regimes[l.regime].qtd++;
    regimes[l.regime].valor = arred(regimes[l.regime].valor + l.venda);
  }
  return {
    venda: s('venda'), traducao: s('traducao'), dilCartorio: s('dilCartorio'),
    dilEnvio: s('dilEnvio'), correio: s('correio'), cartorio: s('cartorio'),
    qtd: doMes.length, regimes, linhas: doMes,
  };
}

/* O mês anterior ao de referência, para a comparação no card. */
function mesAnterior(ano, mes) {
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
}

function resumoAnual(linhas) {
  const porMes = {};
  for (const l of linhas) {
    const k = chaveDe(l.ano, l.mes);
    porMes[k] = porMes[k] || { venda: 0, qtd: 0, cartorio: 0, correio: 0, parceiro: 0, ano: l.ano, mes: l.mes };
    porMes[k].venda = arred(porMes[k].venda + l.venda);
    porMes[k].cartorio = arred(porMes[k].cartorio + l.cartorio);
    porMes[k].correio = arred(porMes[k].correio + l.correio);
    if (l.regime === 'parceiro') porMes[k].parceiro = arred(porMes[k].parceiro + l.venda);
    porMes[k].qtd++;
  }
  return Object.keys(porMes).sort().map(k => ({ chave: k, ...porMes[k] }));
}

/* Quanto cada parceiro fechou em cada mês, para acompanhar o que está a receber. */
function parceirosPorMes(linhas, ano, mes) {
  const doMes = linhas.filter(l => l.ano === ano && l.mes === mes && l.regime === 'parceiro');
  const por = {};
  for (const l of doMes) {
    const nome = l.cli || 'Sem nome';
    por[nome] = por[nome] || { qtd: 0, valor: 0, correio: 0 };
    por[nome].qtd++;
    por[nome].valor = arred(por[nome].valor + l.venda);
    por[nome].correio = arred(por[nome].correio + l.correio);
  }
  return Object.keys(por).map(n => ({ nome: n, ...por[n] })).sort((a, b) => b.valor - a.valor);
}

/* Procura, nas entradas do extrato, lançamentos cujo nome lembre o do parceiro.
   É uma aproximação por primeiro nome, então serve para orientar a cobrança e
   não para dar baixa contábil. */
function recebidoDe(nome, entradas) {
  const chave = semAcento(nome).split(/\s+/)[0];
  if (!chave || chave.length < 4) return { valor: 0, qtd: 0 };
  const achados = entradas.filter(e => semAcento(e.desc).includes(chave));
  return { valor: arred(achados.reduce((a, b) => a + b.valor, 0)), qtd: achados.length };
}

if (typeof module !== 'undefined') {
  module.exports = { processarExtrato, prepararExtrato, painelDoMes, lerPlanilha, vendasDoMes,
    resumoAnual, parceirosPorMes, recebidoDe, mesAnterior, categorizar, CATEGORIAS, MESES,
    arred, semAcento, chaveDe, nomeDoMes };
}
