# Financeiro IFT

Painel financeiro mensal e acompanhamento de vendas da Isabella Fortunato Traduções.

A página roda inteira no navegador. O extrato e a planilha são lidos na própria máquina de quem abre, nada é enviado para servidor nenhum e nada fica guardado neste repositório. Por isso o repositório pode ser público sem expor qualquer dado financeiro.

O que foi carregado fica guardado no próprio navegador, então ao reabrir a página os dados do último uso já aparecem, sem precisar carregar de novo. Essa memória vale por navegador e por computador: abrindo em outra máquina ou no celular, a página começa vazia e é preciso carregar os arquivos ali também. O botão **esquecer estes dados**, no alto da página, apaga tudo.

## Como usar

1. Abrir a página.
2. Soltar o extrato do Banco Inter na primeira caixa. Aceita **.csv** e **.ofx**, de um mês só ou de vários meses, como o ano inteiro.
3. Soltar a planilha Status clientes na segunda caixa. É o arquivo .xlsx com as abas dos meses.
4. Escolher o mês na fileira de abas do alto.

Cada mês que aparece no extrato ou na planilha ganha uma aba própria, e tudo na página segue o mês escolhido: os números, as despesas, a conciliação, os parceiros e o relatório impresso. O mês em que o extrato termina antes do último dia aparece marcado com a data final, como "até 13/10". O mês que só existe na planilha aparece com a borda tracejada e a marca "só planilha", e nele a aba Despesas fica fechada.

A aba **Despesas** mostra os números do mês e para onde o dinheiro foi. A aba **Conciliação** compara o que foi vendido com o que entrou na conta.

Da segunda vez em diante só é preciso soltar os arquivos quando houver mês novo. Carregar um arquivo substitui o anterior, então o mais prático é baixar sempre o extrato do ano até a data de hoje.

## O que a página calcula

**Despesas.** Cinco números no alto: quanto entrou, quanto foi vendido no mês, quanto foi vendido no mês anterior com a variação, quanto saiu em despesas e quanto foi para a conta pessoal. Abaixo, o gráfico de barras horizontal das categorias de despesa, com o valor e a fatia do mês ao passar o mouse. Em seguida a lista de despesas, cada uma com um seletor para corrigir a categoria, e a tabela dos pix para a conta pessoal.

**Conciliação.** Vendido no mês contra o que entrou na conta, a diferença entre os dois e o que está a receber de parceiros. Abaixo, a conciliação passo a passo que explica a diferença, as entradas linha a linha, os parceiros a receber no mês escolhido e as vendas mês a mês do ano.

## Sobre o arquivo do extrato

Os dois formatos que o Inter oferece servem, .csv e .ofx, e a página reconhece pelo final do nome. O .ofx costuma ser mais seguro, porque não depende de configuração regional.

O arquivo precisa ser o que o Inter baixou, sem passar pelo Excel. Abrir o .csv no Excel e salvar de novo troca o ponto e vírgula por vírgula, e aí os valores ficam ambíguos, porque R$ 38.899,40 vira três pedaços. Nesse caso a página recusa o arquivo e explica, em vez de mostrar número errado.

A página aceita o .csv tanto em UTF-8 quanto em ANSI, que são as duas codificações que o Inter usa conforme o navegador e o sistema.

Também fica de fora a fatura do cartão, que tem outro formato. Esta página lê o extrato da conta corrente.

## As regras embutidas

Movimentação de CDB, cofrinho, aplicação e resgate fica fora de todos os totais, por ser dinheiro andando dentro da própria conta. Estornos saem em pares, dos dois lados, mesmo quando a devolução cai num mês e o pagamento original no anterior. O par aceita diferença de até 10 centavos entre o valor original e a devolução, desde que o original esteja até 31 dias antes, porque o banco às vezes devolve 1 centavo a menos; a sobra de centavos fica como um lançamento próprio, que não conta como venda. Quando a devolução não encontra par, a página avisa dentro do mês em vez de abater sozinha. No próprio aviso amarelo, cada devolução tem um seletor para dizer o que ela é: devolução de um pagamento da empresa, que não conta como venda nem como despesa nova; ligada à conta pessoal, que vai para a tabela dos pix pessoais; ou deixar como está. Escolhido o destino, o aviso daquela devolução some, e a linha "devoluções conferidas por você" tem o botão rever para mudar a escolha depois. As escolhas ficam guardadas no navegador e vão junto no arquivo de salvar categorias.

