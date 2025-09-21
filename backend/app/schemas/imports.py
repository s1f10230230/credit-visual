from pydantic import BaseModel


class ImportSummary(BaseModel):
    processed: int
    ingested_messages: int
    transactions_created: int
    duplicates: int
    no_match: int
    errors: list[str]

    @property
    def success_ratio(self) -> float:
        if self.processed == 0:
            return 0.0
        return self.transactions_created / self.processed
