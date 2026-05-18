
Objetivo: identificar por que os treinos “não ficam salvos / não aparecem” e corrigir a causa real da aba de Treinos.

1. Diagnóstico confirmado
- Os treinos estão sendo salvos no backend.
- A base já contém vários treinos do seu usuário, inclusive com fichas e exercícios associados.
- Há até uma requisição recente retornando um treino existente (`Peito e Tríceps - Hipertrofia 60min`), então o problema não é perda de dados.
- Também não é RLS/permissão: as políticas de `workouts`, `routine_sheets` e `workout_exercises` permitem o usuário ler os próprios dados.

2. Problema real
- A aba de Treinos depende de `fetchWorkoutsData()` em `src/services/workouts.service.ts`.
- Essa consulta tenta buscar `workouts` junto com `routine_sheets` e `workout_exercises` em uma única leitura.
- Depois que o campo `last_sheet_id` foi adicionado em `workouts`, passaram a existir duas relações possíveis entre `workouts` e `routine_sheets`:
  - `routine_sheets.workout_id -> workouts.id`
  - `workouts.last_sheet_id -> routine_sheets.id`
- Isso torna o embed de `routine_sheets` ambíguo quando a query não informa explicitamente qual relacionamento deve usar.
- Resultado: a leitura da lista pode falhar.
- Como o código atual ignora `error` da consulta e faz cast para array vazio, a tela se comporta como se não houvesse treinos salvos.

3. Correção principal
- Ajustar `src/services/workouts.service.ts` para usar relacionamentos explícitos no select da lista.
- Especificar a FK correta ao carregar fichas a partir de `workouts`:
  - usar a relação baseada em `routine_sheets.workout_id`
  - não a de `last_sheet_id`
- Se necessário, deixar o embed de `workout_exercises` explícito também, para evitar futuras ambiguidades.
- Fazer a função lançar erro quando a consulta falhar, em vez de retornar `[]`.

4. Melhorar tratamento de erro na aba de Treinos
- Em `src/pages/Workouts.tsx`, tratar erro de carregamento separadamente do estado “sem treinos”.
- Mostrar feedback claro quando a leitura falhar, em vez de exibir estado vazio.
- Manter o refresh automático já implementado, mas agora sobre uma query que realmente funciona.

5. Validar todos os fluxos afetados
- Manual: criar treino e verificar se ele aparece imediatamente na lista.
- IA: gerar treino e confirmar exibição imediata.
- Importação por imagem: confirmar criação + aparição na lista.
- Reprocessamento: confirmar que a lista reflete fichas/exercícios restaurados.
- Treinos antigos já existentes no banco: confirmar que voltam a aparecer na aba.

6. Resultado esperado
- Os treinos continuarão sendo salvos normalmente no backend.
- A aba de Treinos passará a listar os treinos já existentes e os recém-criados corretamente.
- Quando houver falha real de leitura, a tela mostrará erro de carregamento em vez de fingir que não existem treinos.

Detalhes técnicos
- Arquivo principal a corrigir: `src/services/workouts.service.ts`
- Arquivo secundário para UX/erro: `src/pages/Workouts.tsx`
- Não deve exigir mudança de RLS.
- Não deve exigir mudança estrutural no banco.
- O refresh automático/realtime já existente continua útil, mas hoje está sendo mascarado por uma query base quebrada.

Resumo do porquê não aparecem
- Eles aparecem no banco.
- O que quebra é a consulta da lista.
- A consulta ficou ambígua após a introdução de `last_sheet_id` em `workouts`.
- Como o erro está sendo engolido pelo frontend, a UI mostra lista vazia e dá a impressão de que o treino não foi salvo.
