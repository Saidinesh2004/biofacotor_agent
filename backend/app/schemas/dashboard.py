from pydantic import BaseModel

class DashboardStats(BaseModel):
    total_farmers: int
    calls_initiated: int
    calls_completed: int
    calls_failed: int
    total_responses: int
    today_calls: int
    today_responses: int
