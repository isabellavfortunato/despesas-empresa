/* Interface do Financeiro IFT. A conta mora em nucleo.js; aqui só desenhamos.

   O extrato é guardado inteiro e cada mês é montado na hora em que a aba dele é
   aberta. Por isso tudo na página, das despesas aos parceiros e ao relatório
   impresso, segue o mês escolhido na fileira de abas do alto. */

const brl = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const el = id => document.getElementById(id);
const plural = (q, um, muitos) => q + (q === 1 ? um : muitos);

const MES_CURTO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SIGLA = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const estado = {
  base: null,          // extrato preparado, com todos os meses
  planilha: null,      // linhas do Status clientes
  problemas: [],       // linhas da planilha com data de aprovação ilegível
  categorias: {},      // escolhas feitas à mão: favorecido -> categoria
  resolucoes: {},      // devoluções sem par já conferidas: lançamento -> destino
  revendo: false,      // lista das devoluções conferidas aberta para mudar
  mesSel: null,        // 'AAAA-MM'
  painel: null,        // o mês escolhido, montado a partir de base
  vendas: null, vendasAnteriores: null, mesAnterior: null,
  aba: 'mes', nomes: {},
};

/* ---------- avisos ---------- */
let relogioAviso = null;
/* Os avisos de confirmação somem sozinhos; os de atenção e de erro ficam até a
   pessoa fechar no x. */
function avisar(texto, tipo = 'ok', fixo = false) {
  const caixa = el('aviso');
  el('avisoTexto').textContent = texto;
  caixa.className = 'aviso ' + tipo;
  clearTimeout(relogioAviso);
  if (!fixo) relogioAviso = setTimeout(() => caixa.classList.add('escondido'), 7000);
}
el('avisoFechar').addEventListener('click', () => {
  clearTimeout(relogioAviso);
  el('aviso').classList.add('escondido');
});

/* ---------- memória do navegador ----------
   O que você carrega fica guardado nesta máquina, para a página já abrir com os
   dados do último uso. Nada disso vai para o GitHub nem para servidor nenhum:
   mora apenas neste navegador, e o botão de esquecer apaga tudo. */
const BAU = {
  extrato: 'financeiro-ift-dados-extrato',
  planilha: 'financeiro-ift-dados-planilha',
  problemas: 'financeiro-ift-problemas-planilha',
  nomes: 'financeiro-ift-nomes',
  categorias: 'financeiro-ift-categorias',
  devolucoes: 'financeiro-ift-devolucoes',
  mes: 'financeiro-ift-mes',
  aba: 'financeiro-ift-aba',
};

function gravar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch (e) { return false; }
}
function ler(chave) {
  try { const bruto = localStorage.getItem(chave); return bruto ? JSON.parse(bruto) : null; } catch (e) { return null; }
}

function guardarDados() {
  let ok = true;
  if (estado.base) ok = gravar(BAU.extrato, estado.base) && ok;
  if (estado.planilha) {
    ok = gravar(BAU.planilha, estado.planilha) && ok;
    gravar(BAU.problemas, estado.problemas);
  }
  gravar(BAU.nomes, estado.nomes);
  gravar(BAU.categorias, estado.categorias);
  if (!ok) {
    // Janela anônima ou armazenamento cheio: a página segue funcionando sem memória.
    avisar('Não consegui guardar os dados neste navegador, então eles valem só enquanto a página estiver aberta. Costuma acontecer em janela anônima.', 'atencao');
  }
}

/* Só guarda o que foi escolhido à mão. Uma categoria que a própria regra já dá
   não é guardada, para que a regra possa melhorar depois sem ficar presa a uma
   cópia antiga dela. */
function filtrarEscolhas(mapa) {
  const limpo = {};
  for (const [desc, cat] of Object.entries(mapa || {})) {
    if (!cat || cat === 'A confirmar' || !CATEGORIAS.includes(cat)) continue;
    if (categorizar({ desc, hist: '', valor: 0, banco: '' }) === cat) continue;
    limpo[desc] = cat;
  }
  return limpo;
}

/* Versões anteriores guardavam as categorias mês a mês. Elas são reunidas numa
   memória só, que vale para todos os meses. */
function migrarCategoriasAntigas() {
  try {
    const juntas = {};
    const apagar = [];
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i);
      if (/^financeiro-ift-[a-zç]+-de-\d{4}$/.test(chave)) {
        Object.assign(juntas, JSON.parse(localStorage.getItem(chave)) || {});
        apagar.push(chave);
      }
    }
    if (!apagar.length) return;
    estado.categorias = Object.assign(filtrarEscolhas(juntas), estado.categorias);
    apagar.forEach(c => localStorage.removeItem(c));
    gravar(BAU.categorias, estado.categorias);
  } catch (e) { /* sem memória disponível */ }
}

function recuperarDados() {
  estado.nomes = ler(BAU.nomes) || {};
  estado.categorias = ler(BAU.categorias) || {};
  estado.resolucoes = ler(BAU.devolucoes) || {};
  migrarCategoriasAntigas();

  const base = ler(BAU.extrato);
  if (base && base.formato === 2) {
    estado.base = base;
    marcarZona('zonaExtrato', 'nomeExtrato', estado.nomes.extrato);
  } else if (base) {
    // Guardado por uma versão antiga, que só mantinha um mês. Não dá para aproveitar.
    try { localStorage.removeItem(BAU.extrato); } catch (e) { /* nada a fazer */ }
    avisar('Esta versão separa o extrato por mês, e o extrato guardado pela versão anterior não serve mais. Carregue o extrato do Inter mais uma vez, de preferência do ano inteiro. As categorias que você corrigiu continuam guardadas.', 'atencao', true);
  }
  const planilha = ler(BAU.planilha);
  if (Array.isArray(planilha) && planilha.length) {
    estado.planilha = planilha;
    estado.problemas = ler(BAU.problemas) || [];
    marcarZona('zonaPlanilha', 'nomePlanilha', estado.nomes.planilha);
  }

  if (!estado.base && !estado.planilha) return;
  const aba = ler(BAU.aba);
  if (aba === 'mes' || aba === 'vendas') estado.aba = aba;
  escolherMes(ler(BAU.mes));
  mostrarMemoria();
}

