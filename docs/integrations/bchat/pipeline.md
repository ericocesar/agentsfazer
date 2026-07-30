# API de Pipeline (Negócios)

O módulo **Negócios/Pipeline** é implementado internamente como **Funnels**. Abaixo estão todos os endpoints REST expostos pela API.

---

## Funnels (Pipelines)

`/api/v1/accounts/:account_id/funnels`

| Método | Endpoint               | Ação                | Controller#action |
| ------ | ---------------------- | ------------------- | ----------------- |
| GET    | `/funnels`             | Listar funis ativos | `funnels#index`   |
| POST   | `/funnels`             | Criar funil         | `funnels#create`  |
| GET    | `/funnels/:id`         | Exibir funil        | `funnels#show`    |
| PATCH  | `/funnels/:id`         | Atualizar funil     | `funnels#update`  |
| DELETE | `/funnels/:id`         | Remover funil       | `funnels#destroy` |
| GET    | `/funnels/:id/metrics` | Métricas do funil   | `funnels#metrics` |

**Parâmetros do body (`POST`/`PATCH`):**

```json
{
  "funnel": {
    "name": "Meu Pipeline",
    "color": "#4F46E5",
    "is_public": true,
    "is_active": true,
    "is_sga": false,
    "user_ids": [1, 2, 3]
  }
}
```

**Parâmetros de query (`POST`):** `?template_id=5` (clona estágios de um template), `?create_default_stages=true` (cria 4 estágios padrão).

---

## Estágios (Stages)

`/api/v1/accounts/:account_id/funnels/:funnel_id/stages`

| Método | Endpoint      | Ação                     | Controller#action |
| ------ | ------------- | ------------------------ | ----------------- |
| GET    | `/stages`     | Listar estágios do funil | `stages#index`    |
| POST   | `/stages`     | Criar estágio            | `stages#create`   |
| GET    | `/stages/:id` | Exibir estágio           | `stages#show`     |
| PATCH  | `/stages/:id` | Atualizar estágio        | `stages#update`   |
| DELETE | `/stages/:id` | Remover estágio          | `stages#destroy`  |

**Parâmetros do body (`POST`/`PATCH`):**

```json
{
  "stage": {
    "name": "Negociação",
    "color": "#8B5CF6",
    "chatwoot_status": "open",
    "automations": {}
  }
}
```

### Entrada automática por perfil do contato

O campo `automations` da etapa pode decidir em qual pipeline uma nova conversa deve
entrar. O motor avalia os pipelines ativos por `order` e as etapas por `order`, usando
a primeira etapa que corresponder a todos os filtros configurados:

```json
{
  "automations": {
    "newTicket": true,
    "inboxIds": [],
    "labelTriggers": ["cliente"],
    "contactAttributeFilters": [
      { "key": "tipo_cliente", "operator": "equal_to", "value": "cliente" }
    ]
  }
}
```

`labelTriggers` considera etiquetas da conversa e do contato. Os operadores de
`contactAttributeFilters` são `equal_to`, `not_equal_to`, `is_present` e
`is_not_present`; os filtros são lidos de `contacts.custom_attributes` e combinados
com `AND`. Para criar um fallback de novos contatos, habilite `newTicket` em uma
etapa posterior sem filtros.

---

## Cards (Negócios/Deals)

`/api/v1/accounts/:account_id/cards`

| Método | Endpoint                        | Ação                             | Controller#action              |
| ------ | ------------------------------- | -------------------------------- | ------------------------------ |
| GET    | `/cards`                        | Listar cards                     | `cards#index`                  |
| POST   | `/cards`                        | Criar card                       | `cards#create`                 |
| GET    | `/cards/:id`                    | Exibir card                      | `cards#show`                   |
| PATCH  | `/cards/:id`                    | Atualizar card (inclui mover)    | `cards#update`                 |
| DELETE | `/cards/:id`                    | Remover card                     | `cards#destroy`                |
| DELETE | `/cards/bulk_destroy`           | Remover múltiplos cards em lote  | `cards#bulk_destroy`           |
| POST   | `/cards/bulk_move`              | Mover múltiplos cards de estágio | `cards#bulk_move`              |
| POST   | `/cards/bulk_update_attributes` | Atualizar atributos em lote      | `cards#bulk_update_attributes` |

