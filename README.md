📊 Calculadora de Custo de Produto
📌 Descrição do Projeto

Este projeto tem como objetivo o desenvolvimento de uma calculadora de custo de produto com uma interface simples e intuitiva.
O sistema integra um banco de dados de matérias-primas que pode ser facilmente atualizado a partir de lançamentos de notas fiscais, permitindo que o empresário acompanhe os custos de produção de forma prática e dinâmica.

O sistema foi desenvolvido utilizando as tecnologias:

JavaScript

Node.js

MongoDB

dotenv (.env)

🎯 Funcionalidades Principais

Cadastro e edição de fichas técnicas:
O usuário pode preencher e editar fichas técnicas de produtos, selecionando matérias-primas cadastradas e informando as quantidades.

Consulta de custos atualizados:
O sistema calcula automaticamente o custo atualizado dos produtos com base nas últimas notas fiscais, utilizando o método LIFO (Last In, First Out).

Atualização dinâmica:
A cada nova nota fiscal lançada, os custos das matérias-primas são atualizados automaticamente, refletindo nos cálculos de custo de cada produto.

Interface amigável:
Telas simples e de fácil uso, voltadas para empresários sem experiência técnica.

🗂️ Estrutura do Projeto

Banco de Dados Inicial:

Criado a partir de uma planilha Excel com os materiais, valores e histórico de compras.

Informações complementadas com notas fiscais em PDF dos últimos 3 meses.

Sistema pronto para inclusão de dados:

Estrutura da calculadora e do banco de dados desenvolvida para permitir cadastros, edições e exclusões de fichas técnicas de produtos.

Atualização dinâmica de custos:

O sistema processa automaticamente novas entradas de matéria-prima, atualizando os custos.

Interface amigável:

Foco na usabilidade, para que o próprio usuário empresarial mantenha o sistema atualizado.

📌 Fluxo de Uso

Cadastro e edição de fichas técnicas

O usuário preenche a ficha técnica de um produto, selecionando itens do banco de dados e suas respectivas quantidades.

Consulta de custos atualizados

Ao consultar o custo de um produto, o sistema cruza os dados da ficha técnica com os preços mais recentes das matérias-primas (LIFO).

Lançamentos futuros

A cada nova compra, o usuário lança a nota fiscal, mantendo os dados sempre atualizados.

🛠️ Tecnologias Utilizadas

JavaScript (JS) – Linguagem principal para lógica do sistema.

Node.js – Backend e processamento das regras de negócio.

MongoDB – Banco de dados não relacional para armazenar matérias-primas, notas fiscais e fichas técnicas.

dotenv (.env) – Gerenciamento seguro de variáveis de ambiente.

🚀 Como Rodar o Projeto
Pré-requisitos

Node.js instalado

MongoDB em execução

Gerenciador de pacotes (npm ou yarn)

Passos

Clone o repositório:

git clone https://github.com/seu-usuario/seu-repositorio.git


Acesse a pasta do projeto:

cd seu-repositorio


Instale as dependências:

npm install


Configure as variáveis de ambiente no arquivo .env:

PORT=3000
MONGO_URI=sua_string_de_conexao


Inicie o servidor:

npm start

📅 Exemplo Prático do Fluxo

Empresário: fornece a planilha inicial e notas fiscais em PDF.

Sistema: cria o banco de dados inicial com histórico de preços.

Usuário empresarial:

Preenche fichas técnicas.

Consulta custos atualizados.

Atualiza o sistema com novas compras/notas fiscais.

👨‍💻 Autores

Projeto desenvolvido por alunos com foco em organização de custos industriais e facilidade de uso para empresários.