function marcarZona(idZona, idNome, nomeArquivo) {
  el(idZona).classList.add('pronto');
  el(idNome).textContent = nomeArquivo || 'arquivo guardado neste navegador';
}

function mostrarMemoria() {
  const partes = [];
  if (estado.base) {
    const m = estado.base.meses;
    partes.push('extrato de ' + (m.length > 1
      ? MES_CURTO[Number(m[0].slice(5)) - 1] + ' a ' + nomeDoMes(m[m.length - 1])
      : nomeDoMes(m[0])));
  }
  if (estado.planilha) partes.push('planilha com ' + estado.planilha.length + ' orçamentos');
  if (!partes.length) { el('memoria').classList.add('escondido'); return; }
  el('memoriaTexto').textContent = 'Guardado neste navegador: ' + partes.join(' e ') +
    '. Carregar um arquivo novo substitui o anterior.';
  el('memoria').classList.remove('escondido');
}

el('btnEsquecer').addEventListener('click', () => {
  if (!confirm('Apagar deste navegador o extrato, a planilha e as categorias que você corrigiu?')) return;
  for (const chave of Object.values(BAU)) {
    try { localStorage.removeItem(chave); } catch (e) { /* nada a fazer */ }
  }
  location.reload();
});

/* ---------- carregar arquivos ---------- */
function ligarZona(idZona, idInput, aoLer) {
  const zona = el(idZona), entrada = el(idInput);
  const processa = arquivo => {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        aoLer(arquivo.name, leitor.result);
        zona.classList.add('pronto');
        zona.querySelector('.arquivo').textContent = arquivo.name;
        estado.nomes[idZona === 'zonaExtrato' ? 'extrato' : 'planilha'] = arquivo.name;
        guardarDados();
        mostrarMemoria();
      } catch (erro) {
        avisar('Não consegui ler ' + arquivo.name + '. ' + erro.message, 'erro', true);
      }
    };
    leitor.onerror = () => avisar('O navegador não conseguiu abrir ' + arquivo.name + '.', 'erro', true);
    leitor.readAsArrayBuffer(arquivo);
  };
  entrada.addEventListener('change', e => {
    processa(e.target.files[0]);
    // Sem isso, escolher de novo o mesmo arquivo não dispara nada.
    e.target.value = '';
  });
  ['dragenter', 'dragover'].forEach(ev => zona.addEventListener(ev, e => {
    e.preventDefault(); zona.classList.add('sobre');
  }));
  zona.addEventListener('dragleave', e => {
    if (!zona.contains(e.relatedTarget)) zona.classList.remove('sobre');
  });
  zona.addEventListener('drop', e => {
    e.preventDefault(); zona.classList.remove('sobre');
    processa(e.dataTransfer.files[0]);
  });
}

ligarZona('zonaExtrato', 'arqExtrato', (nome, buffer) => {
  // Lido como bytes para o núcleo decidir a codificação, já que o Inter exporta
  // ora em UTF-8, ora em ANSI.
  const base = prepararExtrato(nome, new Uint8Array(buffer));
  estado.base = base;
  // Arquivo novo abre no mês mais recente dele.
  escolherMes(base.meses[base.meses.length - 1]);
  const d = base.diagnostico;
  avisar('Extrato lido: ' + d.lidos + ' lançamentos em ' + plural(base.meses.length, ' mês', ' meses') +
    ', ' + d.internos + ' de CDB e aplicações fora da conta e ' + d.estornos +
    ' retirados em pares de estorno. Escolha o mês nas abas do alto.', 'ok');
});

ligarZona('zonaPlanilha', 'arqPlanilha', (nome, buffer) => {
  if (typeof XLSX === 'undefined') throw new Error('A biblioteca de planilhas não carregou. Confira a conexão e recarregue a página.');
  const livro = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
  const problemas = [];
  const linhas = lerPlanilha(livro, XLSX, problemas);
  if (!linhas.length) throw new Error('Não achei nenhuma linha com data de aprovação nas abas de meses.');
  estado.planilha = linhas;
  estado.problemas = problemas;
  escolherMes(estado.mesSel);
  avisar('Planilha lida: ' + linhas.length + ' orçamentos aprovados em ' +
    plural(resumoAnual(linhas).length, ' mês.', ' meses.'), 'ok');
});

/* ---------- meses ---------- */

function mesesDisponiveis() {
  const todos = new Set(estado.base ? estado.base.meses : []);
  if (estado.planilha) for (const m of resumoAnual(estado.planilha)) todos.add(m.chave);
  return [...todos].sort();
}

/* Troca o mês de tudo de uma vez. Sem mês válido, fica o mais recente. */
function escolherMes(chave) {
  const meses = mesesDisponiveis();
  if (!meses.length) return;
  if (!meses.includes(chave)) {
    // Preferência pelo último mês que tem extrato, que é o que tem despesas para mostrar.
    const comExtrato = estado.base ? estado.base.meses : [];
    chave = comExtrato.length ? comExtrato[comExtrato.length - 1] : meses[meses.length - 1];
  }
  estado.mesSel = chave;
  gravar(BAU.mes, chave);
  montarMes();
  desenharAbasMeses();
  if (estado.painel) desenharMes();
  desenharVendas();
  habilitar();
}