**Parâmetros do body (`POST`/`PATCH`):**

```json
{
  "card": {
    "stage_id": 1,
    "conversation_id": null,
    "contact_id": 42,
    "custom_name": "Proposta ACME",
    "lead_status": "open",
    "close_reason": null,
    "closing_reason_id": null,
    "scheduled_at": null,
    "assigned_user_id": 5,
    "notes": "Cliente interessado no plano enterprise"
  }
}
```

**Campos permitidos (via `card_params`):**

| Campo               | Tipo     | Obrigatório          | Descrição                                                                                                  |
| ------------------- | -------- | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| `stage_id`          | integer  | sim (POST)           | Estágio de destino. Move o card entre estágios **ou entre pipelines** se o estágio pertencer a outro funil |
| `contact_id`        | integer  | sim (se manual_card) | Contato vinculado                                                                                          |
| `custom_name`       | string   | sim (se manual_card) | Nome personalizado do card                                                                                 |
| `conversation_id`   | integer  | não                  | Conversação vinculada                                                                                      |
| `lead_status`       | string   | não                  | `open`, `won` ou `lost`. `closing_reason_id` é obrigatório quando `won`/`lost`                             |
| `close_reason`      | string   | não                  | Razão textual (legado)                                                                                     |
| `closing_reason_id` | integer  | não                  | ID do `FunnelClosingReason` (obrigatório se `lead_status` for `won`/`lost`)                                |
| `scheduled_at`      | datetime | não                  | Agendamento                                                                                                |
| `assigned_user_id`  | integer  | não                  | Usuário responsável                                                                                        |
| `notes`             | text     | não                  | Anotações internas                                                                                         |

**Filtros de listagem (`GET`):** `?stage_id=`, `?lead_status=`, `?created_after=`, `?created_before=`.

**Movimentação:**

| Tipo                               | Como fazer                                                                          | O que acontece                                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entre estágios (mesmo pipeline)    | Enviar `stage_id` de outro estágio no mesmo funil                                   | Dispara `pipeline_card_left_stage`/`pipeline_card_entered_stage` e `card_updated`                                                                     |
| Entre pipelines (funis diferentes) | Enviar `stage_id` de um estágio de outro funil                                      | O campo `transferred_from` (JSONB) é preenchido automaticamente com `{ from_funnel_id, from_funnel_name, from_stage_id, from_stage_name, timestamp }` |
| Via automação                      | `move_to_pipeline` (action param: `"pipeline_id:stage_id"`) ou `move_card_to_stage` | Executado pelo `AutomationRules::ActionService`                                                                                                       |

**Response JSON (card + dados relacionados):**

```json
{
  "id": 1,
  "stage_id": 1,
  "conversation_id": 1,
  "conversation_display_id": 100,
  "contact_id": 42,
  "order": 0,
  "contact_name": "João Silva",
  "contact_phone": "+551199999999",
  "contact_initials": "JS",
  "chatwoot_status": "open",
  "inbox_name": "WhatsApp",
  "assigned_agent": "Maria",
  "assigned_agent_id": 5,
  "notes": "Cliente interessado no plano enterprise",
  "labels": ["vip", "novo-negocio"],
  "lead_status": "open",
  "close_reason": null,
  "closing_reason_id": null,
  "scheduled_at": null,
  "created_at": "2025-01-01T00:00:00Z",
  "custom_name": "Proposta ACME",
  "transferred_from": null,
  "conversation_custom_attributes": { "origem": "site", "produto_interesse": "enterprise" },
  "contact": { ... },
  "items": [],
  "total_value": 0
}
```

**Observações sobre labels e atributos personalizados:**

