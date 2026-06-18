from pydantic import BaseModel

class DashboardStats(BaseModel):
    total_farmers: int
    calls_initiated: int
    calls_completed: int
    calls_failed: int
    total_responses: int
    today_calls: int
    today_responses: int
    total_campaigns: int = 0
    scheduled_campaigns: int = 0
    running_campaigns: int = 0
    completed_campaigns: int = 0
    failed_campaigns: int = 0
    total_farmers_contacted: int = 0
    total_calls_completed: int = 0
    total_responses_received: int = 0