function montarMes() {
  const k = estado.mesSel;
  estado.painel = estado.base && estado.base.meses.includes(k)
    ? painelDoMes(estado.base, k, estado.categorias, estado.resolucoes)
    : null;
  const [ano, mes] = k.split('-').map(Number);
  estado.ref = { ano, mes };
  if (estado.planilha) {
    estado.vendas = vendasDoMes(estado.planilha, ano, mes);
    estado.mesAnterior = mesAnterior(ano, mes);
    estado.vendasAnteriores = vendasDoMes(estado.planilha, estado.mesAnterior.ano, estado.mesAnterior.mes);
  } else {
    estado.vendas = estado.vendasAnteriores = estado.mesAnterior = null;
  }
}

function desenharAbasMeses() {
  const cx = el('abasMeses');
  cx.innerHTML = '';
  const meses = mesesDisponiveis();
  const anos = new Set(meses.map(m => m.slice(0, 4)));
  for (const k of meses) {
    const [a, m] = k.split('-');
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', k === estado.mesSel);
    const temExtrato = estado.base && estado.base.meses.includes(k);
    const parcial = temExtrato ? parcialDoMes(k) : '';
    b.textContent = SIGLA[Number(m) - 1] + (anos.size > 1 ? ' ' + a.slice(2) : '');
    if (parcial) {
      const s = document.createElement('small');
      s.textContent = 'até ' + parcial;
      b.appendChild(s);
    } else if (!temExtrato && estado.base) {
      // Só marca o mês sem extrato quando existe extrato; sem nenhum, a caixa do
      // arquivo já pede o extrato, e a marca em todos os meses seria repetição.
      const s = document.createElement('small');
      s.textContent = 'só planilha';
      b.appendChild(s);
      b.classList.add('sem-extrato');
    }
    b.title = nomeDoMes(k) + (temExtrato ? '' : ', sem extrato carregado para este mês');
    b.addEventListener('click', () => escolherMes(k));
    cx.appendChild(b);
  }
  // No celular a fileira rola de lado; o mês escolhido fica à vista sem mexer na página.
  const sel = cx.querySelector('[aria-selected=true]');
  if (sel) requestAnimationFrame(() => {
    cx.scrollLeft = Math.max(0, sel.offsetLeft - cx.offsetLeft - (cx.clientWidth - sel.offsetWidth) / 2);
  });
}

function parcialDoMes(k) {
  const [d, m, a] = estado.base.ultimoDia.split('/');
  if (a + '-' + m !== k) return '';
  const fim = new Date(Number(a), Number(m), 0).getDate();
  return Number(d) < fim ? d + '/' + m : '';
}

function habilitar() {
  el('abaMes').disabled = !estado.painel;
  el('abaVendas').disabled = !estado.mesSel;
  el('btnImprimir').disabled = !estado.mesSel;
  if (estado.aba === 'mes' && !estado.painel) trocarAba('vendas', false);
  else trocarAba(estado.aba, false);
  // Sem extrato nenhum, quem pede o arquivo é a própria caixa de carregar. O aviso
  // amarelo só aparece quando há extrato, mas ele não cobre o mês escolhido.
  el('zonaExtrato').classList.toggle('falta', !estado.base && !!estado.planilha);
  const faltaMes = !!estado.base && !estado.painel && !!estado.mesSel;
  el('semExtrato').classList.toggle('escondido', !faltaMes);
  if (faltaMes) {
    const m = estado.base.meses;
    el('semExtrato').textContent = 'O extrato carregado vai de ' + nomeDoMes(m[0]) + ' a ' + nomeDoMes(m[m.length - 1]) +
      ' e não tem ' + nomeDoMes(estado.mesSel) + '. Para ver as despesas deste mês, baixe no Inter um extrato que inclua ' +
      MES_CURTO[Number(estado.mesSel.slice(5)) - 1] + '.';
  }
}

/* ---------- abas Despesas e Conciliação ---------- */
function trocarAba(qual, lembrar = true) {
  if (lembrar) { estado.aba = qual; gravar(BAU.aba, qual); }
  el('abaMes').setAttribute('aria-selected', qual === 'mes');
  el('abaVendas').setAttribute('aria-selected', qual === 'vendas');
  el('telaMes').classList.toggle('escondido', qual !== 'mes');
  el('telaVendas').classList.toggle('escondido', qual !== 'vendas');
}
el('abaMes').addEventListener('click', () => trocarAba('mes'));
el('abaVendas').addEventListener('click', () => trocarAba('vendas'));

/* ================= TELA DO MÊS ================= */

function rotuloMes(P) {
  return P.mes + (P.parcial ? ', parcial até ' + P.parcial : '');
}

