/* Núcleo de cálculo do painel. Não toca na tela: recebe texto e devolve números,
   para poder ser testado sozinho e para a interface ficar só com a apresentação. */

const CONTA_PESSOAL = ['isabella venceslau fortunato', 'jalma maria de souza barros'];
const REGRA_C6 = /isabella fortunato traducoes/;
const CARTAO_C6 = 'Cartão de crédito (link C6)';
const NAO_RECEITA = ['Repasse para o Cora', 'Devolução', 'Pagamento de cartão'];
const VALORES_TRANSPORTE = [5, 6, 1.5];

/* A primeira regra que casa vence, então as específicas vêm antes. */
const REGRAS = [
  [/devol/, 'Devolução'],
  [REGRA_C6, 'Repasse para o Cora'],
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
  'Devolução', 'Antecipação de lucros', 'Outros',
];

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const ABAS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const semAcento = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const arred = n => Math.round(n * 100) / 100;

/* ---------- leitura do extrato ---------- */

function lerCSV(texto) {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/);
  const inicio = linhas.findIndex(l => semAcento(l).startsWith('data lancamento'));
  if (inicio < 0) throw new Error('Não achei a linha que começa com "Data Lançamento". Esse arquivo parece não ser um extrato do Inter.');
  const saida = [];
  for (const linha of linhas.slice(inicio + 1)) {
    if (!linha.trim()) continue;
    const p = linha.split(';');
    if (p.length < 4) continue;
    const bruto = p[3].trim();
    if (!bruto) continue;
    const valor = Number(bruto.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(valor)) continue;
    saida.push({ data: p[0].trim(), hist: p[1].trim(), desc: p[2].trim(), valor });
  }
  return saida;
}

function lerOFX(texto) {
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
      hist, desc: campo(bloco, 'NAME') || memo, valor: Number(valor),
    });
  }
  if (!saida.length) throw new Error('Não achei nenhum lançamento nesse OFX.');
  return saida;
}

