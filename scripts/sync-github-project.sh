#!/usr/bin/env bash
# Sync das sprints do NormaReview AI para o GitHub Project do dono.
# Fonte: CEREBRO_PROJETO.md + docs/06-sprint-*.md (espelhado em docs/06-sprints-github-project.json)
#
# Uso (a partir de uma sessão gh autenticada como o dono do projeto):
#   sh ./scripts/sync-github-project.sh
#
# Requer: gh (GitHub CLI) com permissão de admin no project
# https://github.com/users/JulioCesarLinss/projects/1

set -euo pipefail

PROJECT_OWNER="JulioCesarLinss"
PROJECT_NUMBER=1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JSON_FILE="$SCRIPT_DIR/../docs/06-sprints-github-project.json"

if ! command -v jq >/dev/null 2>&1; then
  echo "erro: jq não encontrado (instale antes de rodar)" >&2
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "erro: gh não encontrado" >&2
  exit 1
fi

# --- sanity check: project precisa estar visível nesta sessão ---
echo "==> Verificando acesso ao project ${PROJECT_NUMBER} de ${PROJECT_OWNER}..."
if ! gh project view "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" >/dev/null 2>&1; then
  cat >&2 <<'EOF'
erro: o project não está acessível nesta sessão gh.

Possíveis causas:
- gh autenticado com conta sem acesso ao project
- escopo 'project' ausente na sessão (rode: gh auth refresh -s project)
- project com acesso restrito que não inclui este token

EOF
  exit 1
fi
echo "    ok"

# --- garantir campo Status (cria se não existir) ---
STATUS_FIELD_ID=$(gh project field-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json \
  | jq -r '.fields[] | select(.name=="Status") | .id')

if [ -z "$STATUS_FIELD_ID" ]; then
  echo "==> Campo 'Status' não existe; criando com as 4 colunas do board..."
  STATUS_FIELD_ID=$(gh project field-create "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" \
    --name "Status" \
    --data-type SINGLE_SELECT \
    --single-select-options "📋 Backlog,🗓️ Planificada,🚧 Em execução,✅ Feito (plano),✅ Feito (código)" \
    --format json | jq -r '.id')
  echo "    criado: $STATUS_FIELD_ID"
else
  echo "==> Campo 'Status' já existe: $STATUS_FIELD_ID"
fi

# mapas: nome da coluna -> id da opção, para reuso no loop
declare -A OPTION_IDS
while IFS='|' read -r name id; do
  OPTION_IDS["$name"]="$id"
done < <(gh project field-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json \
  | jq -r '.fields[] | select(.name=="Status") | .options[] | "\(.name)|\(.id)"')

# --- criação de cards (idempotente: pula se já existir card com o mesmo título) ---
echo "==> Criando/atualizando cards das sprints..."
CARD_COUNT=$(jq '.cards | length' "$JSON_FILE")

for i in $(seq 0 $((CARD_COUNT - 1))); do
  TITLE=$(jq -r ".cards[$i].title" "$JSON_FILE")
  STATUS=$(jq -r ".cards[$i].status" "$JSON_FILE")
  BODY=$(jq -r ".cards[$i].body" "$JSON_FILE")

  # draft issues são mais confiáveis em projectsV2 via CLI; cria apenas se não existir
  EXISTING=$(gh project item-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json \
    | jq -r --arg t "$TITLE" '[.items[] | select(.type=="DraftIssue" and .content.title==$t)] | length')

  if [ "$EXISTING" -gt 0 ]; then
    echo "    [-] \"$TITLE\" já existe; pulando"
    continue
  fi

  ITEM_ID=$(gh project item-create "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" \
    --title "$TITLE" --body "$BODY" --format json | jq -r '.id')

  if [ -n "${OPTION_IDS[$STATUS]:-}" ]; then
    gh project item-edit --id "$ITEM_ID" \
      --project-id "$(gh project view "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json | jq -r '.id')" \
      --field-id "$STATUS_FIELD_ID" \
      --single-select-option-id "${OPTION_IDS[$STATUS]}" >/dev/null
    echo "    [+] \"$TITLE\" → $STATUS"
  else
    # ex.: Status padrão do GitHub (Todo/In Progress/Done) sem nossas colunas
    echo "    [+] \"$TITLE\" criado (opção '$STATUS' não existe no campo Status; mova manualmente)"
  fi
done

echo "==> Concluído. Confira em: https://github.com/users/${PROJECT_OWNER}/projects/${PROJECT_NUMBER}"