function desenharMes() {
  const P = estado.painel, T = P.totais, V = estado.vendas, A = estado.vendasAnteriores;
  document.title = 'Financeiro IFT — ' + P.mes;

  el('cEnt').textContent = brl(T.entradas);
  el('nEnt').textContent = T.qtdEntradas + ' recebimentos, ' + brl(T.receitaCartao) + ' no cartão pelo link do C6' +
    (T.naoReceita ? ' e ' + brl(T.naoReceita) + ' que não são venda' : '');

  if (V) {
    el('cVenda').textContent = brl(V.venda);
    el('nVenda').textContent = V.qtd + ' orçamentos aprovados';
  } else {
    el('cVenda').textContent = estado.planilha ? 'sem vendas' : 'sem planilha';
    el('nVenda').textContent = estado.planilha ? 'A planilha não tem aprovações neste mês' : 'Carregue o Status clientes para ver as vendas';
  }

  if (A) {
    el('cVendaAnt').textContent = brl(A.venda);
    let nota = A.qtd + ' orçamentos em ' + nomeMes(estado.mesAnterior);
    if (V && A.venda > 0) {
      const var_ = ((V.venda - A.venda) / A.venda) * 100;
      const sinal = var_ >= 0 ? '+' : '−';
      nota += '. O mês escolhido está ' + sinal + Math.abs(var_).toFixed(1).replace('.', ',') + '%' +
        (P.parcial ? ', ainda parcial' : '');
    }
    el('nVendaAnt').textContent = nota;
  } else {
    el('cVendaAnt').textContent = estado.planilha ? 'sem dados' : '—';
    el('nVendaAnt').textContent = estado.planilha ? 'A planilha não tem o mês anterior' : '';
  }

  el('cSai').textContent = brl(T.saidas);
  el('nSai').textContent = T.qtdSaidas + ' pagamentos a terceiros, sem contar a conta pessoal';
  el('cPes').textContent = brl(T.pessoalIda);
  el('nPes').textContent = T.qtdPessoalIda + ' transferências enviadas, ' + brl(T.pessoalVolta) + ' devolvidos';

  const saldo = T.entradas + T.pessoalVolta - T.saidas - T.pessoalIda;
  el('rodape').textContent = 'Movimentação de ' + rotuloMes(P) + '. Entrou ' + brl(T.entradas) +
    ' e saiu ' + brl(T.saidas + T.pessoalIda) + ' somando despesas e conta pessoal, então o mês fechou em ' +
    brl(saldo) + '.';

  // Mês incompleto e devolução sem par ficam visíveis dentro do próprio mês.
  el('avisoParcial').textContent = P.parcial ? 'O extrato termina em ' + P.parcial + ', então ' + P.mes + ' ainda está incompleto.' : '';
  el('avisoParcial').classList.toggle('escondido', !P.parcial);
  desenharDevolucoes(P);

  el('notaFim').textContent = 'Foram excluídos cofrinho, CDB, aplicações e resgates, por serem movimentação dentro da própria conta. ' +
    'Os pares de estorno saíram dos dois lados para não inflar entradas nem saídas, mesmo quando a devolução caiu em outro mês. ' +
    'Pagamentos ao Mercado Pago e à Portoseg aparecem como pagamento de cartão, e as despesas que os geraram estão nas faturas. ' +
    'Depósito vindo de Isabella Fortunato Traduções pelo C6 é cliente pagando no cartão pelo link, e por isso conta como receita; ' +
    'vindo do Cora, é dinheiro da própria empresa voltando, e não conta como venda.';

  grafico(); tabelaSaidas(el('buscaSaida').value); tabelaPessoal();
}

/* ---------- devoluções sem par ----------
   Cada devolução sem par ganha um seletor dentro do aviso amarelo. Escolhido o
   destino, o aviso daquela devolução some e a conta do mês se refaz. As já
   conferidas ficam numa linha discreta, com um botão para rever a escolha. */
function linhaDevolucao(o) {
  const linha = document.createElement('div');
  linha.className = 'devolucao';
  const texto = document.createElement('span');
  texto.className = 'devolucao-texto';
  const sentido = o.valor < 0 ? 'saiu da empresa' : 'entrou na empresa';
  texto.textContent = o.data + ' · ' + o.desc + ' · ' + brl(Math.abs(o.valor)) + ', ' + sentido;
  const sel = document.createElement('select');
  sel.setAttribute('aria-label', 'O que é a devolução de ' + o.desc + ' em ' + o.data);
  const vazio = document.createElement('option');
  vazio.value = ''; vazio.textContent = 'O que é esta devolução?';
  sel.appendChild(vazio);
  for (const [valor, rotulo] of Object.entries(DESTINOS_DEVOLUCAO)) {
    const op = document.createElement('option');
    op.value = valor; op.textContent = rotulo;
    if (o.destino === valor) op.selected = true;
    sel.appendChild(op);
  }
  sel.addEventListener('change', e => {
    if (e.target.value) estado.resolucoes[o.chave] = e.target.value;
    else delete estado.resolucoes[o.chave];
    gravar(BAU.devolucoes, estado.resolucoes);
    montarMes();
    desenharMes();
    desenharVendas();
    avisar(e.target.value ? 'Devolução marcada como "' + DESTINOS_DEVOLUCAO[e.target.value] + '".' : 'Devolução voltou para a lista de pendentes.', 'ok');
  });
  const noPapel = document.createElement('span');
  noPapel.className = 'cat-papel';
  noPapel.textContent = o.destino ? DESTINOS_DEVOLUCAO[o.destino] : 'a conferir';
  linha.append(texto, sel, noPapel);
  return linha;
}

function desenharDevolucoes(P) {
  const caixa = el('caixaDevolucoes');
  caixa.innerHTML = '';
  if (P.orfaos.length) {
    const titulo = document.createElement('p');
    titulo.className = 'devolucao-titulo';
    titulo.textContent = plural(P.orfaos.length, ' devolução sem par', ' devoluções sem par') +
      ' neste mês. Pode ser devolução parcial, de um pagamento fora do extrato ou ligada à sua conta pessoal. ' +
      'Escolha o que cada uma é para tirar o aviso.';
    caixa.appendChild(titulo);
    for (const o of P.orfaos) caixa.appendChild(linhaDevolucao(o));
  }
  caixa.classList.toggle('escondido', !P.orfaos.length);

  const conf = el('conferidas');
  conf.innerHTML = '';
  conf.classList.toggle('escondido', !P.conferidas.length);
  if (!P.conferidas.length) return;
  const resumo = document.createElement('span');
  resumo.textContent = plural(P.conferidas.length, ' devolução conferida', ' devoluções conferidas') + ' por você neste mês.';
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'link';
  botao.textContent = estado.revendo ? 'fechar' : 'rever';
  botao.addEventListener('click', () => { estado.revendo = !estado.revendo; desenharDevolucoes(estado.painel); });
  const topo = document.createElement('div');
  topo.append(resumo, ' ', botao);
  conf.appendChild(topo);
  if (estado.revendo) for (const o of P.conferidas) conf.appendChild(linhaDevolucao(o));
}

function nomeMes(ref) {
  return ref ? MES_CURTO[ref.mes - 1] + ' de ' + ref.ano : '';
}

/* ---------- gráfico de barras horizontal ----------
   Uma série só, então uma cor só e rótulo direto em cada barra: legenda seria
   ruído. A categoria pendente sai em outro tom para pular aos olhos. */