- **Labels (`labels`)**: São herdadas da conversa vinculada. O card expõe a lista em modo **leitura** (`conversation.cached_label_list`). Para **adicionar/remover labels**, utilize os endpoints de conversa ou automações (`add_label`/`remove_label`).
- **Atributos personalizados (`conversation_custom_attributes`)**: Cards não possuem coluna `custom_attributes` própria. O response inclui os `custom_attributes` da **conversação vinculada** para conveniência. Para **atualizar** atributos personalizados, utilize os endpoints `PATCH /api/v1/accounts/:account_id/conversations/:id` com `custom_attributes: {}` ou automações (`update_custom_attribute`).

---

## Itens do Card (Card Items)

`/api/v1/accounts/:account_id/cards/:card_id/card_items`

| Método | Endpoint          | Ação                 | Controller#action    |
| ------ | ----------------- | -------------------- | -------------------- |
| GET    | `/card_items`     | Listar itens do card | `card_items#index`   |
| POST   | `/card_items`     | Criar item           | `card_items#create`  |
| PATCH  | `/card_items/:id` | Atualizar item       | `card_items#update`  |
| DELETE | `/card_items/:id` | Remover item         | `card_items#destroy` |

**Parâmetros do body (`POST`/`PATCH`):**

```json
{
  "card_item": {
    "title": "Licença Enterprise",
    "value": "1999.00",
    "quantity": 3,
    "template_id": null
  }
}
```

---

## Acessos do Funil (Funnel Accesses)

`/api/v1/accounts/:account_id/funnels/:funnel_id/funnel_accesses`

| Método | Endpoint               | Ação                         | Controller#action         |
| ------ | ---------------------- | ---------------------------- | ------------------------- |
| GET    | `/funnel_accesses`     | Listar acessos do funil      | `funnel_accesses#index`   |
| POST   | `/funnel_accesses`     | Conceder acesso a um usuário | `funnel_accesses#create`  |
| DELETE | `/funnel_accesses/:id` | Remover acesso               | `funnel_accesses#destroy` |

**Parâmetros do body (`POST`):**

```json
{
  "user_id": 1
}
```

---

## Motivos de Fechamento (Closing Reasons)

`/api/v1/accounts/:account_id/funnels/:funnel_id/closing_reasons`

| Método | Endpoint               | Ação                         | Controller#action         |
| ------ | ---------------------- | ---------------------------- | ------------------------- |
| GET    | `/closing_reasons`     | Listar motivos de fechamento | `closing_reasons#index`   |
| POST   | `/closing_reasons`     | Criar motivo                 | `closing_reasons#create`  |
| PATCH  | `/closing_reasons/:id` | Atualizar motivo             | `closing_reasons#update`  |
| DELETE | `/closing_reasons/:id` | Remover motivo               | `closing_reasons#destroy` |

**Parâmetros do body (`POST`/`PATCH`):**

```json
{
  "closing_reason": {
    "reason": "Perdido para concorrente",
    "description": "Cliente escolheu solução concorrente",
    "reason_type": "lost"
  }
}
```

**Filtro de listagem (`GET`):** `?reason_type=`.

---

## Templates de Funil (Funnel Templates)

`/api/v1/accounts/:account_id/funnel_templates`

| Método | Endpoint                | Ação               | Controller#action          |
| ------ | ----------------------- | ------------------ | -------------------------- |
| GET    | `/funnel_templates`     | Listar templates   | `funnel_templates#index`   |
| POST   | `/funnel_templates`     | Criar template     | `funnel_templates#create`  |
| GET    | `/funnel_templates/:id` | Exibir template    | `funnel_templates#show`    |
| PATCH  | `/funnel_templates/:id` | Atualizar template | `funnel_templates#update`  |
| DELETE | `/funnel_templates/:id` | Remover template   | `funnel_templates#destroy` |

**Parâmetros do body (`POST`/`PATCH`):**

