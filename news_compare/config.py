from dataclasses import dataclass
from pathlib import Path


@dataclass
class AppConfig:
    ollama_base_url: str = "http://localhost:11434"
    discovery_model: str = "llama3.1"
    analysis_model: str = "llama3.1"
    max_articles_per_agency: int = 100
    output_dir: Path = Path("news_compare/output")


DEFAULT_CONFIG = AppConfig()