function desenhaGrafico(destino, itens, aoPassar, aoClicar) {
  const cx = el(destino);
  cx.innerHTML = '';
  if (!itens.length) return;
  const maior = Math.max(...itens.map(i => i.valor)) || 1;
  const total = itens.reduce((a, b) => a + b.valor, 0);

  for (const item of itens) {
    const linha = document.createElement('div');
    linha.className = 'linha-barra' + (item.pendente ? ' pendente' : '') + (item.atual ? ' atual' : '');

    const rotulo = document.createElement('span');
    rotulo.className = 'rotulo-cat';
    rotulo.textContent = item.nome;
    if (item.detalhe) {
      const d = document.createElement('small');
      d.textContent = item.detalhe;
      rotulo.appendChild(d);
    }

    const pista = document.createElement('div');
    pista.className = 'pista';
    const marca = document.createElement('div');
    marca.className = 'marca';
    marca.style.width = Math.max(0, (item.valor / maior) * 100) + '%';
    pista.appendChild(marca);

    const cifra = document.createElement('span');
    cifra.className = 'cifra-cat';
    cifra.textContent = brl(item.valor);

    linha.append(rotulo, pista, cifra);

    const fatia = total ? (item.valor / total) * 100 : 0;
    linha.addEventListener('mousemove', e => mostrarDica(e, aoPassar(item, fatia)));
    linha.addEventListener('mouseleave', esconderDica);
    if (aoClicar) {
      linha.classList.add('clicavel');
      linha.addEventListener('click', () => { esconderDica(); aoClicar(item); });
    }
    cx.appendChild(linha);
  }
}

function mostrarDica(evento, html) {
  const d = el('dica');
  d.innerHTML = html;
  d.hidden = false;
  const larg = d.offsetWidth, alt = d.offsetHeight;
  let x = evento.clientX + 14, y = evento.clientY + 14;
  if (x + larg > window.innerWidth - 8) x = evento.clientX - larg - 14;
  if (y + alt > window.innerHeight - 8) y = evento.clientY - alt - 14;
  d.style.left = x + 'px';
  d.style.top = y + 'px';
}
function esconderDica() { el('dica').hidden = true; }

/* O nome do favorecido vem do extrato e vai para a dica como HTML. */
const escapar = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function grafico() {
  const mapa = new Map();
  for (const l of estado.painel.saidas) {
    const a = mapa.get(l.cat) || { soma: 0, qtd: 0 };
    a.soma += l.valor; a.qtd++;
    mapa.set(l.cat, a);
  }
  const itens = [...mapa.entries()].sort((a, b) => b[1].soma - a[1].soma)
    .map(([nome, a]) => ({ nome, valor: arred(a.soma),
      detalhe: plural(a.qtd, ' lançamento', ' lançamentos'),
      pendente: nome === 'A confirmar' }));

  const total = arred(itens.reduce((a, b) => a + b.valor, 0));
  const pend = itens.find(i => i.pendente);
  el('subGrafico').textContent = !itens.length ? 'Nenhuma despesa neste mês.' :
    plural(itens.length, ' categoria', ' categorias') + ' somando ' + brl(total) +
    (pend ? '. Ainda há ' + brl(pend.valor) + ' sem categoria, que é ' +
      ((pend.valor / total) * 100).toFixed(0) + '% do total.' : '. Tudo categorizado.');

  desenhaGrafico('grafico', itens, (item, fatia) =>
    '<b>' + escapar(item.nome) + '</b><br><span class="mono">' + brl(item.valor) + '</span> em ' +
    item.detalhe.trim() + '<br>' + fatia.toFixed(1).replace('.', ',') + '% das despesas do mês');
}

function tabelaSaidas(filtro) {
  const corpo = el('corpoSaida');
  corpo.innerHTML = '';
  const termo = (filtro || '').trim().toLowerCase();
  let vis = 0;
  for (const l of estado.painel.saidas) {
    if (termo && !(l.desc + ' ' + l.cat).toLowerCase().includes(termo)) continue;
    vis++;
    const tr = document.createElement('tr');
    const td1 = document.createElement('td'); td1.className = 'data'; td1.textContent = l.data;
    const td2 = document.createElement('td'); td2.className = 'desc'; td2.textContent = l.desc;
    const sp = document.createElement('span'); sp.className = 'tipo'; sp.textContent = l.hist;
    td2.appendChild(sp);
    const td3 = document.createElement('td');
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Categoria de ' + l.desc);
    for (const c of estado.painel.cats) {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      if (c === l.cat) o.selected = true;
      sel.appendChild(o);
    }
    if (l.cat === 'A confirmar') sel.classList.add('pendente');
    sel.addEventListener('change', e => {
      const valor = e.target.value;
      // A escolha vale para o favorecido em todos os meses, não só neste.
      if (valor === 'A confirmar') delete estado.categorias[l.desc];
      else estado.categorias[l.desc] = valor;
      const mudadas = estado.painel.saidas.filter(o => o.desc === l.desc).length;
      gravar(BAU.categorias, estado.categorias);
      montarMes();
      desenharMes();
      avisar(mudadas > 1
        ? mudadas + ' lançamentos de ' + l.desc + ' neste mês foram categorizados como ' + valor + '. A escolha vale também para os outros meses.'
        : 'Categoria salva, e vale também para os outros meses.', 'ok');
    });
    td3.appendChild(sel);
    // O seletor não vai para o papel, então a categoria também existe como texto.
    const noPapel = document.createElement('span');
    noPapel.className = 'cat-papel';
    noPapel.textContent = l.cat;
    td3.appendChild(noPapel);
    const td4 = document.createElement('td');
    td4.className = 'valor menos';
    td4.textContent = '− ' + brl(l.valor);
    tr.append(td1, td2, td3, td4);
    corpo.appendChild(tr);
  }
  el('vazioSaida').classList.toggle('escondido', vis > 0);
  el('vazioSaida').textContent = estado.painel.saidas.length ? 'Nenhuma linha corresponde à busca.' : 'Nenhuma despesa neste mês.';
  el('contaSaida').textContent = vis + ' de ' + estado.painel.saidas.length + ' linhas';
}

