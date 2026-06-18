from pydantic import BaseModel
from typing import List, Dict, Any

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

    # New analytics fields
    sparkline_data: Dict[str, List[int]] = {}
    trends: Dict[str, str] = {}
    activity_chart_data: List[Dict[str, Any]] = []
    calls_by_status: Dict[str, int] = {}
    recent_activities: List[Dict[str, Any]] = []
    top_campaigns: List[Dict[str, Any]] = []
    farming_insights: Dict[str, Any] = {}
