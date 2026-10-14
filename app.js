/* Interface do Financeiro IFT. A conta mora em nucleo.js; aqui só desenhamos. */

const brl = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const el = id => document.getElementById(id);
const plural = (q, um, muitos) => q + (q === 1 ? um : muitos);

const MES_CURTO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const estado = { painel: null, planilha: null, vendas: null, vendasAnteriores: null,
  mesAnterior: null, aba: 'mes', nomes: {} };

/* ---------- avisos ---------- */
let relogioAviso = null;
function avisar(texto, tipo = 'ok', fixo = false) {
  const caixa = el('aviso');
  caixa.textContent = texto;
  caixa.className = 'aviso ' + tipo;
  clearTimeout(relogioAviso);
  if (!fixo) relogioAviso = setTimeout(() => caixa.classList.add('escondido'), 7000);
}

/* ---------- categorias guardadas ---------- */
const chaveLocal = () => 'financeiro-ift-' + (estado.painel ? estado.painel.mes.replace(/ /g, '-') : 'mes');

function mapaAtual() {
  const m = {};
  if (estado.painel) for (const l of estado.painel.saidas) {
    if (l.cat && l.cat !== 'A confirmar') m[l.desc] = l.cat;
  }
  return m;
}
function guardar() {
  try { localStorage.setItem(chaveLocal(), JSON.stringify(mapaAtual())); } catch (e) { /* janela anônima */ }
  guardarDados();
}
function lerGuardado(mes) {
  try {
    const bruto = localStorage.getItem('financeiro-ift-' + mes.replace(/ /g, '-'));
    return bruto ? JSON.parse(bruto) : {};
  } catch (e) { return {}; }
}
function aplicarMapa(mapa) {
  let n = 0;
  for (const l of estado.painel.saidas) {
    if (mapa[l.desc] && mapa[l.desc] !== l.cat) { l.cat = mapa[l.desc]; n++; }
  }
  return n;
}

/* ---------- memória do navegador ----------
   O que você carrega fica guardado nesta máquina, para a página já abrir com os
   dados do último uso. Nada disso vai para o GitHub nem para servidor nenhum:
   mora apenas neste navegador, e o botão de esquecer apaga tudo. */
const BAU = {
  extrato: 'financeiro-ift-dados-extrato',
  planilha: 'financeiro-ift-dados-planilha',
  nomes: 'financeiro-ift-nomes',
};

function guardarDados() {
  try {
    if (estado.painel) localStorage.setItem(BAU.extrato, JSON.stringify(estado.painel));
    if (estado.planilha) localStorage.setItem(BAU.planilha, JSON.stringify(estado.planilha));
    localStorage.setItem(BAU.nomes, JSON.stringify(estado.nomes));
  } catch (e) {
    // Janela anônima ou armazenamento cheio: a página segue funcionando sem memória.
    avisar('Não consegui guardar os dados neste navegador, então eles valem só enquanto a página estiver aberta. Costuma acontecer em janela anônima.', 'atencao');
  }
}

function recuperarDados() {
  try {
    const nomes = localStorage.getItem(BAU.nomes);
    if (nomes) estado.nomes = JSON.parse(nomes);
    const extrato = localStorage.getItem(BAU.extrato);
    if (extrato) {
      estado.painel = JSON.parse(extrato);
      marcarZona('zonaExtrato', 'nomeExtrato', estado.nomes.extrato);
    }
    const planilha = localStorage.getItem(BAU.planilha);
    if (planilha) {
      estado.planilha = JSON.parse(planilha);
      marcarZona('zonaPlanilha', 'nomePlanilha', estado.nomes.planilha);
    }
  } catch (e) { /* dado corrompido: começa do zero */ }

  if (!estado.painel && !estado.planilha) return;
  casarVendas();
  if (estado.painel) desenharMes();
  desenharVendas();
  habilitar();
  mostrarMemoria();
}

function marcarZona(idZona, idNome, nomeArquivo) {
  if (!nomeArquivo) return;
  el(idZona).classList.add('pronto');
  el(idNome).textContent = nomeArquivo;
}