function obsEntrada(l) {
  if (l.via === 'cartao') return 'Cartão pelo link do C6';
  if (l.via === 'outra') return 'Conta da empresa em outro banco (código ' + l.banco + '), a confirmar';
  return l.obs || '';
}

function tabelaEntradas(filtro) {
  const corpo = el('corpoEnt');
  corpo.innerHTML = '';
  const termo = (filtro || '').trim().toLowerCase();
  let vis = 0;
  for (const l of estado.painel.entradas) {
    if (termo && !(l.desc + ' ' + obsEntrada(l)).toLowerCase().includes(termo)) continue;
    vis++;
    const tr = document.createElement('tr');
    const td1 = document.createElement('td'); td1.className = 'data'; td1.textContent = l.data;
    const td2 = document.createElement('td'); td2.className = 'desc'; td2.textContent = l.desc;
    const sp = document.createElement('span'); sp.className = 'tipo'; sp.textContent = l.hist;
    td2.appendChild(sp);
    const td3 = document.createElement('td'); td3.className = 'obs';
    td3.textContent = obsEntrada(l);
    const td4 = document.createElement('td');
    td4.className = 'valor mais';
    td4.textContent = '+ ' + brl(l.valor);
    tr.append(td1, td2, td3, td4);
    corpo.appendChild(tr);
  }
  el('vazioEnt').classList.toggle('escondido', vis > 0);
  el('vazioEnt').textContent = estado.painel.entradas.length ? 'Nenhuma linha corresponde à busca.' : 'Nenhuma entrada neste mês.';
  el('contaEnt').textContent = vis + ' de ' + estado.painel.entradas.length + ' linhas';
}

function tabelaPessoal() {
  const corpo = el('corpoPes');
  corpo.innerHTML = '';
  for (const l of estado.painel.pessoal) {
    const tr = document.createElement('tr');
    const a = document.createElement('td'); a.className = 'data'; a.textContent = l.data;
    const b = document.createElement('td');
    b.textContent = l.nota
      ? l.nota + ', ' + l.desc + (l.sentido === 'saida' ? ', saiu da empresa' : ', entrou na empresa')
      : (l.sentido === 'saida' ? 'Enviado para a conta pessoal' : 'Devolvido para a empresa');
    const c = document.createElement('td');
    c.className = 'valor ' + (l.sentido === 'saida' ? 'menos' : 'mais');
    c.textContent = (l.sentido === 'saida' ? '− ' : '+ ') + brl(l.valor);
    tr.append(a, b, c);
    corpo.appendChild(tr);
  }
  el('vazioPes').classList.toggle('escondido', estado.painel.pessoal.length > 0);
}

el('buscaSaida').addEventListener('input', e => { if (estado.painel) tabelaSaidas(e.target.value); });
el('buscaEnt').addEventListener('input', e => { if (estado.painel) tabelaEntradas(e.target.value); });

el('btnSalvar').addEventListener('click', () => {
  const conteudo = JSON.stringify({ categorias: estado.categorias, devolucoes: estado.resolucoes }, null, 2);
  const blob = new Blob([conteudo], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Categorias Financeiro IFT.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  avisar('Arquivo de categorias baixado, com ' + plural(Object.keys(estado.categorias).length, ' favorecido.', ' favorecidos.'), 'ok');
});

el('btnCarregar').addEventListener('click', () => el('arqCategorias').click());
el('arqCategorias').addEventListener('change', evento => {
  const arquivo = evento.target.files[0];
  evento.target.value = '';
  if (!arquivo) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    try {
      const lido = JSON.parse(leitor.result);
      const novas = filtrarEscolhas(lido.categorias || lido);
      Object.assign(estado.categorias, novas);
      gravar(BAU.categorias, estado.categorias);
      // As devoluções conferidas viajam no mesmo arquivo.
      for (const [k, v] of Object.entries(lido.devolucoes || {})) {
        if (DESTINOS_DEVOLUCAO[v]) estado.resolucoes[k] = v;
      }
      gravar(BAU.devolucoes, estado.resolucoes);
      if (estado.painel) { montarMes(); desenharMes(); }
      avisar(plural(Object.keys(novas).length, ' favorecido recuperado.', ' favorecidos recuperados.'), 'ok');
    } catch (e) {
      avisar('Não consegui ler esse arquivo. Ele precisa ser o JSON que o botão de salvar gera.', 'erro', true);
    }
  };
  leitor.readAsText(arquivo);
});

/* ================= RELATÓRIO IMPRESSO ================= */

/* A impressão mostra as duas telas de uma vez, então a página precisa sair do
   modo de abas e voltar ao normal depois. Fazemos isso pelos eventos do próprio
   navegador, e não só no clique, para funcionar também quando a pessoa usa
   Ctrl+P ou manda imprimir pelo menu. */
function prepararPapel() {
  if (!estado.mesSel) return;
  document.body.classList.toggle('com-tabelas', el('optTabelas').checked);

  const quando = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  el('capaTitulo').textContent = 'Relatório de ' + nomeDoMes(estado.mesSel);
  el('capaNota').textContent = 'Emitido em ' + quando +
    (estado.painel && estado.painel.parcial ? '. Mês parcial, com o extrato até ' + estado.painel.parcial : '') +
    (estado.planilha ? '. Vendas pela data de aprovação, que é a data do pagamento.' : '.') +
    (estado.painel && !estado.planilha ? ' Sem a planilha carregada, o relatório sai sem a parte de vendas.' : '') +
    (!estado.painel ? ' Sem extrato deste mês, o relatório sai só com a parte de vendas.' : '');

  // As duas telas precisam estar montadas, mesmo a que está fechada na tela.
  el('telaMes').classList.toggle('escondido', !estado.painel);
  el('telaVendas').classList.toggle('escondido', !estado.planilha && !estado.painel);
}

