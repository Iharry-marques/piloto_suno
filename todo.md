# Plano de Organização do Projeto

- [ ] 001. Solicitar confirmação e esclarecimentos ao usuário
- [ ] 002. Descompactar e analisar a estrutura do projeto
- [ ] 003. Identificar código duplicado entre arquivos
- [x] 004. Centralizar lógicas comuns em `utils.js`
    - [x] 004.1. Unificar `preprocessarDados` em `utils.js` e remover de `clients.js`.
    - [x] 004.2. Refatorar `carregarDados` em `clients.js` para usar `carregarDadosDeJSON` de `utils.js`.
    - [x] 004.3. Refatorar `exportarCSV` em `clients.js` para usar `exportarParaCSV` de `utils.js`.
    - [x] 004.4. Verificar se `exportarCSV` em `dashboard.js` já usa `exportarParaCSV` de `utils.js` (Confirmado: Sim).
    - [ ] 004.5. (Opcional) Extrair partes comuns de `criarTimeline` para `utils.js`.
- [x] 005. Remover código morto e imports não utilizados
- [x] 006. Validar referências de arquivos JS em `index.js`
- [x] 007. Revisar e reorganizar componentes conforme boas práticas
- [x] 008. Validar o papel de `index.js` como entrypoint
- [ ] 009. Reportar e enviar organização ao usuário