function mostrarMemoria() {
  const partes = [];
  if (estado.painel) partes.push('extrato de ' + estado.painel.mes);
  if (estado.planilha) partes.push('planilha com ' + estado.planilha.length + ' orçamentos');
  if (!partes.length) { el('memoria').classList.add('escondido'); return; }
  el('memoriaTexto').textContent = 'Guardado neste navegador: ' + partes.join(' e ') +
    '. Carregar um arquivo novo substitui o anterior.';
  el('memoria').classList.remove('escondido');
}

el('btnEsquecer').addEventListener('click', () => {
  for (const chave of Object.values(BAU)) {
    try { localStorage.removeItem(chave); } catch (e) { /* nada a fazer */ }
  }
  location.reload();
});

/* ---------- carregar arquivos ---------- */
function ligarZona(idZona, idInput, aoLer, comoTexto) {
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
        zona.classList.remove('pronto');
        avisar('Não consegui ler ' + arquivo.name + '. ' + erro.message, 'erro', true);
      }
    };
    leitor.onerror = () => avisar('O navegador não conseguiu abrir ' + arquivo.name + '.', 'erro', true);
    if (comoTexto) leitor.readAsText(arquivo, 'utf-8'); else leitor.readAsArrayBuffer(arquivo);
  };
  entrada.addEventListener('change', e => processa(e.target.files[0]));
  ['dragenter', 'dragover'].forEach(ev => zona.addEventListener(ev, e => {
    e.preventDefault(); zona.classList.add('sobre');
  }));
  ['dragleave', 'drop'].forEach(ev => zona.addEventListener(ev, e => {
    e.preventDefault(); zona.classList.remove('sobre');
  }));
  zona.addEventListener('drop', e => processa(e.dataTransfer.files[0]));
}

ligarZona('zonaExtrato', 'arqExtrato', (nome, buffer) => {
  // Lido como bytes para o núcleo decidir a codificação, já que o Inter exporta
  // ora em UTF-8, ora em ANSI.
  const painel = processarExtrato(nome, new Uint8Array(buffer));
  estado.painel = painel;
  aplicarMapa(lerGuardado(painel.mes));
  casarVendas();
  desenharMes();
  desenharVendas();
  habilitar();
  const d = painel.diagnostico;
  let texto2 = 'Extrato de ' + painel.mes + ' lido: ' + d.lidos + ' lançamentos, ' +
    d.internos + ' de CDB e aplicações fora da conta e ' + d.estornos + ' retirados em pares de estorno.';
  if (d.foraDoMes) texto2 += ' ' + d.foraDoMes + ' lançamentos de outro mês foram descartados.';
  avisar(texto2, 'ok');
  if (painel.orfaos.length) {
    const lista = painel.orfaos.map(o => o.desc + ' em ' + o.data + ', ' + brl(Math.abs(o.valor))).join('; ');
    avisar('Atenção: devolução sem par de mesmo valor, que pode ser devolução parcial. Não abati nada sozinho. ' + lista, 'atencao', true);
  }
}, false);

ligarZona('zonaPlanilha', 'arqPlanilha', (nome, buffer) => {
  if (typeof XLSX === 'undefined') throw new Error('A biblioteca de planilhas não carregou. Confira a conexão e recarregue a página.');
  const livro = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
  const linhas = lerPlanilha(livro, XLSX);
  if (!linhas.length) throw new Error('Não achei nenhuma linha com data de aprovação nas abas de meses.');
  estado.planilha = linhas;
  casarVendas();
  desenharVendas();
  if (estado.painel) desenharMes();
  habilitar();
  avisar('Planilha lida: ' + linhas.length + ' orçamentos aprovados em ' +
    resumoAnual(linhas).length + ' meses.', 'ok');
}, false);

function casarVendas() {
  if (!estado.planilha || !estado.painel) {
    estado.vendas = estado.vendasAnteriores = estado.mesAnterior = null;
    return;
  }
  estado.vendas = vendasDoMes(estado.planilha, estado.painel.ano, estado.painel.mesNum);
  estado.mesAnterior = mesAnterior(estado.painel.ano, estado.painel.mesNum);
  estado.vendasAnteriores = vendasDoMes(estado.planilha, estado.mesAnterior.ano, estado.mesAnterior.mes);
}

function habilitar() {
  el('abaMes').disabled = !estado.painel;
  el('abaVendas').disabled = !estado.painel && !estado.planilha;
  el('btnImprimir').disabled = !estado.painel && !estado.planilha;
  if (estado.painel && estado.aba === 'mes') trocarAba('mes');
  else if (estado.planilha && !estado.painel) trocarAba('vendas');
}