function restaurarTela() {
  document.body.classList.remove('com-tabelas');
  trocarAba(estado.aba === 'mes' && !estado.painel ? 'vendas' : estado.aba, false);
}

window.addEventListener('beforeprint', prepararPapel);
window.addEventListener('afterprint', restaurarTela);

el('btnImprimir').addEventListener('click', () => {
  prepararPapel();
  // Um respiro para o navegador refazer o layout antes de abrir a impressão.
  setTimeout(() => { window.print(); restaurarTela(); }, 60);
});

/* ================= TELA DE CONCILIAÇÃO ================= */

function desenharVendas() {
  const P = estado.painel, V = estado.vendas;
  const linhas = estado.planilha;
  const anual = linhas ? resumoAnual(linhas) : [];
  const k = estado.mesSel;

  if (P && V) {
    const T = P.totais;
    el('kVenda').textContent = brl(V.venda);
    el('kVendaNota').textContent = V.qtd + ' orçamentos aprovados em ' + P.mes;
    el('kEnt').textContent = brl(T.entradas);
    el('kEntNota').textContent = T.qtdEntradas + ' recebimentos no extrato';
    const dif = T.entradas - V.venda;
    const elDif = el('kDif');
    elDif.textContent = (dif < 0 ? '− ' : '+ ') + brl(Math.abs(dif));
    elDif.style.color = dif < 0 ? 'var(--saida)' : 'var(--entrada)';
    const parc = (V.regimes.parceiro || { valor: 0, qtd: 0 });
    el('kParceiro').textContent = brl(parc.valor);
    el('kParceiroNota').textContent = plural(parc.qtd, ' orçamento fechado com parceiro', ' orçamentos fechados com parceiros') +
      ', para entrar no caixa do mês seguinte';
    el('kRodape').textContent = 'Conciliação de ' + rotuloMes(P) +
      '. Venda é o que foi fechado com o cliente, entrada é o que o banco recebeu, e a diferença tem explicação, não é erro.';
    el('kDifNota').textContent = 'Explicada passo a passo logo abaixo';
    el('secaoPonte').classList.remove('escondido');
    ponte();
  } else {
    el('kDif').style.color = '';
    for (const id of ['kVenda', 'kEnt', 'kDif', 'kParceiro']) el(id).textContent = '—';
    if (V) {
      el('kVenda').textContent = brl(V.venda);
      const parc = (V.regimes.parceiro || { valor: 0, qtd: 0 });
      el('kParceiro').textContent = brl(parc.valor);
      el('kParceiroNota').textContent = plural(parc.qtd, ' orçamento fechado com parceiro', ' orçamentos fechados com parceiros');
      el('kVendaNota').textContent = V.qtd + ' orçamentos aprovados em ' + nomeDoMes(k);
    } else {
      el('kVendaNota').textContent = !linhas ? 'Carregue a planilha para conciliar' : 'A planilha não tem aprovações neste mês';
      el('kParceiroNota').textContent = '';
    }
    if (P) {
      el('kEnt').textContent = brl(P.totais.entradas);
      el('kEntNota').textContent = P.totais.qtdEntradas + ' recebimentos no extrato';
    } else {
      el('kEntNota').textContent = estado.base ? 'O extrato carregado não tem este mês' : 'Carregue o extrato do Inter';
    }
    el('kRodape').textContent = 'A conciliação precisa do extrato e da planilha do mesmo mês. Abaixo, o que dá para ver com o que foi carregado.';
    el('kDifNota').textContent = 'Aparece quando houver extrato e planilha deste mês';
    el('secaoPonte').classList.add('escondido');
  }

  if (P) { tabelaEntradas(el('buscaEnt').value); el('secEntradas').classList.remove('escondido'); }
  else el('secEntradas').classList.add('escondido');

  // Linhas da planilha com data ilegível: a venda delas não entra em mês nenhum.
  const prob = estado.problemas || [];
  el('avisoPlanilha').classList.toggle('escondido', !prob.length);
  if (prob.length) {
    el('avisoPlanilha').textContent = 'A planilha tem ' + plural(prob.length, ' linha', ' linhas') +
      ' com a data de aprovação ilegível, que ficam fora de todos os meses até serem corrigidas: ' +
      prob.map(p => 'aba ' + p.aba + ', linha ' + p.linha + ' (' + (p.cli || 'sem cliente') +
        (p.orc ? ', orçamento ' + p.orc : '') + ', escrito "' + p.valor + '")').join('; ') + '.';
  }

  el('secParceiros').classList.toggle('escondido', !linhas);
  el('secVendasAno').classList.toggle('escondido', !linhas);
  if (!linhas) return;

  desenhaGrafico('graficoVendas', anual.map(m => ({
    nome: MES_CURTO[m.mes - 1] + ' de ' + m.ano,
    valor: m.venda,
    detalhe: m.qtd + ' orçamentos',
    chave: m.chave,
    atual: m.chave === k,
  })), (item, fatia) => '<b>' + item.nome + '</b><br><span class="mono">' + brl(item.valor) +
    '</span> em ' + item.detalhe + '<br>' + fatia.toFixed(1).replace('.', ',') + '% do período<br>Clique para abrir este mês',
  item => escolherMes(item.chave));

  tabelaParceiros();
}

