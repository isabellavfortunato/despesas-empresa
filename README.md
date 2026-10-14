# Financeiro IFT

Painel financeiro mensal e acompanhamento de vendas da Isabella Fortunato Traduções.

A página roda inteira no navegador. O extrato e a planilha são lidos na própria máquina de quem abre, nada é enviado para servidor nenhum e nada fica guardado neste repositório. Por isso o repositório pode ser público sem expor qualquer dado financeiro.

## Como usar

1. Abrir a página.
2. Soltar o extrato do Banco Inter na primeira caixa. Aceita CSV e OFX.
3. Soltar a planilha Status clientes na segunda caixa. É o arquivo .xlsx com as abas dos meses.

A aba **Mês** mostra o painel do mês do extrato. A aba **Vendas** mostra o ano inteiro e só precisa da planilha.

## O que a página calcula

**Mês.** Vendas fechadas, dinheiro que entrou, saídas para terceiros, pix para a conta pessoal e o resultado. Abaixo, a conciliação que explica por que a venda e a entrada não são o mesmo número, o resumo de saídas por categoria e as três tabelas de lançamentos.

**Vendas.** Vendas mês a mês pela data de aprovação, parceiros a receber no mês escolhido e como cada venda do mês vira dinheiro conforme o regime de pagamento.

## As regras embutidas

Movimentação de CDB, cofrinho, aplicação e resgate fica fora de todos os totais, por ser dinheiro andando dentro da própria conta. Estornos saem em pares, dos dois lados, e quando a devolução não encontra par de mesmo valor a página avisa em vez de abater sozinha.

Pix para Isabella Venceslau Fortunato e Jalma Maria de Souza Barros vai para uma tabela própria, por ser conta pessoal. Pagamentos ao Mercado Pago e à Portoseg entram como pagamento de cartão, e não como despesa nova, porque os gastos que os geraram estão nas faturas.

Depósito vindo de Isabella Fortunato Traduções é a conta do C6, onde caem os pagamentos feitos pelo link, e por isso conta como receita de cliente. Saindo, o mesmo nome significa repasse para o Cora, que cobre os envios.

O pagamento acontece na aprovação, então a data da coluna Aprovado é a data em que o dinheiro entra. Há duas exceções: quem tem Parceiro na coluna Origem acerta no mês seguinte, e quem paga no cartão entra pelo C6 catorze dias depois.

A taxa de cartório fica fora da venda, por ser repasse ao notário, e o Correio e DHL aparecem separados, por serem reembolso do custo de envio.

## Relatório mensal

O botão **Imprimir relatório**, ao lado das abas, monta a versão de papel com as duas telas juntas, independentemente de qual estiver aberta. Na janela de impressão do navegador, escolha **Salvar como PDF** no lugar da impressora.

Por padrão o relatório sai resumido, em quatro páginas: capa com o mês, os cinco cards, a conciliação entre venda e entrada, as saídas por categoria, as vendas mês a mês, os parceiros a receber e como cada venda vira dinheiro. Marcando **incluir as tabelas completas** antes de imprimir, entram também as três tabelas de lançamentos, linha a linha, o que leva o documento a cerca de catorze páginas.

As caixas de carregar arquivo, as abas, os campos de busca e os seletores de categoria não vão para o papel. A categoria de cada saída aparece como texto no lugar do seletor.

## Categorias

Só as saídas têm campo de categoria. Trocar a categoria de um favorecido muda todos os lançamentos dele de uma vez, e o trabalho fica guardado no navegador. O botão de salvar baixa um arquivo com as categorias definidas, e o de carregar devolve esse arquivo para dentro da página, o que serve para levar o trabalho de um computador para outro.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | A página e todo o estilo |
| `nucleo.js` | A conta: leitura do extrato, regras de tratamento, categorização e leitura da planilha |
| `app.js` | A interface: desenha as telas e cuida dos botões |

A única dependência externa é a biblioteca SheetJS, carregada de CDN, usada apenas para abrir o arquivo .xlsx.
