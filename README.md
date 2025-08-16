# 📊 Calculadora de Custo de Produto

Este projeto tem como objetivo o desenvolvimento de uma **calculadora de custo de produto** com uma **interface simples e intuitiva**, integrando um banco de dados de matérias-primas que pode ser atualizado dinamicamente através de lançamentos de notas fiscais.  

---

## 🚀 Tecnologias Utilizadas
- **JavaScript (JS)**
- **Node.js**
- **MongoDB**
- **dotenv (.env)** para variáveis de ambiente

---

## 🎯 Objetivos do Projeto
1. **Banco de Dados Inicial**  
   - Criar um banco de dados organizado com os materiais utilizados na fábrica.  
   - A base é construída a partir de:  
     - Uma **planilha Excel** estruturada, contendo itens, valores e históricos de compras.  
     - Informações extraídas de **notas fiscais (PDF)** dos últimos 3 meses.  

2. **Sistema Pronto para Inclusão**  
   - Estrutura da calculadora e do banco de dados pronta para:  
     - Cadastro de novos produtos.  
     - Criação e edição de fichas técnicas pelo usuário.  
     - Modificação ou exclusão de dados diretamente pelo empresário.  

3. **Atualização Dinâmica de Custos**  
   - Sempre que uma nova nota fiscal de matéria-prima for cadastrada, os custos são automaticamente atualizados.  
   - O sistema utiliza o método **LIFO (Last In, First Out)** para cálculo dos custos.  

4. **Interface Amigável**  
   - Telas simples, intuitivas e acessíveis para empresários sem experiência técnica.  

---

## 🛠️ Funcionalidades Principais
### 1. Cadastro e Edição de Fichas Técnicas
- Usuário pode preencher fichas técnicas de produtos.  
- Seleção de matérias-primas do banco de dados.  
- Definição de quantidades consumidas por produto.  

### 2. Consulta e Atualização de Custos
- O sistema busca os **últimos preços registrados** de cada matéria-prima (método LIFO).  
- Calcula automaticamente o custo atualizado de cada produto.  

### 3. Lançamentos de Notas Fiscais
- Inserção de novas compras de matérias-primas.  
- Base de dados sempre atualizada para novos cálculos.  

---

## 📌 Exemplo Prático de Uso
1. **Empresário** fornece uma planilha Excel e notas fiscais em PDF com os dados das matérias-primas.  
2. **Alunos/Desenvolvedores** estruturam o banco de dados inicial e implementam a calculadora.  
3. **Usuário Final (empresário)**:  
   - Cadastra e edita fichas técnicas de produtos.  
   - Consulta custos atualizados automaticamente.  
   - Registra futuras compras mantendo o banco atualizado.  

---

## ⚙️ Como Rodar o Projeto

### Pré-requisitos
- Node.js instalado  
- MongoDB configurado (local ou em nuvem)  
- Arquivo `.env` com as variáveis necessárias  

### Instalação
```bash
# Clone o repositório
git clone https://github.com/seu-usuario/nome-do-projeto.git

# Acesse a pasta do projeto
cd nome-do-projeto

# Instale as dependências
npm install