```json
{
  "funnel_template": {
    "name": "Pipeline Comercial",
    "description": "Template padrão para vendas",
    "is_active": true,
    "stages": [
      { "name": "Prospecção", "color": "#6B7280", "order": 1 },
      { "name": "Qualificação", "color": "#F59E0B", "order": 2 },
      { "name": "Proposta", "color": "#8B5CF6", "order": 3 },
      { "name": "Fechamento", "color": "#10B981", "order": 4 }
    ]
  }
}
```

---

## Templates de Item (Item Templates)

`/api/v1/accounts/:account_id/item_templates`

| Método | Endpoint              | Ação               | Controller#action        |
| ------ | --------------------- | ------------------ | ------------------------ |
| GET    | `/item_templates`     | Listar templates   | `item_templates#index`   |
| POST   | `/item_templates`     | Criar template     | `item_templates#create`  |
| GET    | `/item_templates/:id` | Exibir template    | `item_templates#show`    |
| PATCH  | `/item_templates/:id` | Atualizar template | `item_templates#update`  |
| DELETE | `/item_templates/:id` | Remover template   | `item_templates#destroy` |

**Filtro de listagem (`GET`):** `?funnel_id=`.

**Parâmetros do body (`POST`/`PATCH`):**

```json
{
  "item_template": {
    "title": "Licença Enterprise",
    "value": "1999.00",
    "funnel_id": 1
  }
}
```

---

## Configuração de Funil do Usuário

`/api/v1/accounts/:account_id/user_funnel_setting`

| Método | Endpoint               | Ação               | Controller#action             |
| ------ | ---------------------- | ------------------ | ----------------------------- |
| GET    | `/user_funnel_setting` | Obter configuração | `user_funnel_settings#show`   |
| PATCH  | `/user_funnel_setting` | Atualizar          | `user_funnel_settings#update` |

**Parâmetros do body (`PATCH`):**

```json
{
  "user_funnel_setting": {
    "default_funnel_id": 1
  }
}
```

---

## Endpoints Relacionados

### Regras de Automação (filtradas por pipeline)

`/api/v1/accounts/:account_id/automation_rules`

| Método | Endpoint                      | Ação      | Controller#action          |
| ------ | ----------------------------- | --------- | -------------------------- |
| GET    | `/automation_rules`           | Listar    | `automation_rules#index`   |
| POST   | `/automation_rules`           | Criar     | `automation_rules#create`  |
| GET    | `/automation_rules/:id`       | Exibir    | `automation_rules#show`    |
| PATCH  | `/automation_rules/:id`       | Atualizar | `automation_rules#update`  |
| DELETE | `/automation_rules/:id`       | Remover   | `automation_rules#destroy` |
| POST   | `/automation_rules/:id/clone` | Clonar    | `automation_rules#clone`   |

**Filtros de listagem (`GET`):** `?pipeline_id=`, `?pipeline_stage_id=`, `?stage_id=`, `?automation_type=`.

**Parâmetros do body (`POST`/`PATCH`):**

```json
{
  "name": "Mover card ao entrar no estágio",
  "description": "Automação de pipeline",
  "event_name": "pipeline_card_entered_stage",
  "active": true,
  "pipeline_id": 1,
  "pipeline_stage_id": 2,
  "automation_type": "pipeline_stage",
  "conditions": [
    {
      "attribute_key": "pipeline_id",
      "filter_operator": "equal_to",
      "query_operator": "AND",
      "custom_attribute_type": "",
      "values": ["1"]
    }
  ],
  "actions": [
    {
      "action_name": "move_to_pipeline_stage",
      "action_params": ["1:3"]
    }
  ]
}
```

### Campaign Blast Source Preview (origem pipeline)

`/api/v1/accounts/:account_id/campaigns/blasts/source_preview`

| Método | Endpoint          | Ação                               | Controller#action                       |
| ------ | ----------------- | ---------------------------------- | --------------------------------------- |
| POST   | `/source_preview` | Preview de contatos de um pipeline | `campaign_blast_source_previews#create` |

**Parâmetros do body (`POST`):**

```json
{
  "source_type": "pipeline",
  "source_config": {
    "pipeline_id": 1,
    "stage_ids": [2, 3]
  }
}
```

---