/* A ponte desce da venda do mês até o dinheiro que entrou, passo a passo. */
function ponte() {
  const P = estado.painel, T = P.totais, V = estado.vendas;
  if (!V) return;
  const R = n => V.regimes[n] || { valor: 0, qtd: 0 };
  const parceiro = R('parceiro'), cartao = R('cartao'), faturado = R('faturado'), pix = R('pix');

  const passos = [
    { classe: 'base', texto: 'Vendido no mês',
      nota: V.qtd + ' orçamentos: tradução ' + brl(V.traducao) + ', diligência de cartório ' +
            brl(V.dilCartorio) + ' e diligência de envio ' + brl(V.dilEnvio),
      valor: V.venda, sinal: '' },
    { classe: 'menos', texto: 'Parceiro, acerta no mês seguinte',
      nota: plural(parceiro.qtd, ' orçamento de parceiro', ' orçamentos de parceiros') + ', que entram no caixa do mês que vem',
      valor: -parceiro.valor, sinal: '− ' },
    { classe: 'menos', texto: 'Cartão pelo link, cai 14 dias depois',
      nota: plural(cartao.qtd, ' orçamento no cartão', ' orçamentos no cartão') + ', que chegam pelo C6 duas semanas após a aprovação',
      valor: -cartao.valor, sinal: '− ' },
  ];
  if (faturado.valor > 0) {
    passos.push({ classe: 'menos', texto: 'Faturado, sem data de recebimento',
      nota: plural(faturado.qtd, ' orçamento faturado', ' orçamentos faturados'),
      valor: -faturado.valor, sinal: '− ' });
  }
  const proprioMes = arred(V.venda - parceiro.valor - cartao.valor - faturado.valor);
  passos.push({ classe: '', texto: 'Venda paga no próprio mês',
    nota: plural(pix.qtd, ' orçamento no pix, pago na aprovação', ' orçamentos no pix, pagos na aprovação'),
    valor: proprioMes, sinal: '' });
  passos.push({ classe: 'mais', texto: 'Correio e DHL cobrados do cliente',
    nota: 'Reembolso do envio, que entra na conta mas não é venda', valor: V.correio, sinal: '+ ' });
  if (T.naoReceita > 0) {
    passos.push({ classe: 'mais', texto: 'Entradas que não são venda',
      nota: plural(T.qtdNaoReceita, ' lançamento', ' lançamentos') + ', como retorno do Cora, devolução ou estorno de cartão. Estão marcados na lista de entradas',
      valor: T.naoReceita, sinal: '+ ' });
  }

  const anterior = arred(T.entradas - proprioMes - V.correio - T.naoReceita);
  passos.push({ classe: anterior < 0 ? 'menos' : 'mais', texto: 'Recebido de meses anteriores',
    nota: 'Parceiros acertando o mês passado e cartão aprovado antes. Do C6 chegaram ' + brl(T.receitaCartao) + ' neste mês',
    valor: anterior, sinal: anterior < 0 ? '− ' : '+ ' });
  passos.push({ classe: 'fecho', texto: 'Dinheiro que entrou na conta',
    nota: T.qtdEntradas + ' recebimentos no extrato do Inter', valor: T.entradas, sinal: '' });

  const cx = el('ponte');
  cx.innerHTML = '';
  for (const p of passos) {
    const linha = document.createElement('div');
    linha.className = 'passo ' + p.classe;
    const texto = document.createElement('span');
    texto.className = 'texto';
    texto.textContent = p.texto;
    const nota = document.createElement('small');
    nota.textContent = p.nota;
    texto.appendChild(nota);
    const cifra = document.createElement('span');
    cifra.className = 'cifra';
    cifra.textContent = p.sinal + brl(Math.abs(p.valor));
    linha.append(texto, cifra);
    cx.appendChild(linha);
  }
}

/* Parceiros que fecharam no mês escolhido. O acerto deles cai no mês seguinte,
   então é nas entradas do mês seguinte que a página procura o pagamento. */
function tabelaParceiros() {
  const { ano, mes } = estado.ref;
  const lista = parceirosPorMes(estado.planilha, ano, mes);
  const corpo = el('corpoParceiro');
  corpo.innerHTML = '';
  const seguinte = mes === 12 ? chaveDe(ano + 1, 1) : chaveDe(ano, mes + 1);
  const temSeguinte = estado.base && estado.base.meses.includes(seguinte);
  const entradas = temSeguinte ? painelDoMes(estado.base, seguinte, estado.categorias, estado.resolucoes).entradas : null;
  el('thEncontrado').textContent = 'Encontrado em ' + MES_CURTO[Number(seguinte.slice(5)) - 1];

  for (const p of lista) {
    const tr = document.createElement('tr');
    const nome = document.createElement('td'); nome.className = 'desc'; nome.textContent = p.nome;
    const q = document.createElement('td'); q.className = 'valor'; q.textContent = p.qtd;
    const v = document.createElement('td'); v.className = 'valor'; v.textContent = brl(p.valor);
    const c = document.createElement('td'); c.className = 'valor'; c.textContent = p.correio ? brl(p.correio) : '—';
    const r = document.createElement('td'); r.className = 'valor';
    if (!entradas) {
      r.textContent = '—';
      r.title = 'O extrato carregado não tem ' + nomeDoMes(seguinte) + ', que é quando o parceiro acerta.';
    } else {
      const achado = recebidoDe(p.nome, entradas);
      r.textContent = achado.qtd ? brl(achado.valor) : 'nada encontrado';
      r.classList.add(achado.valor >= p.valor ? 'mais' : 'menos');
      r.title = achado.qtd ? achado.qtd + ' lançamentos com esse nome em ' + nomeDoMes(seguinte) : '';
    }
    tr.append(nome, q, v, c, r);
    corpo.appendChild(tr);
  }
  el('vazioParceiro').classList.toggle('escondido', lista.length > 0);
  const soma = arred(lista.reduce((a, b) => a + b.valor, 0));
  el('contaParceiro').textContent = lista.length
    ? plural(lista.length, ' parceiro, ', ' parceiros, ') + brl(soma) + ' fechados em ' + nomeDoMes(estado.mesSel)
    : '';
}

recuperarDados();