/* ---------- abas ---------- */
function trocarAba(qual) {
  estado.aba = qual;
  el('abaMes').setAttribute('aria-selected', qual === 'mes');
  el('abaVendas').setAttribute('aria-selected', qual === 'vendas');
  el('telaMes').classList.toggle('escondido', qual !== 'mes');
  el('telaVendas').classList.toggle('escondido', qual !== 'vendas');
}
el('abaMes').addEventListener('click', () => trocarAba('mes'));
el('abaVendas').addEventListener('click', () => trocarAba('vendas'));

/* ================= TELA DO MÊS ================= */

function desenharMes() {
  const P = estado.painel, T = P.totais, V = estado.vendas, A = estado.vendasAnteriores;
  document.title = 'Financeiro IFT — ' + P.mes;

  el('cEnt').textContent = brl(T.entradas);
  el('nEnt').textContent = T.qtdEntradas + ' recebimentos, ' + brl(T.receitaCartao) + ' no cartão pelo link do C6';

  if (V) {
    el('cVenda').textContent = brl(V.venda);
    el('nVenda').textContent = V.qtd + ' orçamentos aprovados';
  } else {
    el('cVenda').textContent = 'sem planilha';
    el('nVenda').textContent = 'Carregue o Status clientes para ver as vendas';
  }

  if (A) {
    el('cVendaAnt').textContent = brl(A.venda);
    let nota = A.qtd + ' orçamentos em ' + nomeMes(estado.mesAnterior);
    if (V && A.venda > 0) {
      const var_ = ((V.venda - A.venda) / A.venda) * 100;
      const sinal = var_ >= 0 ? '+' : '\u2212';
      nota += '. O mês atual está ' + sinal + Math.abs(var_).toFixed(1).replace('.', ',') + '%';
    }
    el('nVendaAnt').textContent = nota;
  } else {
    el('cVendaAnt').textContent = V ? 'sem dados' : '\u2014';
    el('nVendaAnt').textContent = V ? 'A planilha não tem o mês anterior' : '';
  }

  el('cSai').textContent = brl(T.saidas);
  el('nSai').textContent = T.qtdSaidas + ' pagamentos a terceiros, sem contar a conta pessoal';
  el('cPes').textContent = brl(T.pessoalIda);
  el('nPes').textContent = T.qtdPessoalIda + ' transferências enviadas, ' + brl(T.pessoalVolta) + ' devolvidos';

  const saldo = T.entradas + T.pessoalVolta - T.saidas - T.pessoalIda;
  el('rodape').innerHTML = '';
  el('rodape').textContent = 'Movimentação de ' + P.mes + '. Entrou ' + brl(T.entradas) +
    ' e saiu ' + brl(T.saidas + T.pessoalIda) + ' somando despesas e conta pessoal, então o mês fechou em ' +
    brl(saldo) + '.';

  el('notaFim').textContent = 'Foram excluídos cofrinho, CDB, aplicações e resgates, por serem movimentação dentro da própria conta. ' +
    'Os pares de estorno saíram dos dois lados para não inflar entradas nem saídas. Pagamentos ao Mercado Pago e à Portoseg ' +
    'aparecem como pagamento de cartão, e as despesas que os geraram estão nas faturas. Depósito vindo de Isabella Fortunato ' +
    'Traduções é cliente pagando no cartão pelo link do C6, e por isso conta como receita.';

  grafico(); tabelaSaidas(''); tabelaPessoal();
}

function nomeMes(ref) {
  return ref ? MES_CURTO[ref.mes - 1] + ' de ' + ref.ano : '';
}

/* ---------- gráfico de barras horizontal ----------
   Uma série só, então uma cor só e rótulo direto em cada barra: legenda seria
   ruído. A categoria pendente sai em outro tom para pular aos olhos. */
