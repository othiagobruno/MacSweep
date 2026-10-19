.DEFAULT_GOAL := help
.PHONY: help install dev check build release open clean publish

VERSION := $(shell node -p "require('./package.json').version")
BUMP ?= patch
# notarytool keychain profile (xcrun notarytool store-credentials); empty skips notarization
NOTARY_PROFILE ?=

help: ## List available targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies from the lockfile
	npm ci

dev: ## Run the app in development mode
	npm run dev

check: ## Type-check, lint and test
	npm run check

build: ## Build renderer + main into dist/ and dist-electron/
	npm run build

release: check ## Build the release .dmg files (arm64 + x64) into release/ (NOTARY_PROFILE=... to notarize)
	APPLE_KEYCHAIN_PROFILE=$(NOTARY_PROFILE) npm run dist
	@echo "\nMacSweep $(VERSION) built:"
	@ls -1 release/*.dmg

open: ## Open the release/ folder in Finder
	open release

clean: ## Remove build outputs
	rm -rf dist dist-electron release

publish: ## Bump version (BUMP=patch|minor|major), tag and push — GitHub Actions builds the release
	@test -z "$$(git status --porcelain)" || (echo "Working tree is not clean" && exit 1)
	@test "$$(git branch --show-current)" = "main" || (echo "Publish from main" && exit 1)
	npm version $(BUMP) -m "chore: release v%s"
	git push --follow-tags