Pix para Isabella Venceslau Fortunato e Jalma Maria de Souza Barros vai para uma tabela própria, por ser conta pessoal. Pagamentos ao Mercado Pago e à Portoseg entram como pagamento de cartão, e não como despesa nova, porque os gastos que os geraram estão nas faturas.

Depósito vindo de Isabella Fortunato Traduções pela conta do C6 é onde caem os pagamentos feitos no cartão pelo link, e por isso conta como entrada e como receita de cliente. A página reconhece o C6 pelo código do banco que vem no próprio pix (31872495). Vindo do Cora (código 37880206), o mesmo nome é dinheiro da própria empresa voltando e fica marcado como entrada que não é venda. Vindo de qualquer outro banco, entra como receita com a observação "a confirmar". Saindo, o mesmo nome significa repasse para o Cora, que cobre os envios, ou transferência para o C6 quando o destino é o C6.

Na conciliação, as entradas que não são venda (retorno do Cora, devolução, estorno de cartão) aparecem num passo próprio, para não se misturarem com o que foi recebido de meses anteriores. A coluna de parceiros procura o pagamento nas entradas do mês seguinte, que é quando o parceiro acerta.

Na planilha, a linha com data de aprovação preenchida mas ilegível, como "05/05/" sem o ano, fica fora de todos os meses, e a página lista essas linhas na aba Conciliação para serem corrigidas.

O pagamento acontece na aprovação, então a data da coluna Aprovado é a data em que o dinheiro entra. Há duas exceções: quem tem Parceiro na coluna Origem acerta no mês seguinte, e quem paga no cartão entra pelo C6 catorze dias depois.

A taxa de cartório fica fora da venda, por ser repasse ao notário, e o Correio e DHL aparecem separados, por serem reembolso do custo de envio.

## Relatório mensal

O botão **Imprimir relatório**, ao lado das abas, monta a versão de papel com as duas telas juntas, independentemente de qual estiver aberta. Na janela de impressão do navegador, escolha **Salvar como PDF** no lugar da impressora.

O relatório é sempre do mês escolhido nas abas. Por padrão ele sai resumido, em três ou quatro páginas: capa com o mês, os cinco números, o gráfico de despesas por categoria, a conciliação passo a passo, os parceiros a receber e as vendas mês a mês. Marcando **incluir as tabelas completas** antes de imprimir, entram também as três tabelas de lançamentos, linha a linha, o que leva o documento a cerca de catorze páginas.

As caixas de carregar arquivo, as abas, os campos de busca e os seletores de categoria não vão para o papel. A categoria de cada saída aparece como texto no lugar do seletor.

## Categorias

Só as despesas têm campo de categoria. Trocar a categoria de um favorecido muda todos os lançamentos dele de uma vez, em todos os meses, e o trabalho fica guardado no navegador. Só fica guardado o que foi escolhido à mão; o que a regra já acerta sozinha continua vindo da regra. O botão de salvar baixa um arquivo com as categorias escolhidas, e o de carregar devolve esse arquivo para dentro da página, o que serve para levar o trabalho de um computador para outro. Arquivos de categorias salvos pela versão anterior continuam servindo.

## Ícone e tela inicial

O ícone é o símbolo R$ em branco, com serifa e negrito, dentro de um anel claro sobre fundo cor telha (degradê de #C2603A para #A2482A). As letras estão desenhadas como contorno no próprio arquivo, então não dependem de fonte instalada.

Com o manifesto, dá para salvar a página na tela inicial do celular e ela abre em tela cheia, sem a barra do navegador, com o nome Financeiro. No iPhone é pelo botão de compartilhar e depois Adicionar à Tela de Início; no Android, pelo menu do Chrome e depois Adicionar à tela inicial.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | A página e todo o estilo |
| `nucleo.js` | A conta: leitura do extrato, regras de tratamento, categorização e leitura da planilha |
| `app.js` | A interface: desenha as telas e cuida dos botões |
| `favicon.svg` | O ícone da aba, em vetor, que serve em qualquer tamanho |
| `favicon-32.png` | O mesmo ícone em imagem, para navegadores antigos |
| `apple-touch-icon.png` | O ícone de 180 pixels, usado ao salvar na tela inicial do iPhone |
| `icone-512.png` | O ícone grande, usado pelo Android e na tela de abertura |
| `site.webmanifest` | Nome, cores e ícones para quando a página é salva como aplicativo |

A única dependência externa é a biblioteca SheetJS, carregada de CDN, usada apenas para abrir o arquivo .xlsx.