function desenhaGrafico(destino, itens, aoPassar) {
  const cx = el(destino);
  cx.innerHTML = '';
  if (!itens.length) return;
  const maior = Math.max(...itens.map(i => i.valor)) || 1;
  const total = itens.reduce((a, b) => a + b.valor, 0);

  for (const item of itens) {
    const linha = document.createElement('div');
    linha.className = 'linha-barra' + (item.pendente ? ' pendente' : '');

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
    marca.style.width = ((item.valor / maior) * 100) + '%';
    pista.appendChild(marca);

    const cifra = document.createElement('span');
    cifra.className = 'cifra-cat';
    cifra.textContent = brl(item.valor);

    linha.append(rotulo, pista, cifra);

    const fatia = total ? (item.valor / total) * 100 : 0;
    linha.addEventListener('mousemove', e => mostrarDica(e, aoPassar(item, fatia)));
    linha.addEventListener('mouseleave', esconderDica);
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
  el('subGrafico').textContent = itens.length + ' categorias somando ' + brl(total) +
    (pend ? '. Ainda há ' + brl(pend.valor) + ' sem categoria, que é ' +
      ((pend.valor / total) * 100).toFixed(0) + '% do total.' : '. Tudo categorizado.');

  desenhaGrafico('grafico', itens, (item, fatia) =>
    '<b>' + item.nome + '</b><br><span class="mono">' + brl(item.valor) + '</span> em ' +
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
      let mudadas = 0;
      for (const o of estado.painel.saidas) if (o.desc === l.desc) { o.cat = valor; mudadas++; }
      guardar();
      tabelaSaidas(el('buscaSaida').value);
      grafico();
      avisar(mudadas > 1
        ? mudadas + ' lançamentos de ' + l.desc + ' foram categorizados como ' + valor + '.'
        : 'Categoria salva.', 'ok');
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
  el('contaSaida').textContent = vis + ' de ' + estado.painel.saidas.length + ' linhas';
}

function tabelaEntradas(filtro) {
  const corpo = el('corpoEnt');
  corpo.innerHTML = '';
  const termo = (filtro || '').trim().toLowerCase();
  let vis = 0;
  for (const l of estado.painel.entradas) {
    if (termo && !(l.desc + ' ' + (l.obs || '')).toLowerCase().includes(termo)) continue;
    vis++;
    const tr = document.createElement('tr');
    const td1 = document.createElement('td'); td1.className = 'data'; td1.textContent = l.data;
    const td2 = document.createElement('td'); td2.className = 'desc'; td2.textContent = l.desc;
    const sp = document.createElement('span'); sp.className = 'tipo'; sp.textContent = l.hist;
    td2.appendChild(sp);
    const td3 = document.createElement('td'); td3.className = 'obs';
    td3.textContent = l.via === 'cartao' ? 'Cartão pelo link do C6' : (l.obs || '');
    const td4 = document.createElement('td');
    td4.className = 'valor mais';
    td4.textContent = '+ ' + brl(l.valor);
    tr.append(td1, td2, td3, td4);
    corpo.appendChild(tr);
  }
  el('vazioEnt').classList.toggle('escondido', vis > 0);
  el('contaEnt').textContent = vis + ' de ' + estado.painel.entradas.length + ' linhas';
}

function tabelaPessoal() {
  const corpo = el('corpoPes');
  corpo.innerHTML = '';
  for (const l of estado.painel.pessoal) {
    const tr = document.createElement('tr');
    const a = document.createElement('td'); a.className = 'data'; a.textContent = l.data;
    const b = document.createElement('td');
    b.textContent = l.sentido === 'saida' ? 'Enviado para a conta pessoal' : 'Devolvido para a empresa';
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
  if (!estado.painel) return;
  const conteudo = JSON.stringify({ mes: estado.painel.mes, categorias: mapaAtual() }, null, 2);
  const blob = new Blob([conteudo], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Categorias ' + estado.painel.mes + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  guardar();
  avisar('Arquivo de categorias baixado.', 'ok');
});

el('btnCarregar').addEventListener('click', () => el('arqCategorias').click());
el('arqCategorias').addEventListener('change', evento => {
  const arquivo = evento.target.files[0];
  if (!arquivo || !estado.painel) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    try {
      const lido = JSON.parse(leitor.result);
      const n = aplicarMapa(lido.categorias || lido);
      guardar();
      tabelaSaidas(el('buscaSaida').value);
      grafico();
      avisar(plural(n, ' lançamento recuperado.', ' lançamentos recuperados.'), 'ok');
    } catch (e) {
      avisar('Não consegui ler esse arquivo. Ele precisa ser o JSON que o botão de salvar gera.', 'erro', true);
    }
  };
  leitor.readAsText(arquivo);
  evento.target.value = '';
});

/* ================= RELATÓRIO IMPRESSO ================= */

/* A impressão mostra as duas telas de uma vez, então a página precisa sair do
   modo de abas e voltar ao normal depois. Fazemos isso pelos eventos do próprio
   navegador, e não só no clique, para funcionar também quando a pessoa usa
   Ctrl+P ou manda imprimir pelo menu. */
function prepararPapel() {
  if (!estado.painel && !estado.planilha) return;
  document.body.classList.toggle('com-tabelas', el('optTabelas').checked);

  const quando = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  el('capaTitulo').textContent = estado.painel
    ? 'Relatório de ' + estado.painel.mes
    : 'Relatório de vendas';
  el('capaNota').textContent = 'Emitido em ' + quando +
    (estado.planilha ? '. Vendas pela data de aprovação, que é a data do pagamento.' : '.') +
    (estado.painel && !estado.planilha ? ' Sem a planilha carregada, o relatório sai sem a parte de vendas.' : '');

  // As duas telas precisam estar montadas, mesmo a que está fechada na tela.
  el('telaMes').classList.toggle('escondido', !estado.painel);
  el('telaVendas').classList.toggle('escondido', !estado.planilha);
}

function restaurarTela() {
  document.body.classList.remove('com-tabelas');
  trocarAba(estado.aba);
}

window.addEventListener('beforeprint', prepararPapel);
window.addEventListener('afterprint', restaurarTela);

el('btnImprimir').addEventListener('click', () => {
  prepararPapel();
  // Um respiro para o navegador refazer o layout antes de abrir a impressão.
  setTimeout(() => { window.print(); restaurarTela(); }, 60);
});

/* ================= TELA DE VENDAS ================= */

function desenharVendas() {
  const P = estado.painel, V = estado.vendas;
  const linhas = estado.planilha;
  const anual = linhas ? resumoAnual(linhas) : [];

  if (P && V) {
    const T = P.totais;
    el('kVenda').textContent = brl(V.venda);
    el('kVendaNota').textContent = V.qtd + ' orçamentos aprovados em ' + P.mes;
    el('kEnt').textContent = brl(T.entradas);
    el('kEntNota').textContent = T.qtdEntradas + ' recebimentos no extrato';
    const dif = T.entradas - V.venda;
    const elDif = el('kDif');
    elDif.textContent = (dif < 0 ? '\u2212 ' : '+ ') + brl(Math.abs(dif));
    elDif.style.color = dif < 0 ? 'var(--saida)' : 'var(--entrada)';
    const parc = (V.regimes.parceiro || { valor: 0, qtd: 0 });
    el('kParceiro').textContent = brl(parc.valor);
    el('kParceiroNota').textContent = plural(parc.qtd, ' orçamento fechado com parceiro', ' orçamentos fechados com parceiros') +
      ', para entrar no caixa do mês seguinte';
    el('kRodape').textContent = 'Conciliação de ' + P.mes +
      '. Venda é o que foi fechado com o cliente, entrada é o que o banco recebeu, e a diferença tem explicação, não é erro.';
    el('secaoPonte').classList.remove('escondido');
    ponte();
  } else {
    for (const id of ['kVenda', 'kEnt', 'kDif', 'kParceiro']) el(id).textContent = '\u2014';
    el('kVendaNota').textContent = P ? 'Carregue a planilha para conciliar' : 'Carregue o extrato e a planilha';
    el('kEntNota').textContent = el('kParceiroNota').textContent = '';
    el('kRodape').textContent = linhas
      ? 'A conciliação precisa do extrato do mês e da planilha ao mesmo tempo. Abaixo, o que dá para ver só com a planilha.'
      : '';
    el('secaoPonte').classList.add('escondido');
  }

  if (P) { tabelaEntradas(''); el('secEntradas').classList.remove('escondido'); }
  else el('secEntradas').classList.add('escondido');

  if (!linhas) return;

  desenhaGrafico('graficoVendas', anual.map(m => ({
    nome: MES_CURTO[m.mes - 1] + ' de ' + m.ano,
    valor: m.venda,
    detalhe: m.qtd + ' orçamentos',
    pendente: P && m.ano === P.ano && m.mes === P.mesNum ? false : false,
  })), (item, fatia) => '<b>' + item.nome + '</b><br><span class="mono">' + brl(item.valor) +
    '</span> em ' + item.detalhe + '<br>' + fatia.toFixed(1).replace('.', ',') + '% do ano');

  const seletor = el('mesParceiro');
  const escolhido = seletor.value;
  seletor.innerHTML = '';
  for (const m of anual.slice().reverse()) {
    const o = document.createElement('option');
    o.value = m.chave;
    o.textContent = MES_CURTO[m.mes - 1] + ' de ' + m.ano;
    seletor.appendChild(o);
  }
  // O padrão é o mês do extrato; sem extrato, o último mês da planilha.
  const alvo = P ? P.ano + '-' + String(P.mesNum).padStart(2, '0') : null;
  if (escolhido && anual.some(m => m.chave === escolhido)) seletor.value = escolhido;
  else if (alvo && anual.some(m => m.chave === alvo)) seletor.value = alvo;
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
      valor: -parceiro.valor, sinal: '\u2212 ' },
    { classe: 'menos', texto: 'Cartão pelo link, cai 14 dias depois',
      nota: plural(cartao.qtd, ' orçamento no cartão', ' orçamentos no cartão') + ', que chegam pelo C6 duas semanas após a aprovação',
      valor: -cartao.valor, sinal: '\u2212 ' },
  ];
  if (faturado.valor > 0) {
    passos.push({ classe: 'menos', texto: 'Faturado, sem data de recebimento',
      nota: plural(faturado.qtd, ' orçamento faturado', ' orçamentos faturados'),
      valor: -faturado.valor, sinal: '\u2212 ' });
  }
  const proprioMes = V.venda - parceiro.valor - cartao.valor - faturado.valor;
  passos.push({ classe: '', texto: 'Venda paga no próprio mês',
    nota: plural(pix.qtd, ' orçamento no pix, pago na aprovação', ' orçamentos no pix, pagos na aprovação'),
    valor: proprioMes, sinal: '' });
  passos.push({ classe: 'mais', texto: 'Correio e DHL cobrados do cliente',
    nota: 'Reembolso do envio, que entra na conta mas não é venda', valor: V.correio, sinal: '+ ' });

  const anterior = T.entradas - proprioMes - V.correio;
  passos.push({ classe: anterior < 0 ? 'menos' : 'mais', texto: 'Recebido de meses anteriores',
    nota: 'Parceiros acertando o mês passado e cartão aprovado antes. Do C6 chegaram ' + brl(T.receitaCartao) + ' neste mês',
    valor: anterior, sinal: anterior < 0 ? '\u2212 ' : '+ ' });
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

function tabelaParceiros() {
  const chave = el('mesParceiro').value;
  if (!chave) return;
  const [ano, mes] = chave.split('-').map(Number);
  const lista = parceirosPorMes(estado.planilha, ano, mes);
  const corpo = el('corpoParceiro');
  corpo.innerHTML = '';
  const entradas = estado.painel ? estado.painel.entradas : null;

  for (const p of lista) {
    const tr = document.createElement('tr');
    const nome = document.createElement('td'); nome.className = 'desc'; nome.textContent = p.nome;
    const q = document.createElement('td'); q.className = 'valor'; q.textContent = p.qtd;
    const v = document.createElement('td'); v.className = 'valor'; v.textContent = brl(p.valor);
    const c = document.createElement('td'); c.className = 'valor'; c.textContent = p.correio ? brl(p.correio) : '—';
    const r = document.createElement('td'); r.className = 'valor';
    if (!entradas) {
      r.textContent = '—';
      r.title = 'Carregue o extrato do Inter para procurar os pagamentos.';
    } else {
      const achado = recebidoDe(p.nome, entradas);
      r.textContent = achado.qtd ? brl(achado.valor) : 'nada encontrado';
      r.classList.add(achado.valor >= p.valor ? 'mais' : 'menos');
      r.title = achado.qtd ? achado.qtd + ' lançamentos com esse nome no extrato carregado' : '';
    }
    tr.append(nome, q, v, c, r);
    corpo.appendChild(tr);
  }
  el('vazioParceiro').classList.toggle('escondido', lista.length > 0);
  const soma = arred(lista.reduce((a, b) => a + b.valor, 0));
  el('contaParceiro').textContent = lista.length
    ? plural(lista.length, ' parceiro, ', ' parceiros, ') + brl(soma) + ' fechados'
    : '';
}
el('mesParceiro').addEventListener('change', tabelaParceiros);


recuperarDados();
