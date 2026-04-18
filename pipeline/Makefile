.PHONY: help install pipeline scrape-wa acs-cache phase1 clean

help:
	@echo "WealthBridge Propensity Pipeline — make targets:"
	@echo "  make install        Install Python dependencies"
	@echo "  make pipeline       Run full pipeline (skip scrapers, use existing raw/)"
	@echo "  make scrape-wa      Pull WA data from data.wa.gov"
	@echo "  make acs-cache      (Re)build ACS zip-income cache"
	@echo "  make phase1         Train Phase 1 models (requires labels)"
	@echo "  make clean          Remove generated outputs (keep raw)"

install:
	pip install -r requirements.txt

pipeline:
	python src/orchestration/run_pipeline.py --skip-scrapers

scrape-wa:
	python src/scrapers/wa_dor_scraper.py --out data/raw --limit 25000 --target-counties-only

acs-cache:
	python src/enrichment/acs_zip_income.py --build-cache

phase1:
	@if [ -z "$$LABELS" ]; then \
	  echo "Usage: make phase1 LABELS=data/labels/engagement_export.csv"; exit 1; fi
	python src/modeling/phase1_logistic.py --features data/scored/scored_residential.csv \
	    --labels $$LABELS --segment Residential  --out data/models
	python src/modeling/phase1_logistic.py --features data/scored/scored_commercial.csv \
	    --labels $$LABELS --segment Commercial   --out data/models

clean:
	rm -rf data/scored/* data/enriched/* data/models/*