function lerExtrato(nome, texto) {
  return /\.ofx$/i.test(nome) ? lerOFX(texto) : lerCSV(texto);
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
   infla entrada ou saída. O que sobra sem par pode ser devolução parcial. */
function tirarEstornos(regs) {
  const fora = new Set();
  const orfaos = [];
  regs.forEach((reg, i) => {
    if (!semAcento(reg.hist).includes('devolvid') || fora.has(i)) return;
    let par = -1;
    for (let j = 0; j < regs.length; j++) {
      if (j === i || fora.has(j)) continue;
      const o = regs[j];
      if (o.desc === reg.desc && Math.abs(Math.abs(o.valor) - Math.abs(reg.valor)) < 0.005 && o.valor * reg.valor < 0) {
        par = j; break;
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
  for (const [padrao, cat] of REGRAS) if (padrao.test(alvo)) return cat;
  return 'A confirmar';
}

const ordena = r => { const [d, m, a] = r.data.split('/'); return a + m + d; };

/* O OFX do Inter costuma incluir dias do mês seguinte. Fica só o mês dominante. */
function soDoMes(regs) {
  const conta = {};
  for (const r of regs) {
    const [, m, a] = r.data.split('/');
    conta[a + '-' + m] = (conta[a + '-' + m] || 0) + 1;
  }
  const alvo = Object.keys(conta).reduce((x, y) => conta[y] > conta[x] ? y : x);
  const dentro = regs.filter(r => { const [, m, a] = r.data.split('/'); return a + '-' + m === alvo; });
  return { dentro, fora: regs.length - dentro.length, alvo };
}

function processarExtrato(nome, texto, aprendidas = {}) {
  const todos = lerExtrato(nome, texto);
  const { dentro, fora, alvo } = soDoMes(todos);
  const operacionais = dentro.filter(r => !interno(r));
  const internos = dentro.length - operacionais.length;
  const { limpos, removidos, orfaos } = tirarEstornos(operacionais);

  const saidas = [], entradas = [], pessoal = [];
  for (const reg of limpos.slice().sort((a, b) => ordena(a) < ordena(b) ? -1 : 1)) {
    const desc = REGRA_C6.test(semAcento(reg.desc)) && reg.valor > 0 ? reg.desc : reg.desc;
    const item = { data: reg.data, desc, hist: reg.hist, valor: arred(Math.abs(reg.valor)) };
    if (CONTA_PESSOAL.some(n => semAcento(reg.desc).includes(n))) {
      item.sentido = reg.valor < 0 ? 'saida' : 'entrada';
      pessoal.push(item);
    } else if (reg.valor < 0) {
      // O que a Isabella já categorizou à mão vale mais do que qualquer regra.
      item.cat = aprendidas[item.desc] || categorizar(reg);
      saidas.push(item);
    } else {
      let cat = categorizar(reg);
      if (REGRA_C6.test(semAcento(reg.desc))) cat = CARTAO_C6;
      item.obs = NAO_RECEITA.includes(cat) ? cat : '';
      item.via = cat === CARTAO_C6 ? 'cartao' : 'pix';
      entradas.push(item);
    }
  }

  const soma = l => arred(l.reduce((a, b) => a + b.valor, 0));
  const idas = pessoal.filter(i => i.sentido === 'saida');
  const voltas = pessoal.filter(i => i.sentido === 'entrada');
  const deCliente = entradas.filter(i => !i.obs);
  const noCartao = entradas.filter(i => i.via === 'cartao');
  const [ano, mesNum] = alvo.split('-');

  return {
    mes: `${MESES[Number(mesNum) - 1]} de ${ano}`,
    ano: Number(ano), mesNum: Number(mesNum),
    cats: CATEGORIAS, saidas, entradas, pessoal, orfaos,
    diagnostico: { lidos: todos.length, internos, estornos: removidos, foraDoMes: fora },
    totais: {
      entradas: soma(entradas), saidas: soma(saidas),
      receitaCliente: soma(deCliente), receitaCartao: soma(noCartao),
      pessoalIda: soma(idas), pessoalVolta: soma(voltas),
      qtdEntradas: entradas.length, qtdSaidas: saidas.length, qtdPessoalIda: idas.length,
    },
  };
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

function lerPlanilha(livro, XLSX) {
  const linhas = [];
  for (const aba of livro.SheetNames) {
    const idx = ABAS.indexOf(aba.slice(0, 3).toUpperCase());
    if (idx < 0 || !/^\w{3}\s*\d{2}$/.test(aba.trim())) continue;
    const grade = XLSX.utils.sheet_to_json(livro.Sheets[aba], { header: 1, raw: true });
    for (const linha of grade.slice(1)) {
      if (!linha) continue;
      const bruto = linha[COL.apr];
      const data = comoData(bruto);
      if (!data) continue;
      if (semAcento(linha[COL.status] || '').includes('ancel')) continue;
      const n = c => typeof linha[c] === 'number' ? linha[c] : 0;
      const venda = arred(n(COL.trad) + n(COL.dilcart) + n(COL.dilenv));
      linhas.push({
        aba, cli: String(linha[COL.cli] || ''), orc: linha[COL.orc],
        ano: data.getFullYear(), mes: data.getMonth() + 1, dia: data.getDate(),
        origem: String(linha[COL.origem] || ''), pgto: String(linha[COL.pgto] || 'Não informado'),
        regime: regime(String(linha[COL.origem] || ''), String(linha[COL.pgto] || '')),
        traducao: n(COL.trad), dilCartorio: n(COL.dilcart), dilEnvio: n(COL.dilenv),
        correio: n(COL.correio), cartorio: n(COL.cart), venda,
      });
    }
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

/* O xlsx pode trazer a data como objeto, como texto ou como número de série. */
function comoData(bruto) {
  if (bruto instanceof Date) return bruto;
  if (typeof bruto === 'number' && bruto > 20000 && bruto < 80000) {
    return new Date(Date.UTC(1899, 11, 30 + Math.floor(bruto)));
  }
  if (typeof bruto === 'string') {
    const m = bruto.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
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

function resumoAnual(linhas) {
  const porMes = {};
  for (const l of linhas) {
    const k = l.ano + '-' + String(l.mes).padStart(2, '0');
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
  module.exports = { processarExtrato, lerPlanilha, vendasDoMes, resumoAnual,
    parceirosPorMes, recebidoDe, CATEGORIAS, MESES, arred, semAcento };
}
