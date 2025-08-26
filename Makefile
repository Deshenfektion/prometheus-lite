COMPOSE ?= docker compose

.PHONY: help up down logs migrate provision seed admin test lint typecheck

help:
	@grep -E '^[a-z-]+:.*?##' $(MAKEFILE_LIST) | sed 's/:.*##/\t/' | expand -t24

up: ## Build and start the whole stack
	$(COMPOSE) up --build -d

down: ## Stop the stack and drop its volumes
	$(COMPOSE) down -v

logs: ## Follow logs from every service
	$(COMPOSE) logs -f --tail=100

migrate: ## Apply database migrations inside the api container
	$(COMPOSE) exec api node services/api/dist/db/migrate.js

provision: ## Register the targets declared in deploy/collector.docker.yaml
	npm run provision --workspace services/api

seed: ## Register the demo services and generate history
	npm run seed --workspace services/api

admin: ## Create the first admin user (EMAIL, PASSWORD required)
	npm run create-user --workspace services/api -- \
		--email $(EMAIL) --password $(PASSWORD) --name "$(or $(NAME),Admin)" --role ADMIN

test: ## Run every test suite
	npm test --workspaces --if-present
	cd services/collector && .venv/bin/pytest

lint: ## Lint every workspace
	npm run lint --workspaces --if-present
	cd services/collector && .venv/bin/ruff check src tests

typecheck: ## Typecheck every workspace
	npm run typecheck --workspaces --if-present
	cd services/collector && .venv/bin/mypy
