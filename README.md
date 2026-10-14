# Financeiro IFT

Painel financeiro mensal e acompanhamento de vendas da Isabella Fortunato Traduções.

A página roda inteira no navegador. O extrato e a planilha são lidos na própria máquina de quem abre, nada é enviado para servidor nenhum e nada fica guardado neste repositório. Por isso o repositório pode ser público sem expor qualquer dado financeiro.

O que foi carregado fica guardado no próprio navegador, então ao reabrir a página os dados do último uso já aparecem, sem precisar carregar de novo. Essa memória vale por navegador e por computador: abrindo em outra máquina ou no celular, a página começa vazia e é preciso carregar os arquivos ali também. O botão **esquecer estes dados**, no alto da página, apaga tudo.

## Como usar

1. Abrir a página.
2. Soltar o extrato do Banco Inter na primeira caixa. Aceita **.csv** e **.ofx**.
3. Soltar a planilha Status clientes na segunda caixa. É o arquivo .xlsx com as abas dos meses.

A aba **Despesas** mostra os números do mês e para onde o dinheiro foi. A aba **Conciliação** compara o que foi vendido com o que entrou na conta.

Da segunda vez em diante só é preciso soltar os arquivos quando houver mês novo. Carregar um arquivo substitui o anterior.

## O que a página calcula

**Despesas.** Cinco números no alto: quanto entrou, quanto foi vendido no mês, quanto foi vendido no mês anterior com a variação, quanto saiu em despesas e quanto foi para a conta pessoal. Abaixo, o gráfico de barras horizontal das categorias de despesa, com o valor e a fatia do mês ao passar o mouse. Em seguida a lista de despesas, cada uma com um seletor para corrigir a categoria, e a tabela dos pix para a conta pessoal.

**Conciliação.** Vendido no mês contra o que entrou na conta, a diferença entre os dois e o que está a receber de parceiros. Abaixo, a conciliação passo a passo que explica a diferença, as entradas linha a linha, os parceiros a receber no mês escolhido e as vendas mês a mês do ano.

## Sobre o arquivo do extrato

Os dois formatos que o Inter oferece servem, .csv e .ofx, e a página reconhece pelo final do nome. O .ofx costuma ser mais seguro, porque não depende de configuração regional.

O arquivo precisa ser o que o Inter baixou, sem passar pelo Excel. Abrir o .csv no Excel e salvar de novo troca o ponto e vírgula por vírgula, e aí os valores ficam ambíguos, porque R$ 38.899,40 vira três pedaços. Nesse caso a página recusa o arquivo e explica, em vez de mostrar número errado.

A página aceita o .csv tanto em UTF-8 quanto em ANSI, que são as duas codificações que o Inter usa conforme o navegador e o sistema.

Também fica de fora a fatura do cartão, que tem outro formato. Esta página lê o extrato da conta corrente.

## As regras embutidas

Movimentação de CDB, cofrinho, aplicação e resgate fica fora de todos os totais, por ser dinheiro andando dentro da própria conta. Estornos saem em pares, dos dois lados, e quando a devolução não encontra par de mesmo valor a página avisa em vez de abater sozinha.

Pix para Isabella Venceslau Fortunato e Jalma Maria de Souza Barros vai para uma tabela própria, por ser conta pessoal. Pagamentos ao Mercado Pago e à Portoseg entram como pagamento de cartão, e não como despesa nova, porque os gastos que os geraram estão nas faturas.

Depósito vindo de Isabella Fortunato Traduções é a conta do C6, onde caem os pagamentos feitos pelo link, e por isso conta como receita de cliente. Saindo, o mesmo nome significa repasse para o Cora, que cobre os envios.

O pagamento acontece na aprovação, então a data da coluna Aprovado é a data em que o dinheiro entra. Há duas exceções: quem tem Parceiro na coluna Origem acerta no mês seguinte, e quem paga no cartão entra pelo C6 catorze dias depois.

A taxa de cartório fica fora da venda, por ser repasse ao notário, e o Correio e DHL aparecem separados, por serem reembolso do custo de envio.

## Relatório mensal

O botão **Imprimir relatório**, ao lado das abas, monta a versão de papel com as duas telas juntas, independentemente de qual estiver aberta. Na janela de impressão do navegador, escolha **Salvar como PDF** no lugar da impressora.

Por padrão o relatório sai resumido, em quatro páginas: capa com o mês, os cinco números, o gráfico de despesas por categoria, a conciliação passo a passo, os parceiros a receber e as vendas mês a mês. Marcando **incluir as tabelas completas** antes de imprimir, entram também as três tabelas de lançamentos, linha a linha, o que leva o documento a cerca de catorze páginas.

As caixas de carregar arquivo, as abas, os campos de busca e os seletores de categoria não vão para o papel. A categoria de cada saída aparece como texto no lugar do seletor.

## Categorias

Só as despesas têm campo de categoria. Trocar a categoria de um favorecido muda todos os lançamentos dele de uma vez, e o trabalho fica guardado no navegador. O botão de salvar baixa um arquivo com as categorias definidas, e o de carregar devolve esse arquivo para dentro da página, o que serve para levar o trabalho de um computador para outro.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | A página e todo o estilo |
| `nucleo.js` | A conta: leitura do extrato, regras de tratamento, categorização e leitura da planilha |
| `app.js` | A interface: desenha as telas e cuida dos botões |

A única dependência externa é a biblioteca SheetJS, carregada de CDN, usada apenas para abrir o arquivo .xlsx.
